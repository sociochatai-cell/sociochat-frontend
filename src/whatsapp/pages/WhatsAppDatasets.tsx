import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Plus, Database, Upload, ArrowLeft, Trash2, FileSpreadsheet, Users, Link2, Edit, CloudDownload, Settings, MessageCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').toString().replace(/\/$/, '');

const datasetFetchInit = (extra: RequestInit = {}): RequestInit => ({
    credentials: 'include',
    ...extra,
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        ...(extra.headers || {}),
    },
});

interface Dataset {
    id: number;
    name: string;
    description: string;
    columns: string[];
    column_mapping: Record<string, string>;
    source_type: string;
    source_config: Record<string, any>;
    last_sync_at: string | null;
    sync_status: string;
    sync_error: string | null;
    created_at: string;
    updated_at: string;
}

interface PreviewData {
    columns?: string[];
    headers?: string[];
    fields?: string[];
    preview_rows: Record<string, any>[];
    total_rows?: number;
    total_records?: number;
    sheet_names?: string[];
}

export default function WhatsAppDatasets() {
    const { toast } = useToast();
    const [workspaceId, setWorkspaceId] = useState<string | null>(getWorkspaceId());

    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loading, setLoading] = useState(false);

    // Create/Import Dialog State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createTab, setCreateTab] = useState<'manual' | 'csv' | 'sheets' | 'crm' | 'external' | 'contacts'>('manual');
    const [newName, setNewName] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [creating, setCreating] = useState(false);

    // CSV Import State
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<PreviewData | null>(null);
    const [csvColumnMapping, setCsvColumnMapping] = useState<Record<string, string>>({});
    const csvInputRef = useRef<HTMLInputElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    // Google Sheets Import State
    const [sheetUrl, setSheetUrl] = useState("");
    const [sheetName, setSheetName] = useState("Sheet1");
    const [sheetsPreview, setSheetsPreview] = useState<PreviewData | null>(null);
    const [sheetsColumnMapping, setSheetsColumnMapping] = useState<Record<string, string>>({});
    const [loadingSheetsPreview, setLoadingSheetsPreview] = useState(false);

    // CRM Import State
    const [crmSource, setCrmSource] = useState<'contacts' | 'leads'>('contacts');
    const [crmWorkspaceId, setCrmWorkspaceId] = useState(workspaceId || '');
    const [crmPreview, setCrmPreview] = useState<PreviewData | null>(null);
    const [crmColumnMapping, setCrmColumnMapping] = useState<Record<string, string>>({});
    const [loadingCrmPreview, setLoadingCrmPreview] = useState(false);

    // WhatsApp Contacts Import State
    const [contactsPreview, setContactsPreview] = useState<PreviewData | null>(null);
    const [loadingContactsPreview, setLoadingContactsPreview] = useState(false);
    const [contactsSelectedRows, setContactsSelectedRows] = useState<Set<number>>(new Set());

    // External CRM State
    const [externalCrm, setExternalCrm] = useState<'hubspot' | 'pipedrive' | 'sociovia'>('sociovia');
    const [externalApiKey, setExternalApiKey] = useState("");
    const [socioviaApiKey, setSocioviaApiKey] = useState("");
    const [socioviaCrmUrl, setSocioviaCrmUrl] = useState("https://sociovia-backend-362038465411.europe-west1.run.app");
    const [socioviaWorkspaceId, setSocioviaWorkspaceId] = useState("");
    const [socioviaDataType, setSocioviaDataType] = useState<'leads' | 'contacts' | 'deals'>('contacts');
    const [socioviaPreview, setSocioviaPreview] = useState<PreviewData | null>(null);
    const [loadingSocioviaPreview, setLoadingSocioviaPreview] = useState(false);

    // Selection State for Imports
    const [sheetsSelectedRows, setSheetsSelectedRows] = useState<Set<number>>(new Set());
    const [sheetsSelectedCols, setSheetsSelectedCols] = useState<Set<string>>(new Set());
    const [crmSelectedRows, setCrmSelectedRows] = useState<Set<number>>(new Set());
    const [crmSelectedCols, setCrmSelectedCols] = useState<Set<string>>(new Set());
    const [useDefaultColumns, setUseDefaultColumns] = useState(true);

    // Detail State
    const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
    const [datasetDetails, setDatasetDetails] = useState<any | null>(null);
    const [uploading, setUploading] = useState(false);
    const [allRows, setAllRows] = useState<any[]>([]);
    const [rowPage, setRowPage] = useState(1);
    const [totalRows, setTotalRows] = useState(0);

    // Manual Entry State
    const [isAddRowOpen, setIsAddRowOpen] = useState(false);
    const [newRowData, setNewRowData] = useState<Record<string, string>>({});
    const [editingRow, setEditingRow] = useState<any | null>(null);

    // Column Management State
    const [isManageColumnsOpen, setIsManageColumnsOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");


    useEffect(() => {
        const resolvedWorkspaceId = getWorkspaceId();
        if (resolvedWorkspaceId && resolvedWorkspaceId !== workspaceId) {
            setWorkspaceId(resolvedWorkspaceId);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (!workspaceId) return;
        fetchDatasets();
    }, [workspaceId]);

    // Auto-load sheets preview when URL changes (debounced)
    useEffect(() => {
        if (!sheetUrl || !sheetUrl.includes('docs.google.com/spreadsheets')) return;
        const timer = setTimeout(() => {
            handleSheetsPreview();
        }, 800);
        return () => clearTimeout(timer);
    }, [sheetUrl, sheetName]);

    // Auto-load CRM preview when CRM tab is selected
    useEffect(() => {
        if (createTab === 'crm' && crmWorkspaceId && !crmPreview && !loadingCrmPreview) {
            handleCrmPreview();
        }
    }, [createTab, crmWorkspaceId]);

    const fetchDatasets = async () => {
        if (!workspaceId) {
            toast({
                title: 'No workspace selected',
                description: 'Select a workspace from the dashboard before managing datasets.',
                variant: 'destructive',
            });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit()
            );
            const data = await res.json();
            if (data.success) {
                setDatasets(data.data);
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to load datasets', variant: 'destructive' });
            }
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Failed to load datasets', variant: 'destructive' });
        }
        finally { setLoading(false); }
    };

    // ========== CREATE HANDLERS ==========

    const handleCreateManual = async () => {
        if (!newName) return;
        setCreating(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                })
            );
            const data = await res.json();
            if (data.success) {
                toast({ title: "Dataset Created", description: "You can now add data manually or import." });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to create dataset", variant: "destructive" });
        }
        finally { setCreating(false); }
    };

    const handleCsvPreview = async (file: File) => {
        setCsvFile(file);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/csv/preview`,
                datasetFetchInit({ method: 'POST', body: formData })
            );
            const data = await res.json();
            if (data.success) {
                setCsvPreview(data);
                // Initialize column mapping with identity mapping
                const mapping: Record<string, string> = {};
                data.columns?.forEach((col: string) => { mapping[col] = col; });
                setCsvColumnMapping(mapping);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to preview CSV", variant: "destructive" });
        }
    };

    const handleCreateFromCsv = async () => {
        if (!newName || !csvFile) return;
        setCreating(true);
        try {
            // First create the dataset
            const createRes = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                })
            );
            const createData = await createRes.json();
            if (!createData.success) throw new Error(createData.error);

            // Then upload with mapping
            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('column_mapping', JSON.stringify(csvColumnMapping));
            formData.append('replace', 'true');

            const uploadRes = await fetch(
                `${API_BASE}/api/whatsapp/datasets/${createData.data.id}/upload-mapped`,
                datasetFetchInit({ method: 'POST', body: formData })
            );
            const uploadData = await uploadRes.json();
            if (uploadData.success) {
                toast({ title: "Dataset Created", description: `Imported ${uploadData.rows_added} rows from CSV.` });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Import Failed", description: uploadData.error, variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setCreating(false); }
    };

    const handleSheetsPreview = async () => {
        if (!sheetUrl) return;
        setLoadingSheetsPreview(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/sheets/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ sheet_url: sheetUrl, sheet_name: sheetName })
            });
            const data = await res.json();
            if (data.success) {
                setSheetsPreview(data);
                const mapping: Record<string, string> = {};
                data.headers?.forEach((col: string) => { mapping[col] = col; });
                setSheetsColumnMapping(mapping);
                // Auto-select all rows and columns
                const allRows = new Set<number>(data.preview_rows?.map((_: any, idx: number) => idx) || []);
                setSheetsSelectedRows(allRows);
                setSheetsSelectedCols(new Set(data.headers || []));
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to preview sheet", variant: "destructive" });
        } finally { setLoadingSheetsPreview(false); }
    };

    const handleCreateFromSheets = async () => {
        if (!newName || !sheetUrl) return;
        setCreating(true);
        try {
            // Create dataset
            const createRes = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                })
            );
            const createData = await createRes.json();
            if (!createData.success) throw new Error(createData.error);

            // Import from sheets
            const importRes = await fetch(`${API_BASE}/api/whatsapp/datasets/${createData.data.id}/import-sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ sheet_url: sheetUrl, sheet_name: sheetName, column_mapping: sheetsColumnMapping, replace: true })
            });
            const importData = await importRes.json();
            if (importData.success) {
                toast({ title: "Dataset Created", description: `Imported ${importData.rows_added} rows from Google Sheets.` });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Import Failed", description: importData.error, variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setCreating(false); }
    };

    const handleCrmPreview = async () => {
        if (!crmWorkspaceId) return;
        setLoadingCrmPreview(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/crm/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ source: crmSource, workspace_id: crmWorkspaceId })
            });
            const data = await res.json();
            if (data.success) {
                setCrmPreview(data);
                const mapping: Record<string, string> = {};
                data.fields?.forEach((col: string) => { mapping[col] = col; });
                setCrmColumnMapping(mapping);
                // Auto-select all rows and columns
                const allRows = new Set<number>(data.preview_rows?.map((_: any, idx: number) => idx) || []);
                setCrmSelectedRows(allRows);
                setCrmSelectedCols(new Set(data.fields || []));
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to preview CRM data", variant: "destructive" });
        } finally { setLoadingCrmPreview(false); }
    };

    const handleCreateFromCrm = async () => {
        if (!newName || !crmWorkspaceId) return;
        setCreating(true);
        try {
            // Create dataset
            const createRes = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                })
            );
            const createData = await createRes.json();
            if (!createData.success) throw new Error(createData.error);

            // Import from CRM
            const importRes = await fetch(`${API_BASE}/api/whatsapp/datasets/${createData.data.id}/import-crm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ source: crmSource, workspace_id: crmWorkspaceId, column_mapping: crmColumnMapping, replace: true })
            });
            const importData = await importRes.json();
            if (importData.success) {
                toast({ title: "Dataset Created", description: `Imported ${importData.rows_added} ${crmSource} from CRM.` });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Import Failed", description: importData.error, variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setCreating(false); }
    };

    const handleContactsPreview = async () => {
        if (!workspaceId) return;
        setLoadingContactsPreview(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/crm/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ source: 'whatsapp_contacts', workspace_id: workspaceId })
            });
            const data = await res.json();
            if (data.success) {
                setContactsPreview(data);
                // Auto-select all rows
                const allRows = new Set<number>(data.preview_rows?.map((_: any, idx: number) => idx) || []);
                setContactsSelectedRows(allRows);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to preview WhatsApp Contacts", variant: "destructive" });
        } finally { setLoadingContactsPreview(false); }
    };

    const handleCreateFromContacts = async () => {
        if (!newName || !workspaceId) return;
        setCreating(true);
        try {
            // Create dataset
            const createRes = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                })
            );
            const createData = await createRes.json();
            if (!createData.success) throw new Error(createData.error);

            // Import from WhatsApp Contacts
            const importRes = await fetch(`${API_BASE}/api/whatsapp/datasets/${createData.data.id}/import-crm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ source: 'whatsapp_contacts', workspace_id: workspaceId, replace: true })
            });
            const importData = await importRes.json();
            if (importData.success) {
                toast({ title: "Dataset Created", description: `Imported ${importData.rows_added} WhatsApp Contacts.` });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Import Failed", description: importData.error, variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setCreating(false); }
    };

    const handleCreateFromExternal = async () => {
        if (!newName || !externalApiKey) return;
        setCreating(true);
        try {
            // Create dataset
            const createRes = await fetch(
                `${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName, description: newDesc }),
                })
            );
            const createData = await createRes.json();
            if (!createData.success) throw new Error(createData.error);

            // Import from external CRM
            const endpoint = externalCrm === 'hubspot' ? 'import-hubspot' : 'import-pipedrive';
            const importRes = await fetch(`${API_BASE}/api/whatsapp/datasets/${createData.data.id}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ api_key: externalApiKey, replace: true })
            });
            const importData = await importRes.json();
            if (importData.success) {
                toast({ title: "Dataset Created", description: `Imported ${importData.rows_added} contacts from ${externalCrm}.` });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Import Failed", description: importData.error, variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setCreating(false); }
    };

    const handleSocioviaPreview = async () => {
        if (!socioviaCrmUrl || !socioviaWorkspaceId) return;
        setLoadingSocioviaPreview(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/crm/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ source: socioviaDataType, workspace_id: socioviaWorkspaceId, crm_url: socioviaCrmUrl })
            });
            const data = await res.json();
            if (data.success) {
                setSocioviaPreview(data);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to connect to Sociovia CRM", variant: "destructive" });
        } finally { setLoadingSocioviaPreview(false); }
    };

    const handleCreateFromSociovia = async () => {
        if (!newName || !socioviaCrmUrl || !socioviaWorkspaceId) return;
        if (!workspaceId) {
            toast({ title: "Error", description: "No workspace selected. Please select a workspace first.", variant: "destructive" });
            return;
        }
        setCreating(true);
        try {
            const createRes = await fetch(`${API_BASE}/api/whatsapp/workspaces/${workspaceId}/datasets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ name: newName, description: newDesc, source_type: 'sociovia' })
            });
            const createData = await createRes.json();
            console.log('Dataset creation response:', createData);
            if (!createData.success) throw new Error(createData.error || 'Failed to create dataset');

            const datasetId = createData.data?.id;
            if (!datasetId) {
                throw new Error('Dataset was created but no ID was returned. Please try again.');
            }

            const importRes = await fetch(`${API_BASE}/api/whatsapp/datasets/${datasetId}/import-sociovia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ crm_url: socioviaCrmUrl, workspace_id: socioviaWorkspaceId, data_type: socioviaDataType, replace: true })
            });
            const importData = await importRes.json();
            console.log('Sociovia import response:', importData);
            if (importData.success) {
                toast({ title: "Dataset Created", description: `Imported ${importData.rows_added} ${socioviaDataType} from Sociovia CRM.` });
                resetCreateDialog();
                fetchDatasets();
            } else {
                toast({ title: "Import Failed", description: importData.error, variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Error", description: e.message, variant: "destructive" });
        } finally { setCreating(false); }
    };

    const resetCreateDialog = () => {
        setIsCreateOpen(false);
        setCreateTab('manual');
        setNewName("");
        setNewDesc("");
        setCsvFile(null);
        setCsvPreview(null);
        setCsvColumnMapping({});
        setSheetUrl("");
        setSheetName("Sheet1");
        setSheetsPreview(null);
        setSheetsColumnMapping({});
        setCrmPreview(null);
        setCrmColumnMapping({});
        setContactsPreview(null);
        setContactsSelectedRows(new Set());
        setExternalApiKey("");
        setSocioviaCrmUrl("");
        setSocioviaWorkspaceId("");
        setSocioviaPreview(null);
    };

    // ========== DETAIL VIEW HANDLERS ==========

    const loadDatasetDetails = async (id: number) => {
        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/datasets/${id}`,
                datasetFetchInit()
            );
            const data = await res.json();
            if (data.success) {
                setDatasetDetails(data.data);
                setSelectedDataset(data.data);
                setTotalRows(data.data.total_rows || 0);
                loadRows(id, 1);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const loadRows = async (datasetId: number, page: number) => {
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/datasets/${datasetId}/rows?page=${page}&limit=50`,
                datasetFetchInit()
            );
            const data = await res.json();
            if (data.success) {
                setAllRows(data.data);
                setRowPage(page);
                if (data.pagination) {
                    setTotalRows(data.pagination.total);
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleAddRow = async () => {
        if (!selectedDataset) return;
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/rows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ data: newRowData })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Row Added" });
                setIsAddRowOpen(false);
                setNewRowData({});
                loadDatasetDetails(selectedDataset.id);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to add row", variant: "destructive" });
        }
    };

    const handleUpdateRow = async () => {
        if (!selectedDataset || !editingRow) return;
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/rows/${editingRow.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ data: editingRow.data })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Row Updated" });
                setEditingRow(null);
                loadRows(selectedDataset.id, rowPage);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to update row", variant: "destructive" });
        }
    };

    const handleDeleteRow = async (rowId: number) => {
        if (!selectedDataset) return;
        if (!confirm("Delete this row?")) return;
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/rows/${rowId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Row Deleted" });
                loadDatasetDetails(selectedDataset.id);
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to delete row", variant: "destructive" });
        }
    };

    // Column management handlers
    const handleAddColumn = async () => {
        if (!selectedDataset || !newColumnName.trim()) return;
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/columns`,
                datasetFetchInit({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ column_name: newColumnName.trim() }),
                })
            );
            const data = await res.json();
            if (data.success) {
                toast({ title: "Column Added", description: `Added column "${newColumnName}"` });
                setNewColumnName("");
                loadDatasetDetails(selectedDataset.id);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to add column", variant: "destructive" });
        }
    };

    const handleRemoveColumn = async (columnName: string) => {
        if (!selectedDataset) return;
        if (!confirm(`Remove column "${columnName}"? This will delete data from all rows.`)) return;
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/columns/${encodeURIComponent(columnName)}`,
                datasetFetchInit({ method: 'DELETE' })
            );
            const data = await res.json();
            if (data.success) {
                toast({ title: "Column Removed" });
                loadDatasetDetails(selectedDataset.id);
            } else {
                toast({ title: "Error", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to remove column", variant: "destructive" });
        }
    };

    const handleSyncDataset = async () => {
        if (!selectedDataset) return;
        setUploading(true);
        try {
            const endpoint = selectedDataset.source_type === 'google_sheets'
                ? `${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/sync-sheets`
                : null;

            if (!endpoint) {
                toast({ title: "Info", description: "This dataset doesn't support auto-sync. Re-import manually." });
                setUploading(false);
                return;
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ replace: true })
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Synced", description: `Updated with ${data.rows_added} rows.` });
                loadDatasetDetails(selectedDataset.id);
            } else {
                toast({ title: "Sync Failed", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Sync failed", variant: "destructive" });
        } finally { setUploading(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedDataset) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}/upload?replace=true`,
                datasetFetchInit({ method: 'POST', body: formData })
            );
            const data = await res.json();
            if (data.success) {
                toast({ title: "Upload Successful", description: `Added ${data.rows_added} rows.` });
                loadDatasetDetails(selectedDataset.id);
            } else {
                toast({ title: "Upload Failed", description: data.error, variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Upload failed", variant: "destructive" });
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleDeleteDataset = async () => {
        if (!selectedDataset) return;
        if (!confirm(`Delete dataset "${selectedDataset.name}" and all its rows?`)) return;
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/datasets/${selectedDataset.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: "Deleted" });
                setSelectedDataset(null);
                setDatasetDetails(null);
                fetchDatasets();
            }
        } catch (e) {
            toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
        }
    };

    const getSourceBadge = (sourceType: string) => {
        const badges: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
            manual: { label: "Manual", variant: "outline" },
            csv: { label: "CSV", variant: "secondary" },
            google_sheets: { label: "Google Sheets", variant: "default" },
            crm: { label: "CRM", variant: "default" },
            hubspot: { label: "HubSpot", variant: "default" },
            pipedrive: { label: "Pipedrive", variant: "default" },
            sociovia: { label: "Sociovia CRM", variant: "default" },
        };
        const badge = badges[sourceType] || { label: sourceType || "Unknown", variant: "outline" as const };
        return <Badge variant={badge.variant}>{badge.label}</Badge>;
    };

    if (!workspaceId) return <div className="p-8">Select a workspace</div>;

    // ========== DETAIL VIEW ==========
    if (selectedDataset && datasetDetails) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedDataset(null); setDatasetDetails(null); fetchDatasets(); }}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                {datasetDetails.name}
                                {getSourceBadge(datasetDetails.source_type)}
                            </h1>
                            <p className="text-muted-foreground">{datasetDetails.description}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleDeleteDataset}>
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Data ({totalRows} rows)</CardTitle>
                            <div className="flex items-center gap-2">
                                {/* Add Row Button */}
                                <Dialog open={isAddRowOpen} onOpenChange={setIsAddRowOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Plus className="h-4 w-4 mr-1" /> Add Row
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add New Row</DialogTitle>
                                        </DialogHeader>
                                        <div className="grid gap-3 py-4 max-h-[400px] overflow-y-auto">
                                            {(datasetDetails.columns || []).map((col: string) => (
                                                <div key={col} className="grid gap-1">
                                                    <Label>{col}</Label>
                                                    <Input
                                                        value={newRowData[col] || ''}
                                                        onChange={(e) => setNewRowData({ ...newRowData, [col]: e.target.value })}
                                                        placeholder={`Enter ${col}`}
                                                    />
                                                </div>
                                            ))}
                                            {(!datasetDetails.columns || datasetDetails.columns.length === 0) && (
                                                <>
                                                    <p className="text-sm text-muted-foreground">No columns defined. Add custom fields:</p>
                                                    <div className="grid gap-1">
                                                        <Label>Field Name</Label>
                                                        <Input placeholder="e.g. name, phone, email" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsAddRowOpen(false)}>Cancel</Button>
                                            <Button onClick={handleAddRow}>Add Row</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                {/* Manage Columns Dialog */}
                                <Dialog open={isManageColumnsOpen} onOpenChange={setIsManageColumnsOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                            <Settings className="h-4 w-4 mr-1" /> Manage Columns
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Manage Columns</DialogTitle>
                                            <DialogDescription>Add or remove columns from this dataset.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            {/* Add Column */}
                                            <div className="flex gap-2">
                                                <Input
                                                    value={newColumnName}
                                                    onChange={(e) => setNewColumnName(e.target.value)}
                                                    placeholder="New column name"
                                                    className="flex-1"
                                                />
                                                <Button onClick={handleAddColumn} disabled={!newColumnName.trim()}>
                                                    <Plus className="h-4 w-4 mr-1" /> Add
                                                </Button>
                                            </div>

                                            {/* Existing Columns */}
                                            <div className="space-y-2">
                                                <Label>Existing Columns ({datasetDetails.columns?.length || 0})</Label>
                                                <div className="border rounded p-2 space-y-2 max-h-48 overflow-y-auto">
                                                    {datasetDetails.columns?.map((col: string) => (
                                                        <div key={col} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                                                            <span className="text-sm">{col}</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRemoveColumn(col)}
                                                                className="h-7 text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {(!datasetDetails.columns || datasetDetails.columns.length === 0) && (
                                                        <p className="text-muted-foreground text-sm text-center py-4">No columns defined</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsManageColumnsOpen(false)}>Close</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                {/* Sync Button (for sheets) */}
                                {datasetDetails.source_type === 'google_sheets' && (
                                    <Button variant="outline" size="sm" onClick={handleSyncDataset} disabled={uploading}>
                                        <RefreshCw className={`h-4 w-4 mr-1 ${uploading ? 'animate-spin' : ''}`} /> Sync
                                    </Button>
                                )}

                                {/* Upload CSV */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={uploading}
                                    onClick={() => uploadInputRef.current?.click()}
                                >
                                    <Upload className="mr-1 h-4 w-4" />
                                    {uploading ? "Uploading..." : "Upload CSV"}
                                </Button>
                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                            </div>
                        </div>
                        <CardDescription>
                            Columns: {datasetDetails.columns?.join(", ") || "None"}
                            {datasetDetails.last_sync_at && (
                                <span className="ml-4">Last synced: {new Date(datasetDetails.last_sync_at).toLocaleString()}</span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[500px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        {datasetDetails.columns?.map((col: string) => (
                                            <TableHead key={col}>{col}</TableHead>
                                        ))}
                                        <TableHead className="w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allRows.map((row: any, idx: number) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="text-muted-foreground">{(rowPage - 1) * 50 + idx + 1}</TableCell>
                                            {datasetDetails.columns?.map((col: string) => (
                                                <TableCell key={col}>
                                                    {editingRow?.id === row.id ? (
                                                        <Input
                                                            value={editingRow.data[col] || ''}
                                                            onChange={(e) => setEditingRow({
                                                                ...editingRow,
                                                                data: { ...editingRow.data, [col]: e.target.value }
                                                            })}
                                                            className="h-8"
                                                        />
                                                    ) : (
                                                        row.data[col] || '-'
                                                    )}
                                                </TableCell>
                                            ))}
                                            <TableCell>
                                                {editingRow?.id === row.id ? (
                                                    <div className="flex gap-1">
                                                        <Button size="sm" variant="ghost" onClick={handleUpdateRow}>Save</Button>
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingRow(null)}>Cancel</Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1">
                                                        <Button size="sm" variant="ghost" onClick={() => setEditingRow({ ...row })}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="sm" variant="ghost" onClick={() => handleDeleteRow(row.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {allRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={(datasetDetails.columns?.length || 0) + 2} className="text-center py-8">
                                                No data yet. Add rows manually or import from a source.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>

                        {/* Pagination */}
                        {totalRows > 50 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={rowPage === 1}
                                    onClick={() => loadRows(selectedDataset.id, rowPage - 1)}
                                >
                                    Previous
                                </Button>
                                <span className="py-2 px-3 text-sm">
                                    Page {rowPage} of {Math.ceil(totalRows / 50)}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={rowPage >= Math.ceil(totalRows / 50)}
                                    onClick={() => loadRows(selectedDataset.id, rowPage + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ========== LIST VIEW ==========
    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="h-6 w-6 text-blue-600" /> Variable Datasets
                    </h1>
                    <p className="text-muted-foreground">Manage dynamic data sources for your flows and campaigns.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Dataset
                </Button>
            </div>

            {/* Create/Import Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) resetCreateDialog(); else setIsCreateOpen(true); }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Dataset</DialogTitle>
                        <DialogDescription>Choose how to create your dataset - manually, from CSV, Google Sheets, or your CRM.</DialogDescription>
                    </DialogHeader>

                    <Tabs value={createTab} onValueChange={(v) => setCreateTab(v as any)}>
                        <TabsList className="flex flex-wrap h-auto w-full bg-muted p-1">
                            <TabsTrigger value="manual" className="flex-1">
                                <Edit className="h-4 w-4 mr-1" /> Manual
                            </TabsTrigger>
                            <TabsTrigger value="csv">
                                <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
                            </TabsTrigger>
                            <TabsTrigger value="sheets">
                                <FileSpreadsheet className="h-4 w-4 mr-1" /> Sheets
                            </TabsTrigger>
                            <TabsTrigger value="contacts">
                                <MessageCircle className="h-4 w-4 mr-1" /> Contacts
                            </TabsTrigger>
                            <TabsTrigger value="crm">
                                <Users className="h-4 w-4 mr-1" /> CRM
                            </TabsTrigger>
                            <TabsTrigger value="external" className="flex-1">
                                <Link2 className="h-4 w-4 mr-1" /> External
                            </TabsTrigger>
                        </TabsList>

                        {/* Manual Creation */}
                        <TabsContent value="manual" className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dataset Name *</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Branch Locations" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description</Label>
                                    <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
                                <Button onClick={handleCreateManual} disabled={creating || !newName}>
                                    {creating ? "Creating..." : "Create Empty Dataset"}
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* CSV Import */}
                        <TabsContent value="csv" className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dataset Name *</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Customer List" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description</Label>
                                    <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>CSV File *</Label>
                                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                        <input
                                            ref={csvInputRef}
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            onChange={(e) => e.target.files?.[0] && handleCsvPreview(e.target.files[0])}
                                        />
                                        {csvFile ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <FileSpreadsheet className="h-5 w-5" />
                                                <span>{csvFile.name}</span>
                                                <Button variant="ghost" size="sm" onClick={() => { setCsvFile(null); setCsvPreview(null); }}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
                                                <Upload className="h-4 w-4 mr-2" /> Select CSV File
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* CSV Preview & Column Mapping */}
                                {csvPreview && (
                                    <div className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label>Column Mapping (rename columns)</Label>
                                            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-2 bg-muted/30 rounded">
                                                {csvPreview.columns?.map((col) => (
                                                    <div key={col} className="flex items-center gap-2">
                                                        <span className="text-sm w-1/2 truncate">{col} →</span>
                                                        <Input
                                                            className="h-8"
                                                            value={csvColumnMapping[col] || ''}
                                                            onChange={(e) => setCsvColumnMapping({ ...csvColumnMapping, [col]: e.target.value })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Preview: {csvPreview.preview_rows?.length} of {csvPreview.total_rows} rows
                                        </div>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
                                <Button onClick={handleCreateFromCsv} disabled={creating || !newName || !csvFile}>
                                    {creating ? "Importing..." : "Import from CSV"}
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* Google Sheets Import */}
                        <TabsContent value="sheets" className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dataset Name *</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Products" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Google Sheet URL *</Label>
                                    <Input
                                        value={sheetUrl}
                                        onChange={(e) => setSheetUrl(e.target.value)}
                                        placeholder="https://docs.google.com/spreadsheets/d/..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Share your sheet with: sql-sa@angular-sorter-473216-k8.iam.gserviceaccount.com
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Sheet Name</Label>
                                    <Select value={sheetName} onValueChange={setSheetName}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sheetsPreview?.sheet_names?.map((name) => (
                                                <SelectItem key={name} value={name}>{name}</SelectItem>
                                            )) || <SelectItem value="Sheet1">Sheet1</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" onClick={handleSheetsPreview} disabled={!sheetUrl || loadingSheetsPreview}>
                                    {loadingSheetsPreview ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-2" />}
                                    Preview Sheet
                                </Button>

                                {/* Sheets Preview */}
                                {sheetsPreview && (
                                    <div className="space-y-3 p-3 bg-muted/30 rounded">
                                        <div className="text-sm font-medium">Columns found: {sheetsPreview.headers?.join(", ")}</div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                Total rows: {sheetsPreview.total_rows} | Selected: {sheetsSelectedRows.size} rows, {sheetsSelectedCols.size} columns
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="defaultCols"
                                                    checked={useDefaultColumns}
                                                    onCheckedChange={(checked) => setUseDefaultColumns(!!checked)}
                                                />
                                                <Label htmlFor="defaultCols" className="text-xs">Default Columns</Label>
                                            </div>
                                        </div>

                                        {/* Column Selection (when custom columns mode) */}
                                        {!useDefaultColumns && sheetsPreview.headers && (
                                            <div className="flex flex-wrap gap-2 p-2 border rounded bg-muted/20">
                                                <span className="text-xs font-medium w-full mb-1">Select columns to import:</span>
                                                {sheetsPreview.headers.map((col: string) => (
                                                    <div key={col} className="flex items-center gap-1">
                                                        <Checkbox
                                                            id={`col-${col}`}
                                                            checked={sheetsSelectedCols.has(col)}
                                                            onCheckedChange={(checked) => {
                                                                const newSet = new Set(sheetsSelectedCols);
                                                                if (checked) newSet.add(col);
                                                                else newSet.delete(col);
                                                                setSheetsSelectedCols(newSet);
                                                            }}
                                                        />
                                                        <Label htmlFor={`col-${col}`} className="text-xs">{col}</Label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Preview Table with Row Selection */}
                                        {sheetsPreview.preview_rows && sheetsPreview.preview_rows.length > 0 && (
                                            <div className="border rounded overflow-hidden mt-2">
                                                <ScrollArea className="max-h-48">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-8">
                                                                    <Checkbox
                                                                        checked={sheetsSelectedRows.size === sheetsPreview.preview_rows.length}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) {
                                                                                setSheetsSelectedRows(new Set(sheetsPreview.preview_rows!.map((_, i) => i)));
                                                                            } else {
                                                                                setSheetsSelectedRows(new Set());
                                                                            }
                                                                        }}
                                                                    />
                                                                </TableHead>
                                                                {sheetsPreview.headers?.filter((h: string) => useDefaultColumns || sheetsSelectedCols.has(h)).map((header: string) => (
                                                                    <TableHead key={header} className="text-xs">{header}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {sheetsPreview.preview_rows.map((row: Record<string, any>, idx: number) => (
                                                                <TableRow key={idx} className={sheetsSelectedRows.has(idx) ? "bg-muted/30" : ""}>
                                                                    <TableCell className="w-8">
                                                                        <Checkbox
                                                                            checked={sheetsSelectedRows.has(idx)}
                                                                            onCheckedChange={(checked) => {
                                                                                const newSet = new Set(sheetsSelectedRows);
                                                                                if (checked) newSet.add(idx);
                                                                                else newSet.delete(idx);
                                                                                setSheetsSelectedRows(newSet);
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    {sheetsPreview.headers?.filter((h: string) => useDefaultColumns || sheetsSelectedCols.has(h)).map((header: string) => (
                                                                        <TableCell key={header} className="text-xs max-w-32 truncate">
                                                                            {row[header] || '-'}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
                                <Button onClick={handleCreateFromSheets} disabled={creating || !newName || !sheetUrl || sheetsSelectedRows.size === 0}>
                                    {creating ? "Importing..." : `Import ${sheetsSelectedRows.size} Rows`}
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* WhatsApp Contacts Import */}
                        <TabsContent value="contacts" className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dataset Name *</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. WhatsApp Customer List" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Description</Label>
                                    <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
                                </div>
                                <Button variant="outline" onClick={handleContactsPreview} disabled={loadingContactsPreview}>
                                    {loadingContactsPreview ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                                    Load WhatsApp Contacts
                                </Button>

                                {/* Contacts Preview */}
                                {contactsPreview && (
                                    <div className="space-y-3 p-3 bg-muted/30 rounded">
                                        <div className="text-sm font-medium">Fields: {contactsPreview.fields?.join(", ")}</div>
                                        <div className="text-sm text-muted-foreground">
                                            Total contacts: {contactsPreview.total_records} | Selected: {contactsSelectedRows.size} rows
                                        </div>

                                        {/* Preview Table with Row Selection */}
                                        {contactsPreview.preview_rows && contactsPreview.preview_rows.length > 0 && (
                                            <div className="border rounded overflow-hidden mt-2">
                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead className="w-8">
                                                                    <Checkbox
                                                                        checked={contactsSelectedRows.size === contactsPreview.preview_rows.length}
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) {
                                                                                setContactsSelectedRows(new Set(contactsPreview.preview_rows!.map((_, i) => i)));
                                                                            } else {
                                                                                setContactsSelectedRows(new Set());
                                                                            }
                                                                        }}
                                                                    />
                                                                </TableHead>
                                                                {contactsPreview.fields?.map((field: string) => (
                                                                    <TableHead key={field} className="text-xs">{field}</TableHead>
                                                                ))}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {contactsPreview.preview_rows.map((row: Record<string, any>, idx: number) => (
                                                                <TableRow key={idx} className={contactsSelectedRows.has(idx) ? "bg-muted/30" : ""}>
                                                                    <TableCell className="w-8">
                                                                        <Checkbox
                                                                            checked={contactsSelectedRows.has(idx)}
                                                                            onCheckedChange={(checked) => {
                                                                                const newSet = new Set(contactsSelectedRows);
                                                                                if (checked) newSet.add(idx);
                                                                                else newSet.delete(idx);
                                                                                setContactsSelectedRows(newSet);
                                                                            }}
                                                                        />
                                                                    </TableCell>
                                                                    {contactsPreview.fields?.map((field: string) => (
                                                                        <TableCell key={field} className="text-xs max-w-32 truncate">
                                                                            {row[field] || '-'}
                                                                        </TableCell>
                                                                    ))}
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
                                <Button onClick={handleCreateFromContacts} disabled={creating || !newName || contactsSelectedRows.size === 0}>
                                    {creating ? "Importing..." : `Import ${contactsSelectedRows.size} Contacts`}
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* CRM Import */}
                        <TabsContent value="crm" className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dataset Name *</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. CRM Contacts" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Import From</Label>
                                    <Select value={crmSource} onValueChange={(v) => setCrmSource(v as 'contacts' | 'leads')}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="contacts">CRM Contacts</SelectItem>
                                            <SelectItem value="leads">CRM Leads</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>CRM Workspace ID</Label>
                                    <Input
                                        value={crmWorkspaceId}
                                        onChange={(e) => setCrmWorkspaceId(e.target.value)}
                                        placeholder="Workspace ID"
                                    />
                                </div>
                                <Button variant="outline" onClick={handleCrmPreview} disabled={!crmWorkspaceId || loadingCrmPreview}>
                                    {loadingCrmPreview ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                                    Preview {crmSource}
                                </Button>

                                {/* CRM Preview */}
                                {crmPreview && (
                                    <div className="space-y-3 p-3 bg-muted/30 rounded">
                                        <div className="text-sm font-medium">Fields: {crmPreview.fields?.join(", ")}</div>
                                        <div className="text-sm text-muted-foreground">
                                            Total records: {crmPreview.total_records} | Selected: {crmSelectedRows.size} rows
                                        </div>

                                        {/* Preview Table with Row Selection */}
                                        {crmPreview.preview_rows && crmPreview.preview_rows.length > 0 && (
                                            <div className="border rounded mt-2 w-full h-[300px] overflow-auto">
                                                <Table className="min-w-max">
                                                    <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                                        <TableRow>
                                                            <TableHead className="w-8">
                                                                <Checkbox
                                                                    checked={crmSelectedRows.size === crmPreview.preview_rows.length}
                                                                    onCheckedChange={(checked) => {
                                                                        if (checked) {
                                                                            setCrmSelectedRows(new Set(crmPreview.preview_rows!.map((_, i) => i)));
                                                                        } else {
                                                                            setCrmSelectedRows(new Set());
                                                                        }
                                                                    }}
                                                                />
                                                            </TableHead>
                                                            {crmPreview.fields?.map((field: string) => (
                                                                <TableHead key={field} className="text-xs">{field}</TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {crmPreview.preview_rows.map((row: Record<string, any>, idx: number) => (
                                                            <TableRow key={idx} className={crmSelectedRows.has(idx) ? "bg-muted/30" : ""}>
                                                                <TableCell className="w-8">
                                                                    <Checkbox
                                                                        checked={crmSelectedRows.has(idx)}
                                                                        onCheckedChange={(checked) => {
                                                                            const newSet = new Set(crmSelectedRows);
                                                                            if (checked) newSet.add(idx);
                                                                            else newSet.delete(idx);
                                                                            setCrmSelectedRows(newSet);
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                {crmPreview.fields?.map((field: string) => (
                                                                    <TableCell key={field} className="text-xs max-w-32 truncate">
                                                                        {row[field] || '-'}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
                                <Button onClick={handleCreateFromCrm} disabled={creating || !newName || !crmWorkspaceId || crmSelectedRows.size === 0}>
                                    {creating ? "Importing..." : `Import ${crmSelectedRows.size} ${crmSource}`}
                                </Button>
                            </DialogFooter>
                        </TabsContent>

                        {/* External CRM Import */}
                        <TabsContent value="external" className="space-y-4 mt-4">
                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label>Dataset Name *</Label>
                                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sociovia Contacts" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>External CRM</Label>
                                    <Select value={externalCrm} onValueChange={(v) => { setExternalCrm(v as any); setSocioviaPreview(null); }}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sociovia">Sociovia CRM</SelectItem>
                                            <SelectItem value="hubspot">HubSpot</SelectItem>
                                            <SelectItem value="pipedrive">Pipedrive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Sociovia CRM Section */}
                                {externalCrm === 'sociovia' && (
                                    <>
                                        <div className="grid gap-2">
                                            <Label>Sociovia API Key (optional)</Label>
                                            <Input
                                                type="password"
                                                value={socioviaApiKey}
                                                onChange={(e) => setSocioviaApiKey(e.target.value)}
                                                placeholder="Enter API Key to verify"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Sociovia API authentication will be required soon.
                                            </p>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Workspace ID *</Label>
                                            <Input
                                                value={socioviaWorkspaceId}
                                                onChange={(e) => setSocioviaWorkspaceId(e.target.value)}
                                                placeholder="e.g. 41"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Data Type</Label>
                                            <Select value={socioviaDataType} onValueChange={(v) => { setSocioviaDataType(v as any); setSocioviaPreview(null); }}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="contacts">Contacts</SelectItem>
                                                    <SelectItem value="leads">Leads</SelectItem>
                                                    <SelectItem value="deals">Deals</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button variant="outline" onClick={handleSocioviaPreview} disabled={!socioviaCrmUrl || !socioviaWorkspaceId || loadingSocioviaPreview}>
                                            {loadingSocioviaPreview ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CloudDownload className="h-4 w-4 mr-2" />}
                                            Preview {socioviaDataType}
                                        </Button>

                                        {/* Sociovia Preview */}
                                        {socioviaPreview && (
                                            <div className="space-y-3 p-3 bg-muted/30 rounded w-full overflow-hidden">
                                                <div className="text-sm font-medium">Fields: {socioviaPreview.fields?.join(", ")}</div>
                                                <div className="text-sm text-muted-foreground">
                                                    Total records: {socioviaPreview.total_records}
                                                </div>
                                                {socioviaPreview.preview_rows && socioviaPreview.preview_rows.length > 0 && (
                                                    <div className="border rounded mt-2 w-full h-[300px] overflow-auto">
                                                        <Table className="min-w-max">
                                                            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                                                                <TableRow>
                                                                    {socioviaPreview.fields?.map((field: string) => (
                                                                        <TableHead key={field} className="text-xs">{field}</TableHead>
                                                                    ))}
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {socioviaPreview.preview_rows.map((row: Record<string, any>, idx: number) => (
                                                                    <TableRow key={idx}>
                                                                        {socioviaPreview.fields?.map((field: string) => (
                                                                            <TableCell key={field} className="text-xs max-w-32 truncate">
                                                                                {row[field] || '-'}
                                                                            </TableCell>
                                                                        ))}
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* HubSpot / Pipedrive Section */}
                                {externalCrm !== 'sociovia' && (
                                    <div className="grid gap-2">
                                        <Label>API Key *</Label>
                                        <Input
                                            type="password"
                                            value={externalApiKey}
                                            onChange={(e) => setExternalApiKey(e.target.value)}
                                            placeholder={externalCrm === 'hubspot' ? "HubSpot Private App Token" : "Pipedrive API Token"}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {externalCrm === 'hubspot'
                                                ? "Get your token from HubSpot → Settings → Integrations → Private Apps"
                                                : "Get your token from Pipedrive → Settings → Personal Preferences → API"}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={resetCreateDialog}>Cancel</Button>
                                {externalCrm === 'sociovia' ? (
                                    <Button onClick={handleCreateFromSociovia} disabled={creating || !newName || !socioviaCrmUrl || !socioviaWorkspaceId}>
                                        {creating ? "Importing..." : `Import ${socioviaDataType} from Sociovia`}
                                    </Button>
                                ) : (
                                    <Button onClick={handleCreateFromExternal} disabled={creating || !newName || !externalApiKey}>
                                        {creating ? "Importing..." : `Import from ${externalCrm}`}
                                    </Button>
                                )}
                            </DialogFooter>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Dataset Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {datasets.map(ds => (
                    <Card key={ds.id} className="cursor-pointer hover:border-blue-400 transition-colors" onClick={() => loadDatasetDetails(ds.id)}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span className="truncate">{ds.name}</span>
                                {getSourceBadge(ds.source_type)}
                            </CardTitle>
                            <CardDescription>{ds.description || "No description"}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm text-muted-foreground space-y-2">
                                <div>Updated: {ds.updated_at ? new Date(ds.updated_at).toLocaleDateString() : 'Never'}</div>
                                <div className="truncate">Cols: {ds.columns?.join(", ") || "Empty"}</div>
                                {ds.sync_status === 'error' && (
                                    <div className="text-red-500 text-xs truncate">Sync error: {ds.sync_error}</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {datasets.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg bg-slate-50">
                        <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No datasets found</p>
                        <p className="text-sm mb-4">Create one to get started with your flows and campaigns.</p>
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Create Dataset
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
