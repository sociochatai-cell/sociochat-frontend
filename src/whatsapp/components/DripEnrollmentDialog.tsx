import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, UserPlus, FileSpreadsheet, Eye, AlertCircle, CheckCircle, Download, RefreshCw, X, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config';

interface VariableMapping {
  key: string;
  source: string;
  field?: string;
  value?: string;
  missing: boolean;
}

interface StepPreview {
  template_name: string;
  language: string;
  resolved: string[];
  mapping: VariableMapping[];
  missing_keys: string[];
}

interface ContactPreview {
  source: string;
  contact_id?: number;
  dataset_row_id?: number;
  phone: string;
  steps: StepPreview[];
}

interface VariableSchema {
  steps: Array<{
    step_order: number;
    template_name: string;
    variables: string[];
    field_names: string[];
    variable_count?: number;
    header_format?: string;
    variable_mapping?: Record<string, string>;  // {"1": "Name", "2": "Amount", ...}
    body_text?: string;
    header_text?: string;
    footer_text?: string;
  }>;
  union_field_names: string[];
}

interface Campaign {
  id: number;
  name: string;
  steps: Array<{
    step_order: number;
    template_name?: string;
    template_params?: Record<string, { source: string; value: string }>;
  }>;
}

interface Dataset {
  id: number;
  name: string;
  row_count: number;
  columns: string[];
}

interface SheetsPreview {
  success: boolean;
  headers: string[];
  preview_rows: Record<string, string>[];
  total_rows: number;
  sheet_names?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
  accountId: number;
  onEnrollmentComplete: () => void;
  defaultTab?: 'manual' | 'csv' | 'dataset' | 'sheets';
}

export function DripEnrollmentDialog({ open, onOpenChange, campaign, accountId, onEnrollmentComplete, defaultTab = 'manual' }: Props) {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'dataset' | 'sheets'>(defaultTab);

  // Variable schema for the campaign
  const [variableSchema, setVariableSchema] = useState<VariableSchema | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Manual enrollment
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualVariables, setManualVariables] = useState<Record<string, string>>({});
  const [enrolling, setEnrolling] = useState(false);

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [csvFallbackValues, setCsvFallbackValues] = useState<Record<string, string>>({});

  // Dataset selection
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [datasetRows, setDatasetRows] = useState<Record<string, string>[]>([]);
  const [datasetHeaders, setDatasetHeaders] = useState<string[]>([]);
  const [loadingDatasetRows, setLoadingDatasetRows] = useState(false);
  const [datasetColumnMapping, setDatasetColumnMapping] = useState<Record<string, string>>({});
  const [datasetFallbackValues, setDatasetFallbackValues] = useState<Record<string, string>>({});

  // Google Sheets
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [sheetsTab, setSheetsTab] = useState('');
  const [sheetsPreview, setSheetsPreview] = useState<SheetsPreview | null>(null);
  const [loadingSheetsPreview, setLoadingSheetsPreview] = useState(false);
  const [sheetsColumnMapping, setSheetsColumnMapping] = useState<Record<string, string>>({});
  const [importingSheets, setImportingSheets] = useState(false);
  const [sheetsFallbackValues, setSheetsFallbackValues] = useState<Record<string, string>>({});

  // Preview
  const [previews, setPreviews] = useState<ContactPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Live preview cycling through contacts (for CSV, Sheets, Dataset)
  const [livePreviewIndex, setLivePreviewIndex] = useState(0);
  const [sheetsLivePreviewIndex, setSheetsLivePreviewIndex] = useState(0);
  const [datasetLivePreviewIndex, setDatasetLivePreviewIndex] = useState(0);
  const [isLivePreviewPlaying, setIsLivePreviewPlaying] = useState(true);
  const livePreviewIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Static preview pagination (10 per page)
  const [staticPreviewPage, setStaticPreviewPage] = useState(0);
  const ROWS_PER_PAGE = 10;

  // Validation state
  const [skipIncompleteContacts, setSkipIncompleteContacts] = useState(true);

  // Validation results for each tab
  interface ValidationResult {
    totalContacts: number;
    validContacts: number;
    incompleteContacts: number;
    missingVariables: Array<{ rowIndex: number; phone: string; missingVars: string[] }>;
  }

  // Compute CSV validation
  const csvValidation = useMemo((): ValidationResult => {
    if (!variableSchema || csvData.length === 0) {
      return { totalContacts: 0, validContacts: 0, incompleteContacts: 0, missingVariables: [] };
    }

    const missingVariables: Array<{ rowIndex: number; phone: string; missingVars: string[] }> = [];

    csvData.forEach((row, idx) => {
      const missingVars: string[] = [];
      variableSchema.steps.forEach(step => {
        const varMapping = step.variable_mapping || {};
        for (let i = 1; i <= (step.variable_count || 0); i++) {
          const fieldKey = `step_${step.step_order}_var_${i}`;
          const alias = varMapping[String(i)] || `var_${i}`;
          const mappedColumn = columnMapping[fieldKey];
          const value = mappedColumn ? row[mappedColumn] : null;
          const fallbackValue = csvFallbackValues[fieldKey];

          if (!value && !fallbackValue) {
            missingVars.push(alias);
          }
        }
      });

      if (missingVars.length > 0) {
        const phoneCol = columnMapping['phone'];
        missingVariables.push({
          rowIndex: idx + 1,
          phone: phoneCol ? row[phoneCol] || 'Unknown' : 'Unknown',
          missingVars
        });
      }
    });

    return {
      totalContacts: csvData.length,
      validContacts: csvData.length - missingVariables.length,
      incompleteContacts: missingVariables.length,
      missingVariables
    };
  }, [csvData, variableSchema, columnMapping, csvFallbackValues]);

  // Compute Dataset validation
  const datasetValidation = useMemo((): ValidationResult => {
    if (!variableSchema || datasetRows.length === 0) {
      return { totalContacts: 0, validContacts: 0, incompleteContacts: 0, missingVariables: [] };
    }

    const missingVariables: Array<{ rowIndex: number; phone: string; missingVars: string[] }> = [];

    datasetRows.forEach((row, idx) => {
      const missingVars: string[] = [];
      variableSchema.steps.forEach(step => {
        const varMapping = step.variable_mapping || {};
        for (let i = 1; i <= (step.variable_count || 0); i++) {
          const fieldKey = `step_${step.step_order}_var_${i}`;
          const alias = varMapping[String(i)] || `var_${i}`;
          const mappedColumn = datasetColumnMapping[fieldKey];
          const value = mappedColumn ? row[mappedColumn] : null;
          const fallbackValue = datasetFallbackValues[fieldKey];

          if (!value && !fallbackValue) {
            missingVars.push(alias);
          }
        }
      });

      if (missingVars.length > 0) {
        const phoneCol = datasetColumnMapping['phone'];
        missingVariables.push({
          rowIndex: idx + 1,
          phone: phoneCol ? row[phoneCol] || 'Unknown' : 'Unknown',
          missingVars
        });
      }
    });

    return {
      totalContacts: datasetRows.length,
      validContacts: datasetRows.length - missingVariables.length,
      incompleteContacts: missingVariables.length,
      missingVariables
    };
  }, [datasetRows, variableSchema, datasetColumnMapping, datasetFallbackValues]);

  // Compute Sheets validation
  const sheetsValidation = useMemo((): ValidationResult => {
    if (!variableSchema || !sheetsPreview?.preview_rows?.length) {
      return { totalContacts: 0, validContacts: 0, incompleteContacts: 0, missingVariables: [] };
    }

    const missingVariables: Array<{ rowIndex: number; phone: string; missingVars: string[] }> = [];

    sheetsPreview.preview_rows.forEach((row, idx) => {
      const missingVars: string[] = [];
      variableSchema.steps.forEach(step => {
        const varMapping = step.variable_mapping || {};
        for (let i = 1; i <= (step.variable_count || 0); i++) {
          const fieldKey = `step_${step.step_order}_var_${i}`;
          const alias = varMapping[String(i)] || `var_${i}`;
          const mappedColumn = sheetsColumnMapping[fieldKey];
          const value = mappedColumn ? row[mappedColumn] : null;
          const fallbackValue = sheetsFallbackValues[fieldKey];

          if (!value && !fallbackValue) {
            missingVars.push(alias);
          }
        }
      });

      if (missingVars.length > 0) {
        const phoneCol = sheetsColumnMapping['phone'];
        missingVariables.push({
          rowIndex: idx + 1,
          phone: phoneCol ? row[phoneCol] || 'Unknown' : 'Unknown',
          missingVars
        });
      }
    });

    return {
      totalContacts: sheetsPreview.total_rows,
      validContacts: sheetsPreview.total_rows - missingVariables.length,
      incompleteContacts: missingVariables.length,
      missingVariables
    };
  }, [sheetsPreview, variableSchema, sheetsColumnMapping, sheetsFallbackValues]);

  // Check if enrollment is allowed (all variables have data or fallback)
  const canEnrollCsv = useMemo(() => {
    if (csvData.length === 0 || !columnMapping['phone']) return false;
    if (skipIncompleteContacts && csvValidation.validContacts > 0) return true;
    return csvValidation.incompleteContacts === 0;
  }, [csvData.length, columnMapping, csvValidation, skipIncompleteContacts]);

  const canEnrollDataset = useMemo(() => {
    if (datasetRows.length === 0 || !datasetColumnMapping['phone']) return false;
    if (skipIncompleteContacts && datasetValidation.validContacts > 0) return true;
    return datasetValidation.incompleteContacts === 0;
  }, [datasetRows.length, datasetColumnMapping, datasetValidation, skipIncompleteContacts]);

  const canEnrollSheets = useMemo(() => {
    if (!sheetsPreview?.preview_rows?.length || !sheetsColumnMapping['phone']) return false;
    if (skipIncompleteContacts && sheetsValidation.validContacts > 0) return true;
    return sheetsValidation.incompleteContacts === 0;
  }, [sheetsPreview, sheetsColumnMapping, sheetsValidation, skipIncompleteContacts]);

  // Live preview auto-cycling effect for CSV
  useEffect(() => {
    if (isLivePreviewPlaying && csvData.length > 0 && activeTab === 'csv') {
      livePreviewIntervalRef.current = setInterval(() => {
        setLivePreviewIndex(prev => (prev + 1) % csvData.length);
      }, 2000);
    }
    return () => {
      if (livePreviewIntervalRef.current) clearInterval(livePreviewIntervalRef.current);
    };
  }, [isLivePreviewPlaying, csvData.length, activeTab]);

  // Live preview auto-cycling effect for Sheets
  useEffect(() => {
    if (isLivePreviewPlaying && sheetsPreview?.preview_rows?.length && activeTab === 'sheets') {
      const interval = setInterval(() => {
        setSheetsLivePreviewIndex(prev => (prev + 1) % sheetsPreview.preview_rows.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLivePreviewPlaying, sheetsPreview?.preview_rows?.length, activeTab]);

  // Live preview auto-cycling effect for Dataset
  useEffect(() => {
    if (isLivePreviewPlaying && datasetRows.length > 0 && activeTab === 'dataset') {
      const interval = setInterval(() => {
        setDatasetLivePreviewIndex(prev => (prev + 1) % datasetRows.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLivePreviewPlaying, datasetRows.length, activeTab]);

  // Load variable schema when dialog opens
  useEffect(() => {
    if (open && campaign) {
      loadVariableSchema();
      loadDatasets();
      setActiveTab(defaultTab); // Reset to default tab when opening
    }
  }, [open, campaign, defaultTab]);

  async function loadVariableSchema() {
    if (!campaign) return;
    try {
      setLoadingSchema(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/variables`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setVariableSchema(data.schema);

        // Initialize manual variables - collect all variables across all steps
        const initialVars: Record<string, string> = {};

        // First add union_field_names (if any pre-defined)
        data.schema.union_field_names?.forEach((field: string) => {
          initialVars[field] = '';
        });

        // Then add numbered variables from each step's variable_count
        data.schema.steps?.forEach((step: any) => {
          const varCount = step.variable_count || 0;
          for (let i = 1; i <= varCount; i++) {
            const varKey = `${step.template_name}_var_${i}`;
            initialVars[varKey] = '';
          }
        });

        setManualVariables(initialVars);
      }
    } catch (err) {
      console.error('Failed to load variable schema:', err);
    } finally {
      setLoadingSchema(false);
    }
  }

  async function loadDatasets() {
    try {
      setLoadingDatasets(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/datasets?account_id=${accountId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setDatasets(data.datasets || []);
      }
    } catch (err) {
      console.error('Failed to load datasets:', err);
    } finally {
      setLoadingDatasets(false);
    }
  }

  async function loadDatasetRows(datasetId: number) {
    try {
      setLoadingDatasetRows(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/datasets/${datasetId}/rows?limit=50`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const rows = data.data || [];
        if (rows.length > 0) {
          // Extract headers from first row's data field
          const firstRow = rows[0];
          const headers = Object.keys(firstRow.data || {});
          setDatasetHeaders(headers);
          setDatasetRows(rows.map((r: any) => r.data || {}));

          // Auto-map columns
          autoMapColumns(headers, setDatasetColumnMapping);
        }
      }
    } catch (err) {
      console.error('Failed to load dataset rows:', err);
      toast.error('Failed to load dataset preview');
    } finally {
      setLoadingDatasetRows(false);
    }
  }

  async function loadSheetsPreview() {
    if (!sheetsUrl) return;
    try {
      setLoadingSheetsPreview(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/sheets/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sheet_url: sheetsUrl, sheet_name: sheetsTab })
      });
      const data = await res.json();
      if (data.success) {
        setSheetsPreview(data);
        // Auto-map columns
        autoMapColumns(data.headers || [], setSheetsColumnMapping);
      } else {
        toast.error(data.error || 'Failed to preview sheet');
      }
    } catch (err) {
      toast.error('Failed to preview Google Sheet');
    } finally {
      setLoadingSheetsPreview(false);
    }
  }

  function autoMapColumns(headers: string[], setMapping: (m: Record<string, string>) => void) {
    const autoMap: Record<string, string> = {};
    if (variableSchema) {
      headers.forEach(header => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader === 'phone' || lowerHeader === 'phone_number' || lowerHeader === 'mobile') {
          autoMap['phone'] = header;
        } else if (lowerHeader === 'name' || lowerHeader === 'first_name') {
          autoMap['name'] = header;
        } else {
          // Try matching by step order with actual variable name
          variableSchema.steps?.forEach(step => {
            const varMapping = step.variable_mapping || {};
            for (let i = 1; i <= (step.variable_count || 0); i++) {
              const varName = varMapping[String(i)]?.toLowerCase().replace(/\s+/g, '_') || `var_${i}`;
              if (lowerHeader === `step_${step.step_order}_${varName}` ||
                lowerHeader === `step_${step.step_order}_var_${i}` ||
                lowerHeader === varName) {
                autoMap[`step_${step.step_order}_var_${i}`] = header;
              }
            }
          });
        }
      });
    }
    setMapping(autoMap);
  }

  // Smart defaults based on variable name patterns
  function getSuggestedDefault(variableName: string): string {
    const lower = variableName.toLowerCase();

    // Name patterns
    if (lower.includes('name') || lower.includes('customer') || lower.includes('user')) {
      return 'Customer';
    }
    // Date patterns
    if (lower.includes('date') || lower.includes('day')) {
      return new Date().toLocaleDateString();
    }
    // Time patterns
    if (lower.includes('time')) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Link/URL patterns
    if (lower.includes('link') || lower.includes('url')) {
      return 'https://example.com';
    }
    // Order/ID patterns
    if (lower.includes('order') || lower.includes('id') || lower.includes('number')) {
      return 'N/A';
    }
    // Amount/Price patterns
    if (lower.includes('amount') || lower.includes('price') || lower.includes('total')) {
      return '0.00';
    }
    // OTP/Code patterns
    if (lower.includes('otp') || lower.includes('code') || lower.includes('pin')) {
      return '******';
    }
    // Product patterns
    if (lower.includes('product') || lower.includes('item')) {
      return 'Your Order';
    }
    // Address patterns
    if (lower.includes('address') || lower.includes('location')) {
      return 'Your Address';
    }
    // Company patterns
    if (lower.includes('company') || lower.includes('business')) {
      return 'Our Company';
    }

    return '';
  }

  // Get value with fallback - simple version for pre-extracted values
  function getValueWithFallback(
    value: string | null | undefined,
    fallbackValue?: string
  ): { value: string; source: 'data' | 'fallback' | 'missing' } {
    if (value && String(value).trim()) {
      return { value: String(value), source: 'data' };
    }
    if (fallbackValue && String(fallbackValue).trim()) {
      return { value: String(fallbackValue), source: 'fallback' };
    }
    return { value: '⚠ missing', source: 'missing' };
  }

  async function handleSheetsEnroll() {
    if (!campaign || !sheetsUrl || !sheetsPreview) {
      toast.error('Please preview the sheet first');
      return;
    }
    if (!sheetsColumnMapping['phone']) {
      toast.error('Please map the phone column');
      return;
    }

    try {
      setImportingSheets(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/import-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sheet_url: sheetsUrl,
          sheet_name: sheetsTab,
          phone_column: sheetsColumnMapping['phone'],
          column_mapping: sheetsColumnMapping,
          fallback_values: sheetsFallbackValues
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Enrolled ${data.enrolled} contacts from Google Sheet`);
        onEnrollmentComplete();
        resetForm();
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch (err) {
      toast.error('Google Sheets import failed');
    } finally {
      setImportingSheets(false);
    }
  }

  async function downloadSampleCSV() {
    if (!campaign) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/sample-csv`, {
        credentials: 'include'
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campaign_${campaign.id}_sample.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      toast.error('Failed to download sample CSV');
    }
  }

  async function loadPreview() {
    if (!campaign) return;
    try {
      setLoadingPreview(true);
      const params = new URLSearchParams({ limit: '10' });
      if (selectedDatasetId) {
        params.set('dataset_id', selectedDatasetId.toString());
      }
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/preview?${params}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPreviews(data.previews || []);
        setShowPreview(true);
      }
    } catch (err) {
      toast.error('Failed to load preview');
    } finally {
      setLoadingPreview(false);
    }
  }

  // Parse CSV file
  function handleCSVFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        toast.error('CSV must have at least a header row and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      setCsvHeaders(headers);

      // Auto-map columns that match variable names
      const autoMap: Record<string, string> = {};
      if (variableSchema) {
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader === 'phone' || lowerHeader === 'phone_number') {
            autoMap['phone'] = header;
          } else if (lowerHeader === 'name' || lowerHeader === 'first_name') {
            autoMap['name'] = header;
          } else {
            // Check for per-step variable format: step_N_var_M or step_N_VarName
            const stepVarMatch = lowerHeader.match(/^step_(\d+)_var_(\d+)$/);
            if (stepVarMatch) {
              autoMap[`step_${stepVarMatch[1]}_var_${stepVarMatch[2]}`] = header;
            } else {
              // Try matching by step order with actual variable name (e.g., step_1_Name, step_1_Amount)
              variableSchema.steps?.forEach(step => {
                const tplName = step.template_name?.toLowerCase() || '';
                const varMapping = step.variable_mapping || {};

                for (let i = 1; i <= (step.variable_count || 0); i++) {
                  const varName = varMapping[String(i)]?.toLowerCase().replace(/\s+/g, '_') || `var_${i}`;

                  // Match various patterns:
                  // - step_N_VarName (e.g., step_1_name, step_1_amount)
                  // - step_N_var_M (e.g., step_1_var_1)
                  // - template_name_var_M
                  // - template_name_VarName
                  if (lowerHeader === `step_${step.step_order}_${varName}` ||
                    lowerHeader === `step_${step.step_order}_var_${i}` ||
                    lowerHeader === `${tplName}_var_${i}` ||
                    lowerHeader === `${tplName}_${i}` ||
                    lowerHeader === `step${step.step_order}_var${i}` ||
                    lowerHeader === varName) {
                    autoMap[`step_${step.step_order}_var_${i}`] = header;
                  }
                }
              });

              // Legacy: Check if header matches any union field name
              variableSchema.union_field_names.forEach(field => {
                if (field.toLowerCase() === lowerHeader) {
                  autoMap[field] = header;
                }
              });
            }
          }
        });
      }
      setColumnMapping(autoMap);

      // Parse data rows (first 5 for preview)
      const dataRows: Record<string, string>[] = [];
      for (let i = 1; i < Math.min(lines.length, 6); i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });
        dataRows.push(row);
      }
      setCsvData(dataRows);
    };
    reader.readAsText(file);
  }

  async function handleManualEnroll() {
    if (!campaign || !manualPhone) {
      toast.error('Phone number is required');
      return;
    }

    try {
      setEnrolling(true);

      // Build per-step variables from manualVariables
      // Current format: {template_name_var_1: value, template_name_var_2: value}
      // Target format: {step_1: {1: value, 2: value}, step_2: {1: value, 2: value}}
      const perStepVariables: Record<string, Record<string, string>> = {};

      if (variableSchema?.steps) {
        variableSchema.steps.forEach(step => {
          const stepKey = `step_${step.step_order}`;
          const stepVars: Record<string, string> = {};

          // Get variables for this step
          const varCount = step.variable_count || 0;
          const varMapping = step.variable_mapping || {};

          for (let i = 1; i <= varCount; i++) {
            const varKey = `${step.template_name}_var_${i}`;
            const value = manualVariables[varKey];

            if (value) {
              // Priority: Use mapped name (e.g. "name") if available, else index (e.g. "1")
              // variable_mapping keys are strings "1", "2"
              const mappedKey = varMapping[String(i)] || String(i);
              stepVars[mappedKey] = value;
            }
          }

          // Only add if there are any variables
          if (Object.keys(stepVars).length > 0) {
            perStepVariables[stepKey] = stepVars;
          }
        });
      }

      // Also keep profile_data for backward compatibility (name, etc.)
      const profileData: Record<string, string> = {};
      if (manualName) profileData['name'] = manualName;

      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone_number: manualPhone,
          name: manualName,
          workspace_id: accountId,
          profile_data: profileData,
          per_step_variables: Object.keys(perStepVariables).length > 0 ? perStepVariables : undefined
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Contact enrolled successfully');
        onEnrollmentComplete();
        resetForm();
      } else {
        toast.error(data.error || 'Enrollment failed');
      }
    } catch (err) {
      toast.error('Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  async function handleCSVEnroll() {
    if (!campaign || !csvFile) {
      toast.error('Please select a CSV file');
      return;
    }

    if (!columnMapping['phone']) {
      toast.error('Please map the phone column');
      return;
    }

    try {
      setUploading(true);
      console.log('[DRIP] Sending column_mapping:', columnMapping);
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('column_mapping', JSON.stringify(columnMapping));
      formData.append('phone_column', columnMapping['phone'] || '');
      formData.append('fallback_values', JSON.stringify(csvFallbackValues));

      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/import-contacts`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Enrolled ${data.enrolled} contacts (${data.skipped} skipped)`);
        onEnrollmentComplete();
        resetForm();
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch (err) {
      toast.error('Import failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDatasetEnroll() {
    if (!campaign || !selectedDatasetId) {
      toast.error('Please select a dataset');
      return;
    }
    if (!datasetColumnMapping['phone']) {
      toast.error('Please map the phone column');
      return;
    }

    try {
      setEnrolling(true);
      const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaign.id}/enroll-dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          phone_column: datasetColumnMapping['phone'] || 'phone',
          name_column: datasetColumnMapping['name'] || 'name',
          column_mapping: datasetColumnMapping,
          fallback_values: datasetFallbackValues
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Enrolled ${data.enrolled} contacts (${data.skipped} skipped)`);
        onEnrollmentComplete();
        resetForm();
      } else {
        toast.error(data.error || 'Enrollment failed');
      }
    } catch (err) {
      toast.error('Enrollment failed');
    } finally {
      setEnrolling(false);
    }
  }

  function resetForm() {
    setManualPhone('');
    setManualName('');
    setManualVariables({});
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setSelectedDatasetId(null);
    setDatasetRows([]);
    setDatasetHeaders([]);
    setDatasetColumnMapping({});
    setSheetsUrl('');
    setSheetsTab('');
    setSheetsPreview(null);
    setSheetsColumnMapping({});
    setPreviews([]);
    setShowPreview(false);
  }

  const requiredFields = useMemo(() => {
    if (!variableSchema) return [];
    return ['phone', 'name', ...variableSchema.union_field_names];
  }, [variableSchema]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Enroll Contacts - {campaign?.name}
          </DialogTitle>
          <DialogDescription>
            Add contacts with personalized variables for each of the {campaign?.steps?.length || 0} templates.
            Each contact can have unique values for every template in the campaign.
          </DialogDescription>
        </DialogHeader>

        {loadingSchema ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="ml-2">Loading variable schema...</span>
          </div>
        ) : (
          <>
            {/* Variable Schema Summary */}
            {variableSchema && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-800 mb-2">📋 Per-Customer Personalization</h4>
                    <p className="text-xs text-blue-600 mb-3">
                      Each customer can have unique variable values for EACH template in the campaign
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline" className="bg-white">phone (required)</Badge>
                      <Badge variant="outline" className="bg-white">name</Badge>
                    </div>

                    {/* Per-step variable details */}
                    <div className="space-y-2">
                      {variableSchema.steps.filter(s => (s.variable_count || 0) > 0 || s.header_format).map(step => (
                        <div key={step.step_order} className="p-2 bg-white rounded border border-blue-100">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-xs">
                              Step {step.step_order}
                            </Badge>
                            <span className="text-sm font-medium text-gray-700">{step.template_name}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {step.header_format === 'IMAGE' && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                                📷 Image Header
                              </Badge>
                            )}
                            {(step.variable_count || 0) > 0 && (
                              <>
                                {Array.from({ length: step.variable_count || 0 }, (_, i) => (
                                  <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                                    {`{{${i + 1}}}`}
                                  </Badge>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {variableSchema.steps.every(s => !(s.variable_count || 0) && !s.header_format) && (
                        <p className="text-xs text-blue-600">No template variables required - just phone and name</p>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={downloadSampleCSV}>
                    <Download className="w-4 h-4 mr-1" />
                    Sample CSV
                  </Button>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Manual
                </TabsTrigger>
                <TabsTrigger value="csv" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  CSV
                </TabsTrigger>
                <TabsTrigger value="dataset" className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Dataset
                </TabsTrigger>
                <TabsTrigger value="sheets" className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Sheets
                </TabsTrigger>
              </TabsList>

              {/* Manual Entry Tab */}
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      value={manualPhone}
                      onChange={e => setManualPhone(e.target.value)}
                      placeholder="+1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      placeholder="Contact name"
                    />
                  </div>
                </div>

                {/* Per-step variable inputs - Personalized for this contact */}
                {variableSchema && variableSchema.steps.filter(s => (s.variable_count || 0) > 0 || s.header_format === 'IMAGE').length > 0 && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-emerald-200">
                    <h4 className="text-sm font-medium text-emerald-800 mb-3 flex items-center gap-2">
                      <span>🎯</span>
                      Personalized Variables (per template)
                    </h4>
                    <p className="text-xs text-emerald-600 mb-3">
                      Enter custom values for each template this contact will receive
                    </p>
                  </div>
                )}

                {variableSchema && variableSchema.steps.filter(s => (s.variable_count || 0) > 0 || s.header_format === 'IMAGE').map(step => (
                  <div key={step.step_order} className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-semibold">
                        Step {step.step_order}
                      </Badge>
                      <Label className="text-sm font-medium text-gray-700">{step.template_name}</Label>
                    </div>

                    {/* Image header upload for this step */}
                    {step.header_format === 'IMAGE' && (
                      <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <Label className="text-xs font-medium text-purple-700 mb-2 block">
                          📷 Image Header (optional for enrollment)
                        </Label>
                        <p className="text-xs text-purple-600">
                          Image headers are configured at the campaign step level, not per-contact.
                        </p>
                      </div>
                    )}

                    {/* Variable inputs for this step */}
                    {(step.variable_count || 0) > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: step.variable_count || 0 }, (_, i) => {
                          const varKey = `${step.template_name}_var_${i + 1}`;
                          const varName = step.variable_mapping?.[String(i + 1)] || `Variable ${i + 1}`;
                          return (
                            <div key={i} className="space-y-1">
                              <Label className="text-xs text-gray-600 flex items-center gap-1">
                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-mono">{`{{${varName}}}`}</span>
                              </Label>
                              <Input
                                value={manualVariables[varKey] || ''}
                                onChange={e => setManualVariables({ ...manualVariables, [varKey]: e.target.value })}
                                placeholder={`Enter ${varName}`}
                                className="h-9"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  onClick={handleManualEnroll}
                  disabled={enrolling || !manualPhone}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {enrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  Enroll Contact
                </Button>
              </TabsContent>

              {/* CSV Upload Tab */}
              <TabsContent value="csv" className="space-y-4 mt-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {csvFile ? csvFile.name : 'Click to upload CSV file'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Must contain: phone column + variable data columns
                    </p>
                  </label>
                </div>

                {csvHeaders.length > 0 && (
                  <>
                    {/* Column Mapping */}
                    <div className="border rounded-lg p-4 bg-gray-50 overflow-hidden">
                      <Label className="mb-3 block font-medium">Map CSV Columns to Variables</Label>

                      {/* Phone Column - Required */}
                      <div className="mb-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-red-600">Phone Column *</Label>
                          <Select
                            value={columnMapping['phone'] || ''}
                            onValueChange={v => setColumnMapping({ ...columnMapping, phone: v })}
                          >
                            <SelectTrigger className="h-9 max-w-xs">
                              <SelectValue placeholder="Select column" />
                            </SelectTrigger>
                            <SelectContent>
                              {csvHeaders.filter(h => h && h.trim()).map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Color Legend */}
                      <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs">
                        <span className="text-gray-500 font-medium">Preview Legend:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-emerald-200 animate-pulse-green"></span>
                          <span className="text-gray-600">Data from file</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-amber-200"></span>
                          <span className="text-gray-600">Using fallback</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-red-200 animate-pulse"></span>
                          <span className="text-gray-600">Missing (set fallback)</span>
                        </div>
                      </div>

                      {/* Per-step variable mappings with live preview */}
                      {variableSchema?.steps.filter(s => (s.variable_count || 0) > 0).map(step => {
                        const varMapping = step.variable_mapping || {};

                        // Get mapped variables for badge display
                        const getMappedVars = () => {
                          const mappedVars: string[] = [];
                          for (let i = 1; i <= (step.variable_count || 0); i++) {
                            const fieldKey = `step_${step.step_order}_var_${i}`;
                            const alias = varMapping[String(i)] || `var_${i}`;
                            const mappedColumn = columnMapping[fieldKey];
                            if (mappedColumn) {
                              mappedVars.push(`${alias}`);
                            }
                          }
                          return mappedVars;
                        };

                        const mappedVars = getMappedVars();
                        const currentContact = csvData[livePreviewIndex] || {};

                        return (
                          <div key={step.step_order} className="col-span-2 border-t pt-3 mt-2">
                            <div className="flex items-center justify-between mb-2">
                              <Label className="text-xs font-medium text-emerald-700">
                                Step {step.step_order}: {step.template_name}
                              </Label>
                              {mappedVars.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-500">Mapped:</span>
                                  {mappedVars.map((v, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700"
                                    >
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              {Array.from({ length: step.variable_count || 0 }, (_, i) => {
                                const fieldKey = `step_${step.step_order}_var_${i + 1}`;
                                const alias = varMapping[String(i + 1)] || `Variable ${i + 1}`;
                                const isMapped = !!columnMapping[fieldKey];
                                const hasFallback = !!csvFallbackValues[fieldKey];
                                const suggestedDefault = getSuggestedDefault(alias);

                                return (
                                  <div key={fieldKey} className="space-y-1.5 p-2 rounded-lg border bg-white">
                                    <Label className={`text-xs flex items-center gap-1 ${isMapped ? 'text-emerald-600 font-medium' : hasFallback ? 'text-amber-600' : 'text-gray-500'}`}>
                                      <span className="text-gray-400">{`{{${i + 1}}}`}</span>
                                      <span>{alias}</span>
                                      {isMapped && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                                      {!isMapped && hasFallback && <span className="text-xs text-amber-500">📋</span>}
                                    </Label>

                                    {/* Column mapping dropdown */}
                                    <Select
                                      value={columnMapping[fieldKey] || '__none__'}
                                      onValueChange={v => setColumnMapping({ ...columnMapping, [fieldKey]: v === '__none__' ? '' : v })}
                                    >
                                      <SelectTrigger className={`h-8 text-xs transition-all duration-300 ${isMapped ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200' : ''}`}>
                                        <SelectValue placeholder={`Map to ${alias}`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">-- None --</SelectItem>
                                        {csvHeaders.filter(h => h && h.trim()).map(h => (
                                          <SelectItem key={h} value={h}>{h}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {/* Fallback value input */}
                                    <div className="flex items-center gap-1">
                                      <Input
                                        className={`h-7 text-xs flex-1 ${hasFallback ? 'border-amber-300 bg-amber-50' : 'border-dashed'}`}
                                        placeholder={suggestedDefault || `Default if empty...`}
                                        value={csvFallbackValues[fieldKey] || ''}
                                        onChange={e => setCsvFallbackValues({ ...csvFallbackValues, [fieldKey]: e.target.value })}
                                      />
                                      {suggestedDefault && !csvFallbackValues[fieldKey] && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50"
                                          onClick={() => setCsvFallbackValues({ ...csvFallbackValues, [fieldKey]: suggestedDefault })}
                                        >
                                          Use "{suggestedDefault}"
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Live Template Preview - Cycles through contacts */}
                            <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-emerald-700">🔄 Live Preview</span>
                                  <Badge variant="outline" className="text-xs bg-white">
                                    Contact {livePreviewIndex + 1} of {csvData.length}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => setLivePreviewIndex(prev => prev === 0 ? csvData.length - 1 : prev - 1)}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => setIsLivePreviewPlaying(!isLivePreviewPlaying)}
                                  >
                                    {isLivePreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => setLivePreviewIndex(prev => (prev + 1) % csvData.length)}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Template Preview with Variable Values */}
                              <div className="bg-white rounded-md p-3 border shadow-sm space-y-3">
                                {/* Header if exists */}
                                {step.header_text && (
                                  <div className="border-b pb-2">
                                    <div className="text-xs text-gray-400 mb-1">Header</div>
                                    <div className="text-sm font-medium text-gray-700">
                                      {(() => {
                                        let text = step.header_text;
                                        for (let i = 1; i <= (step.variable_count || 0); i++) {
                                          const fieldKey = `step_${step.step_order}_var_${i}`;
                                          const mappedColumn = columnMapping[fieldKey];
                                          const value = mappedColumn ? currentContact[mappedColumn] : null;
                                          if (value) {
                                            text = text.replace(`{{${i}}}`, value);
                                          }
                                        }
                                        return text;
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* Body - Main template content */}
                                <div>
                                  <div className="text-xs text-gray-400 mb-1">Message</div>
                                  <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {(() => {
                                      let text = step.body_text || `Template: ${step.template_name}`;
                                      // Replace {{1}}, {{2}}, etc. with actual values
                                      for (let i = 1; i <= (step.variable_count || 0); i++) {
                                        const fieldKey = `step_${step.step_order}_var_${i}`;
                                        const mappedColumn = columnMapping[fieldKey];
                                        const value = mappedColumn ? currentContact[mappedColumn] : null;
                                        const alias = varMapping[String(i)] || `var_${i}`;
                                        const fallbackValue = csvFallbackValues[fieldKey];

                                        // Get value with fallback logic
                                        const { value: displayValue, source } = getValueWithFallback(value, fallbackValue);

                                        // Replace the placeholder with styled value or placeholder text
                                        const placeholder = `{{${i}}}`;
                                        // Use markers to indicate source: ⟦value|source⟧
                                        text = text.replace(placeholder, `⟦${displayValue}|${source}⟧`);

                                        // Also replace named alias if exists (e.g. {{name}})
                                        if (alias && alias !== String(i)) {
                                          // Escape special regex chars in alias just in case
                                          const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                          text = text.replace(new RegExp(`{{${escapedAlias}}}`, 'g'), `⟦${displayValue}|${source}⟧`);
                                        }
                                      }

                                      // Now render with highlights based on source
                                      const segments = text.split(/⟦|⟧/);
                                      return segments.map((segment, idx) => {
                                        // Odd indices are the values (between ⟦ and ⟧)
                                        if (idx % 2 === 1) {
                                          const [displayValue, source] = segment.split('|');

                                          if (source === 'data') {
                                            // Green glow - data from CSV
                                            return (
                                              <span
                                                key={`${livePreviewIndex}-${idx}`}
                                                className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium animate-pulse-green mx-0.5"
                                              >
                                                {displayValue}
                                              </span>
                                            );
                                          } else if (source === 'fallback') {
                                            // Amber glow - using fallback value
                                            return (
                                              <span
                                                key={`${livePreviewIndex}-${idx}`}
                                                className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium animate-shimmer-amber mx-0.5"
                                                title="Using fallback value"
                                              >
                                                {displayValue}
                                              </span>
                                            );
                                          } else {
                                            // Red glow - missing, no fallback
                                            return (
                                              <span
                                                key={`${livePreviewIndex}-${idx}`}
                                                className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium animate-shimmer-red mx-0.5"
                                                title="Missing: no mapping or fallback"
                                              >
                                                {displayValue}
                                              </span>
                                            );
                                          }
                                        }
                                        return <span key={idx}>{segment}</span>;
                                      });
                                    })()}
                                  </div>
                                </div>

                                {/* Footer if exists */}
                                {step.footer_text && (
                                  <div className="border-t pt-2">
                                    <div className="text-xs text-gray-400 mb-1">Footer</div>
                                    <div className="text-xs text-gray-500">{step.footer_text}</div>
                                  </div>
                                )}

                                {/* Variable mapping summary */}
                                <div className="border-t pt-2 mt-2">
                                  <div className="text-xs text-gray-400 mb-1">Variable Status</div>
                                  <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: step.variable_count || 0 }, (_, i) => {
                                      const fieldKey = `step_${step.step_order}_var_${i + 1}`;
                                      const alias = varMapping[String(i + 1)] || `var_${i + 1}`;
                                      const mappedColumn = columnMapping[fieldKey];
                                      const value = mappedColumn ? currentContact[mappedColumn] : null;
                                      const fallbackValue = csvFallbackValues[fieldKey];
                                      const { value: displayValue, source } = getValueWithFallback(value, fallbackValue);

                                      return (
                                        <div key={i} className="text-xs flex items-center gap-1">
                                          <span className="text-gray-400">{`{{${i + 1}}}`}</span>
                                          <span className="text-gray-500">{alias}:</span>
                                          {source === 'data' ? (
                                            <span className="text-emerald-700 font-medium bg-emerald-50 px-1 rounded">
                                              ✓ {displayValue}
                                            </span>
                                          ) : source === 'fallback' ? (
                                            <span className="text-amber-700 font-medium bg-amber-50 px-1 rounded" title="Using fallback">
                                              ⚡ {displayValue}
                                            </span>
                                          ) : (
                                            <span className="text-red-600 font-medium bg-red-50 px-1 rounded animate-pulse">
                                              ⚠ missing
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Static CSV Preview with Pagination */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                        <span className="text-sm font-medium">
                          All Contacts ({csvData.length} total)
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Showing {staticPreviewPage * ROWS_PER_PAGE + 1}-{Math.min((staticPreviewPage + 1) * ROWS_PER_PAGE, csvData.length)} of {csvData.length}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setStaticPreviewPage(prev => Math.max(0, prev - 1))}
                            disabled={staticPreviewPage === 0}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setStaticPreviewPage(prev => Math.min(Math.ceil(csvData.length / ROWS_PER_PAGE) - 1, prev + 1))}
                            disabled={(staticPreviewPage + 1) * ROWS_PER_PAGE >= csvData.length}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs w-10">#</TableHead>
                              {csvHeaders.filter(h => h && h.trim()).map(h => (
                                <TableHead key={h} className="text-xs whitespace-nowrap">
                                  {h}
                                  {columnMapping['phone'] === h && <Badge className="ml-1 text-xs">Phone</Badge>}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {csvData
                              .slice(staticPreviewPage * ROWS_PER_PAGE, (staticPreviewPage + 1) * ROWS_PER_PAGE)
                              .map((row, idx) => {
                                const actualIndex = staticPreviewPage * ROWS_PER_PAGE + idx;
                                return (
                                  <TableRow
                                    key={actualIndex}
                                    className={actualIndex === livePreviewIndex ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''}
                                  >
                                    <TableCell className="text-xs py-2 text-gray-400 font-mono">
                                      {actualIndex + 1}
                                    </TableCell>
                                    {csvHeaders.filter(h => h && h.trim()).map(h => (
                                      <TableCell key={h} className="text-xs py-2">
                                        {row[h] || '-'}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Validation Summary */}
                    {csvData.length > 0 && variableSchema && (
                      <div className={`rounded-lg p-4 border ${csvValidation.incompleteContacts === 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                        }`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {csvValidation.incompleteContacts === 0 ? (
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                            )}
                            <span className="font-medium text-sm">
                              {csvValidation.incompleteContacts === 0
                                ? 'All contacts ready to enroll'
                                : 'Some contacts have missing data'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-emerald-700 font-medium">✓ {csvValidation.validContacts} ready</span>
                            {csvValidation.incompleteContacts > 0 && (
                              <span className="text-amber-700 font-medium">⚠ {csvValidation.incompleteContacts} incomplete</span>
                            )}
                          </div>
                        </div>

                        {csvValidation.incompleteContacts > 0 && (
                          <>
                            <div className="flex items-center gap-2 mt-3">
                              <input
                                type="checkbox"
                                id="skipIncomplete"
                                checked={skipIncompleteContacts}
                                onChange={e => setSkipIncompleteContacts(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor="skipIncomplete" className="text-sm text-gray-700">
                                Skip incomplete contacts and enroll only {csvValidation.validContacts} valid contacts
                              </label>
                            </div>

                            {/* Show first few incomplete contacts */}
                            <details className="mt-3">
                              <summary className="text-xs text-amber-700 cursor-pointer hover:text-amber-800">
                                View incomplete contacts ({csvValidation.incompleteContacts})
                              </summary>
                              <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
                                {csvValidation.missingVariables.slice(0, 10).map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-gray-600 bg-white px-2 py-1 rounded">
                                    <span className="text-gray-400">Row {item.rowIndex}:</span>
                                    <span className="font-mono">{item.phone}</span>
                                    <span className="text-red-500">missing: {item.missingVars.join(', ')}</span>
                                  </div>
                                ))}
                                {csvValidation.missingVariables.length > 10 && (
                                  <div className="text-gray-500 italic">
                                    ...and {csvValidation.missingVariables.length - 10} more
                                  </div>
                                )}
                              </div>
                            </details>

                            {!skipIncompleteContacts && csvValidation.validContacts === 0 && (
                              <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                                ⚠️ All contacts have missing data. Please map columns or set fallback values for all variables.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={handleCSVEnroll}
                      disabled={uploading || !canEnrollCsv}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      {skipIncompleteContacts && csvValidation.incompleteContacts > 0
                        ? `Import & Enroll ${csvValidation.validContacts} Valid Contacts`
                        : 'Import & Enroll All'
                      }
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Dataset Tab */}
              <TabsContent value="dataset" className="space-y-4 mt-4">
                {loadingDatasets ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : datasets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No datasets available</p>
                    <p className="text-xs">Create a dataset first in the Datasets section</p>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-4 items-end">
                      <div className="flex-1 space-y-2">
                        <Label>Select Dataset</Label>
                        <Select
                          value={selectedDatasetId?.toString() || ''}
                          onValueChange={v => {
                            const id = v ? parseInt(v) : null;
                            setSelectedDatasetId(id);
                            if (id) loadDatasetRows(id);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a dataset" />
                          </SelectTrigger>
                          <SelectContent>
                            {datasets.map(ds => (
                              <SelectItem key={ds.id} value={ds.id.toString()}>
                                {ds.name} ({ds.row_count} contacts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedDatasetId && (
                        <Button
                          variant="outline"
                          onClick={() => loadDatasetRows(selectedDatasetId)}
                          disabled={loadingDatasetRows}
                        >
                          {loadingDatasetRows ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                      )}
                    </div>

                    {/* Dataset Preview */}
                    {loadingDatasetRows ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        <span className="text-sm text-gray-500">Loading dataset preview...</span>
                      </div>
                    ) : datasetRows.length > 0 && (
                      <>
                        {/* Column Mapping */}
                        <div className="border rounded-lg p-4 bg-gray-50">
                          <Label className="mb-3 block font-medium">Map Dataset Columns to Variables</Label>

                          {/* Color Legend */}
                          <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs mb-4">
                            <span className="text-gray-500 font-medium">Preview Legend:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-sm bg-emerald-200 animate-pulse-green"></span>
                              <span className="text-gray-600">Data from dataset</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-sm bg-amber-200"></span>
                              <span className="text-gray-600">Using fallback</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-3 h-3 rounded-sm bg-red-200 animate-pulse"></span>
                              <span className="text-gray-600">Missing (set fallback)</span>
                            </div>
                          </div>

                          {/* Phone Column - Required */}
                          <div className="mb-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-red-600">Phone Column *</Label>
                              <Select
                                value={datasetColumnMapping['phone'] || ''}
                                onValueChange={v => setDatasetColumnMapping({ ...datasetColumnMapping, phone: v })}
                              >
                                <SelectTrigger className="h-9 max-w-xs">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {datasetHeaders.map(h => (
                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Per-step variable mappings */}
                          {variableSchema?.steps.filter(s => (s.variable_count || 0) > 0).map(step => {
                            const varMapping = step.variable_mapping || {};
                            return (
                              <div key={step.step_order} className="border-t pt-3 mt-2">
                                <Label className="text-xs font-medium text-emerald-700 mb-2 block">
                                  Step {step.step_order}: {step.template_name}
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                  {Array.from({ length: step.variable_count || 0 }, (_, i) => {
                                    const fieldKey = `step_${step.step_order}_var_${i + 1}`;
                                    const alias = varMapping[String(i + 1)] || `Variable ${i + 1}`;
                                    const isMapped = !!datasetColumnMapping[fieldKey];
                                    const hasFallback = !!datasetFallbackValues[fieldKey];
                                    const suggestedDefault = getSuggestedDefault(alias);

                                    return (
                                      <div key={fieldKey} className="space-y-1">
                                        <Label className={`text-xs flex items-center gap-1 ${isMapped ? 'text-emerald-600' : hasFallback ? 'text-amber-600' : 'text-red-500'}`}>
                                          <span className="text-gray-400">{`{{${i + 1}}}`}</span>
                                          <span>{alias}</span>
                                          {isMapped ? (
                                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                                          ) : hasFallback ? (
                                            <span className="text-amber-500 text-xs">⚡</span>
                                          ) : (
                                            <AlertCircle className="w-3 h-3 text-red-400" />
                                          )}
                                        </Label>
                                        <Select
                                          value={datasetColumnMapping[fieldKey] || '__none__'}
                                          onValueChange={v => setDatasetColumnMapping({ ...datasetColumnMapping, [fieldKey]: v === '__none__' ? '' : v })}
                                        >
                                          <SelectTrigger className={`h-8 text-xs ${isMapped ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                                            <SelectValue placeholder={`Map to ${alias}`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="__none__">-- None --</SelectItem>
                                            {datasetHeaders.map(h => (
                                              <SelectItem key={h} value={h}>{h}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>

                                        {/* Fallback value input */}
                                        <div className="flex items-center gap-1">
                                          <Input
                                            type="text"
                                            placeholder={suggestedDefault ? `Default: ${suggestedDefault}` : 'Fallback if empty...'}
                                            value={datasetFallbackValues[fieldKey] || ''}
                                            onChange={e => setDatasetFallbackValues({ ...datasetFallbackValues, [fieldKey]: e.target.value })}
                                            className={`h-7 text-xs flex-1 ${hasFallback ? 'border-amber-300 bg-amber-50' : 'border-dashed border-gray-300'}`}
                                          />
                                          {suggestedDefault && !datasetFallbackValues[fieldKey] && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50"
                                              onClick={() => setDatasetFallbackValues({ ...datasetFallbackValues, [fieldKey]: suggestedDefault })}
                                            >
                                              Use
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Live Template Preview for this step */}
                                {datasetRows.length > 0 && (
                                  <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-emerald-700">🔄 Live Preview</span>
                                        <Badge variant="outline" className="text-xs bg-white">
                                          Row {datasetLivePreviewIndex + 1} of {datasetRows.length}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                          onClick={() => setDatasetLivePreviewIndex(prev => prev === 0 ? datasetRows.length - 1 : prev - 1)}>
                                          <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                          onClick={() => setIsLivePreviewPlaying(!isLivePreviewPlaying)}>
                                          {isLivePreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                          onClick={() => setDatasetLivePreviewIndex(prev => (prev + 1) % datasetRows.length)}>
                                          <ChevronRight className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Template Preview with resolved values */}
                                    <div className="bg-white rounded-md p-3 border shadow-sm">
                                      {step.header_text && (
                                        <div className="border-b pb-2 mb-2">
                                          <div className="text-xs text-gray-400 mb-1">Header</div>
                                          <div className="text-sm font-medium text-gray-700">
                                            {(() => {
                                              let text = step.header_text;
                                              const currentRow = datasetRows[datasetLivePreviewIndex] || {};
                                              for (let vi = 1; vi <= (step.variable_count || 0); vi++) {
                                                const fk = `step_${step.step_order}_var_${vi}`;
                                                const col = datasetColumnMapping[fk];
                                                const val = col ? currentRow[col] : null;
                                                if (val) text = text.replace(`{{${vi}}}`, String(val));
                                              }
                                              return text;
                                            })()}
                                          </div>
                                        </div>
                                      )}
                                      <div>
                                        <div className="text-xs text-gray-400 mb-1">Message</div>
                                        <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                          {(() => {
                                            let text = step.body_text || `Template: ${step.template_name}`;
                                            const currentRow = datasetRows[datasetLivePreviewIndex] || {};

                                            // Replace variables with markers that include source info
                                            for (let vi = 1; vi <= (step.variable_count || 0); vi++) {
                                              const fk = `step_${step.step_order}_var_${vi}`;
                                              const col = datasetColumnMapping[fk];
                                              const val = col ? currentRow[col] : null;
                                              const fallbackVal = datasetFallbackValues[fk];

                                              const { value: displayValue, source } = getValueWithFallback(val, fallbackVal);
                                              text = text.replace(`{{${vi}}}`, `⟦${displayValue}|${source}⟧`);

                                              // Also replace named alias if exists
                                              const alias = step.variable_mapping?.[String(vi)];
                                              if (alias && alias !== String(vi)) {
                                                const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                text = text.replace(new RegExp(`{{${escapedAlias}}}`, 'g'), `⟦${displayValue}|${source}⟧`);
                                              }
                                            }

                                            // Render with colored highlights based on source
                                            const segments = text.split(/⟦|⟧/);
                                            return segments.map((segment, idx) => {
                                              if (idx % 2 === 1) {
                                                const [displayValue, source] = segment.split('|');

                                                if (source === 'data') {
                                                  return (
                                                    <span key={`dataset-${datasetLivePreviewIndex}-${idx}`}
                                                      className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium animate-pulse-green mx-0.5">
                                                      {displayValue}
                                                    </span>
                                                  );
                                                } else if (source === 'fallback') {
                                                  return (
                                                    <span key={`dataset-${datasetLivePreviewIndex}-${idx}`}
                                                      className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium animate-shimmer-amber mx-0.5"
                                                      title="Using fallback value">
                                                      {displayValue}
                                                    </span>
                                                  );
                                                } else {
                                                  return (
                                                    <span key={`dataset-${datasetLivePreviewIndex}-${idx}`}
                                                      className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium animate-shimmer-red mx-0.5"
                                                      title="Missing: no mapping or fallback">
                                                      {displayValue}
                                                    </span>
                                                  );
                                                }
                                              }
                                              return <span key={idx}>{segment}</span>;
                                            });
                                          })()}
                                        </div>
                                      </div>
                                      {step.footer_text && (
                                        <div className="border-t pt-2 mt-2 text-xs text-gray-500">{step.footer_text}</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Dataset Preview Table */}
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-100 px-3 py-2">
                            <span className="text-sm font-medium">Dataset Preview ({datasetRows.length} rows shown)</span>
                          </div>
                          <div className="overflow-x-auto max-h-48">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs w-10">#</TableHead>
                                  {datasetHeaders.map(h => (
                                    <TableHead key={h} className="text-xs whitespace-nowrap">
                                      {h}
                                      {datasetColumnMapping['phone'] === h && <Badge className="ml-1 text-xs">Phone</Badge>}
                                    </TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {datasetRows.slice(0, 10).map((row, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="text-xs py-2 text-gray-400 font-mono">{idx + 1}</TableCell>
                                    {datasetHeaders.map(h => (
                                      <TableCell key={h} className="text-xs py-2">{row[h] || '-'}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        {/* Validation Summary */}
                        {datasetRows.length > 0 && variableSchema && (
                          <div className={`rounded-lg p-4 border ${datasetValidation.incompleteContacts === 0
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-amber-50 border-amber-200'
                            }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {datasetValidation.incompleteContacts === 0 ? (
                                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                                ) : (
                                  <AlertCircle className="w-5 h-5 text-amber-600" />
                                )}
                                <span className="font-medium text-sm">
                                  {datasetValidation.incompleteContacts === 0
                                    ? 'All contacts ready to enroll'
                                    : 'Some contacts have missing data'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-emerald-700 font-medium">✓ {datasetValidation.validContacts} ready</span>
                                {datasetValidation.incompleteContacts > 0 && (
                                  <span className="text-amber-700 font-medium">⚠ {datasetValidation.incompleteContacts} incomplete</span>
                                )}
                              </div>
                            </div>

                            {datasetValidation.incompleteContacts > 0 && (
                              <>
                                <div className="flex items-center gap-2 mt-3">
                                  <input
                                    type="checkbox"
                                    id="skipIncompleteDataset"
                                    checked={skipIncompleteContacts}
                                    onChange={e => setSkipIncompleteContacts(e.target.checked)}
                                    className="rounded border-gray-300"
                                  />
                                  <label htmlFor="skipIncompleteDataset" className="text-sm text-gray-700">
                                    Skip incomplete contacts and enroll only {datasetValidation.validContacts} valid contacts
                                  </label>
                                </div>

                                <details className="mt-3">
                                  <summary className="text-xs text-amber-700 cursor-pointer hover:text-amber-800">
                                    View incomplete contacts ({datasetValidation.incompleteContacts})
                                  </summary>
                                  <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
                                    {datasetValidation.missingVariables.slice(0, 10).map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-gray-600 bg-white px-2 py-1 rounded">
                                        <span className="text-gray-400">Row {item.rowIndex}:</span>
                                        <span className="font-mono">{item.phone}</span>
                                        <span className="text-red-500">missing: {item.missingVars.join(', ')}</span>
                                      </div>
                                    ))}
                                    {datasetValidation.missingVariables.length > 10 && (
                                      <div className="text-gray-500 italic">
                                        ...and {datasetValidation.missingVariables.length - 10} more
                                      </div>
                                    )}
                                  </div>
                                </details>

                                {!skipIncompleteContacts && datasetValidation.validContacts === 0 && (
                                  <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                                    ⚠️ All contacts have missing data. Please map columns or set fallback values.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        <Button
                          onClick={handleDatasetEnroll}
                          disabled={enrolling || !canEnrollDataset}
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          {enrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                          {skipIncompleteContacts && datasetValidation.incompleteContacts > 0
                            ? `Enroll ${datasetValidation.validContacts} Valid Contacts`
                            : 'Enroll All from Dataset'
                          }
                        </Button>
                      </>
                    )}

                    {selectedDatasetId && datasetRows.length === 0 && !loadingDatasetRows && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        <p>No rows in this dataset or failed to load preview.</p>
                        <Button variant="link" onClick={() => loadDatasetRows(selectedDatasetId)}>
                          Try again
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Google Sheets Tab */}
              <TabsContent value="sheets" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Google Sheet URL *</Label>
                      <Input
                        value={sheetsUrl}
                        onChange={e => setSheetsUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sheet Tab Name (optional)</Label>
                      <Input
                        value={sheetsTab}
                        onChange={e => setSheetsTab(e.target.value)}
                        placeholder="Sheet1"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={loadSheetsPreview}
                      disabled={!sheetsUrl || loadingSheetsPreview}
                    >
                      {loadingSheetsPreview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                      Preview Sheet
                    </Button>
                  </div>

                  {/* Sheets Preview */}
                  {sheetsPreview && (
                    <>
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-sm font-medium text-green-800">
                          ✓ Sheet loaded: {sheetsPreview.total_rows} rows, {sheetsPreview.headers?.length} columns
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Columns: {sheetsPreview.headers?.join(', ')}
                        </div>
                      </div>

                      {/* Column Mapping */}
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <Label className="mb-3 block font-medium">Map Sheet Columns to Variables</Label>

                        {/* Color Legend */}
                        <div className="bg-white rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs mb-4 border">
                          <span className="text-gray-500 font-medium">Preview Legend:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-emerald-200 animate-pulse-green"></span>
                            <span className="text-gray-600">Data from sheet</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-amber-200"></span>
                            <span className="text-gray-600">Using fallback</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-red-200 animate-pulse"></span>
                            <span className="text-gray-600">Missing (set fallback)</span>
                          </div>
                        </div>

                        {/* Phone Column - Required */}
                        <div className="mb-4">
                          <div className="space-y-1">
                            <Label className="text-xs text-red-600">Phone Column *</Label>
                            <Select
                              value={sheetsColumnMapping['phone'] || ''}
                              onValueChange={v => setSheetsColumnMapping({ ...sheetsColumnMapping, phone: v })}
                            >
                              <SelectTrigger className="h-9 max-w-xs">
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                {sheetsPreview.headers?.filter(h => h && h.trim()).map(h => (
                                  <SelectItem key={h} value={h}>{h}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Per-step variable mappings */}
                        {variableSchema?.steps.filter(s => (s.variable_count || 0) > 0).map(step => {
                          const varMapping = step.variable_mapping || {};
                          return (
                            <div key={step.step_order} className="border-t pt-3 mt-2">
                              <Label className="text-xs font-medium text-emerald-700 mb-2 block">
                                Step {step.step_order}: {step.template_name}
                              </Label>
                              <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: step.variable_count || 0 }, (_, i) => {
                                  const fieldKey = `step_${step.step_order}_var_${i + 1}`;
                                  const alias = varMapping[String(i + 1)] || `Variable ${i + 1}`;
                                  const isMapped = !!sheetsColumnMapping[fieldKey];
                                  const hasFallback = !!sheetsFallbackValues[fieldKey];
                                  const suggestedDefault = getSuggestedDefault(alias);

                                  return (
                                    <div key={fieldKey} className="space-y-1">
                                      <Label className={`text-xs flex items-center gap-1 ${isMapped ? 'text-emerald-600' : hasFallback ? 'text-amber-600' : 'text-red-500'}`}>
                                        <span className="text-gray-400">{`{{${i + 1}}}`}</span>
                                        <span>{alias}</span>
                                        {isMapped ? (
                                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                                        ) : hasFallback ? (
                                          <span className="text-amber-500 text-xs">⚡</span>
                                        ) : (
                                          <AlertCircle className="w-3 h-3 text-red-400" />
                                        )}
                                      </Label>
                                      <Select
                                        value={sheetsColumnMapping[fieldKey] || '__none__'}
                                        onValueChange={v => setSheetsColumnMapping({ ...sheetsColumnMapping, [fieldKey]: v === '__none__' ? '' : v })}
                                      >
                                        <SelectTrigger className={`h-8 text-xs ${isMapped ? 'border-emerald-400 bg-emerald-50' : ''}`}>
                                          <SelectValue placeholder={`Map to ${alias}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">-- None --</SelectItem>
                                          {sheetsPreview.headers?.filter(h => h && h.trim()).map(h => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>

                                      {/* Fallback value input */}
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="text"
                                          placeholder={suggestedDefault ? `Default: ${suggestedDefault}` : 'Fallback if empty...'}
                                          value={sheetsFallbackValues[fieldKey] || ''}
                                          onChange={e => setSheetsFallbackValues({ ...sheetsFallbackValues, [fieldKey]: e.target.value })}
                                          className={`h-7 text-xs flex-1 ${hasFallback ? 'border-amber-300 bg-amber-50' : 'border-dashed border-gray-300'}`}
                                        />
                                        {suggestedDefault && !sheetsFallbackValues[fieldKey] && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-50"
                                            onClick={() => setSheetsFallbackValues({ ...sheetsFallbackValues, [fieldKey]: suggestedDefault })}
                                          >
                                            Use
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Live Template Preview for this step */}
                              {sheetsPreview.preview_rows && sheetsPreview.preview_rows.length > 0 && (
                                <div className="mt-3 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-emerald-700">🔄 Live Preview</span>
                                      <Badge variant="outline" className="text-xs bg-white">
                                        Row {sheetsLivePreviewIndex + 1} of {sheetsPreview.preview_rows.length}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                        onClick={() => setSheetsLivePreviewIndex(prev => prev === 0 ? sheetsPreview.preview_rows!.length - 1 : prev - 1)}>
                                        <ChevronLeft className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                        onClick={() => setIsLivePreviewPlaying(!isLivePreviewPlaying)}>
                                        {isLivePreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                        onClick={() => setSheetsLivePreviewIndex(prev => (prev + 1) % sheetsPreview.preview_rows!.length)}>
                                        <ChevronRight className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Template Preview with resolved values */}
                                  <div className="bg-white rounded-md p-3 border shadow-sm">
                                    {step.header_text && (
                                      <div className="border-b pb-2 mb-2">
                                        <div className="text-xs text-gray-400 mb-1">Header</div>
                                        <div className="text-sm font-medium text-gray-700">
                                          {(() => {
                                            let text = step.header_text;
                                            const currentRow = sheetsPreview.preview_rows![sheetsLivePreviewIndex] || {};
                                            for (let vi = 1; vi <= (step.variable_count || 0); vi++) {
                                              const fk = `step_${step.step_order}_var_${vi}`;
                                              const col = sheetsColumnMapping[fk];
                                              const val = col ? currentRow[col] : null;
                                              if (val) text = text.replace(`{{${vi}}}`, String(val));
                                            }
                                            return text;
                                          })()}
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-xs text-gray-400 mb-1">Message</div>
                                      <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                        {(() => {
                                          let text = step.body_text || `Template: ${step.template_name}`;
                                          const currentRow = sheetsPreview.preview_rows![sheetsLivePreviewIndex] || {};

                                          // Replace variables with markers that include source info
                                          for (let vi = 1; vi <= (step.variable_count || 0); vi++) {
                                            const fk = `step_${step.step_order}_var_${vi}`;
                                            const col = sheetsColumnMapping[fk];
                                            const val = col ? currentRow[col] : null;
                                            const fallbackVal = sheetsFallbackValues[fk];
                                            const aliasName = varMapping[String(vi)] || `var_${vi}`;

                                            const { value: displayValue, source } = getValueWithFallback(val, fallbackVal);
                                            text = text.replace(`{{${vi}}}`, `⟦${displayValue}|${source}⟧`);

                                            // Also replace named alias if exists
                                            if (aliasName && aliasName !== String(vi)) {
                                              const escapedAlias = aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                              text = text.replace(new RegExp(`{{${escapedAlias}}}`, 'g'), `⟦${displayValue}|${source}⟧`);
                                            }
                                          }

                                          // Render with colored highlights based on source
                                          const segments = text.split(/⟦|⟧/);
                                          return segments.map((segment, idx) => {
                                            if (idx % 2 === 1) {
                                              const [displayValue, source] = segment.split('|');

                                              if (source === 'data') {
                                                return (
                                                  <span key={`sheets-${sheetsLivePreviewIndex}-${idx}`}
                                                    className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium animate-pulse-green mx-0.5">
                                                    {displayValue}
                                                  </span>
                                                );
                                              } else if (source === 'fallback') {
                                                return (
                                                  <span key={`sheets-${sheetsLivePreviewIndex}-${idx}`}
                                                    className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium animate-shimmer-amber mx-0.5"
                                                    title="Using fallback value">
                                                    {displayValue}
                                                  </span>
                                                );
                                              } else {
                                                return (
                                                  <span key={`sheets-${sheetsLivePreviewIndex}-${idx}`}
                                                    className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium animate-shimmer-red mx-0.5"
                                                    title="Missing: no mapping or fallback">
                                                    {displayValue}
                                                  </span>
                                                );
                                              }
                                            }
                                            return <span key={idx}>{segment}</span>;
                                          });
                                        })()}
                                      </div>
                                    </div>
                                    {step.footer_text && (
                                      <div className="border-t pt-2 mt-2 text-xs text-gray-500">{step.footer_text}</div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Preview Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-3 py-2">
                          <span className="text-sm font-medium">Sheet Preview ({sheetsPreview.preview_rows?.length} of {sheetsPreview.total_rows} rows)</span>
                        </div>
                        <div className="overflow-x-auto max-h-48">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs w-10">#</TableHead>
                                {sheetsPreview.headers?.map(h => (
                                  <TableHead key={h} className="text-xs whitespace-nowrap">
                                    {h}
                                    {sheetsColumnMapping['phone'] === h && <Badge className="ml-1 text-xs">Phone</Badge>}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sheetsPreview.preview_rows?.slice(0, 10).map((row, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs py-2 text-gray-400 font-mono">{idx + 1}</TableCell>
                                  {sheetsPreview.headers?.map(h => (
                                    <TableCell key={h} className="text-xs py-2">{row[h] || '-'}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Validation Summary */}
                      {sheetsPreview.preview_rows && sheetsPreview.preview_rows.length > 0 && variableSchema && (
                        <div className={`rounded-lg p-4 border ${sheetsValidation.incompleteContacts === 0
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                          }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {sheetsValidation.incompleteContacts === 0 ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                              )}
                              <span className="font-medium text-sm">
                                {sheetsValidation.incompleteContacts === 0
                                  ? 'All contacts ready to enroll'
                                  : 'Some contacts have missing data'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-emerald-700 font-medium">✓ {sheetsValidation.validContacts} ready</span>
                              {sheetsValidation.incompleteContacts > 0 && (
                                <span className="text-amber-700 font-medium">⚠ {sheetsValidation.incompleteContacts} incomplete</span>
                              )}
                            </div>
                          </div>

                          {sheetsValidation.incompleteContacts > 0 && (
                            <>
                              <div className="flex items-center gap-2 mt-3">
                                <input
                                  type="checkbox"
                                  id="skipIncompleteSheets"
                                  checked={skipIncompleteContacts}
                                  onChange={e => setSkipIncompleteContacts(e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <label htmlFor="skipIncompleteSheets" className="text-sm text-gray-700">
                                  Skip incomplete contacts and enroll only {sheetsValidation.validContacts} valid contacts
                                </label>
                              </div>

                              <details className="mt-3">
                                <summary className="text-xs text-amber-700 cursor-pointer hover:text-amber-800">
                                  View incomplete contacts ({sheetsValidation.incompleteContacts})
                                </summary>
                                <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
                                  {sheetsValidation.missingVariables.slice(0, 10).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-gray-600 bg-white px-2 py-1 rounded">
                                      <span className="text-gray-400">Row {item.rowIndex}:</span>
                                      <span className="font-mono">{item.phone}</span>
                                      <span className="text-red-500">missing: {item.missingVars.join(', ')}</span>
                                    </div>
                                  ))}
                                  {sheetsValidation.missingVariables.length > 10 && (
                                    <div className="text-gray-500 italic">
                                      ...and {sheetsValidation.missingVariables.length - 10} more
                                    </div>
                                  )}
                                </div>
                              </details>

                              {!skipIncompleteContacts && sheetsValidation.validContacts === 0 && (
                                <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-700">
                                  ⚠️ All contacts have missing data. Please map columns or set fallback values.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={handleSheetsEnroll}
                        disabled={importingSheets || !canEnrollSheets}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                      >
                        {importingSheets ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                        {skipIncompleteContacts && sheetsValidation.incompleteContacts > 0
                          ? `Import & Enroll ${sheetsValidation.validContacts} Valid Contacts`
                          : 'Import & Enroll from Google Sheets'
                        }
                      </Button>
                    </>
                  )}

                  {!sheetsPreview && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs">
                      <p className="font-medium text-amber-700">⚠️ Setup Required:</p>
                      <ol className="list-decimal list-inside mt-1 text-amber-600 space-y-1">
                        <li>Ensure <code className="bg-amber-100 px-1 rounded">GOOGLE_SHEETS_CREDENTIALS_FILE</code> is configured in backend</li>
                        <li>Share your Google Sheet with the service account email</li>
                        <li>Click "Preview Sheet" to load and map columns</li>
                      </ol>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* Preview Panel */}
            {showPreview && previews.length > 0 && (
              <div className="border rounded-lg mt-4 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-800">Variable Preview ({previews.length} contacts)</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {previews.map((preview, pIdx) => (
                    <div key={pIdx} className="border-b last:border-b-0 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{preview.phone || 'No phone'}</Badge>
                        <span className="text-xs text-gray-500">
                          {preview.source === 'dataset' ? `Row #${preview.dataset_row_id}` : `Contact #${preview.contact_id}`}
                        </span>
                      </div>
                      <div className="grid gap-2">
                        {preview.steps.map((step, sIdx) => (
                          <div key={sIdx} className="pl-4 border-l-2 border-emerald-200">
                            <div className="text-xs font-medium text-emerald-700">
                              Step {sIdx + 1}: {step.template_name}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {step.mapping.map((m, mIdx) => (
                                <span
                                  key={mIdx}
                                  className={`text-xs px-2 py-0.5 rounded ${m.missing
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-700'
                                    }`}
                                >
                                  {m.field || `Var ${m.key}`}: {m.value || '-'}
                                </span>
                              ))}
                              {step.missing_keys.length > 0 && (
                                <span className="text-xs text-red-600 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Missing: {step.missing_keys.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
