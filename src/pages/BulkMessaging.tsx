// WhatsApp Bulk Messaging Page
// =============================
// Wizard-based UI for creating and managing bulk messaging campaigns

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    Calendar,
    Check,
    CheckCircle,
    ChevronLeft,
    Clock,
    Database,
    Download,
    Eye,
    FileSpreadsheet,
    FileText,
    HelpCircle,
    Info,
    Keyboard,
    Loader2,
    MousePointer,
    MessageCircle,
    MessageSquare,
    MoreVertical,
    Pause,
    Pencil,
    Play,
    Plus,
    RefreshCw,
    Search,
    Send,
    Settings,
    Trash2,
    Upload,
    Users,
    X,
    XCircle,
    Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { maskPhoneNumber } from '@/lib/phoneMask';
import { useToast } from '@/hooks/use-toast';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import { useWhatsAppRealtime } from '@/whatsapp/hooks/useWhatsAppRealtime';

// API Base URL from environment
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').toString().replace(/\/$/, '');

// Types
const CampaignTimer = ({ targetDate }: { targetDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        if (!targetDate) return;

        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date();

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);

                setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
            } else {
                setTimeLeft('Processing...');
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    return (
        <div className="flex items-center gap-1 text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">
            <Timer className="w-3 h-3" />
            <span>{timeLeft}</span>
        </div>
    );
};

interface Campaign {
    id: number;
    name: string;
    description?: string;
    template_name: string;
    template_language: string;
    status: string;
    total_recipients: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    failed_count: number;
    pending_count: number;
    progress_percent: number;
    delivery_rate: number;
    read_rate: number;
    scheduled_at?: string;
    started_at?: string;
    completed_at?: string;
    created_at: string;
    last_error?: string;
    language?: string; // Populated from backend
    trigger_value?: string; // Used for scheduling
    steps?: any[]; // Fallback for template info
}

interface Template {
    id: number;
    name: string;
    category: string;
    language: string;
    status: string;
    body_text?: string;
    header_text?: string;
    footer_text?: string;
    variable_count: number;
    variable_mapping?: Record<string, string>; // Position "1" -> Name "name"
    components?: any[];
}

// Helper to get variable keys (either numeric "1", "2" or named "name", "order_id")
const getTemplateVariables = (template: Template | null): string[] => {
    if (!template) return [];

    const variables: Set<string> = new Set();
    const texts = [template.header_text, template.body_text, template.footer_text];

    texts.forEach(text => {
        if (!text) return;
        const matches = text.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
            matches.forEach(m => {
                const varName = m.replace(/\{\{|\}\}/g, '').trim();
                variables.add(varName);
            });
        }
    });

    if (variables.size > 0) {
        return Array.from(variables);
    }

    // Fallback: If no text parsing possible, use variable_mapping
    if (template.variable_mapping && Object.keys(template.variable_mapping).length > 0) {
        return Object.entries(template.variable_mapping)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([_, name]) => name);
    }

    // Fallback: 1..variable_count -> ["1", "2", ...]
    return Array.from({ length: template.variable_count }, (_, i) => (i + 1).toString());
};

interface Recipient {
    phone_number: string;
    name?: string;
    params?: Record<string, string>;
    status?: string;
    id?: string;
}

interface Dataset {
    id: number;
    name: string;
    row_count: number;
    created_at?: string;
}

interface WhatsAppAccount {
    id: number;
    phone_number_id: string;
    display_phone_number: string;
    verified_name: string;
    waba_id: string;
    is_active: boolean;
}

interface CampaignStats {
    total_recipients: number;
    pending: number;
    queued: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    clicked?: number;
    replied?: number;
    progress_percent: number;
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
    click_rate?: number;
    reply_rate?: number;
}

type RecipientSegment = 'all' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'clicked' | 'replied';
type RecipientSmartFilter = 'none' | 'clicked_not_replied' | 'read_not_clicked' | 'read_not_replied' | 'delivered_not_read';

interface CampaignRecipientIntelligence {
    phone_number: string;
    name?: string | null;
    enrollment_status?: string;
    sent: boolean;
    delivered: boolean;
    read: boolean;
    failed: boolean;
    clicked: boolean;
    replied: boolean;
    click_count: number;
    status_label: RecipientSegment;
    last_status?: string;
    last_event_at?: string | null;
    error_message?: string | null;
    reply_preview?: string | null;
    reply_at?: string | null;
}

interface FailureDetail {
    phone: string;
    error_code: string | null;
    error_message: string | null;
    type: 'delivery_failed' | 'enrollment_failed';
    timestamp: string | null;
}

interface CRMAudienceItem {
    id: string;
    name: string | null;
    phone: string | null;
    phone_normalized: string | null;
    email: string | null;
    company: string | null;
    status: string | null;
    source: string | null;
    external_source: string | null;
    crm_score: number;
    whatsapp_score: number;
    whatsapp_ready: boolean;
    created_at: string | null;
}

type CampaignSummaryCounts = Record<RecipientSegment, number>;

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    scheduled: 'bg-blue-100 text-blue-800',
    running: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-600',
};

const STATUS_ICONS: Record<string, any> = {
    draft: FileSpreadsheet,
    scheduled: Calendar,
    running: Play,
    paused: Pause,
    completed: CheckCircle,
    failed: XCircle,
    cancelled: X,
};

type RecipientDisplayStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'clicked' | 'replied' | 'failed';

const getRecipientDisplayStatus = (recipient: CampaignRecipientIntelligence): RecipientDisplayStatus => {
    if (recipient.failed) return 'failed';
    if (recipient.replied) return 'replied';
    if (recipient.clicked) return 'clicked';
    if (recipient.read) return 'read';
    if (recipient.delivered) return 'delivered';
    if (recipient.sent) return 'sent';
    return 'pending';
};

const matchesRecipientSegmentClient = (
    recipient: CampaignRecipientIntelligence,
    segment: RecipientSegment
): boolean => {
    if (segment === 'all') return true;
    if (segment === 'delivered') return !!recipient.delivered && !recipient.failed;
    if (segment === 'read') return !!recipient.read && !recipient.failed;
    if (segment === 'failed') return !!recipient.failed;
    if (segment === 'clicked') return !!recipient.clicked && !recipient.failed;
    if (segment === 'replied') return !!recipient.replied && !recipient.failed;
    if (segment === 'pending') return !recipient.sent && !recipient.failed;
    if (segment === 'sent') return !!recipient.sent;
    return true;
};

const normalizePhoneForMatch = (value?: string | null): string => (value || '').replace(/\D/g, '');

/** Parse one CSV line respecting quoted fields (commas/semicolons inside quotes). */
function parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === delimiter) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }

    result.push(current.trim());
    return result.map((value) => value.replace(/^"|"$/g, ''));
}

function detectCsvDelimiter(headerLine: string): string {
    const candidates = [',', ';', '\t'];
    let best = ',';
    let bestCount = 0;
    for (const delimiter of candidates) {
        const count = parseCsvLine(headerLine, delimiter).length;
        if (count > bestCount) {
            bestCount = count;
            best = delimiter;
        }
    }
    return best;
}

/** Parse CSV text exported from Excel/Google Sheets (BOM, CRLF, quoted fields, ; delimiter). */
function parseBulkCsvContent(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());

    if (lines.length < 2) {
        throw new Error('CSV must have a header row and at least one data row');
    }

    const delimiter = detectCsvDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter)
        .map((header) => header.trim())
        .filter((header) => header.length > 0);

    if (headers.length === 0) {
        throw new Error('CSV header row is empty');
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i], delimiter);
        if (values.every((value) => !value.trim())) continue;

        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx]?.trim() ?? '';
        });
        rows.push(row);
    }

    return { headers, rows };
}

function isCsvUploadFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return (
        name.endsWith('.csv')
        || file.type === 'text/csv'
        || file.type === 'application/vnd.ms-excel'
        || file.type === 'text/plain'
    );
}

const matchesRecipientSmartFilterClient = (
    recipient: CampaignRecipientIntelligence,
    smartFilter: RecipientSmartFilter
): boolean => {
    if (smartFilter === 'none') return true;
    if (smartFilter === 'delivered_not_read') return !!recipient.delivered && !recipient.read && !recipient.failed;
    if (smartFilter === 'read_not_clicked') return !!recipient.read && !recipient.clicked && !recipient.failed;
    if (smartFilter === 'read_not_replied') return !!recipient.read && !recipient.replied && !recipient.failed;
    if (smartFilter === 'clicked_not_replied') return !!recipient.clicked && !recipient.replied && !recipient.failed;
    return true;
};

const matchesRecipientSearchClient = (recipient: CampaignRecipientIntelligence, search: string): boolean => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    const phone = (recipient.phone_number || '').toLowerCase();
    const name = (recipient.name || '').toLowerCase();
    return phone.includes(needle) || name.includes(needle);
};

const computeSummaryCounts = (rows: CampaignRecipientIntelligence[]): CampaignSummaryCounts => {
    const summary: CampaignSummaryCounts = {
        all: rows.length,
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        clicked: 0,
        replied: 0,
    };

    for (const row of rows) {
        summary.pending += Number(!row.sent && !row.failed);
        summary.sent += Number(!!row.sent);
        summary.delivered += Number(!!row.delivered && !row.failed);
        summary.read += Number(!!row.read && !row.failed);
        summary.failed += Number(!!row.failed);
        summary.clicked += Number(!!row.clicked && !row.failed);
        summary.replied += Number(!!row.replied && !row.failed);
    }
    return summary;
};

const buildStatsFromSummary = (summary: CampaignSummaryCounts): Partial<CampaignStats> => {
    const totalRecipients = Number(summary.all || 0);
    const sent = Number(summary.sent || 0);
    const delivered = Number(summary.delivered || 0);
    const read = Number(summary.read || 0);
    const failed = Number(summary.failed || 0);
    const clicked = Number(summary.clicked || 0);
    const replied = Number(summary.replied || 0);
    const pending = Number(summary.pending || 0);

    const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

    return {
        total_recipients: totalRecipients,
        pending,
        sent,
        delivered,
        read,
        failed,
        clicked,
        replied,
        progress_percent: pct(sent, Math.max(totalRecipients, 1)),
        delivery_rate: pct(delivered, Math.max(sent, 1)),
        read_rate: pct(read, Math.max(sent, 1)),
        failure_rate: pct(failed, Math.max(totalRecipients, 1)),
        click_rate: pct(clicked, Math.max(sent, 1)),
        reply_rate: pct(replied, Math.max(sent, 1)),
    };
};

const RECIPIENT_STATUS_BADGE_CLASS: Record<RecipientDisplayStatus, string> = {
    failed: 'bg-red-50 text-red-600 border-red-200',
    replied: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    clicked: 'bg-blue-50 text-blue-600 border-blue-200',
    read: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    delivered: 'bg-green-50 text-green-600 border-green-200',
    sent: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    pending: 'bg-gray-50 text-gray-600 border-gray-200',
};

// Wizard Steps
const WIZARD_STEPS = [
    { id: 'setup', title: 'Campaign Setup', description: 'Name and template' },
    { id: 'audience', title: 'Audience', description: 'Add recipients' },
    { id: 'preview', title: 'Preview', description: 'Review before sending' },
    { id: 'schedule', title: 'Schedule', description: 'Send now or later' },
];

export default function BulkMessaging() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recipientsApplyTimeoutRef = useRef<number | null>(null);

    // View state
    const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
    const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

    // Workspace state
    const [workspaceId, setWorkspaceId] = useState<string | null>(null);
    const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    // Campaign list state
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<number>>(new Set());

    // Bulk delete progress state
    const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
        isDeleting: boolean;
        total: number;
        completed: number;
        failed: number;
    } | null>(null);

    // Wizard state
    const [currentStep, setCurrentStep] = useState(0);

    // Campaign form state
    const [campaignName, setCampaignName] = useState('');
    const [campaignDescription, setCampaignDescription] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Recipients state
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [phoneNumbersText, setPhoneNumbersText] = useState('');
    const [uploadProgress, setUploadProgress] = useState<{ added: number; duplicates: number; invalid: number } | null>(null);
    const [enableTrackingUrl, setEnableTrackingUrl] = useState(true);

    // Audience Sources State
    const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'dataset' | 'crm'>('manual');
    const [importMapping, setImportMapping] = useState<{
        active: boolean;
        type: 'csv' | 'dataset';
        sourceName: string; // Filename or Dataset Name
        datasetId?: string;
        headers: string[];
        previewData: any[]; // First few rows
        fullData: any[]; // All data
        columnMap: Record<string, string>; // "phone" -> "col", "name" -> "col", "1" -> "col"
    }>({ active: false, type: 'csv', sourceName: '', headers: [], previewData: [], fullData: [], columnMap: {} });

    // Dataset State
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [loadingDatasets, setLoadingDatasets] = useState(false);
    const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
    const [loadingDatasetRows, setLoadingDatasetRows] = useState(false);

    // Load datasets when tab active
    useEffect(() => {
        if (activeTab === 'dataset' && datasets.length === 0) {
            loadDatasets();
        }
    }, [activeTab, datasets.length]);

    // Variable defaults state (for templates with variables)
    const [variableDefaults, setVariableDefaults] = useState<Record<string, string>>({});
    const [variableSource, setVariableSource] = useState<Record<string, 'recipient_name' | 'recipient_phone' | 'csv_column' | 'static_value'>>({});
    const [variableColumns, setVariableColumns] = useState<Record<string, string>>({}); // Which CSV column for each variable
    const [csvColumns, setCsvColumns] = useState<string[]>([]); // Available columns from uploaded CSV

    // CRM Audience state (for importing from CRM)
    const [showCrmImport, setShowCrmImport] = useState(false);
    const [crmSource, setCrmSource] = useState<'leads' | 'contacts'>('leads');
    const [crmAudience, setCrmAudience] = useState<CRMAudienceItem[]>([]);
    const [selectedCrmIds, setSelectedCrmIds] = useState<Set<string>>(new Set());
    const [loadingCrm, setLoadingCrm] = useState(false);
    const [crmSearch, setCrmSearch] = useState('');
    const [crmSummary, setCrmSummary] = useState<{ total: number; with_phone: number; whatsapp_ready: number } | null>(null);

    // Template Search & Sync State
    const [templateSearch, setTemplateSearch] = useState('');
    const [stepHeaderImage, setStepHeaderImage] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [csvDragActive, setCsvDragActive] = useState(false);

    // Filter templates based on search
    const filteredTemplates = useMemo(() => {
        if (!templateSearch.trim()) return templates;
        const search = templateSearch.toLowerCase().trim();
        return templates.filter(t =>
            t.name.toLowerCase().includes(search) ||
            t.category.toLowerCase().includes(search)
        );
    }, [templates, templateSearch]);

    // Helper to get all variables from text in occurrence order
    const getVariablesInOrder = (text: string | undefined | null) => {
        if (!text) return [];
        return Array.from(text.matchAll(/\{\{([^}]+)\}\}/g)).map(m => ({ raw: m[0], name: m[1], index: m.index }));
    };

    // Helper to get media header format from template components
    const getTemplateMediaHeaderFormat = (template: Template | null): 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null => {
        if (!template?.components) return null;
        const headerComp = template.components.find((c) => c.type === 'HEADER');
        const format = headerComp?.format;
        if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') return format;
        return null;
    };

    const templateNeedsMediaHeader = (template: Template | null) => !!getTemplateMediaHeaderFormat(template);

    // Helper function to detect variable context from surrounding text
    // Supports both numeric (varNum="1") and named (varNum="name") keys
    const detectVariableContext = (template: Template | null, varKey: string) => {
        if (!template) return { suggestedSource: 'csv_column' as const, suggestedLabel: `Variable ${varKey}`, contextHint: '' };

        const varString = `{{${varKey}}}`;
        const normalizedKey = String(varKey || '').trim().toLowerCase();
        const isNumericVar = /^\d+$/.test(normalizedKey);
        const components = template.components || [];
        let context = '';

        // Find component containing variable
        for (const comp of components) {
            if (comp.type === 'BODY' && comp.text) {
                const text = comp.text;
                const idx = text.indexOf(varString);
                if (idx !== -1) {
                    // Get surrounding text (20 chars before)
                    const start = Math.max(0, idx - 30);
                    context = text.substring(start, idx).toLowerCase();
                    break;
                }
            }
        }

        // Suggest source based on context
        const varName = normalizedKey;

        // Priority 1: Link/URL/Tracking (often confused with IDs)
        if (varName.includes('link') || varName.includes('url') || context.includes('track') || context.includes('link') || context.includes('url') || context.includes('https')) {
            return {
                suggestedSource: 'csv_column' as const,
                suggestedLabel: 'Link/URL',
                contextHint: 'Detected link/url'
            };
        }

        // Priority 2: Order/Reference ID
        if (varName.includes('order') || varName.includes('id') || varName.includes('ref') || context.includes('order') || context.includes('ref') || context.includes('id:') || context.includes('#')) {
            return {
                suggestedSource: 'csv_column' as const,
                suggestedLabel: 'Order/Reference ID',
                contextHint: 'Detected ID/reference context'
            };
        }

        // Priority 3: Common Entities
        if (varName.includes('date') || varName.includes('time') || context.includes('date') || context.includes('time') || context.includes('when')) {
            return {
                suggestedSource: 'csv_column' as const,
                suggestedLabel: 'Date/Time',
                contextHint: 'Detected date/time context'
            };
        }

        if (varName.includes('amount') || varName.includes('price') || varName.includes('cost') || context.includes('amount') || context.includes('price') || context.includes('total') || context.includes('pay') || context.includes('cost')) {
            return {
                suggestedSource: 'csv_column' as const,
                suggestedLabel: 'Amount/Price',
                contextHint: 'Detected amount/price context'
            };
        }

        if (!isNumericVar && (context.includes('hi') || context.includes('hello') || context.includes('dear'))) {
            return {
                suggestedSource: 'recipient_name' as const,
                suggestedLabel: 'Customer Name',
                contextHint: 'Detected greeting/name context'
            };
        }

        // Check if name
        if (!isNumericVar && (varName.includes('name') || context.includes('name'))) {
            return {
                suggestedSource: 'recipient_name' as const,
                suggestedLabel: 'Customer Name',
                contextHint: 'Detected name context'
            };
        }

        return {
            suggestedSource: 'csv_column' as const,
            suggestedLabel: `Variable ${varKey}`,
            contextHint: 'Generic variable'
        };
    };

    const resolveRecipientVariableValue = (
        recipient: Recipient | undefined,
        varKey: string,
        allowPlaceholder = false,
    ): string => {
        const context = detectVariableContext(selectedTemplate, varKey);
        const hasExplicitSource = Object.prototype.hasOwnProperty.call(variableSource, varKey);
        const source = hasExplicitSource ? variableSource[varKey] : context.suggestedSource;
        const csvColumn = variableColumns[varKey] || `param_${varKey}`;

        const valueFromColumn = recipient?.params?.[csvColumn];
        const valueFromVarKey = recipient?.params?.[varKey];
        const fallbackDefault = variableDefaults[varKey] || '';

        // In auto mode, prioritize explicit per-recipient params to avoid heuristic mis-mapping.
        if (!hasExplicitSource) {
            const autoValue = valueFromColumn || valueFromVarKey;
            if (autoValue) return autoValue;
        }

        switch (source) {
            case 'recipient_name':
                return recipient?.name || valueFromVarKey || fallbackDefault || 'Customer';
            case 'recipient_phone':
                return recipient?.phone_number || '';
            case 'csv_column':
                return valueFromColumn || valueFromVarKey || fallbackDefault || (allowPlaceholder ? `[${context.suggestedLabel}]` : '');
            case 'static_value':
                return fallbackDefault;
            default:
                return valueFromVarKey || recipient?.name || fallbackDefault || 'Customer';
        }
    };

    // Schedule state
    const [scheduleType, setScheduleType] = useState<'now' | 'later'>('now');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');

    // Campaign detail state
    const [campaignDetail, setCampaignDetail] = useState<Campaign | null>(null);
    const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);
    const [campaignFailures, setCampaignFailures] = useState<FailureDetail[]>([]);
    const [campaignRecipients, setCampaignRecipients] = useState<CampaignRecipientIntelligence[]>([]);
    const [campaignSummaryCounts, setCampaignSummaryCounts] = useState<CampaignSummaryCounts | null>(null);
    const [clickTrackingMeta, setClickTrackingMeta] = useState<{ trackingEnabled: boolean; hasTrackableUrl: boolean }>({
        trackingEnabled: true,
        hasTrackableUrl: true,
    });
    const [recipientSegment, setRecipientSegment] = useState<RecipientSegment>('all');
    const [recipientSmartFilter, setRecipientSmartFilter] = useState<RecipientSmartFilter>('none');
    const [recipientSearch, setRecipientSearch] = useState('');
    const [selectedRecipientPhones, setSelectedRecipientPhones] = useState<Set<string>>(new Set());
    const [retargetingRecipients, setRetargetingRecipients] = useState(false);
    const [retargetName, setRetargetName] = useState('');
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    // Submitting state
    const [submitting, setSubmitting] = useState(false);

    // Preview animation state - cycles through recipients
    const [previewIndex, setPreviewIndex] = useState(0);

    // Animate preview cycling through recipients
    useEffect(() => {
        if (currentStep === 2 && recipients.length > 1) {
            const hasVars = selectedTemplate ? getTemplateVariables(selectedTemplate).length > 0 : false;
            // Only animate if we have variables to show differences
            if (hasVars) {
                const interval = setInterval(() => {
                    setPreviewIndex(prev => (prev + 1) % recipients.length);
                }, 2000); // Change every 2 seconds
                return () => clearInterval(interval);
            }
        }
    }, [currentStep, recipients.length, selectedTemplate]);

    // Initialize workspace
    useEffect(() => {
        const wsId = getWorkspaceId();
        if (wsId) {
            setWorkspaceId(wsId);
        }

        // Check URL for campaign ID
        const campaignIdParam = searchParams.get('campaign');
        if (campaignIdParam) {
            setSelectedCampaignId(parseInt(campaignIdParam));
            setView('detail');
        }
    }, [searchParams]);

    // Fetch WhatsApp accounts
    useEffect(() => {
        if (!workspaceId) return;

        const fetchAccounts = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/whatsapp/accounts?workspace_id=${workspaceId}`, {
                    credentials: 'include',
                });
                const json = await res.json();
                if (json.accounts) {
                    const activeAccounts = json.accounts.filter((a: WhatsAppAccount) => a.is_active);
                    setAccounts(activeAccounts);
                    if (activeAccounts.length > 0 && !selectedAccountId) {
                        setSelectedAccountId(activeAccounts[0].id);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch accounts:', err);
            }
        };

        fetchAccounts();
    }, [workspaceId]);

    // Fetch campaigns
    const fetchCampaigns = useCallback(async () => {
        if (!workspaceId) return;

        setLoadingCampaigns(true);
        try {
            const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns?workspace_id=${workspaceId}${statusParam}`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (json.success) {
                setCampaigns(json.campaigns || []);
            }
        } catch (err) {
            console.error('Failed to fetch campaigns:', err);
            toast({
                title: 'Error',
                description: 'Failed to load campaigns',
                variant: 'destructive',
            });
        } finally {
            setLoadingCampaigns(false);
        }
    }, [workspaceId, statusFilter, toast]);

    useEffect(() => {
        if (view === 'list') {
            fetchCampaigns();
        }
    }, [view, fetchCampaigns]);

    // Fetch templates from database
    const fetchTemplates = useCallback(async () => {
        if (!selectedAccountId) return;

        setLoadingTemplates(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/templates?account_id=${selectedAccountId}&workspace_id=${workspaceId}&status=APPROVED`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (json.success && json.templates) {
                setTemplates(json.templates);
            }
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }, [selectedAccountId, workspaceId]);

    // Sync templates from Meta API
    const syncTemplates = useCallback(async () => {
        if (!selectedAccountId) return;

        setLoadingTemplates(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/templates/sync`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_id: selectedAccountId, workspace_id: workspaceId })
                }
            );
            const json = await res.json();
            if (json.success && json.templates) {
                // Only show approved templates
                const approvedTemplates = json.templates.filter((t: Template) => t.status === 'APPROVED');
                setTemplates(approvedTemplates);
            }
        } catch (err) {
            console.error('Failed to sync templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }, [selectedAccountId, workspaceId]);

    // Handle header image upload
    const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !workspaceId) return;

        // Reset previous
        setStepHeaderImage(null);
        setUploadingImage(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace_id', workspaceId);
        formData.append('is_public', 'true');

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/media/upload/public`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const json = await res.json();
            const imageUrl = json.url || json.public_url;

            if (json.success && imageUrl) {
                setStepHeaderImage(imageUrl);
                toast({
                    title: 'Header Image Uploaded',
                    description: 'The image will be used as the template header.',
                });
            } else {
                throw new Error(json.error || 'Upload failed');
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            toast({
                title: 'Upload Failed',
                description: err.message || 'Could not upload header image',
                variant: 'destructive',
            });
        } finally {
            setUploadingImage(false);
            if (e.target) e.target.value = '';
        }
    };

    useEffect(() => {
        if (view === 'create' && selectedAccountId) {
            fetchTemplates();
        }
    }, [view, selectedAccountId, fetchTemplates]);

    // Fetch campaign detail
    const fetchCampaignDetail = useCallback(async () => {
        if (!selectedCampaignId || !workspaceId) return;

        setLoadingDetail(true);
        setLoadingStats(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}?workspace_id=${workspaceId}`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (json.success) {
                setCampaignDetail(json.campaign);
            }

            // Also fetch live stats
            const statsRes = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/stats?workspace_id=${workspaceId}`,
                { credentials: 'include' }
            );
            const statsJson = await statsRes.json();
            if (statsJson.success) {
                setCampaignStats(statsJson.stats);
                setLoadingStats(false);

                // Fetch failure details if there are any failures
                if (statsJson.stats.failed > 0) {
                    try {
                        const failRes = await fetch(
                            `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/failed?workspace_id=${workspaceId}`,
                            { credentials: 'include' }
                        );
                        const failJson = await failRes.json();
                        if (failJson.success) {
                            setCampaignFailures(failJson.failures);
                        }
                    } catch (err) {
                        console.error('Failed to fetch failure details:', err);
                    }
                } else {
                    setCampaignFailures([]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch campaign detail:', err);
        } finally {
            setLoadingDetail(false);
            setLoadingStats(false);
        }
    }, [selectedCampaignId, workspaceId]);

    const fetchCampaignIntelligence = useCallback(async () => {
        if (!selectedCampaignId || !workspaceId) return;

        setLoadingRecipients(true);
        try {
            const params = new URLSearchParams({
                workspace_id: workspaceId,
                segment: 'all',
                limit: '5000',
            });
            const currentRes = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/intelligence?${params.toString()}`,
                { credentials: 'include' }
            );
            const currentJson = await currentRes.json();

            if (recipientsApplyTimeoutRef.current) {
                window.clearTimeout(recipientsApplyTimeoutRef.current);
            }

            if (currentJson.success) {
                const currentRecipients: CampaignRecipientIntelligence[] = Array.isArray(currentJson.recipients) ? currentJson.recipients : [];
                const liveSummary = computeSummaryCounts(currentRecipients);
                setCampaignSummaryCounts(liveSummary);
                setCampaignStats((prev) => ({
                    ...(prev || {} as CampaignStats),
                    ...buildStatsFromSummary(liveSummary),
                }));
                if (currentJson.summary) {
                    setCampaignStats((prev) => ({ ...(prev || {} as CampaignStats), ...currentJson.summary }));
                    setClickTrackingMeta({
                        trackingEnabled: currentJson.summary.tracking_enabled !== false,
                        hasTrackableUrl: currentJson.summary.has_trackable_url !== false,
                    });
                }
                // Debounce application to avoid table jitter during burst updates.
                recipientsApplyTimeoutRef.current = window.setTimeout(() => {
                    setCampaignRecipients(currentRecipients);
                    setLoadingRecipients(false);
                    recipientsApplyTimeoutRef.current = null;
                }, 350);
            } else {
                recipientsApplyTimeoutRef.current = window.setTimeout(() => {
                    setCampaignRecipients([]);
                    const emptySummary = computeSummaryCounts([]);
                    setCampaignSummaryCounts(emptySummary);
                    setClickTrackingMeta({ trackingEnabled: true, hasTrackableUrl: true });
                    setCampaignStats((prev) => ({
                        ...(prev || {} as CampaignStats),
                        ...buildStatsFromSummary(emptySummary),
                    }));
                    setLoadingRecipients(false);
                    recipientsApplyTimeoutRef.current = null;
                }, 350);
            }
        } catch (err) {
            console.error('Failed to fetch campaign intelligence:', err);
            if (recipientsApplyTimeoutRef.current) {
                window.clearTimeout(recipientsApplyTimeoutRef.current);
                recipientsApplyTimeoutRef.current = null;
            }
            setCampaignRecipients([]);
            const emptySummary = computeSummaryCounts([]);
            setCampaignSummaryCounts(emptySummary);
            setClickTrackingMeta({ trackingEnabled: true, hasTrackableUrl: true });
            setCampaignStats((prev) => ({
                ...(prev || {} as CampaignStats),
                ...buildStatsFromSummary(emptySummary),
            }));
            setLoadingRecipients(false);
        }
    }, [selectedCampaignId, workspaceId]);

    useEffect(() => {
        if (view === 'detail' && selectedCampaignId) {
            // Clear stale data when campaign changes to prevent flash of old data
            setCampaignDetail(null);
            setCampaignStats(null);
            setClickTrackingMeta({ trackingEnabled: true, hasTrackableUrl: true });
            setLoadingStats(true);
            fetchCampaignDetail();
            fetchCampaignIntelligence();
        }
    }, [view, selectedCampaignId, fetchCampaignDetail, fetchCampaignIntelligence]);

    const applyRealtimeRecipientPatch = useCallback((updater: (rows: CampaignRecipientIntelligence[]) => CampaignRecipientIntelligence[]) => {
        setCampaignRecipients((prev) => {
            const next = updater(prev);
            if (next === prev) return prev;
            const liveSummary = computeSummaryCounts(next);
            setCampaignSummaryCounts(liveSummary);
            setCampaignStats((prevStats) => ({
                ...(prevStats || {} as CampaignStats),
                ...buildStatsFromSummary(liveSummary),
            }));
            return next;
        });
    }, []);

    useWhatsAppRealtime({
        workspaceId: workspaceId || '',
        onEvent: (event: any) => {
            if (view !== 'detail' || !selectedCampaignId) return;

            const eventType = event?.type;
            const data = event?.data || {};

            if (eventType === 'whatsapp_message_status') {
                const eventCampaignId = data.campaign_id ?? data?.message?.campaign_id;
                const hasCampaignMatch = eventCampaignId != null && Number(eventCampaignId) === Number(selectedCampaignId);
                if (!hasCampaignMatch) {
                    return;
                }
                const phone = normalizePhoneForMatch(
                    data.recipient_phone || data.user_phone || data.phone_number || data?.conversation?.user_phone
                );
                if (!phone) return;
                const status = String(data.status || '').toLowerCase();
                applyRealtimeRecipientPatch((rows) => {
                    let changed = false;
                    const next = rows.map((row) => {
                        if (normalizePhoneForMatch(row.phone_number) !== phone) return row;
                        changed = true;
                        const patched: CampaignRecipientIntelligence = { ...row };
                        if (status === 'sent') {
                            patched.sent = true;
                        } else if (status === 'delivered') {
                            patched.sent = true;
                            patched.delivered = true;
                            patched.failed = false;
                        } else if (status === 'read') {
                            patched.sent = true;
                            patched.delivered = true;
                            patched.read = true;
                            patched.failed = false;
                        } else if (status === 'failed') {
                            patched.sent = true;
                            patched.failed = true;
                            patched.error_message = data.error_message || patched.error_message;
                        }
                        patched.last_event_at = data.timestamp || patched.last_event_at;
                        return patched;
                    });
                    return changed ? next : rows;
                });
                return;
            }

            if (eventType === 'whatsapp_link_clicked' && campaignDetail?.name && data?.campaign_name === campaignDetail.name) {
                const phone = normalizePhoneForMatch(data.phone_number);
                applyRealtimeRecipientPatch((rows) => {
                    if (!phone) return rows;
                    let changed = false;
                    const next = rows.map((row) => {
                        if (normalizePhoneForMatch(row.phone_number) !== phone) return row;
                        changed = true;
                        const patched: CampaignRecipientIntelligence = {
                            ...row,
                            clicked: true,
                            click_count: Math.max(
                                Number(row.click_count || 0),
                                Number(data.click_count || Number(row.click_count || 0) + 1)
                            ),
                            last_event_at: data.last_clicked_at || row.last_event_at,
                        };
                        return patched;
                    });
                    return changed ? next : rows;
                });
                return;
            }

            if (eventType === 'whatsapp_message_received' && data.campaign_id && Number(data.campaign_id) === Number(selectedCampaignId)) {
                const phone = normalizePhoneForMatch(data.user_phone || data?.conversation?.user_phone);
                const preview = data?.message?.body || data?.message?.text || null;
                const ts = data?.message?.created_at || new Date().toISOString();
                applyRealtimeRecipientPatch((rows) => {
                    if (!phone) return rows;
                    let changed = false;
                    const next = rows.map((row) => {
                        if (normalizePhoneForMatch(row.phone_number) !== phone) return row;
                        changed = true;
                        const patched: CampaignRecipientIntelligence = {
                            ...row,
                            replied: true,
                            reply_preview: preview || row.reply_preview,
                            reply_at: row.reply_at || ts,
                            last_event_at: ts,
                        };
                        return patched;
                    });
                    return changed ? next : rows;
                });
            }
        },
    });

    useEffect(() => {
        return () => {
            if (recipientsApplyTimeoutRef.current) {
                window.clearTimeout(recipientsApplyTimeoutRef.current);
                recipientsApplyTimeoutRef.current = null;
            }
        };
    }, []);

    const visibleCampaignRecipients = useMemo(() => {
        return campaignRecipients.filter((recipient) => {
            if (!matchesRecipientSegmentClient(recipient, recipientSegment)) return false;
            if (!matchesRecipientSmartFilterClient(recipient, recipientSmartFilter)) return false;
            if (!matchesRecipientSearchClient(recipient, recipientSearch)) return false;
            return true;
        });
    }, [campaignRecipients, recipientSegment, recipientSmartFilter, recipientSearch]);

    const smartFilterOptions = useMemo<Array<[RecipientSmartFilter, string]>>(() => {
        if (recipientSegment === 'delivered') {
            return [['delivered_not_read', 'Delivered not read']];
        }
        if (recipientSegment === 'read') {
            return [
                ['read_not_clicked', 'Read not clicked'],
                ['read_not_replied', 'Read not replied'],
            ];
        }
        if (recipientSegment === 'clicked') {
            return [['clicked_not_replied', 'Clicked not replied']];
        }
        return [];
    }, [recipientSegment]);

    useEffect(() => {
        if (recipientSmartFilter === 'none') return;
        const isAllowed = smartFilterOptions.some(([mode]) => mode === recipientSmartFilter);
        if (!isAllowed) {
            setRecipientSmartFilter('none');
        }
    }, [recipientSmartFilter, smartFilterOptions]);

    const campaignFailuresByPhone = useMemo(() => {
        const map = new Map<string, FailureDetail>();
        for (const failure of campaignFailures) {
            const phone = normalizePhoneForMatch(failure.phone);
            if (!phone) continue;
            const existing = map.get(phone);
            if (!existing) {
                map.set(phone, failure);
                continue;
            }

            const existingScore = Number(Boolean(existing.error_code)) + Number(Boolean(existing.error_message));
            const incomingScore = Number(Boolean(failure.error_code)) + Number(Boolean(failure.error_message));
            if (incomingScore >= existingScore) {
                map.set(phone, failure);
            }
        }
        return map;
    }, [campaignFailures]);

    const recipientTotalFiltered = visibleCampaignRecipients.length;

    const tabLabelCount = useCallback(
        (segment: RecipientSegment) => campaignSummaryCounts?.[segment] ?? 0,
        [campaignSummaryCounts]
    );

    useEffect(() => {
        setSelectedRecipientPhones((prev) => {
            if (prev.size === 0) return prev;
            const allowed = new Set(visibleCampaignRecipients.map((recipient) => recipient.phone_number));
            const next = new Set<string>();
            for (const phone of prev) {
                if (allowed.has(phone)) next.add(phone);
            }
            return next;
        });
    }, [visibleCampaignRecipients]);

    const toggleRecipientSelection = (phone: string) => {
        setSelectedRecipientPhones(prev => {
            const next = new Set(prev);
            if (next.has(phone)) {
                next.delete(phone);
            } else {
                next.add(phone);
            }
            return next;
        });
    };

    const toggleSelectAllRecipients = () => {
        const phones = visibleCampaignRecipients.map(r => r.phone_number);
        setSelectedRecipientPhones(prev => {
            if (prev.size === phones.length && phones.length > 0) {
                return new Set();
            }
            return new Set(phones);
        });
    };

    const handleRetargetRecipients = async (segmentMode: RecipientSegment, selectedOnly: boolean) => {
        if (!selectedCampaignId || !workspaceId) return;

        const selectedPhones = selectedOnly ? Array.from(selectedRecipientPhones) : [];
        if (selectedOnly && selectedPhones.length === 0) {
            toast({
                title: 'No recipients selected',
                description: 'Select at least one recipient to retarget.',
                variant: 'destructive',
            });
            return;
        }

        setRetargetingRecipients(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/retarget?workspace_id=${workspaceId}`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_id: workspaceId,
                        segment: segmentMode,
                        smart_filter: recipientSmartFilter !== 'none' ? recipientSmartFilter : undefined,
                        phone_numbers: selectedPhones,
                        send_now: true,
                        name: retargetName.trim() || undefined,
                    }),
                }
            );
            const json = await res.json();
            if (!json.success) {
                throw new Error(json.error || 'Failed to retarget recipients');
            }

            toast({
                title: 'Retarget campaign started',
                description: `New campaign #${json.campaign_id} created for ${json.recipient_count} recipients.`,
            });
            setSelectedRecipientPhones(new Set());
            setRetargetName('');
            // Auto-navigate to the newly created retargeted campaign
            setSelectedCampaignId(json.campaign_id);
            setView('detail');
            fetchCampaigns();
        } catch (err: any) {
            toast({
                title: 'Retarget failed',
                description: err.message || 'Unable to create retarget campaign.',
                variant: 'destructive',
            });
        } finally {
            setRetargetingRecipients(false);
        }
    };

    // Normalize a raw phone value: handles multi-number fields, scientific notation, country codes
    const normalizePhone = (raw: string): string | null => {
        if (raw === null || raw === undefined) return null;
        const str = String(raw); // Handle numeric values from JSON
        if (!str.trim()) return null;
        let input = str.trim();

        // Handle Excel scientific notation (e.g., 9.19E+11)
        if (/^\d+\.?\d*[eE]\+?\d+$/.test(input)) {
            try {
                const num = parseFloat(input);
                if (isFinite(num)) input = Math.round(num).toString();
            } catch { /* ignore */ }
        }

        // Split on common delimiters: comma, semicolon, slash, newline, "or", "and", embedded "+"
        const parts = input
            .split(/[,;\/\n\r]+|\s+(?:or|and|&)\s+/i)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        // Also handle embedded "+" between digits (e.g., "7812094176+913532547123")
        const expandedParts: string[] = [];
        for (const part of parts) {
            // If part contains a + between digits, split on it
            const subParts = part.split(/(?<=\d)\+(?=\d)/);
            expandedParts.push(...subParts);
        }

        for (const part of expandedParts) {
            // Strip everything except digits
            let digits = part.replace(/[^\d]/g, '');
            // Remove leading zeros
            digits = digits.replace(/^0+/, '') || '';
            if (!digits) continue;

            // Add country code for 10-digit Indian numbers
            if (digits.length === 10 && '6789'.includes(digits[0])) {
                digits = '91' + digits;
            }

            // Valid phone: 10-15 digits
            if (digits.length >= 10 && digits.length <= 15) {
                return digits;
            }
        }
        return null;
    };

    // Parse phone numbers from text
    const parsePhoneNumbers = (text: string): string[] => {
        return text
            .split(/[\n;]+/)
            .map(line => normalizePhone(line))
            .filter((p): p is string => p !== null);
    };

    // Handlers
    const loadDatasets = async () => {
        try {
            setLoadingDatasets(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/datasets?account_id=${selectedAccountId}`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setDatasets(data.datasets || []);
            }
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'Failed to load datasets', variant: 'destructive' });
        } finally {
            setLoadingDatasets(false);
        }
    };

    const handleDatasetSelect = async (datasetIdStr: string) => {
        setSelectedDatasetId(datasetIdStr);
        if (!datasetIdStr) return;

        try {
            setLoadingDatasetRows(true);
            const dataset = datasets.find(d => d.id.toString() === datasetIdStr);

            // Fetch ALL rows using pagination (backend uses per_page, not limit)
            let allRows: any[] = [];
            let page = 1;
            const perPage = 500;
            let hasMore = true;

            while (hasMore) {
                const res = await fetch(`${API_BASE}/api/whatsapp/datasets/${datasetIdStr}/rows?page=${page}&per_page=${perPage}`, {
                    credentials: 'include'
                });
                if (!res.ok) break;
                const data = await res.json();
                const pageRows = (data.data || []).map((r: any) => r.data || {});
                allRows = allRows.concat(pageRows);
                // Stop when we've fetched all pages
                if (pageRows.length < perPage || (data.pages && page >= data.pages)) {
                    hasMore = false;
                }
                page++;
            }

            // Normalize row keys: trim whitespace from column names to prevent mismatches
            const rows = allRows.map(row => {
                const cleaned: Record<string, any> = {};
                for (const [key, val] of Object.entries(row)) {
                    cleaned[key.trim()] = typeof val === 'string' ? val.trim() : val;
                }
                return cleaned;
            });

            if (rows.length > 0) {
                const headers = Object.keys(rows[0]);
                const autoMap = autoMapColumns(headers, selectedTemplate);

                setImportMapping({
                    active: true,
                    type: 'dataset',
                    sourceName: dataset?.name || 'Dataset',
                    datasetId: datasetIdStr,
                    headers,
                    previewData: rows.slice(0, 5),
                    fullData: rows,
                    columnMap: autoMap
                });
            } else {
                toast({ title: 'Empty Dataset', description: 'Dataset has no rows', variant: 'destructive' });
            }
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'Failed to load dataset rows', variant: 'destructive' });
        } finally {
            setLoadingDatasetRows(false);
        }
    };

    const processCsvFile = async (file: File) => {
        if (!isCsvUploadFile(file)) {
            toast({
                title: 'Invalid file',
                description: 'Please upload a .csv file (Excel: Save As → CSV UTF-8).',
                variant: 'destructive',
            });
            return;
        }

        try {
            const text = await file.text();
            const { headers, rows } = parseBulkCsvContent(text);

            if (rows.length === 0) {
                toast({
                    title: 'Invalid CSV',
                    description: 'CSV must have a header row and at least one data row.',
                    variant: 'destructive',
                });
                return;
            }

            const autoMap = autoMapColumns(headers, selectedTemplate);
            if (!autoMap.phone) {
                toast({
                    title: 'Phone column not detected',
                    description: 'Map a phone/mobile column in the next step (e.g. phone, mobile, contact_number).',
                });
            }

            setImportMapping({
                active: true,
                type: 'csv',
                sourceName: file.name,
                headers,
                previewData: rows.slice(0, 5),
                fullData: rows,
                columnMap: autoMap,
            });
        } catch (err) {
            console.error('CSV parse error:', err);
            toast({
                title: 'Failed to parse CSV',
                description: err instanceof Error ? err.message : 'Check file format and try again.',
                variant: 'destructive',
            });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processCsvFile(file);
    };

    const handleDownloadSampleCsv = () => {
        const templateVars = selectedTemplate ? getTemplateVariables(selectedTemplate) : [];
        const headers = ['phone', 'name', ...templateVars];
        const sampleValues = [
            '919876543210',
            'John Doe',
            ...templateVars.map((_, index) => `value_${index + 1}`),
        ];
        const csv = `${headers.join(',')}\n${sampleValues.join(',')}\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'bulk_audience_sample.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const autoMapColumns = (headers: string[], template: Template | null) => {
        const map: Record<string, string> = {};
        headers.forEach(h => {
            const lower = h.toLowerCase().trim();
            const normalized = lower.replace(/[\s_-]+/g, '_'); // "contact number" → "contact_number"
            const PHONE_PATTERNS = [
                'phone', 'phone_number', 'phonenumber', 'phone_no', 'phone no',
                'mobile', 'mobile_number', 'mobilenumber', 'mobile_no', 'mobile no',
                'contact_number', 'contact number', 'contact_no', 'whatsapp', 'whatsapp_number',
                'cell', 'telephone', 'tel', 'msisdn', 'wa_id', 'recipient_phone',
            ];
            const NAME_PATTERNS = ['name', 'first_name', 'customer_name', 'customer', 'client_name', 'full_name', 'contact_person', 'person', 'recipient_name'];

            if (PHONE_PATTERNS.includes(lower) || PHONE_PATTERNS.includes(normalized)) {
                map['phone'] = h;
            } else if (NAME_PATTERNS.includes(lower) || NAME_PATTERNS.includes(normalized)) {
                if (!map['name']) map['name'] = h; // Prefer first match ("Name" over "Contact Person")
            } else if (template) {
                const templateVars = getTemplateVariables(template);
                if (templateVars.length > 0) {
                    templateVars.forEach(varKey => {
                        const ctx = detectVariableContext(template, varKey);
                        const labelLower = ctx.suggestedLabel.toLowerCase();
                        // Check matches: param_name, var_name, suggested label, normalized variants
                        if (lower === `param_${varKey}` || lower === `var_${varKey}` || lower === varKey.toLowerCase() || normalized === varKey.toLowerCase().replace(/[\s_-]+/g, '_') || lower === labelLower.replace(/\s+/g, '_') || lower === labelLower || normalized === labelLower.replace(/[\s_-]+/g, '_')) {
                            map[varKey] = h;
                        }
                    });
                }
            }
        });
        return map;
    };

    // Helper: look up a value by column name, trying exact then trimmed key
    const getRowVal = (row: Record<string, any>, col: string): any => {
        if (col in row) return row[col];
        const trimmed = col.trim();
        for (const key of Object.keys(row)) {
            if (key.trim() === trimmed) return row[key];
        }
        return undefined;
    };

    // Validation Summary Calculation
    const validationSummary = useMemo(() => {
        if (!importMapping.active) return { total: 0, valid: 0, invalid: 0, missingVars: 0 };

        let valid = 0;
        let invalid = 0;
        let missingVars = 0;

        importMapping.fullData.forEach(row => {
            // Check phone
            const phoneCol = importMapping.columnMap['phone'];
            if (!phoneCol || !getRowVal(row, phoneCol)) {
                invalid++;
                return;
            }

            // Check variables
            if (selectedTemplate) {
                const templateVars = getTemplateVariables(selectedTemplate);
                if (templateVars.length > 0) {
                    templateVars.forEach(varKey => {
                        const col = importMapping.columnMap[varKey];
                        // Valid if column mapped AND has value, OR fallback provided
                        const val = col ? getRowVal(row, col) : null;
                        const fallback = variableDefaults[varKey];
                        if ((!val || val === '') && (!fallback || fallback === '')) {
                            missingVars++;
                        }
                    });
                }
            }
            valid++;
        });

        return { total: importMapping.fullData.length, valid, invalid, missingVars };
    }, [importMapping, variableDefaults, selectedTemplate]);

    const handleConfirmImport = () => {
        if (!importMapping.columnMap['phone']) {
            toast({ title: 'Missing Map', description: 'Please map the Phone Number column', variant: 'destructive' });
            return;
        }

        let addedCount = 0;
        const newRecipients: Recipient[] = [];
        const existingPhones = new Set(recipients.map(r => r.phone_number));

        // Update metadata for tracking source (helps UI)
        const newSource = { ...variableSource };
        const newCols = { ...variableColumns };

        const templateVars = selectedTemplate ? getTemplateVariables(selectedTemplate) : [];

        templateVars.forEach(varKey => {
            if (importMapping.columnMap[varKey]) {
                newSource[varKey] = 'csv_column';
                newCols[varKey] = importMapping.columnMap[varKey];
            }
        });
        setVariableSource(newSource);
        setVariableColumns(newCols);
        setCsvColumns(importMapping.headers);

        importMapping.fullData.forEach(row => {
            const phoneCol = importMapping.columnMap['phone'];
            const phoneRaw = getRowVal(row, phoneCol);
            const phone = normalizePhone(phoneRaw ?? '');

            if (!phone || existingPhones.has(phone)) return;

            const nameCol = importMapping.columnMap['name'];
            const name = nameCol ? getRowVal(row, nameCol) : undefined;
            const params: Record<string, string> = {};

            templateVars.forEach(varKey => {
                const col = importMapping.columnMap[varKey];
                const val = (col ? (getRowVal(row, col) ?? '') : '') || variableDefaults[varKey] || '';
                if (val) params[varKey] = String(val); // Store explicit value
            });

            newRecipients.push({ phone_number: phone, name, params: Object.keys(params).length > 0 ? params : undefined });
            existingPhones.add(phone);
            addedCount++;
        });

        setRecipients(prev => [...prev, ...newRecipients]);
        setImportMapping({ active: false, type: 'csv', sourceName: '', headers: [], previewData: [], fullData: [], columnMap: {} });
        setSelectedDatasetId('');

        if (addedCount === 0) {
            toast({
                title: 'No recipients added',
                description: 'Check phone column mapping and that numbers are valid (10-digit Indian or with country code).',
                variant: 'destructive',
            });
            return;
        }

        toast({ title: 'Import Complete', description: `Added ${addedCount} recipients` });
    };

    const handleCancelImport = () => {
        setImportMapping({ active: false, type: 'csv', sourceName: '', headers: [], previewData: [], fullData: [], columnMap: {} });
        setSelectedDatasetId('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Add phone numbers from text area (supports "phone, var1, var2, var3..." format)
    const handleAddPhoneNumbers = () => {
        const lines = phoneNumbersText.split(/[\n;]+/).filter(l => l.trim());
        const newRecipients: Recipient[] = [];
        const templateVars = selectedTemplate ? getTemplateVariables(selectedTemplate) : [];

        lines.forEach(line => {
            // Split by comma or tab
            const parts = line.split(/[,\t]+/).map(p => p.trim());
            let phone = '';
            let name = '';
            const params: Record<string, string> = {};

            if (parts.length >= 1) {
                // First part is always phone — normalize it
                phone = normalizePhone(parts[0]) || '';

                // Remaining parts are variable values
                if (parts.length >= 2) {
                    // Second part is name (or first variable)
                    name = parts[1];

                    // Additional parts map to variables
                    // Format: phone, name/var1, var2, var3, ...
                    for (let i = 1; i < parts.length && i <= templateVars.length; i++) {
                        if (parts[i]) {
                            // Map positional CSV input to our variable keys in order
                            // If index 1 (name) is consumed, we might skip it or map it to first variable?
                            // Logic here is ambiguous for mixed name/variables. 
                            // Assuming simplistic mapping: parts[1] -> name, parts[2] -> var1, parts[3] -> var2...
                            // OR parts[1] is name, and vars start from parts[2]?
                            // Original code: parts[1] is name. params map 1..varCount from parts[1]... wait.

                            // ORIGINAL LOGIC RE-CHECK: 
                            // if parts.length >= 2: name = parts[1]
                            // loop i=1..parts.length: if parts[i]: params[i.toString()] = parts[i]
                            // so parts[1] is put into name AND params["1"]. This seems intentional for "Hello {{1}}".

                            // UPDATED LOGIC:
                            // We need to map parts[i] to templateVars[i-1].
                            const varKey = templateVars[i - 1]; // 0-indexed var key
                            if (varKey) {
                                params[varKey] = parts[i];
                            }
                        }
                    }
                }
            }

            if (phone) {
                newRecipients.push({
                    phone_number: phone,
                    name: name || undefined,
                    params: Object.keys(params).length > 0 ? params : undefined
                });
            }
        });

        setRecipients(prev => {
            const existing = new Set(prev.map(r => r.phone_number));
            const filtered = newRecipients.filter(r => !existing.has(r.phone_number));
            return [...prev, ...filtered];
        });

        setPhoneNumbersText('');
        const withParams = newRecipients.filter(r => r.params && Object.keys(r.params).length > 0).length;
        const withNames = newRecipients.filter(r => r.name).length;
        toast({
            title: 'Numbers Added',
            description: `Added ${newRecipients.length} recipients${withNames > 0 ? ` (${withNames} with names)` : ''}${withParams > 0 ? ` with variable data` : ''}`,
        });
    };

    // Remove recipient
    const handleRemoveRecipient = (phone: string) => {
        setRecipients(prev => prev.filter(r => r.phone_number !== phone));
    };

    // Edit recipient inline
    const [editingRecipientIdx, setEditingRecipientIdx] = useState<number | null>(null);
    const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

    const handleStartEditRecipient = (idx: number) => {
        setEditingRecipientIdx(idx);
        setEditingRecipient({ ...recipients[idx], params: { ...(recipients[idx].params || {}) } });
    };

    const handleSaveEditRecipient = () => {
        if (editingRecipientIdx === null || !editingRecipient) return;
        setRecipients(prev => {
            const updated = [...prev];
            updated[editingRecipientIdx] = editingRecipient;
            return updated;
        });
        setEditingRecipientIdx(null);
        setEditingRecipient(null);
    };

    const handleCancelEditRecipient = () => {
        setEditingRecipientIdx(null);
        setEditingRecipient(null);
    };

    // Fetch CRM audience (leads or contacts)
    const fetchCrmAudience = useCallback(async () => {
        if (!workspaceId) return;

        setLoadingCrm(true);
        try {
            const searchParam = crmSearch ? `&search=${encodeURIComponent(crmSearch)}` : '';
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/crm-audience?workspace_id=${workspaceId}&source=${crmSource}${searchParam}&limit=200`,
                { credentials: 'include' }
            );
            const json = await res.json();
            if (json.success) {
                setCrmAudience(json.audience || []);
                setCrmSummary(json.summary || null);
            } else {
                toast({
                    title: 'Error',
                    description: json.error || 'Failed to load CRM audience',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Failed to fetch CRM audience:', err);
            toast({
                title: 'Error',
                description: 'Failed to load CRM audience',
                variant: 'destructive',
            });
        } finally {
            setLoadingCrm(false);
        }
    }, [workspaceId, crmSource, crmSearch, toast]);

    // Import selected CRM records as recipients
    const handleCrmImport = () => {
        const selectedRecords = crmAudience.filter(item => selectedCrmIds.has(item.id) && item.whatsapp_ready);

        const newRecipients: Recipient[] = selectedRecords.map(record => ({
            phone_number: record.phone_normalized || record.phone || '',
            name: record.name || undefined,
            params: {},
        }));

        setRecipients(prev => {
            const existing = new Set(prev.map(r => r.phone_number));
            const filtered = newRecipients.filter(r => !existing.has(r.phone_number));
            return [...prev, ...filtered];
        });

        const addedCount = newRecipients.length;
        setShowCrmImport(false);
        setSelectedCrmIds(new Set());

        toast({
            title: 'CRM Import Complete',
            description: `Added ${addedCount} recipients from CRM ${crmSource}`,
        });
    };

    // Toggle CRM selection
    const toggleCrmSelection = (id: string) => {
        setSelectedCrmIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Select all WhatsApp-ready CRM records
    const selectAllCrm = () => {
        const readyIds = crmAudience.filter(item => item.whatsapp_ready).map(item => item.id);
        setSelectedCrmIds(new Set(readyIds));
    };

    // Deselect all CRM records
    const deselectAllCrm = () => {
        setSelectedCrmIds(new Set());
    };

    // Helper to render score stars
    const renderScoreStars = (score: number) => {
        if (score >= 80) return '⭐⭐⭐';
        if (score >= 50) return '⭐⭐';
        if (score > 0) return '⭐';
        return '—';
    };

    // Create campaign
    const handleCreateCampaign = async () => {
        if (!selectedAccountId || !campaignName || !selectedTemplate) {
            toast({
                title: 'Missing Fields',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        setSubmitting(true);
        try {
            // Create campaign
            const createRes = await fetch(`${API_BASE}/api/whatsapp/bulk/campaigns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    account_id: selectedAccountId,
                    name: campaignName,
                    description: campaignDescription,
                    template_name: selectedTemplate.name,
                    template_language: selectedTemplate.language,
                }),
            });

            const createJson = await createRes.json();
            if (!createJson.success) {
                throw new Error(createJson.error || 'Failed to create campaign');
            }

            const campaignId = createJson.campaign.id;

            // Apply variable defaults to recipients before sending
            const recipientsWithParams = recipients.map(r => {
                const params: Record<string, string> = {};

                // Apply variable sources for each variable
                if (selectedTemplate) {
                    const templateVars = getTemplateVariables(selectedTemplate);
                    if (templateVars.length > 0) {
                        templateVars.forEach(varKey => {
                            params[varKey] = resolveRecipientVariableValue(r, varKey, false);
                        });
                    }
                }

                return {
                    ...r,
                    params: {
                        ...(Object.keys(params).length > 0 ? params : {}),
                        ...(stepHeaderImage ? (
                            getTemplateMediaHeaderFormat(selectedTemplate) === 'VIDEO'
                                ? { header_video_url: stepHeaderImage }
                                : getTemplateMediaHeaderFormat(selectedTemplate) === 'DOCUMENT'
                                    ? { header_document_url: stepHeaderImage }
                                    : { header_image_url: stepHeaderImage }
                        ) : {})
                    }
                };
            });

            // Add recipients
            if (recipientsWithParams.length > 0) {
                const recipientsRes = await fetch(
                    `${API_BASE}/api/whatsapp/bulk/campaigns/${campaignId}/recipients`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            recipients: recipientsWithParams,
                            workspace_id: workspaceId,
                            enable_tracking_url: enableTrackingUrl,
                        }),
                    }
                );

                const recipientsJson = await recipientsRes.json();
                if (!recipientsJson.success) {
                    throw new Error(recipientsJson.error || 'Failed to add recipients');
                }

                setUploadProgress({
                    added: recipientsJson.added,
                    duplicates: recipientsJson.duplicates,
                    invalid: recipientsJson.invalid,
                });
            }

            // Schedule or send now
            let scheduleData: any = { send_now: true };
            if (scheduleType === 'later' && scheduledDate && scheduledTime) {
                // Create date in IST - JavaScript handles timezone conversion automatically
                // When we create a Date with local time string, JS stores it as UTC internally
                const istDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
                scheduleData = {
                    scheduled_at: istDateTime.toISOString(),
                };
            }

            const scheduleRes = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${campaignId}/schedule`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ ...scheduleData, workspace_id: workspaceId }),
                }
            );

            const scheduleJson = await scheduleRes.json();
            if (!scheduleJson.success) {
                throw new Error(scheduleJson.error || 'Failed to schedule campaign');
            }

            toast({
                title: 'Campaign Created',
                description: scheduleType === 'now' ? 'Campaign is now sending!' : 'Campaign scheduled successfully',
            });

            // Navigate to campaign detail
            setSelectedCampaignId(campaignId);
            setView('detail');
            resetForm();

        } catch (err: any) {
            console.error('Failed to create campaign:', err);
            toast({
                title: 'Error',
                description: err.message || 'Failed to create campaign',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    // Pause campaign
    const handlePauseCampaign = async () => {
        if (!selectedCampaignId) return;

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/pause`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ workspace_id: workspaceId })
                }
            );
            const json = await res.json();
            if (json.success) {
                toast({ title: 'Campaign Paused' });
                fetchCampaignDetail();
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to pause campaign', variant: 'destructive' });
        }
    };

    // Resume campaign
    const handleResumeCampaign = async () => {
        if (!selectedCampaignId) return;

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/resume`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ workspace_id: workspaceId })
                }
            );
            const json = await res.json();
            if (json.success) {
                toast({ title: 'Campaign Resumed' });
                fetchCampaignDetail();
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to resume campaign', variant: 'destructive' });
        }
    };

    // Reset form
    const resetForm = () => {
        setCampaignName('');
        setCampaignDescription('');
        setSelectedTemplate(null);
        setRecipients([]);
        setPhoneNumbersText('');
        setScheduleType('now');
        setScheduledDate('');
        setScheduledTime('');
        setCurrentStep(0);
        setUploadProgress(null);
        setVariableDefaults({});
        setVariableSource({});
        setVariableColumns({});
        setCsvColumns([]);
        setStepHeaderImage(null);
        setTemplateSearch('');
        setEnableTrackingUrl(true);
    };

    // Delete campaign handler
    const handleDeleteCampaign = async (campaignId: number, campaignName: string, force: boolean = false) => {
        if (!confirm(`Are you sure you want to delete "${campaignName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${campaignId}${force ? '?force=true' : ''}`,
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspace_id: workspaceId }),
                }
            );

            const json = await res.json();
            if (json.success) {
                toast({
                    title: 'Campaign Deleted',
                    description: json.message || 'Campaign has been deleted',
                });
                // Refresh campaigns list
                setCampaigns(prev => prev.filter(c => c.id !== campaignId));
                // If viewing the deleted campaign, go back to list
                if (selectedCampaignId === campaignId) {
                    setView('list');
                    setSelectedCampaignId(null);
                }
            } else {
                throw new Error(json.error || 'Failed to delete campaign');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete campaign',
                variant: 'destructive',
            });
        }
    };

    // Resubscribe webhooks to fix delivery status tracking
    const handleResubscribeWebhooks = async () => {
        if (!selectedCampaignId) return;
        try {
            const res = await fetch(
                `${API_BASE}/api/whatsapp/bulk/campaigns/${selectedCampaignId}/resubscribe-webhooks`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workspace_id: workspaceId }),
                }
            );
            const json = await res.json();
            if (json.success) {
                toast({
                    title: 'Webhooks Resubscribed',
                    description: 'Status updates should resume shortly. Refresh stats in a few seconds.',
                });
                // Refresh stats after a short delay
                setTimeout(() => fetchCampaignDetail(), 3000);
            } else {
                throw new Error(json.message || 'Failed to resubscribe');
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to resubscribe webhooks',
                variant: 'destructive',
            });
        }
    };

    // Bulk delete campaigns handler
    const handleBulkDelete = async () => {
        if (selectedCampaignIds.size === 0) return;

        const count = selectedCampaignIds.size;
        if (!confirm(`Are you sure you want to delete ${count} campaign${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
            return;
        }

        const idsToDelete = Array.from(selectedCampaignIds);
        const deletedIds: number[] = [];

        // Initialize progress
        setBulkDeleteProgress({
            isDeleting: true,
            total: count,
            completed: 0,
            failed: 0,
        });

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < idsToDelete.length; i++) {
            const campaignId = idsToDelete[i];
            try {
                const res = await fetch(
                    `${API_BASE}/api/whatsapp/bulk/campaigns/${campaignId}?force=true`,
                    {
                        method: 'DELETE',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ workspace_id: workspaceId }),
                    }
                );

                const json = await res.json();
                if (json.success) {
                    successCount++;
                    deletedIds.push(campaignId);
                } else {
                    failCount++;
                }
            } catch {
                failCount++;
            }

            // Update progress after each deletion
            setBulkDeleteProgress({
                isDeleting: true,
                total: count,
                completed: successCount + failCount,
                failed: failCount,
            });

            // Remove the campaign from list as it's deleted (for visual feedback)
            if (deletedIds.includes(campaignId)) {
                setCampaigns(prev => prev.filter(c => c.id !== campaignId));
            }
        }

        // Clear progress and selection
        setBulkDeleteProgress(null);
        setSelectedCampaignIds(new Set());

        toast({
            title: 'Bulk Delete Complete',
            description: `Deleted ${successCount} campaign${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        });
    };

    // Toggle campaign selection
    const toggleCampaignSelection = (campaignId: number) => {
        setSelectedCampaignIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(campaignId)) {
                newSet.delete(campaignId);
            } else {
                newSet.add(campaignId);
            }
            return newSet;
        });
    };

    // Select all campaigns
    const toggleSelectAll = () => {
        if (selectedCampaignIds.size === campaigns.length) {
            setSelectedCampaignIds(new Set());
        } else {
            setSelectedCampaignIds(new Set(campaigns.map(c => c.id)));
        }
    };

    // Render campaign list view
    const renderListView = () => (
        <div className="space-y-6 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Bulk Messaging</h1>
                    <p className="text-muted-foreground">Send template messages to multiple recipients</p>
                </div>
                <Button onClick={() => { resetForm(); setView('create'); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Campaign
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-40">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="icon" onClick={fetchCampaigns}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>

                {/* Bulk Actions */}
                {selectedCampaignIds.size > 0 && !bulkDeleteProgress && (
                    <div className="flex flex-wrap items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg w-full sm:w-auto">
                        <span className="text-xs sm:text-sm font-medium w-full sm:w-auto">
                            {selectedCampaignIds.size} selected
                        </span>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDelete}
                            className="gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Selected
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCampaignIds(new Set())}
                        >
                            Clear
                        </Button>
                    </div>
                )}
            </div>

            {/* Bulk Delete Progress Overlay */}
            {bulkDeleteProgress && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Card className="w-full max-w-md mx-4 shadow-2xl">
                        <CardContent className="p-6">
                            <div className="flex flex-col items-center text-center space-y-4">
                                {/* Animated Icon */}
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                        <Trash2 className="w-8 h-8 text-red-600 animate-pulse" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-white animate-bounce">
                                        {bulkDeleteProgress.completed}
                                    </div>
                                </div>

                                {/* Title */}
                                <div>
                                    <h3 className="text-lg font-semibold">Deleting Campaigns...</h3>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Please wait while we delete your campaigns
                                    </p>
                                </div>

                                {/* Progress Stats */}
                                <div className="w-full space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Progress</span>
                                        <span className="font-medium">
                                            {bulkDeleteProgress.completed} / {bulkDeleteProgress.total}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-300 ease-out"
                                            style={{
                                                width: `${(bulkDeleteProgress.completed / bulkDeleteProgress.total) * 100}%`
                                            }}
                                        />
                                    </div>

                                    {/* Percentage */}
                                    <div className="text-2xl font-bold text-primary">
                                        {Math.round((bulkDeleteProgress.completed / bulkDeleteProgress.total) * 100)}%
                                    </div>

                                    {/* Failed count if any */}
                                    {bulkDeleteProgress.failed > 0 && (
                                        <p className="text-sm text-red-500">
                                            ⚠️ {bulkDeleteProgress.failed} failed
                                        </p>
                                    )}
                                </div>

                                {/* Loading dots animation */}
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Select All Checkbox */}
            {campaigns.length > 0 && !bulkDeleteProgress && (
                <div className="flex items-center gap-2 pb-2 border-b">
                    <input
                        type="checkbox"
                        id="select-all"
                        checked={selectedCampaignIds.size === campaigns.length && campaigns.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                        Select all ({campaigns.length})
                    </label>
                </div>
            )}

            {/* Campaign List */}
            {loadingCampaigns ? (
                <div className="grid gap-3">
                    {Array.from({ length: 8 }).map((_, idx) => (
                        <Card key={`campaign-skeleton-${idx}`} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-4 w-4 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                                    <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />

                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="h-4 w-52 max-w-[75%] rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                                        <div className="h-3 w-72 max-w-[90%] rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                                    </div>

                                    <div className="hidden sm:flex items-center gap-3">
                                        <div className="h-6 w-20 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                                        <div className="h-8 w-8 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : campaigns.length === 0 && !bulkDeleteProgress ? (
                <Card className="p-12 text-center">
                    <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">No campaigns yet</h3>
                    <p className="mt-2 text-muted-foreground">Create your first bulk messaging campaign</p>
                    <Button onClick={() => setView('create')} className="mt-4 gap-2">
                        <Plus className="w-4 h-4" />
                        New Campaign
                    </Button>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {campaigns.map(campaign => {
                        const StatusIcon = STATUS_ICONS[campaign.status] || FileSpreadsheet;
                        const isSelected = selectedCampaignIds.has(campaign.id);
                        return (
                            <Card
                                key={campaign.id}
                                className={cn(
                                    "hover:shadow-md transition-all",
                                    isSelected && "ring-2 ring-primary bg-primary/5"
                                )}
                            >
                                <CardContent className="p-3 sm:p-4 overflow-hidden">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
                                        {/* Checkbox */}
                                        <input
                                            type="checkbox"
                                            id={`campaign-${campaign.id}`}
                                            checked={isSelected}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleCampaignSelection(campaign.id);
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
                                            aria-label={`Select campaign ${campaign.name}`}
                                        />

                                        <div
                                            className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1 w-full cursor-pointer"
                                            onClick={() => {
                                                setSelectedCampaignId(campaign.id);
                                                setView('detail');
                                            }}
                                        >
                                            <div className={cn(
                                                'p-2 rounded-lg',
                                                STATUS_COLORS[campaign.status]?.replace('text-', 'bg-').split(' ')[0] || 'bg-gray-100'
                                            )}>
                                                <StatusIcon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-medium truncate">{campaign.name}</h3>
                                                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
                                                    <span>{campaign.template_name || campaign.steps?.[0]?.template_name || 'No Template'}</span>
                                                    {(campaign.language || campaign.steps?.[0]?.language) && (
                                                        <span className="uppercase text-xs border px-1 rounded bg-muted/50 self-center">
                                                            {campaign.language || campaign.steps?.[0]?.language}
                                                        </span>
                                                    )}
                                                    <span>• {campaign.total_recipients} recipients</span>
                                                </div>
                                                {(campaign.scheduled_at || (campaign.status === 'scheduled' && campaign.trigger_value)) && (
                                                    <div className="mt-1">
                                                        <div className="text-xs text-blue-600 flex items-center gap-1 mb-1">
                                                            <Clock className="w-3 h-3" />
                                                            Scheduled: {new Date(campaign.scheduled_at || campaign.trigger_value || '').toLocaleString()}
                                                        </div>
                                                        <CampaignTimer targetDate={campaign.scheduled_at || campaign.trigger_value || ''} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 ml-7 sm:ml-auto">
                                            <Badge className={cn(STATUS_COLORS[campaign.status], 'text-[10px] sm:text-xs')}>
                                                {campaign.status}
                                            </Badge>
                                            {campaign.status === 'running' && (
                                                <div className="hidden sm:block w-24">
                                                    <Progress value={campaign.progress_percent} className="h-2" />
                                                    <p className="text-xs text-muted-foreground text-right mt-1">
                                                        {campaign.progress_percent}%
                                                    </p>
                                                </div>
                                            )}
                                            {(campaign.status === 'completed' || campaign.status === 'running') && (
                                                <div className="hidden sm:block text-right">
                                                    <p className="text-sm font-medium">{campaign.sent_count}/{campaign.total_recipients}</p>
                                                    <p className="text-xs text-muted-foreground">sent</p>
                                                </div>
                                            )}
                                            {/* Delete Button */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteCampaign(campaign.id, campaign.name, true);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );

    // Render wizard create view
    const renderCreateView = () => (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setView('list')}>
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Create Campaign</h1>
                    <p className="text-muted-foreground">Set up your bulk messaging campaign</p>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="overflow-x-auto pb-1">
                <div className="flex items-center justify-between min-w-max">
                    {WIZARD_STEPS.map((step, index) => (
                        <div key={step.id} className="flex items-center">
                        <div
                            className={cn(
                                'flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium transition-colors',
                                index < currentStep
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : index === currentStep
                                        ? 'border-primary text-primary'
                                        : 'border-muted text-muted-foreground'
                            )}
                        >
                            {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                        </div>
                        <div className="ml-2 hidden sm:block">
                            <p className={cn(
                                'text-sm font-medium',
                                index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                            )}>
                                {step.title}
                            </p>
                        </div>
                            {index < WIZARD_STEPS.length - 1 && (
                                <div className={cn(
                                    'w-10 sm:w-12 lg:w-24 h-0.5 mx-2',
                                    index < currentStep ? 'bg-primary' : 'bg-muted'
                                )} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <Card>
                <CardContent className="p-6">
                    {/* Step 0: Setup */}
                    {currentStep === 0 && (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="account">WhatsApp Account</Label>
                                <Select
                                    value={selectedAccountId?.toString() || ''}
                                    onValueChange={v => setSelectedAccountId(parseInt(v))}
                                >
                                    <SelectTrigger id="account">
                                        <SelectValue placeholder="Select account" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(account => (
                                            <SelectItem key={account.id} value={account.id.toString()}>
                                                {account.verified_name} ({maskPhoneNumber(account.display_phone_number)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Campaign Name *</Label>
                                <Input
                                    id="name"
                                    value={campaignName}
                                    onChange={e => setCampaignName(e.target.value)}
                                    placeholder="e.g., Black Friday Sale"
                                    autoComplete="off"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description (optional)</Label>
                                <Textarea
                                    id="description"
                                    value={campaignDescription}
                                    onChange={e => setCampaignDescription(e.target.value)}
                                    placeholder="Describe your campaign..."
                                    rows={2}
                                    autoComplete="off"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <Label className="text-base font-semibold">1. Select Template *</Label>
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                                        <div className="relative w-full sm:w-auto">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search templates..."
                                                className="pl-9 h-9 w-full sm:w-[220px] lg:w-[300px]"
                                                value={templateSearch}
                                                onChange={(e) => setTemplateSearch(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={syncTemplates}
                                            disabled={loadingTemplates || !selectedAccountId}
                                            className="h-9"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingTemplates ? 'animate-spin' : ''}`} />
                                            Sync from Meta
                                        </Button>
                                    </div>
                                </div>

                                <div className="max-h-[420px] overflow-y-auto pr-1">
                                    {loadingTemplates ? (
                                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                                            <p className="text-sm text-muted-foreground">Fetching your WhatsApp templates...</p>
                                        </div>
                                    ) : filteredTemplates.length === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/30">
                                            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
                                            <h3 className="text-lg font-medium">No templates found</h3>
                                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                                                {templateSearch ? `No templates match "${templateSearch}"` : "You haven't got any approved templates yet."}
                                            </p>
                                            {templateSearch && (
                                                <Button variant="link" onClick={() => setTemplateSearch('')} className="mt-2 text-primary">
                                                    Clear search
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {filteredTemplates.map(template => {
                                                const isSelected = selectedTemplate?.id === template.id;
                                                return (
                                                    <div
                                                        key={template.id}
                                                        onClick={() => {
                                                            setSelectedTemplate(template);
                                                            // Reset image if not an image template
                                                            const hasMediaHeader = templateNeedsMediaHeader(template);
                                                            if (!hasMediaHeader) setStepHeaderImage(null);
                                                        }}
                                                        className={cn(
                                                            "group relative flex flex-col p-4 rounded-xl border-2 transition-all cursor-pointer hover:border-primary/50",
                                                            isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-gray-100 bg-white"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm break-words">{template.name}</span>
                                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{template.category}</span>
                                                            </div>
                                                            {isSelected && (
                                                                <div className="bg-primary text-white rounded-full p-1">
                                                                    <Check className="w-3 h-3" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mt-auto flex items-center justify-between">
                                                            <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-5">
                                                                {template.language}
                                                            </Badge>
                                                            {template.variable_count > 0 && (
                                                                <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                                                                    {template.variable_count} vars
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedTemplate && (
                                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                                    {/* Template Preview Left */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-sm font-semibold">Template Visuals</Label>
                                            <Badge variant="secondary" className="text-[10px] font-normal uppercase">Preview</Badge>
                                        </div>

                                        <Card className="overflow-hidden border-2 shadow-sm max-w-[320px] mx-auto md:mx-0">
                                            <div className="bg-[#E5DDD5] min-h-[300px] p-4 flex flex-col relative">
                                                <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm max-w-[90%] self-start relative before:content-[''] before:absolute before:top-0 before:-left-2 before:w-0 before:h-0 before:border-t-[8px] before:border-t-white before:border-l-[8px] before:border-l-transparent">
                                                    {/* Header Image Component */}
                                                    {(() => {
                                                        const headerComp = selectedTemplate.components?.find(c => c.type === 'HEADER');
                                                        if (headerComp?.format === 'IMAGE' || headerComp?.format === 'VIDEO' || headerComp?.format === 'DOCUMENT') {
                                                            const isImage = headerComp.format === 'IMAGE';
                                                            return (
                                                                <div className="mb-3 rounded-md overflow-hidden bg-gray-100 aspect-video flex flex-col items-center justify-center border group relative">
                                                                    {stepHeaderImage ? (
                                                                        <>
                                                                            {isImage ? (
                                                                                <img src={stepHeaderImage} alt="Header" className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                <div className="flex flex-col items-center gap-2 p-4 text-center text-muted-foreground">
                                                                                    <span className="text-xs font-medium">{headerComp.format} uploaded</span>
                                                                                </div>
                                                                            )}
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setStepHeaderImage(null); }}
                                                                                className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex flex-col items-center gap-2 p-4 text-center">
                                                                            {uploadingImage ? (
                                                                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                                            ) : (
                                                                                <>
                                                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                                                                                        <Upload className="w-5 h-5" />
                                                                                    </div>
                                                                                    <p className="text-[10px] font-medium text-muted-foreground">Upload Header Image</p>
                                                                                    <input
                                                                                        type="file"
                                                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                                                        accept="image/*"
                                                                                        onChange={handleHeaderImageUpload}
                                                                                        disabled={uploadingImage}
                                                                                    />
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        if (selectedTemplate.header_text) {
                                                            return <p className="font-bold text-sm mb-2 text-gray-800 border-b pb-1">{selectedTemplate.header_text}</p>;
                                                        }
                                                        return null;
                                                    })()}

                                                    <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">
                                                        {selectedTemplate.body_text}
                                                    </div>

                                                    {selectedTemplate.footer_text && (
                                                        <p className="text-[11px] text-gray-400 mt-2 italic">{selectedTemplate.footer_text}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </div>

                                    {/* Template Details Right */}
                                    <div className="space-y-4">
                                        <Label className="text-sm font-semibold">Configuration Details</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 rounded-xl bg-gray-50 border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Variables</p>
                                                <p className="text-lg font-bold">{selectedTemplate.variable_count}</p>
                                            </div>
                                            <div className="p-3 rounded-xl bg-gray-50 border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Language</p>
                                                <p className="text-lg font-bold uppercase">{selectedTemplate.language}</p>
                                            </div>
                                        </div>

                                        {selectedTemplate.variable_count > 0 && (
                                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                                    <span className="text-sm font-bold text-amber-900">Variables Required</span>
                                                </div>
                                                <p className="text-xs text-amber-800 leading-relaxed">
                                                    This template contains <span className="font-bold">{selectedTemplate.variable_count} placeholder(s)</span>.
                                                    You'll map these to your recipient data in the next step.
                                                </p>
                                            </div>
                                        )}

                                        {templateNeedsMediaHeader(selectedTemplate) && (
                                            <div className={cn(
                                                "p-4 rounded-xl border-2 transition-all",
                                                stepHeaderImage ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"
                                            )}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    {stepHeaderImage ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Info className="w-4 h-4 text-blue-600" />}
                                                    <span className={cn("text-sm font-bold", stepHeaderImage ? "text-emerald-900" : "text-blue-900")}>
                                                        {stepHeaderImage ? "Media Ready" : `Header ${getTemplateMediaHeaderFormat(selectedTemplate) || 'Media'} Needed`}
                                                    </span>
                                                </div>
                                                <p className={cn("text-xs leading-relaxed mb-3", stepHeaderImage ? "text-emerald-800" : "text-blue-800")}>
                                                    {stepHeaderImage
                                                        ? "Successfully uploaded. This media will be sent as the header for all messages in this campaign."
                                                        : `This template requires a ${(getTemplateMediaHeaderFormat(selectedTemplate) || 'media').toLowerCase()} header. Click the upload area in the preview to add one.`}
                                                </p>
                                                {!stepHeaderImage && (
                                                    <div className="relative">
                                                        <Button variant="outline" size="sm" className="w-full bg-white border-blue-300" disabled={uploadingImage}>
                                                            {uploadingImage ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
                                                            Choose Header {getTemplateMediaHeaderFormat(selectedTemplate) || 'Media'}
                                                        </Button>
                                                        <input
                                                            type="file"
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            accept={
                                                                getTemplateMediaHeaderFormat(selectedTemplate) === 'VIDEO'
                                                                    ? 'video/mp4,video/quicktime,video/3gpp'
                                                                    : getTemplateMediaHeaderFormat(selectedTemplate) === 'DOCUMENT'
                                                                        ? 'application/pdf,.doc,.docx,.txt'
                                                                        : 'image/*'
                                                            }
                                                            onChange={handleHeaderImageUpload}
                                                            disabled={uploadingImage}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Step 1: Audience */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 px-4 py-3 gap-3">
                                <div>
                                    <Label className="text-sm font-medium">Auto-track URL variables</Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        When enabled, URL-like template values are automatically replaced with per-recipient tracking links.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEnableTrackingUrl(prev => !prev)}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                        enableTrackingUrl ? "bg-primary" : "bg-gray-300"
                                    )}
                                    aria-pressed={enableTrackingUrl}
                                    aria-label="Toggle automatic tracking URL replacement"
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
                                            enableTrackingUrl ? "translate-x-5" : "translate-x-1"
                                        )}
                                    />
                                </button>
                            </div>

                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 h-auto">
                                    <TabsTrigger value="manual" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 text-[11px] sm:text-sm">
                                        <Keyboard className="w-4 h-4" />
                                        Manual Entry
                                    </TabsTrigger>
                                    <TabsTrigger value="csv" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 text-[11px] sm:text-sm">
                                        <Upload className="w-4 h-4" />
                                        CSV Upload
                                    </TabsTrigger>
                                    <TabsTrigger value="dataset" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 text-[11px] sm:text-sm">
                                        <Database className="w-4 h-4" />
                                        Datasets
                                    </TabsTrigger>
                                </TabsList>

                                {/* Manual Entry Tab */}
                                <TabsContent value="manual" className="space-y-4 mt-4">
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-base font-medium">Enter Manually</Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Enter one per line with variable values
                                            </p>
                                        </div>
                                        <Textarea
                                            value={phoneNumbersText}
                                            onChange={e => setPhoneNumbersText(e.target.value)}
                                            placeholder={selectedTemplate && selectedTemplate.variable_count > 0
                                                ? `9390094496, John, ORD-12345, https://track.com/123\n6300873116, Jane, ORD-67890, https://track.com/456`
                                                : `9390094496, John Doe\n6300873116, Jane Smith`}
                                            rows={6}
                                            className="font-mono text-sm"
                                        />
                                        <div className="bg-muted/50 p-3 rounded-lg">
                                            <p className="text-xs text-muted-foreground mb-2 font-medium">Format Guide:</p>
                                            {selectedTemplate && selectedTemplate.variable_count > 0 ? (
                                                <div className="text-xs space-y-1">
                                                    <p className="font-mono bg-background px-2 py-1 rounded border">
                                                        phone, {getTemplateVariables(selectedTemplate).map(varKey => {
                                                            const ctx = detectVariableContext(selectedTemplate, varKey);
                                                            return ctx.suggestedLabel.toLowerCase().replace(/\s+/g, '_');
                                                        }).join(', ')}
                                                    </p>
                                                    <p className="text-muted-foreground mt-1">
                                                        Each comma-separated value maps to <code className="bg-muted px-1 rounded">{`{{1}}`}</code>, <code className="bg-muted px-1 rounded">{`{{2}}`}</code>, etc.
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-mono bg-background px-2 py-1 rounded border">
                                                    phone, name
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleAddPhoneNumbers}
                                            disabled={!phoneNumbersText.trim()}
                                            className="w-full"
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Recipients
                                        </Button>
                                    </div>
                                </TabsContent>

                                {/* CSV Upload Tab */}
                                <TabsContent value="csv" className="space-y-4 mt-4">
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-base font-medium">Upload CSV File</Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Drag and drop or click to upload
                                            </p>
                                        </div>

                                        {!importMapping.active ? (
                                            <>
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            fileInputRef.current?.click();
                                                        }
                                                    }}
                                                    onDragEnter={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setCsvDragActive(true);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setCsvDragActive(true);
                                                    }}
                                                    onDragLeave={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setCsvDragActive(false);
                                                    }}
                                                    onDrop={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setCsvDragActive(false);
                                                        const file = e.dataTransfer.files?.[0];
                                                        if (file) await processCsvFile(file);
                                                    }}
                                                    className={cn(
                                                        'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
                                                        csvDragActive
                                                            ? 'border-primary bg-primary/5'
                                                            : 'border-gray-300 hover:border-primary/50'
                                                    )}
                                                >
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept=".csv,text/csv,application/vnd.ms-excel"
                                                        onChange={handleCsvFileSelect}
                                                        className="hidden"
                                                        id="csv-upload-bulk"
                                                    />
                                                    <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                                                    <p className="text-sm font-medium text-gray-600">
                                                        Drag & drop a CSV file here, or click to browse
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-2">
                                                        Must contain: phone column + variable data columns
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={handleDownloadSampleCsv}
                                                >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Download Sample Template
                                                </Button>
                                            </>
                                        ) : importMapping.type === 'csv' && (
                                            <Card className="border-primary/30">
                                                <CardHeader className="p-4 pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <CardTitle className="text-sm flex items-center gap-2">
                                                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                                            Map Columns: {importMapping.sourceName}
                                                        </CardTitle>
                                                        {validationSummary.missingVars > 0 && (
                                                            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                                {validationSummary.missingVars} missing values
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <CardDescription className="text-xs">
                                                        {importMapping.fullData.length} rows detected. Map your data below.
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0">
                                                    <div className="space-y-3">
                                                        {/* Phone Column - Required */}
                                                        <div className="p-3 rounded-lg border bg-white">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <Label className="text-sm font-medium text-red-600">* Phone Number</Label>
                                                                <span className="text-xs text-muted-foreground">Required</span>
                                                            </div>
                                                            <Select
                                                                value={importMapping.columnMap['phone'] || ''}
                                                                onValueChange={(v) => setImportMapping(p => ({ ...p, columnMap: { ...p.columnMap, phone: v } }))}
                                                            >
                                                                <SelectTrigger className="h-9">
                                                                    <SelectValue placeholder="Select phone column" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {importMapping.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Variable Mappings with Fallback */}
                                                        {selectedTemplate && selectedTemplate.variable_count > 0 && (
                                                            <div className="space-y-2">
                                                                {getTemplateVariables(selectedTemplate).map((key, i) => {
                                                                    const varNum = i + 1; // Just for display index
                                                                    const ctx = detectVariableContext(selectedTemplate, key);
                                                                    const isMapped = !!importMapping.columnMap[key];
                                                                    const hasFallback = !!variableDefaults[key];
                                                                    const previewValue = importMapping.previewData[0]?.[importMapping.columnMap[key] || ''];

                                                                    return (
                                                                        <div key={key} className="p-3 rounded-lg border bg-white">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                                                                    {varNum}
                                                                                </Badge>
                                                                                <span className="text-sm font-medium">{key} <span className="text-muted-foreground font-normal">({ctx.suggestedLabel})</span></span>
                                                                                {ctx.contextHint && (
                                                                                    <span className="text-xs text-emerald-600">✓ {ctx.contextHint}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <div>
                                                                                    <Label className="text-xs text-muted-foreground mb-1 block">Column</Label>
                                                                                    <Select
                                                                                        value={importMapping.columnMap[key] || ''}
                                                                                        onValueChange={(v) => setImportMapping(p => ({ ...p, columnMap: { ...p.columnMap, [key]: v === '__none__' ? '' : v } }))}
                                                                                    >
                                                                                        <SelectTrigger className={cn("h-8 text-xs", isMapped && "border-emerald-400 bg-emerald-50")}>
                                                                                            <SelectValue placeholder="Select..." />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            <SelectItem value="__none__">-- Unmapped --</SelectItem>
                                                                                            {importMapping.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>
                                                                                <div>
                                                                                    <Label className="text-xs text-muted-foreground mb-1 block">Fallback (if empty)</Label>
                                                                                    <Input
                                                                                        className={cn("h-8 text-xs", hasFallback && "border-amber-300 bg-amber-50")}
                                                                                        placeholder="Default value..."
                                                                                        value={variableDefaults[key] || ''}
                                                                                        onChange={(e) => setVariableDefaults({ ...variableDefaults, [key]: e.target.value })}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            {/* Preview value */}
                                                                            <div className="mt-2 text-xs text-muted-foreground">
                                                                                Preview: {previewValue || variableDefaults[key] || <span className="text-amber-500 italic">Missing</span>}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                                <CardFooter className="p-3 border-t bg-gray-50 flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={handleCancelImport}>Cancel</Button>
                                                    <Button size="sm" onClick={handleConfirmImport} disabled={!importMapping.columnMap['phone']}>
                                                        <Check className="w-3 h-3 mr-1" /> Import Recipients
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        )}
                                    </div>
                                </TabsContent>

                                {/* Datasets Tab */}
                                <TabsContent value="dataset" className="space-y-4 mt-4">
                                    <div className="space-y-4">
                                        <div>
                                            <Label className="text-base font-medium">Select Dataset</Label>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Choose from your saved datasets
                                            </p>
                                        </div>

                                        {loadingDatasets ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            </div>
                                        ) : datasets.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                                                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p>No datasets available</p>
                                                <p className="text-xs mt-1">Create a dataset first in the Datasets section</p>
                                            </div>
                                        ) : (
                                            <>
                                                <Select
                                                    value={selectedDatasetId}
                                                    onValueChange={handleDatasetSelect}
                                                >
                                                    <SelectTrigger className="h-10">
                                                        <SelectValue placeholder="Select a dataset..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {datasets.map(ds => (
                                                            <SelectItem key={ds.id} value={ds.id.toString()}>
                                                                <div className="flex items-center gap-2">
                                                                    <Database className="w-4 h-4 text-muted-foreground" />
                                                                    {ds.name}
                                                                    <Badge variant="outline" className="text-xs">{ds.row_count} rows</Badge>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                {/* Dataset Column Mapping */}
                                                {importMapping.active && importMapping.type === 'dataset' && (
                                                    <Card className="border-primary/30">
                                                        <CardHeader className="p-4 pb-2">
                                                            <CardTitle className="text-sm flex items-center gap-2">
                                                                <Database className="w-4 h-4 text-blue-600" />
                                                                Map Columns: {importMapping.sourceName}
                                                            </CardTitle>
                                                            <CardDescription className="text-xs">
                                                                {importMapping.fullData.length} rows. Map columns and set fallback values.
                                                            </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="p-4 pt-0">
                                                            <div className="space-y-3">
                                                                {/* Phone Column */}
                                                                <div className="p-3 rounded-lg border bg-white">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <Label className="text-sm font-medium text-red-600">* Phone Number</Label>
                                                                    </div>
                                                                    <Select
                                                                        value={importMapping.columnMap['phone'] || ''}
                                                                        onValueChange={(v) => setImportMapping(p => ({ ...p, columnMap: { ...p.columnMap, phone: v } }))}
                                                                    >
                                                                        <SelectTrigger className="h-9">
                                                                            <SelectValue placeholder="Select phone column" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {importMapping.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>

                                                                {/* Variable Mappings with Fallback */}
                                                                {selectedTemplate && selectedTemplate.variable_count > 0 && (
                                                                    <div className="space-y-2">
                                                                        {getTemplateVariables(selectedTemplate).map((key, i) => {
                                                                            const varNum = i + 1;
                                                                            const ctx = detectVariableContext(selectedTemplate, key);
                                                                            const isMapped = !!importMapping.columnMap[key];
                                                                            const hasFallback = !!variableDefaults[key];
                                                                            const previewValue = importMapping.previewData[0]?.[importMapping.columnMap[key] || ''];

                                                                            return (
                                                                                <div key={key} className="p-3 rounded-lg border bg-white">
                                                                                    <div className="flex items-center gap-2 mb-2">
                                                                                        <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                                                                            {varNum}
                                                                                        </Badge>
                                                                                        <span className="text-sm font-medium">{key} <span className="text-muted-foreground font-normal">({ctx.suggestedLabel})</span></span>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-2 gap-2">
                                                                                        <div>
                                                                                            <Label className="text-xs text-muted-foreground mb-1 block">Column</Label>
                                                                                            <Select
                                                                                                value={importMapping.columnMap[key] || ''}
                                                                                                onValueChange={(v) => setImportMapping(p => ({ ...p, columnMap: { ...p.columnMap, [key]: v === '__none__' ? '' : v } }))}
                                                                                            >
                                                                                                <SelectTrigger className={cn("h-8 text-xs", isMapped && "border-emerald-400 bg-emerald-50")}>
                                                                                                    <SelectValue placeholder="Select..." />
                                                                                                </SelectTrigger>
                                                                                                <SelectContent>
                                                                                                    <SelectItem value="__none__">-- Unmapped --</SelectItem>
                                                                                                    {importMapping.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                                                                </SelectContent>
                                                                                            </Select>
                                                                                        </div>
                                                                                        <div>
                                                                                            <Label className="text-xs text-muted-foreground mb-1 block">Fallback (if empty)</Label>
                                                                                            <Input
                                                                                                className={cn("h-8 text-xs", hasFallback && "border-amber-300 bg-amber-50")}
                                                                                                placeholder="Default value..."
                                                                                                value={variableDefaults[key] || ''}
                                                                                                onChange={(e) => setVariableDefaults({ ...variableDefaults, [key]: e.target.value })}
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                                                        Preview: {previewValue || variableDefaults[key] || <span className="text-amber-500 italic">Missing</span>}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                        <CardFooter className="p-3 border-t bg-gray-50 flex justify-end gap-2">
                                                            <Button variant="ghost" size="sm" onClick={handleCancelImport}>Cancel</Button>
                                                            <Button size="sm" onClick={handleConfirmImport} disabled={!importMapping.columnMap['phone']}>
                                                                <Check className="w-3 h-3 mr-1" /> Import Recipients
                                                            </Button>
                                                        </CardFooter>
                                                    </Card>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {/* Recipients List - Shows after adding recipients from any source */}
                            {recipients.length > 0 && (() => {
                                const templateVarKeys = selectedTemplate ? getTemplateVariables(selectedTemplate) : [];
                                const missingCount = recipients.filter(r => {
                                    if (!templateVarKeys.length) return false;
                                    return templateVarKeys.some(k => !r.params?.[k] && !variableDefaults[k]);
                                }).length;

                                return (
                                    <div className="space-y-3 pt-4 border-t">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium text-sm">Recipients ({recipients.length})</h3>
                                                {missingCount > 0 && (
                                                    <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px] h-5">
                                                        <AlertCircle className="w-3 h-3 mr-1" />
                                                        {missingCount} with missing data
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setRecipients([]); setUploadProgress(null); }}>
                                                Clear All
                                            </Button>
                                        </div>

                                        {missingCount > 0 && (
                                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="font-medium">Some recipients have missing variable data</p>
                                                    <p className="text-xs mt-1 text-amber-700">
                                                        Messages will still be sent, but missing variables will appear as empty text.
                                                        Click the <Pencil className="w-3 h-3 inline" /> edit button to fill in values, or set fallback defaults in the mapping above.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border rounded-md overflow-hidden">
                                            <div className="max-h-[500px] overflow-auto">
                                                <Table>
                                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead>Phone</TableHead>
                                                            <TableHead>Name</TableHead>
                                                            <TableHead>Variables</TableHead>
                                                            <TableHead className="w-[80px]"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {recipients.map((r, i) => {
                                                            const isEditing = editingRecipientIdx === i;
                                                            const hasMissing = templateVarKeys.length > 0 && templateVarKeys.some(k => !r.params?.[k] && !variableDefaults[k]);

                                                            if (isEditing && editingRecipient) {
                                                                return (
                                                                    <TableRow key={i} className="bg-blue-50/50">
                                                                        <TableCell className="text-xs">
                                                                            <Input className="h-7 text-xs w-32" value={editingRecipient.phone_number} onChange={e => setEditingRecipient({ ...editingRecipient, phone_number: e.target.value })} />
                                                                        </TableCell>
                                                                        <TableCell className="text-xs">
                                                                            <Input className="h-7 text-xs w-28" value={editingRecipient.name || ''} placeholder="Name" onChange={e => setEditingRecipient({ ...editingRecipient, name: e.target.value })} />
                                                                        </TableCell>
                                                                        <TableCell className="text-xs">
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {templateVarKeys.map(k => (
                                                                                    <div key={k} className="flex items-center gap-1">
                                                                                        <span className="text-[10px] text-muted-foreground">{k}:</span>
                                                                                        <Input
                                                                                            className={cn("h-6 text-[11px] w-24 px-1", !editingRecipient.params?.[k] && "border-amber-300 bg-amber-50")}
                                                                                            value={editingRecipient.params?.[k] || ''}
                                                                                            placeholder={variableDefaults[k] || 'value...'}
                                                                                            onChange={e => setEditingRecipient({
                                                                                                ...editingRecipient,
                                                                                                params: { ...(editingRecipient.params || {}), [k]: e.target.value }
                                                                                            })}
                                                                                        />
                                                                                    </div>
                                                                                ))}
                                                                                {templateVarKeys.length === 0 && Object.entries(editingRecipient.params || {}).map(([k]) => (
                                                                                    <div key={k} className="flex items-center gap-1">
                                                                                        <span className="text-[10px] text-muted-foreground">{k}:</span>
                                                                                        <Input
                                                                                            className="h-6 text-[11px] w-24 px-1"
                                                                                            value={editingRecipient.params?.[k] || ''}
                                                                                            onChange={e => setEditingRecipient({
                                                                                                ...editingRecipient,
                                                                                                params: { ...(editingRecipient.params || {}), [k]: e.target.value }
                                                                                            })}
                                                                                        />
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <div className="flex gap-1">
                                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-green-600" onClick={handleSaveEditRecipient}>
                                                                                    <Check className="w-3 h-3" />
                                                                                </Button>
                                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-gray-600" onClick={handleCancelEditRecipient}>
                                                                                    <X className="w-3 h-3" />
                                                                                </Button>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            }

                                                            return (
                                                                <TableRow key={i} className={hasMissing ? 'bg-amber-50/30' : ''}>
                                                                    <TableCell className="font-medium text-xs">{maskPhoneNumber(r.phone_number)}</TableCell>
                                                                    <TableCell className="text-xs">{r.name || '-'}</TableCell>
                                                                    <TableCell className="text-xs">
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {Object.entries(r.params || {}).map(([k, v]) => (
                                                                                <Badge key={k} variant="outline" className={cn(
                                                                                    "text-[10px] px-1 py-0 h-5 font-normal",
                                                                                    !v && "border-amber-300 bg-amber-50 text-amber-600"
                                                                                )}>
                                                                                    {k}: {v || <span className="italic">empty</span>}
                                                                                </Badge>
                                                                            ))}
                                                                            {hasMissing && (
                                                                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 font-normal border-amber-300 bg-amber-50 text-amber-600">
                                                                                    <AlertCircle className="w-2.5 h-2.5 mr-0.5" /> missing
                                                                                </Badge>
                                                                            )}
                                                                            {(!r.params || Object.keys(r.params).length === 0) && !hasMissing && <span className="text-muted-foreground">-</span>}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <div className="flex gap-1">
                                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-blue-600" onClick={() => handleStartEditRecipient(i)}>
                                                                                <Pencil className="w-3 h-3" />
                                                                            </Button>
                                                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-red-600" onClick={() => handleRemoveRecipient(r.phone_number)}>
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {
                        currentStep === 2 && (
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Campaign Summary */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Campaign Summary</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Name</span>
                                                <span className="font-medium">{campaignName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Template</span>
                                                <span className="font-medium">{selectedTemplate?.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Recipients</span>
                                                <span className="font-medium">{recipients.length}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Account</span>
                                                <span className="font-medium">
                                                    {maskPhoneNumber(accounts.find(a => a.id === selectedAccountId)?.display_phone_number || '')}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Message Preview with Animated Variables */}
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-base">Message Preview</CardTitle>
                                            {selectedTemplate?.variable_count > 0 && recipients.length > 1 && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="relative flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                    </span>
                                                    Cycling through {recipients.length} recipients
                                                </div>
                                            )}
                                        </CardHeader>
                                        <CardContent>
                                            <div className="bg-green-50 rounded-lg p-4 relative">
                                                {/* Current recipient indicator */}
                                                {recipients.length > 0 && selectedTemplate?.variable_count > 0 && (
                                                    <div key={`recipient-${previewIndex}`} className="flex items-center gap-2 mb-3 pb-2 border-b border-green-200">
                                                        <span className="text-xs font-mono bg-white px-2 py-1 rounded shadow-sm transition-all duration-300">
                                                            {maskPhoneNumber(recipients[previewIndex]?.phone_number || recipients[0]?.phone_number || '')}
                                                        </span>
                                                        {(recipients[previewIndex]?.name || recipients[0]?.name) && (
                                                            <span className="text-xs font-medium text-green-700 transition-all duration-300">
                                                                {recipients[previewIndex]?.name || recipients[0]?.name}
                                                            </span>
                                                        )}
                                                        {recipients.length > 1 && (
                                                            <span className="text-xs text-muted-foreground ml-auto">
                                                                {previewIndex + 1} / {recipients.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {selectedTemplate?.header_text && (
                                                    <p className="font-medium text-sm mb-1 bg-white/50 p-2 rounded border border-green-100 shadow-sm">
                                                        {selectedTemplate.header_text.split(/(\{\{[^}]+\}\})/).map((part, i) => {
                                                            const varMatch = part.match(/\{\{([^}]+)\}\}/);
                                                            if (varMatch) {
                                                                const varName = varMatch[1].trim();
                                                                const currentRecipient = recipients[previewIndex] || recipients[0];
                                                                const value = resolveRecipientVariableValue(currentRecipient, varName, true);
                                                                return <span key={`h-${i}`} className="font-bold text-green-700">{value}</span>;
                                                            }
                                                            return part;
                                                        })}
                                                    </p>
                                                )}

                                                {/* Media Header Placeholders */}
                                                {templateNeedsMediaHeader(selectedTemplate) && (
                                                    <div className="mb-2 h-40 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border">
                                                        {stepHeaderImage ? (
                                                            getTemplateMediaHeaderFormat(selectedTemplate) === 'IMAGE' ? (
                                                                <img src={stepHeaderImage} alt="Header" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">{getTemplateMediaHeaderFormat(selectedTemplate)} header uploaded</span>
                                                            )
                                                        ) : (
                                                            <div className="text-center p-4">
                                                                <Upload className="w-8 h-8 mx-auto mb-1 opacity-20" />
                                                                <span className="text-xs text-muted-foreground">No Header Media Uploaded</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <p className="text-sm whitespace-pre-wrap leading-relaxed py-1">
                                                    {(selectedTemplate?.body_text || '').split(/(\{\{[^}]+\}\})/).map((part, i) => {
                                                        const varMatch = part.match(/\{\{([^}]+)\}\}/);
                                                        if (varMatch) {
                                                            const varName = varMatch[1].trim();
                                                            const currentRecipient = recipients[previewIndex] || recipients[0];
                                                            const value = resolveRecipientVariableValue(currentRecipient, varName, true);
                                                            return (
                                                                <span
                                                                    key={`b-${varName}-${previewIndex}-${i}`}
                                                                    className="inline-block bg-gradient-to-r from-green-200 to-emerald-200 text-green-800 px-1.5 py-0.5 rounded font-semibold mx-0.5 transition-all duration-500 shadow-sm"
                                                                >
                                                                    {value}
                                                                </span>
                                                            );
                                                        }
                                                        return part;
                                                    })}
                                                </p>

                                                {/* Button Preview */}
                                                {selectedTemplate?.components?.some((c: any) => c.type === 'BUTTONS') && (
                                                    <div className="mt-3 space-y-2 border-t pt-2">
                                                        {selectedTemplate.components.find((c: any) => c.type === 'BUTTONS')?.buttons?.map((btn: any, idx: number) => (
                                                            <div key={idx} className="bg-white text-blue-500 text-center py-2 rounded shadow-sm text-sm font-medium border cursor-pointer hover:bg-gray-50">
                                                                {btn.type === 'URL' && <span className="mr-1">🔗</span>}
                                                                {btn.type === 'PHONE_NUMBER' && <span className="mr-1">📞</span>}
                                                                {btn.text}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {selectedTemplate?.footer_text && (
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {selectedTemplate.footer_text}
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        )
                    }

                    {/* Step 3: Schedule */}
                    {
                        currentStep === 3 && (
                            <div className="space-y-6">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <Card
                                        className={cn(
                                            'cursor-pointer transition-all',
                                            scheduleType === 'now' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                                        )}
                                        onClick={() => setScheduleType('now')}
                                    >
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className={cn(
                                                'p-3 rounded-full',
                                                scheduleType === 'now' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                            )}>
                                                <Send className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium">Send Now</p>
                                                <p className="text-sm text-muted-foreground">Start sending immediately</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        className={cn(
                                            'cursor-pointer transition-all',
                                            scheduleType === 'later' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                                        )}
                                        onClick={() => setScheduleType('later')}
                                    >
                                        <CardContent className="p-4 flex items-center gap-4">
                                            <div className={cn(
                                                'p-3 rounded-full',
                                                scheduleType === 'later' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                            )}>
                                                <Calendar className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium">Schedule for Later</p>
                                                <p className="text-sm text-muted-foreground">Pick a date and time</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {scheduleType === 'later' && (
                                    <div className="space-y-4">
                                        <div className="grid sm:grid-cols-2 gap-4 max-w-md">
                                            <div className="space-y-2">
                                                <Label htmlFor="date">Date</Label>
                                                <Input
                                                    id="date"
                                                    type="date"
                                                    value={scheduledDate}
                                                    onChange={e => setScheduledDate(e.target.value)}
                                                    min={new Date().toISOString().split('T')[0]}
                                                    autoComplete="off"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="time">Time (IST)</Label>
                                                <Input
                                                    id="time"
                                                    type="time"
                                                    value={scheduledTime}
                                                    onChange={e => setScheduledTime(e.target.value)}
                                                    autoComplete="off"
                                                />
                                            </div>
                                        </div>

                                        {/* Beautiful scheduled time preview */}
                                        {scheduledDate && scheduledTime && (
                                            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 max-w-md">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-white rounded-full shadow-sm">
                                                            <Clock className="w-5 h-5 text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">Campaign will start at</p>
                                                            <p className="text-lg font-semibold text-blue-700">
                                                                {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleDateString('en-IN', {
                                                                    weekday: 'long',
                                                                    day: 'numeric',
                                                                    month: 'long',
                                                                    year: 'numeric'
                                                                })}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-2xl font-bold text-blue-800">
                                                                    {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleTimeString('en-IN', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                        hour12: true
                                                                    })}
                                                                </span>
                                                                <Badge variant="outline" className="bg-white text-blue-600 border-blue-300">
                                                                    IST 🇮🇳
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    }
                </CardContent >

                <CardFooter className="flex justify-between border-t pt-6">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (currentStep === 0) {
                                setView('list');
                            } else {
                                setCurrentStep(prev => prev - 1);
                            }
                        }}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>

                    {currentStep < WIZARD_STEPS.length - 1 ? (
                        <Button
                            onClick={() => {
                                // Auto-add phone numbers from textarea if on audience step
                                if (currentStep === 1 && phoneNumbersText.trim()) {
                                    handleAddPhoneNumbers();
                                }
                                setCurrentStep(prev => prev + 1);
                            }}
                            disabled={
                                (currentStep === 0 && (!campaignName || !selectedTemplate || (templateNeedsMediaHeader(selectedTemplate) && !stepHeaderImage))) ||
                                (currentStep === 1 && recipients.length === 0 && !phoneNumbersText.trim())
                            }
                        >
                            Next
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCreateCampaign}
                            disabled={submitting || (scheduleType === 'later' && (!scheduledDate || !scheduledTime))}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    {scheduleType === 'now' ? (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Send Now
                                        </>
                                    ) : (
                                        <>
                                            <Calendar className="w-4 h-4 mr-2" />
                                            Schedule
                                        </>
                                    )}
                                </>
                            )}
                        </Button>
                    )}
                </CardFooter>
            </Card >
        </div >
    );

    // Render campaign detail view
    const renderDetailView = () => {
        if (loadingDetail && !campaignDetail) {
            return (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            );
        }

        if (!campaignDetail) {
            return (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Campaign not found</p>
                    <Button variant="link" onClick={() => setView('list')}>Back to list</Button>
                </div>
            );
        }

        const stats = campaignStats || {
            total_recipients: campaignDetail.total_recipients,
            pending: campaignDetail.pending_count,
            queued: 0,
            sent: campaignDetail.sent_count,
            delivered: campaignDetail.delivered_count,
            read: campaignDetail.read_count,
            failed: campaignDetail.failed_count,
            clicked: 0,
            replied: 0,
            progress_percent: campaignDetail.progress_percent,
            delivery_rate: campaignDetail.delivery_rate,
            read_rate: campaignDetail.read_rate,
            failure_rate: 0,
            click_rate: 0,
            reply_rate: 0,
        };

        const StatusIcon = STATUS_ICONS[campaignDetail.status] || FileSpreadsheet;
        const templateStep = Array.isArray(campaignDetail.steps)
            ? campaignDetail.steps.find((step: any) => step?.template_name || step?.template_language || step?.language)
            : null;
        const campaignTemplateName =
            (campaignDetail.template_name || '').trim() ||
            String(templateStep?.template_name || '').trim() ||
            '-';
        const campaignTemplateLanguage =
            (campaignDetail.template_language || '').trim() ||
            (campaignDetail.language || '').trim() ||
            String(templateStep?.template_language || templateStep?.language || '').trim() ||
            '-';
        const finalizedCount = stats.delivered + stats.failed;
        const sentConsistencyGap = Math.max(stats.sent - finalizedCount, 0);

        const funnelValueMap: Record<'sent' | 'delivered' | 'read' | 'clicked' | 'replied', number> = {
            sent: stats.sent,
            delivered: stats.delivered,
            read: stats.read,
            clicked: stats.clicked || 0,
            replied: stats.replied || 0,
        };
        const funnelConfigMap: Record<'sent' | 'delivered' | 'read' | 'clicked' | 'replied', { label: string; color: string }> = {
            sent: { label: 'Sent', color: 'bg-indigo-500' },
            delivered: { label: 'Delivered', color: 'bg-green-500' },
            read: { label: 'Read', color: 'bg-emerald-500' },
            clicked: { label: 'Clicked', color: 'bg-blue-500' },
            replied: { label: 'Replied', color: 'bg-indigo-400' },
        };
        const funnelStageMap: Record<RecipientSegment, Array<'sent' | 'delivered' | 'read' | 'clicked' | 'replied'>> = {
            all: ['sent', 'delivered', 'read', 'clicked', 'replied'],
            pending: ['sent', 'delivered', 'read', 'clicked', 'replied'],
            sent: ['sent', 'delivered', 'read', 'clicked', 'replied'],
            delivered: ['delivered', 'read', 'clicked', 'replied'],
            read: ['read', 'clicked', 'replied'],
            clicked: ['clicked', 'replied'],
            replied: ['replied'],
            failed: ['sent', 'delivered', 'read', 'clicked', 'replied'],
        };
        const activeFunnelStageKeys = funnelStageMap[recipientSegment] || funnelStageMap.all;
        const funnelStages = activeFunnelStageKeys.map((key) => ({
            label: funnelConfigMap[key].label,
            value: funnelValueMap[key],
            color: funnelConfigMap[key].color,
        }));
        const funnelBase = Math.max(funnelStages[0]?.value || 0, 1);
        const lastRecipientUpdate = campaignRecipients.find((recipient) => !!recipient.last_event_at)?.last_event_at || null;
        const clicksDisabledReason = !clickTrackingMeta.trackingEnabled
            ? 'No tracking enabled'
            : (!clickTrackingMeta.hasTrackableUrl ? 'No URL added' : null);

        return (
            <div className="space-y-6 pb-28">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <Button variant="ghost" size="icon" onClick={() => setView('list')}>
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-[18px] font-semibold text-[#111827]">Campaign: {campaignDetail.name}</h1>
                                <Badge className={STATUS_COLORS[campaignDetail.status]}>
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {campaignDetail.status}
                                </Badge>
                            </div>
                            <p className="text-sm text-[#6B7280] mt-1">Template: {campaignDetail.template_name}</p>
                            <p className="text-sm text-[#6B7280]">
                                Last updated: {lastRecipientUpdate ? new Date(lastRecipientUpdate).toLocaleString() : 'No events yet'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {campaignDetail.status === 'running' && (
                            <Button variant="outline" onClick={handlePauseCampaign}>
                                <Pause className="w-4 h-4 mr-2" />
                                Pause
                            </Button>
                        )}
                        {campaignDetail.status === 'paused' && (
                            <Button onClick={handleResumeCampaign}>
                                <Play className="w-4 h-4 mr-2" />
                                Resume
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => handleRetargetRecipients('all', false)} disabled={retargetingRecipients}>
                            <RefreshCw className={cn('w-4 h-4 mr-2', retargetingRecipients && 'animate-spin')} />
                            Resend Campaign
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const rows = visibleCampaignRecipients.map((recipient) => {
                                    const status = getRecipientDisplayStatus(recipient);
                                    return {
                                        phone: recipient.phone_number,
                                        name: recipient.name || '',
                                        status,
                                        clicks: recipient.click_count || 0,
                                        replied: recipient.replied ? 'yes' : 'no',
                                        last_update: recipient.last_event_at ? new Date(recipient.last_event_at).toISOString() : '',
                                    };
                                });
                                if (rows.length === 0) {
                                    toast({
                                        title: 'Nothing to export',
                                        description: 'No recipients available in the current view.',
                                    });
                                    return;
                                }
                                const header = Object.keys(rows[0]);
                                const csv = [
                                    header.join(','),
                                    ...rows.map((row) =>
                                        header
                                            .map((key) => {
                                                const value = String((row as Record<string, string | number>)[key] ?? '');
                                                return `"${value.replace(/"/g, '""')}"`;
                                            })
                                            .join(',')
                                    ),
                                ].join('\n');
                                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${campaignDetail.name.replace(/\s+/g, '_')}_recipients.csv`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Sent', value: stats.sent, color: 'text-[#4F46E5]' },
                        { label: 'Delivered', value: stats.delivered, color: 'text-[#22C55E]' },
                        { label: 'Read', value: stats.read, color: 'text-[#10B981]' },
                        { label: 'Failed', value: stats.failed, color: 'text-[#EF4444]' },
                    ].map((item) => (
                        <Card key={item.label} className="border-[#E5E7EB] rounded-xl">
                            <CardContent className="p-4">
                                {/* Labels always visible, numbers animate with shimmer if loading */}
                                <p className="text-sm text-[#6B7280] mb-2">{item.label}</p>
                                {loadingStats ? (
                                    <div className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse" />
                                ) : (
                                    <p className={cn('text-3xl font-semibold', item.color)}>{item.value}</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="border-[#E5E7EB] rounded-xl bg-[#F9FAFB]">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-[#111827]">Delivery Funnel</CardTitle>
                        <CardDescription className="text-[#6B7280]">
                            {funnelStages.map((stage) => stage.label).join(' -> ')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {funnelStages.map((stage) => {
                            const percent = Math.max(0, Math.min(100, Math.round((stage.value / funnelBase) * 100)));
                            return (
                                <div key={stage.label} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-[#111827]">{stage.label}</span>
                                        <span className="text-[#6B7280]">{stage.value}</span>
                                    </div>
                                    <div className="h-2.5 w-full rounded-full bg-white border border-[#E5E7EB] overflow-hidden">
                                        <div className={cn('h-full rounded-full transition-all', stage.color)} style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        <p className="text-xs text-[#6B7280]">
                            Check: Total ({stats.total_recipients}) | Sent ({stats.sent}) = Delivered ({stats.delivered}) + Failed ({stats.failed})
                            {sentConsistencyGap > 0 ? ` + In-flight (${sentConsistencyGap})` : ''}
                        </p>
                    </CardContent>
                </Card>

                {stats.sent > 0 && stats.delivered === 0 && stats.read === 0 && stats.failed === 0 && campaignDetail.status === 'completed' && (
                    <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                <div>
                                    <p className="font-medium text-amber-800">Delivery status not updating</p>
                                    <p className="text-sm text-amber-700">Status webhooks may have been interrupted. Try resubscribing to resume delivery tracking.</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleResubscribeWebhooks}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Fix Status Tracking
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {campaignDetail.last_error && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-800">Last Error</p>
                                <p className="text-sm text-red-700">{campaignDetail.last_error}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {campaignFailures.length > 0 && (
                    <p className="text-sm text-[#6B7280]">
                        Loaded {campaignFailures.length} failure records from webhook diagnostics.
                    </p>
                )}

                <Card className="border-[#E5E7EB] rounded-xl">
                    <CardHeader className="pb-3 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="text-base">Recipient Intelligence</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <div className="relative w-full sm:w-60">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                                    <Input
                                        placeholder="Search phone or name"
                                        value={recipientSearch}
                                        onChange={(e) => setRecipientSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Button variant="outline" size="sm" onClick={fetchCampaignIntelligence}>
                                    <RefreshCw className={cn('w-4 h-4 mr-2', loadingRecipients && 'animate-spin')} />
                                    Refresh
                                </Button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {([
                                ['all', 'All'],
                                ['delivered', 'Delivered'],
                                ['read', 'Read'],
                                ['clicked', 'Clicked'],
                                ['replied', 'Replied'],
                                ['failed', 'Failed'],
                            ] as Array<[RecipientSegment, string]>).map(([segment, name]) => (
                                <button
                                    key={segment}
                                    type="button"
                                    className={cn(
                                        'px-3 py-2 text-sm rounded-md border transition-colors',
                                        recipientSegment === segment
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                            : 'bg-white border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]'
                                    )}
                                    onClick={() => {
                                        setRecipientSegment(segment);
                                        setSelectedRecipientPhones(new Set());
                                    }}
                                >
                                    {name} ({tabLabelCount(segment)})
                                </button>
                            ))}
                        </div>

                        {smartFilterOptions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {smartFilterOptions.map(([mode, label]) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        className={cn(
                                            'px-3 py-1.5 text-xs rounded-full border transition-colors',
                                            recipientSmartFilter === mode
                                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                : 'bg-[#F3F4F6] border-transparent text-[#374151]'
                                        )}
                                        onClick={() => {
                                            setRecipientSmartFilter((prev) => (prev === mode ? 'none' : mode));
                                            setSelectedRecipientPhones(new Set());
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                                {recipientSmartFilter !== 'none' && (
                                    <button
                                        type="button"
                                        className="px-3 py-1.5 text-xs rounded-full border border-[#D1D5DB] bg-white text-[#374151]"
                                        onClick={() => {
                                            setRecipientSmartFilter('none');
                                            setSelectedRecipientPhones(new Set());
                                        }}
                                    >
                                        Clear filter
                                    </button>
                                )}
                            </div>
                        )}
                    </CardHeader>

                    <CardContent>
                        {loadingRecipients && visibleCampaignRecipients.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : visibleCampaignRecipients.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-6 text-center">No recipients in this segment.</div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-3 text-sm text-[#374151]">
                                    <input
                                        type="checkbox"
                                        checked={visibleCampaignRecipients.length > 0 && selectedRecipientPhones.size === visibleCampaignRecipients.length}
                                        onChange={toggleSelectAllRecipients}
                                        className="h-4 w-4"
                                    />
                                    <span>Select all in current tab ({recipientTotalFiltered})</span>
                                </div>
                                <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10" />
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Clicks</TableHead>
                                            <TableHead>Reply</TableHead>
                                            <TableHead>Last Update</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleCampaignRecipients.map((recipient) => {
                                            const displayStatus = getRecipientDisplayStatus(recipient);
                                            const failureDetail =
                                                displayStatus === 'failed'
                                                    ? campaignFailuresByPhone.get(normalizePhoneForMatch(recipient.phone_number))
                                                    : undefined;
                                            const failureMessage = recipient.error_message || failureDetail?.error_message;
                                            const failureCode = failureDetail?.error_code;
                                            return (
                                                <TableRow key={recipient.phone_number}>
                                                    <TableCell>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedRecipientPhones.has(recipient.phone_number)}
                                                            onChange={() => toggleRecipientSelection(recipient.phone_number)}
                                                            className="h-4 w-4"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-mono text-sm">{maskPhoneNumber(recipient.phone_number)}</TableCell>
                                                    <TableCell>{recipient.name || '-'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={RECIPIENT_STATUS_BADGE_CLASS[displayStatus]}>
                                                            {displayStatus}
                                                        </Badge>
                                                        {displayStatus === 'failed' && (failureMessage || failureCode) && (
                                                            <div className="mt-1 space-y-0.5 max-w-xs">
                                                                {failureMessage && (
                                                                    <p className="text-xs text-red-600 truncate" title={failureMessage}>
                                                                        {failureMessage}
                                                                    </p>
                                                                )}
                                                                {failureCode && (
                                                                    <p className="text-xs text-red-700 font-medium">Code: {failureCode}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {clicksDisabledReason ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="inline-flex items-center gap-1 text-sm text-[#9CA3AF] cursor-not-allowed">
                                                                        <MousePointer className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                                                        {recipient.click_count || 0}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{clicksDisabledReason}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-sm">
                                                                <MousePointer className="w-3.5 h-3.5 text-[#6B7280]" />
                                                                {recipient.click_count || 0}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate" title={recipient.reply_preview || ''}>
                                                        {recipient.replied ? (
                                                            <span className="inline-flex items-center gap-1 text-emerald-600">
                                                                <Check className="w-3.5 h-3.5" />
                                                                {recipient.reply_preview || 'Replied'}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[#9CA3AF]">
                                                                <X className="w-3.5 h-3.5" />
                                                                No reply
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-[#6B7280]">
                                                        {recipient.last_event_at ? new Date(recipient.last_event_at).toLocaleString() : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur border border-[#E5E7EB] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
                    <div className="text-sm font-medium text-[#111827]">
                        {selectedRecipientPhones.size} selected
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <Input
                            placeholder="Retarget campaign name (optional)"
                            value={retargetName}
                            onChange={(e) => setRetargetName(e.target.value)}
                            className="w-full sm:w-64"
                        />
                        <Button
                            variant="outline"
                            onClick={() => handleRetargetRecipients(recipientSegment, true)}
                            disabled={retargetingRecipients || selectedRecipientPhones.size === 0}
                        >
                            {retargetingRecipients ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Retarget
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleRetargetRecipients(recipientSegment, false)}
                            disabled={retargetingRecipients}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Resend
                        </Button>
                    </div>
                </div>

                {/* Campaign Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Campaign Details</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created</span>
                                <span>{new Date(campaignDetail.created_at).toLocaleString()}</span>
                            </div>
                            {campaignDetail.scheduled_at && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Scheduled For</span>
                                    <span>{new Date(campaignDetail.scheduled_at).toLocaleString()}</span>
                                </div>
                            )}
                            {campaignDetail.started_at && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Started</span>
                                    <span>{new Date(campaignDetail.started_at).toLocaleString()}</span>
                                </div>
                            )}
                            {campaignDetail.completed_at && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Completed</span>
                                    <span>{new Date(campaignDetail.completed_at).toLocaleString()}</span>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Template</span>
                                <span>{campaignTemplateName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Language</span>
                                <span>{campaignTemplateLanguage}</span>
                            </div>
                            {campaignDetail.description && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Description</span>
                                    <span className="text-right max-w-xs truncate">{campaignDetail.description}</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    return (
        <TooltipProvider>
            <div className="w-full min-h-screen py-6 px-3 sm:px-6 lg:px-8">
                {view === 'list' && renderListView()}
                {view === 'create' && renderCreateView()}
                {view === 'detail' && renderDetailView()}
            </div>
        </TooltipProvider>
    );
}
