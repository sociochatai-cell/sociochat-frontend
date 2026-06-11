import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitMerge, Plus, Trash2, Clock, Play, UserPlus, ArrowRight, Loader2, RefreshCw, Users, Upload, FileSpreadsheet, Pause, RotateCcw, Eye, X, BarChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config';
import { DripEnrollmentDialog } from '../components/DripEnrollmentDialog';
import { getActiveAccountId } from '../utils/accountContext';

const API_BASE = API_BASE_URL;

interface Template {
    id: number;
    name: string;
    language: string;
    category: string;
    status: string;
    variable_count?: number;
    body_text?: string;  // Template body for preview
    header_format?: string;  // TEXT, IMAGE, VIDEO, DOCUMENT
}

interface Step {
    id?: number;
    step_order: number;
    delay_seconds: number;
    // Template fields
    template_name?: string;
    language?: string;
    template_params?: Record<string, { source: string; value: string; fallback?: string }>;
    exit_on_reply?: boolean;
    // Logic fields
    step_type?: 'template' | 'loop' | 'condition';
    config?: any;
}

interface Campaign {
    id: number;
    name: string;
    description: string;
    status: string;
    trigger_type?: string;  // 'manual' | 'new_lead' | 'new_contact' | 'google_sheet_row' | 'new_message'
    enrolled_count: number;
    steps: Step[];
}

export function DripCampaignsSection({ accountId: propAccountId }: { accountId: number }) {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [accountId, setAccountId] = useState<number>(propAccountId);

    // Auto-resolve accountId when the prop is 0/falsy (standalone route)
    useEffect(() => {
        if (propAccountId) {
            setAccountId(propAccountId);
        } else {
            getActiveAccountId(API_BASE).then((id) => {
                if (id) {
                    setAccountId(id);
                } else {
                    toast.error('No WhatsApp account found. Please connect one first.');
                    setLoading(false);
                }
            });
        }
    }, [propAccountId]);

    // Templates list
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Create Dialog
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newCampaign, setNewCampaign] = useState({ name: '', description: '', trigger_type: 'drip_manual', steps: [] as Step[] });

    // Step editor
    const [currentSteps, setCurrentSteps] = useState<Step[]>([]);
    const [stepType, setStepType] = useState<'template' | 'loop'>('template');

    // Template Step State
    const [stepTemplate, setStepTemplate] = useState('');
    const [stepDelay, setStepDelay] = useState('0');
    const [stepVariables, setStepVariables] = useState<Record<string, string>>({});  // {"1": "name", "2": "company"}
    const [stepFallbacks, setStepFallbacks] = useState<Record<string, string>>({});  // {"1": "there", "2": ""}
    const [stepExitOnReply, setStepExitOnReply] = useState(false);
    const [stepHeaderImage, setStepHeaderImage] = useState('');  // URL for image header
    const [uploadingImage, setUploadingImage] = useState(false);

    // Loop Step State
    const [loopCount, setLoopCount] = useState('1');
    const [jumpTarget, setJumpTarget] = useState('1');

    // Enroll Dialog (unified for manual, CSV, dataset)
    const [enrollCampaign, setEnrollCampaign] = useState<Campaign | null>(null);
    const [enrollDefaultTab, setEnrollDefaultTab] = useState<'manual' | 'csv' | 'dataset'>('manual');
    const [enrollPhone, setEnrollPhone] = useState('');
    const [enrolling, setEnrolling] = useState(false);

    // Bulk Enrollment (legacy - keeping state for now but redirecting to unified dialog)
    const [bulkEnrollCampaign, setBulkEnrollCampaign] = useState<Campaign | null>(null);
    const [bulkPhones, setBulkPhones] = useState('');
    const [bulkEnrolling, setBulkEnrolling] = useState(false);
    const [uploadingCSV, setUploadingCSV] = useState(false);

    // Google Sheets Import
    const [sheetsCampaign, setSheetsCampaign] = useState<Campaign | null>(null);
    const [sheetsUrl, setSheetsUrl] = useState('');
    const [sheetsTab, setSheetsTab] = useState('Sheet1');
    const [importingSheets, setImportingSheets] = useState(false);

    // Google Sheets Preview (for new campaign creation)
    const [sheetsPhoneColumn, setSheetsPhoneColumn] = useState('phone');
    const [sheetsPreviewData, setSheetsPreviewData] = useState<{ headers: string[]; rows: any[][] } | null>(null);
    const [sheetsPreviewLoading, setSheetsPreviewLoading] = useState(false);
    const [sheetsPreviewVisible, setSheetsPreviewVisible] = useState(false);
    const [sheetsVarMapping, setSheetsVarMapping] = useState<{ [key: string]: string }>({});
    const [sheetsServiceAccountEmail, setSheetsServiceAccountEmail] = useState<string | null>(null);
    const [emailCopied, setEmailCopied] = useState(false);


    // View Enrollees
    const [viewEnrolleesCampaign, setViewEnrolleesCampaign] = useState<Campaign | null>(null);
    const [enrollees, setEnrollees] = useState<any[]>([]);
    const [loadingEnrollees, setLoadingEnrollees] = useState(false);
    const [enrolleesPage, setEnrolleesPage] = useState(1);
    const [enrolleesTotal, setEnrolleesTotal] = useState(0);

    // CRM Audience (for bulk enrollment from CRM)
    const [crmAudienceCampaign, setCrmAudienceCampaign] = useState<Campaign | null>(null);
    const [crmAudienceTab, setCrmAudienceTab] = useState<'leads' | 'contacts'>('leads');
    const [crmAudienceSummary, setCrmAudienceSummary] = useState<{
        leads_with_phone: number;
        contacts_with_phone: number;
        total_available: number;
        suppressed: number;
        already_enrolled: number;
        estimated_enrollable: number;
    } | null>(null);
    const [crmLeads, setCrmLeads] = useState<any[]>([]);
    const [crmContacts, setCrmContacts] = useState<any[]>([]);
    const [loadingCrmAudience, setLoadingCrmAudience] = useState(false);
    const [enrollingFromCrm, setEnrollingFromCrm] = useState(false);
    const [selectedCrmLeads, setSelectedCrmLeads] = useState<Set<string>>(new Set());
    const [selectedCrmContacts, setSelectedCrmContacts] = useState<Set<string>>(new Set());

    // Manual Sheet Sync
    const [syncingCampaignId, setSyncingCampaignId] = useState<number | null>(null);
    const [syncCooldowns, setSyncCooldowns] = useState<{ [campaignId: number]: number }>({}); // Cooldown timer in seconds

    // CRM Live Preview
    const [crmVariableSchema, setCrmVariableSchema] = useState<any>(null);
    const [crmPreviewIndex, setCrmPreviewIndex] = useState(0);
    const [crmIsPreviewPlaying, setCrmIsPreviewPlaying] = useState(true);
    // Variable mapping: { [templateVarIndex]: crmField or manual value }
    const [crmVarMapping, setCrmVarMapping] = useState<{ [key: string]: string }>({});
    // Manual values for variables
    const [crmManualVars, setCrmManualVars] = useState<{ [key: string]: string }>({});

    // Auto-cycle CRM preview
    useEffect(() => {
        const currentList = crmAudienceTab === 'leads' ? crmLeads : crmContacts;
        if (crmIsPreviewPlaying && currentList.length > 0 && crmAudienceCampaign) {
            const interval = setInterval(() => {
                setCrmPreviewIndex(prev => (prev + 1) % currentList.length);
            }, 2500);
            return () => clearInterval(interval);
        }
    }, [crmIsPreviewPlaying, crmLeads.length, crmContacts.length, crmAudienceTab, crmAudienceCampaign]);

    // Reset preview index when switching tabs
    useEffect(() => {
        setCrmPreviewIndex(0);
    }, [crmAudienceTab]);

    useEffect(() => {
        if (accountId) {
            loadCampaigns();
            loadTemplates();
        }
    }, [accountId]);

    async function loadCampaigns() {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setCampaigns(data.campaigns || []);
            }
        } catch (err) {
            console.error('Failed to load campaigns:', err);
            toast.error("Failed to load campaigns");
        } finally {
            setLoading(false);
        }
    }

    // Manual sync for Google Sheet campaigns
    async function handleManualSync(campaignId: number) {
        setSyncingCampaignId(campaignId);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/sheets/sync/${campaignId}`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `Synced ${data.enrolled || 0} new contacts`);
                loadCampaigns(); // Refresh to show updated enrolled count

                // Start 5-minute cooldown timer
                const COOLDOWN_SECONDS = 300; // 5 minutes
                setSyncCooldowns(prev => ({ ...prev, [campaignId]: COOLDOWN_SECONDS }));

                const interval = setInterval(() => {
                    setSyncCooldowns(prev => {
                        const remaining = (prev[campaignId] || 0) - 1;
                        if (remaining <= 0) {
                            clearInterval(interval);
                            const { [campaignId]: _, ...rest } = prev;
                            return rest;
                        }
                        return { ...prev, [campaignId]: remaining };
                    });
                }, 1000);
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch (err) {
            console.error('Sync failed:', err);
            toast.error('Failed to sync sheet');
        } finally {
            setSyncingCampaignId(null);
        }
    }

    async function loadTemplates() {
        try {
            setLoadingTemplates(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/templates?account_id=${accountId}&status=APPROVED`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoadingTemplates(false);
        }
    }

    function addStep() {
        // Logic for Loop Step
        if (stepType === 'loop') {
            const newStep: Step = {
                step_order: currentSteps.length + 1,
                delay_seconds: 0, // Loops usually execute immediately
                step_type: 'loop',
                config: {
                    loop_count: parseInt(loopCount) || 1,
                    jump_target: parseInt(jumpTarget) || 1
                }
            };
            setCurrentSteps([...currentSteps, newStep]);
            setLoopCount('1');
            setJumpTarget('1');
            return;
        }

        // Logic for Template Step
        if (!stepTemplate) return;

        // Find selected template to get variable count
        const selectedTpl = templates.find(t => t.name === stepTemplate);
        const varCount = selectedTpl?.variable_count || 0;

        // Build template_params from step-level variable mapping
        // Uses the values from stepVariables and stepFallbacks state
        const template_params: Record<string, { source: string; value: string; fallback: string }> = {};
        for (let i = 1; i <= varCount; i++) {
            const fieldValue = stepVariables[String(i)] || '';
            const fallbackValue = stepFallbacks[String(i)] || '';

            template_params[String(i)] = {
                source: fieldValue ? 'field' : 'static',
                value: fieldValue || fallbackValue || `var_${i}`, // Use field name or fallback
                fallback: fallbackValue || 'Customer'
            };
        }

        const newStep: Step = {
            step_order: currentSteps.length + 1,
            template_name: stepTemplate,
            delay_seconds: parseInt(stepDelay) * 60,
            language: selectedTpl?.language || 'en_US',
            template_params: Object.keys(template_params).length > 0 ? template_params : undefined,
            exit_on_reply: stepExitOnReply,
            header_image_url: stepHeaderImage || undefined,
            step_type: 'template'
        } as Step & { header_image_url?: string };

        setCurrentSteps([...currentSteps, newStep]);

        // Reset all step form fields
        setStepTemplate('');
        setStepDelay('0');
        setStepExitOnReply(false);
        setStepVariables({});   // Clear variable mappings
        setStepFallbacks({});   // Clear fallbacks
        setStepHeaderImage('');
    }

    // Fetch Google Sheets preview data
    async function fetchSheetsPreview() {
        if (!sheetsUrl) {
            toast.error('Please enter a Google Sheet URL');
            return;
        }

        setSheetsPreviewLoading(true);
        try {
            // Also fetch config to get service account email
            const configRes = await fetch(`${API_BASE}/api/whatsapp/sheets/config`, { credentials: 'include' });
            if (configRes.ok) {
                const config = await configRes.json();
                setSheetsServiceAccountEmail(config.service_account_email);
            }

            const res = await fetch(`${API_BASE}/api/whatsapp/sheets/preview?sheet_id=${encodeURIComponent(sheetsUrl)}&sheet_name=${encodeURIComponent(sheetsTab)}&limit=5`, {
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                setSheetsPreviewData({
                    headers: data.headers || [],
                    rows: data.rows || []
                });
                setSheetsPreviewVisible(true);

                // Auto-detect phone column
                const phoneColIndex = (data.headers || []).findIndex((h: string) =>
                    h.toLowerCase().includes('phone') || h.toLowerCase().includes('mobile') || h.toLowerCase().includes('whatsapp')
                );
                if (phoneColIndex >= 0) {
                    setSheetsPhoneColumn(data.headers[phoneColIndex]);
                    toast.success(`Auto-detected phone column: ${data.headers[phoneColIndex]}`);
                }
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to fetch sheet data');
            }
        } catch (e) {
            toast.error('Error fetching sheet preview');
        } finally {
            setSheetsPreviewLoading(false);
        }
    }

    function removeStep(index: number) {
        const updated = currentSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 }));
        setCurrentSteps(updated);
    }

    async function handleCreate() {
        if (!newCampaign.name) {
            toast.error("Name is required");
            return;
        }

        try {
            const payload: any = {
                ...newCampaign,
                status: 'active',  // Set to active so scheduler picks it up
                steps: currentSteps
            };

            // For Google Sheet triggers, include sheet configuration
            if (newCampaign.trigger_type === 'google_sheet_row') {
                payload.sheet_id = sheetsUrl;
                payload.sheet_name = sheetsTab || 'Sheet1';
                payload.phone_column = sheetsPhoneColumn || 'phone';
            }

            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success("Campaign created");
                setIsCreateOpen(false);
                setNewCampaign({ name: '', description: '', trigger_type: 'drip_manual', steps: [] });
                setCurrentSteps([]);
                loadCampaigns();
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed");
            }
        } catch (err) {
            toast.error("Error creating campaign");
        }
    }

    async function handleDelete(campaignId: number) {
        if (!confirm('Are you sure you want to delete this campaign? All enrollments will also be deleted.')) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaignId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (res.ok) {
                toast.success('Campaign deleted');
                loadCampaigns();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to delete');
            }
        } catch (err) {
            toast.error('Error deleting campaign');
        }
    }

    async function handleEnroll() {
        if (!enrollCampaign || !enrollPhone) return;

        try {
            setEnrolling(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${enrollCampaign.id}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone_number: enrollPhone })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Enrolled ${enrollPhone}`);
                setEnrollCampaign(null);
                setEnrollPhone('');
                loadCampaigns();
            } else {
                toast.error(data.error || "Enrollment failed");
            }
        } catch (err) {
            toast.error("Enrollment failed");
        } finally {
            setEnrolling(false);
        }
    }

    // Bulk Enrollment Handler
    async function handleBulkEnroll() {
        if (!bulkEnrollCampaign || !bulkPhones.trim()) return;

        const phoneList = bulkPhones
            .split(/[\n,;]+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (phoneList.length === 0) {
            toast.error("No valid phone numbers found");
            return;
        }

        try {
            setBulkEnrolling(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${bulkEnrollCampaign.id}/bulk-enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone_numbers: phoneList })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Enrolled ${data.enrolled} contacts (${data.skipped} skipped)`);
                setBulkEnrollCampaign(null);
                setBulkPhones('');
                loadCampaigns();
            } else {
                toast.error(data.error || "Bulk enrollment failed");
            }
        } catch (err) {
            toast.error("Bulk enrollment failed");
        } finally {
            setBulkEnrolling(false);
        }
    }

    // CSV Upload Handler
    async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !bulkEnrollCampaign) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('column_mapping', '{}');

        try {
            setUploadingCSV(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${bulkEnrollCampaign.id}/import-contacts`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Imported ${data.enrolled} from ${data.file} (${data.skipped} skipped)`);
                setBulkEnrollCampaign(null);
                loadCampaigns();
            } else {
                toast.error(data.error || "Import failed");
            }
        } catch (err) {
            toast.error("CSV import failed");
        } finally {
            setUploadingCSV(false);
            e.target.value = '';
        }
    }

    // Google Sheets Import Handler
    async function handleSheetsImport() {
        if (!sheetsCampaign || !sheetsUrl.trim()) return;

        try {
            setImportingSheets(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${sheetsCampaign.id}/import-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    sheet_id: sheetsUrl,
                    sheet_name: sheetsTab
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Imported ${data.enrolled} contacts from Google Sheet`);
                setSheetsCampaign(null);
                setSheetsUrl('');
                loadCampaigns();
            } else {
                toast.error(data.error || "Google Sheets import failed");
            }
        } catch (err) {
            toast.error("Google Sheets import failed");
        } finally {
            setImportingSheets(false);
        }
    }

    // Load Enrollees
    async function loadEnrollees(campaignId: number, page: number = 1) {
        try {
            setLoadingEnrollees(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaignId}/enrollments?page=${page}&limit=20`, {
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                setEnrollees(data.enrollments || []);
                setEnrolleesTotal(data.pagination?.total || 0);
                setEnrolleesPage(page);
            }
        } catch (err) {
            toast.error("Failed to load enrollees");
        } finally {
            setLoadingEnrollees(false);
        }
    }

    // Enrollment Action (pause/resume/restart)
    async function handleEnrollmentAction(enrollmentId: number, action: 'pause' | 'resume' | 'restart') {
        if (!viewEnrolleesCampaign) return;

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${viewEnrolleesCampaign.id}/enrollments/${enrollmentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ action })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                loadEnrollees(viewEnrolleesCampaign.id, enrolleesPage);
            } else {
                toast.error(data.error || "Action failed");
            }
        } catch (err) {
            toast.error("Action failed");
        }
    }

    // Remove Enrollment
    async function handleRemoveEnrollment(enrollmentId: number) {
        if (!viewEnrolleesCampaign) return;
        if (!confirm('Remove this contact from the campaign?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${viewEnrolleesCampaign.id}/enrollments/${enrollmentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                loadEnrollees(viewEnrolleesCampaign.id, enrolleesPage);
                loadCampaigns();
            } else {
                toast.error(data.error || "Failed to remove");
            }
        } catch (err) {
            toast.error("Failed to remove enrollment");
        }
    }

    // Load CRM Audience for bulk enrollment
    async function loadCrmAudience(campaignId: number) {
        try {
            setLoadingCrmAudience(true);
            setCrmLeads([]);
            setCrmContacts([]);
            setSelectedCrmLeads(new Set());
            setSelectedCrmContacts(new Set());
            setCrmPreviewIndex(0);

            // Load variable schema for preview
            const schemaRes = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${campaignId}/variables`, {
                credentials: 'include'
            });
            if (schemaRes.ok) {
                const schemaData = await schemaRes.json();
                setCrmVariableSchema(schemaData.schema);
            }

            // Get summary first
            const summaryRes = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/crm-audience/summary?campaign_id=${campaignId}`, {
                credentials: 'include'
            });

            if (summaryRes.ok) {
                const summary = await summaryRes.json();
                setCrmAudienceSummary(summary);
            }

            // Get leads list (include_all=true to show leads without phone too)
            const leadsRes = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/crm-audience/leads?campaign_id=${campaignId}&limit=100&include_all=true`, {
                credentials: 'include'
            });

            if (leadsRes.ok) {
                const data = await leadsRes.json();
                setCrmLeads(data.leads || []);
            }

            // Get contacts list
            const contactsRes = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/crm-audience/contacts?campaign_id=${campaignId}&limit=100`, {
                credentials: 'include'
            });

            if (contactsRes.ok) {
                const data = await contactsRes.json();
                setCrmContacts(data.contacts || []);
            }
        } catch (err) {
            toast.error("Failed to load CRM audience");
        } finally {
            setLoadingCrmAudience(false);
        }
    }

    // Enroll selected leads and contacts from CRM
    async function enrollFromCrm() {
        if (!crmAudienceCampaign) return;

        // Combine phone numbers from both selected leads and contacts
        const leadPhones = crmLeads
            .filter(lead => selectedCrmLeads.has(lead.id))
            .map(lead => lead.phone_normalized || lead.phone)
            .filter(p => p);

        const contactPhones = crmContacts
            .filter(contact => selectedCrmContacts.has(contact.id))
            .map(contact => contact.phone_normalized || contact.phone)
            .filter(p => p);

        const phoneList = [...new Set([...leadPhones, ...contactPhones])]; // Dedupe

        if (phoneList.length === 0) {
            toast.error("No valid phone numbers selected");
            return;
        }

        try {
            setEnrollingFromCrm(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/drip-campaigns/${crmAudienceCampaign.id}/bulk-enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phone_numbers: phoneList })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(`Enrolled ${data.enrolled} from CRM (${data.skipped} skipped)`);
                setCrmAudienceCampaign(null);
                setCrmLeads([]);
                setCrmContacts([]);
                setSelectedCrmLeads(new Set());
                setSelectedCrmContacts(new Set());
                loadCampaigns();
            } else {
                toast.error(data.error || "CRM enrollment failed");
            }
        } catch (err) {
            toast.error("CRM enrollment failed");
        } finally {
            setEnrollingFromCrm(false);
        }
    }

    // Toggle lead selection
    function toggleLeadSelection(leadId: string) {
        setSelectedCrmLeads(prev => {
            const next = new Set(prev);
            if (next.has(leadId)) {
                next.delete(leadId);
            } else {
                next.add(leadId);
            }
            return next;
        });
    }

    // Select all valid leads only
    function selectAllLeads() {
        const validLeads = crmLeads.filter(l => l.is_valid !== false);
        if (selectedCrmLeads.size === validLeads.length) {
            setSelectedCrmLeads(new Set());
        } else {
            setSelectedCrmLeads(new Set(validLeads.map(l => l.id)));
        }
    }

    // Toggle contact selection
    function toggleContactSelection(contactId: string) {
        setSelectedCrmContacts(prev => {
            const next = new Set(prev);
            if (next.has(contactId)) {
                next.delete(contactId);
            } else {
                next.add(contactId);
            }
            return next;
        });
    }

    // Select all valid contacts
    function selectAllContacts() {
        const validContacts = crmContacts.filter(c => c.phone);
        if (selectedCrmContacts.size === validContacts.length) {
            setSelectedCrmContacts(new Set());
        } else {
            setSelectedCrmContacts(new Set(validContacts.map(c => c.id)));
        }
    }


    return (
        <Card className="border shadow-sm bg-gradient-to-br from-green-50/50 via-white to-emerald-50/30">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500" />
            <CardHeader
                className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 shadow-sm">
                            <GitMerge className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Drip Campaigns</CardTitle>
                            <CardDescription>Automated sequences of messages over time</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
                            {campaigns.length} Active
                        </Badge>
                        {isOpen ? <div className="text-emerald-500">▼</div> : <div className="text-gray-400">▶</div>}
                    </div>
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="pt-0 pb-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-end mb-4 gap-2">
                        <Button variant="outline" onClick={() => navigate('/dashboard/drip-analytics')}>
                            <BarChart className="w-4 h-4 mr-2" />
                            Global Analytics
                        </Button>

                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Campaign
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden shadow-2xl border-none">
                                <div className="p-6 pb-2 border-b bg-white sticky top-0 z-10">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                            <Plus className="w-5 h-5 text-emerald-500" />
                                            Create Drip Campaign
                                        </DialogTitle>
                                    </DialogHeader>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-6">
                                    <div className="space-y-2">
                                        <Label>Campaign Name</Label>
                                        <Input
                                            value={newCampaign.name}
                                            onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                            placeholder="e.g. New User Onboarding"
                                        />
                                    </div>

                                    {/* Trigger Type Selector */}
                                    <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                                        <Label className="text-sm font-medium text-blue-700 mb-2 block">⚡ Trigger</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: 'drip_manual', label: 'Manual Enrollment', icon: '👤', desc: 'Manually enroll users via the Enroll button' },
                                                { value: 'new_message', label: 'New WhatsApp Message', icon: '💬', desc: 'Auto-enroll when a new user sends their first WhatsApp message' },
                                                { value: 'new_lead', label: 'New CRM Lead', icon: '📋', desc: 'Auto-enroll when a new lead is created in CRM' },
                                                { value: 'new_contact', label: 'New CRM Contact', icon: '👥', desc: 'Auto-enroll when a new contact is created in CRM' },
                                                { value: 'google_sheet_row', label: 'Google Sheet Row', icon: '📊', desc: 'Auto-enroll when new row is added to linked Google Sheet (syncs every 15 min)' },
                                            ].map(trigger => (
                                                <div
                                                    key={trigger.value}
                                                    onClick={() => setNewCampaign({ ...newCampaign, trigger_type: trigger.value })}
                                                    className={`p-3 rounded border cursor-pointer transition-all text-xs flex items-center gap-2 ${newCampaign.trigger_type === trigger.value
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                                                        : 'border-gray-200 bg-white hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <span className="text-lg">{trigger.icon}</span>
                                                    <span className="font-medium">{trigger.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            {newCampaign.trigger_type === 'drip_manual' && 'Manually enroll users via the Enroll button'}
                                            {newCampaign.trigger_type === 'new_message' && 'Auto-enroll when a new user sends their first WhatsApp message'}
                                            {newCampaign.trigger_type === 'new_lead' && 'Auto-enroll when a new lead is created in CRM'}
                                            {newCampaign.trigger_type === 'new_contact' && 'Auto-enroll when a new contact is created in CRM'}
                                            {newCampaign.trigger_type === 'google_sheet_row' && '📊 Auto-enroll when new row is added to linked Google Sheet. Configure sheet link after creating campaign.'}
                                        </p>
                                    </div>

                                    {/* Trigger-Specific Configuration */}
                                    {newCampaign.trigger_type === 'new_lead' && (
                                        <div className="p-4 bg-amber-50 rounded-lg border-2 border-amber-300">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-amber-500 text-white">Auto-triggered</Badge>
                                                    <h4 className="text-sm font-medium text-amber-800">
                                                        📋 CRM Lead Source
                                                    </h4>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-amber-700 border-amber-300 hover:bg-amber-100"
                                                    onClick={() => window.open('/crm/leads', '_blank')}
                                                >
                                                    <Users className="w-4 h-4 mr-1" />
                                                    View Leads
                                                </Button>
                                            </div>
                                            <p className="text-xs text-amber-600 mt-2">
                                                New leads with phone numbers will automatically enroll. Map variables when adding steps below.
                                            </p>
                                        </div>
                                    )}

                                    {newCampaign.trigger_type === 'new_contact' && (
                                        <div className="p-4 bg-indigo-50 rounded-lg border-2 border-indigo-300">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-indigo-500 text-white">Auto-triggered</Badge>
                                                    <h4 className="text-sm font-medium text-indigo-800">
                                                        👥 CRM Contact Source
                                                    </h4>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                                                    onClick={() => window.open('/crm/contacts', '_blank')}
                                                >
                                                    <Users className="w-4 h-4 mr-1" />
                                                    View Contacts
                                                </Button>
                                            </div>
                                            <p className="text-xs text-indigo-600 mt-2">
                                                New contacts with phone numbers will automatically enroll. Map variables when adding steps below.
                                            </p>
                                        </div>
                                    )}

                                    {newCampaign.trigger_type === 'google_sheet_row' && (
                                        <div className="p-4 bg-green-50 rounded-lg border-2 border-green-300 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge className="bg-green-500 text-white">Auto-triggered</Badge>
                                                    <h4 className="text-sm font-medium text-green-800">
                                                        📊 Google Sheet Source
                                                    </h4>
                                                </div>
                                                <Badge variant="outline" className="text-green-600 border-green-300">
                                                    Syncs every 15 min
                                                </Badge>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs text-green-700">Google Sheet URL</Label>
                                                    <Input
                                                        placeholder="https://docs.google.com/spreadsheets/d/..."
                                                        value={sheetsUrl}
                                                        onChange={(e) => setSheetsUrl(e.target.value)}
                                                        className="mt-1 text-sm"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Label className="text-xs text-green-700">Sheet Tab Name</Label>
                                                        <Input
                                                            placeholder="Sheet1"
                                                            value={sheetsTab}
                                                            onChange={(e) => setSheetsTab(e.target.value)}
                                                            className="mt-1 text-sm"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-xs text-green-700">Phone Column</Label>
                                                        {sheetsPreviewData?.headers?.length ? (
                                                            <Select value={sheetsPhoneColumn} onValueChange={setSheetsPhoneColumn}>
                                                                <SelectTrigger className="mt-1 h-9 text-sm">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {sheetsPreviewData.headers.filter((h: string) => h && h.trim()).map((h: string) => (
                                                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Input
                                                                placeholder="phone"
                                                                value={sheetsPhoneColumn}
                                                                onChange={(e) => setSheetsPhoneColumn(e.target.value)}
                                                                className="mt-1 text-sm"
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 pt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-green-700 border-green-300 hover:bg-green-100"
                                                        onClick={fetchSheetsPreview}
                                                        disabled={sheetsPreviewLoading || !sheetsUrl}
                                                    >
                                                        {sheetsPreviewLoading ? (
                                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                        ) : (
                                                            <Eye className="w-4 h-4 mr-1" />
                                                        )}
                                                        {sheetsPreviewLoading ? 'Loading...' : 'Preview Sheet'}
                                                    </Button>
                                                    {sheetsPreviewVisible && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setSheetsPreviewVisible(false)}
                                                        >
                                                            <X className="w-4 h-4 mr-1" />
                                                            Hide
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Service Account Email Info */}
                                                <div className="bg-green-100 border border-green-200 rounded-lg p-3 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-green-700 font-medium">📧 Share your sheet with this email:</span>
                                                    </div>
                                                    {sheetsServiceAccountEmail ? (
                                                        <div className="flex items-center gap-2">
                                                            <code className="bg-white px-2 py-1 rounded text-xs text-green-800 flex-1 font-mono truncate">
                                                                {sheetsServiceAccountEmail}
                                                            </code>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="shrink-0 h-7 text-xs"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(sheetsServiceAccountEmail);
                                                                    setEmailCopied(true);
                                                                    setTimeout(() => setEmailCopied(false), 2000);
                                                                    toast.success('Email copied to clipboard!');
                                                                }}
                                                            >
                                                                {emailCopied ? '✓ Copied!' : '📋 Copy'}
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-green-600 italic">Click "Preview Sheet" to load service account email</p>
                                                    )}
                                                    <div className="text-xs text-green-600 space-y-1 pt-1 border-t border-green-200">
                                                        <p className="font-medium">How to share:</p>
                                                        <ol className="list-decimal list-inside space-y-0.5 text-green-700">
                                                            <li>Open your Google Sheet</li>
                                                            <li>Click "Share" button (top right)</li>
                                                            <li>Paste the email above</li>
                                                            <li>Set permission to "Editor"</li>
                                                            <li>Click "Send"</li>
                                                        </ol>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Preview Table */}
                                            {sheetsPreviewVisible && sheetsPreviewData && (
                                                <div className="border border-green-200 rounded overflow-hidden">
                                                    <div className="bg-green-100 px-3 py-2 flex items-center justify-between">
                                                        <span className="text-xs font-medium text-green-800">
                                                            Preview ({sheetsPreviewData.rows.length} rows)
                                                        </span>
                                                        <Badge variant="outline" className="text-green-600 text-xs">
                                                            📱 {sheetsPhoneColumn}
                                                        </Badge>
                                                    </div>
                                                    <div className="overflow-x-auto max-h-40">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-green-50 sticky top-0">
                                                                <tr>
                                                                    {sheetsPreviewData.headers.map((h: string, i: number) => (
                                                                        <th key={i} className={`px-2 py-1 text-left font-medium ${h === sheetsPhoneColumn ? 'text-green-700 bg-green-100' : 'text-gray-600'}`}>
                                                                            {h}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {sheetsPreviewData.rows.map((row: any[], ri: number) => (
                                                                    <tr key={ri} className="border-t border-green-100">
                                                                        {row.map((cell: any, ci: number) => (
                                                                            <td key={ci} className="px-2 py-1 text-gray-700 truncate max-w-[100px]">
                                                                                {cell ?? ''}
                                                                            </td>
                                                                        ))}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            <p className="text-xs text-green-600">
                                                New rows will automatically enroll. Map variables when adding steps below.
                                            </p>
                                        </div>
                                    )}

                                    <div className="border rounded-md p-4 bg-gray-50/50">
                                        <Label className="mb-2 block">Sequence Steps</Label>

                                        <div className="space-y-2 mb-4">
                                            {currentSteps.map((step, idx) => (
                                                <div key={idx} className={`flex items-center gap-2 p-2 border rounded shadow-sm ${step.step_type === 'loop' ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                                                    <div className="flex flex-col items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        {step.step_type === 'loop' ? (
                                                            <div>
                                                                <div className="text-sm font-bold text-yellow-800">Loop Logic</div>
                                                                <div className="text-xs text-yellow-600">
                                                                    Loop {step.config?.loop_count} times, Jump to Step {step.config?.jump_target}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div className="text-sm font-medium">{step.template_name}</div>
                                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    Delay: {step.delay_seconds / 60} mins
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => removeStep(idx)}>
                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {currentSteps.length === 0 && <div className="text-sm text-muted-foreground italic text-center py-2">No steps added yet.</div>}
                                        </div>

                                        <div className="border-t pt-4 space-y-4">
                                            {/* Type Selector */}
                                            <div className="flex items-center gap-4">
                                                <Label className="text-xs w-20">Step Type</Label>
                                                <Select value={stepType} onValueChange={(v: any) => setStepType(v)}>
                                                    <SelectTrigger className="w-[180px] h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="template">Send Message</SelectItem>
                                                        <SelectItem value="loop">Loop Logic</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {stepType === 'template' ? (
                                                <div className="grid grid-cols-12 gap-2 items-end">
                                                    <div className="col-span-5 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-xs">Template</Label>
                                                            <Button variant="ghost" size="sm" onClick={loadTemplates} className="h-5 w-5 p-0">
                                                                <RefreshCw className={`w-3 h-3 ${loadingTemplates ? 'animate-spin' : ''}`} />
                                                            </Button>
                                                        </div>
                                                        <Select value={stepTemplate} onValueChange={(v) => {
                                                            // Clear mappings when template changes (prevents stale mappings)
                                                            if (v !== stepTemplate) {
                                                                setStepVariables({});
                                                                setStepFallbacks({});
                                                            }
                                                            setStepTemplate(v);
                                                        }}>
                                                            <SelectTrigger className="h-8 border-emerald-100 hover:border-emerald-300 transition-colors">
                                                                <SelectValue placeholder="Select template" />
                                                            </SelectTrigger>
                                                            <SelectContent position="popper" sideOffset={5} className="max-h-[300px] z-[100]">
                                                                {templates.map(t => (
                                                                    <SelectItem key={t.id} value={t.name}>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-xs">{t.name}</span>
                                                                            <span className="text-[10px] bg-gray-100 px-1 rounded text-muted-foreground uppercase">
                                                                                {t.language}
                                                                            </span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                                {templates.length === 0 && (
                                                                    <div className="p-4 text-center text-xs text-muted-foreground italic">
                                                                        No approved templates found.
                                                                    </div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-4 space-y-1">
                                                        <Label className="text-xs">Delay (mins)</Label>
                                                        <Input type="number" value={stepDelay} onChange={e => setStepDelay(e.target.value)} className="h-8" />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <Button size="sm" variant="secondary" onClick={addStep} disabled={!stepTemplate} className="w-full h-8">
                                                            <Plus className="w-3 h-3 mr-1" /> Add Step
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-12 gap-2 items-end bg-yellow-50/50 p-2 rounded">
                                                    <div className="col-span-4 space-y-1">
                                                        <Label className="text-xs">Repeat Count</Label>
                                                        <Input type="number" value={loopCount} onChange={e => setLoopCount(e.target.value)} className="h-8" placeholder="Wait N times" />
                                                    </div>
                                                    <div className="col-span-5 space-y-1">
                                                        <Label className="text-xs">Jump Back To Step #</Label>
                                                        <Input type="number" value={jumpTarget} onChange={e => setJumpTarget(e.target.value)} className="h-8" placeholder="Step Order" />
                                                    </div>
                                                    <div className="col-span-3">
                                                        <Button size="sm" variant="secondary" onClick={addStep} className="w-full h-8 bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                                                            <Plus className="w-3 h-3 mr-1" /> Add Loop
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Variable inputs AND/OR Image header when template is selected */}
                                        {stepTemplate && (() => {
                                            const selectedTpl = templates.find(t => t.name === stepTemplate);
                                            const varCount = selectedTpl?.variable_count || 0;
                                            const hasImageHeader = selectedTpl?.header_format === 'IMAGE';

                                            // Show section if has variables OR has image header
                                            if (varCount === 0 && !hasImageHeader) return null;

                                            // Generate array of variable indices
                                            const varIndices = Array.from({ length: varCount }, (_, i) => i + 1);

                                            return (
                                                <div className="mt-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label className="text-xs font-medium text-blue-700">
                                                            {varCount > 0 ? `Template Variables (${varCount} required)` : 'Template Settings'}
                                                        </Label>
                                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={stepExitOnReply}
                                                                onChange={e => setStepExitOnReply(e.target.checked)}
                                                                className="rounded"
                                                            />
                                                            Stop on reply
                                                        </label>
                                                    </div>

                                                    {/* Image header upload */}
                                                    {hasImageHeader && (
                                                        <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                            <Label className="text-xs font-medium text-purple-700 mb-2 block">
                                                                📷 Image Header (required)
                                                            </Label>

                                                            {stepHeaderImage ? (
                                                                <div className="flex items-center gap-3 p-2 bg-white rounded border">
                                                                    <img
                                                                        src={stepHeaderImage}
                                                                        alt="Header"
                                                                        className="w-16 h-16 object-cover rounded"
                                                                    />
                                                                    <div className="flex-1 text-xs text-green-600">
                                                                        ✅ Image uploaded
                                                                    </div>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => setStepHeaderImage('')}
                                                                        className="text-red-500"
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </div>
                                                            ) : (
                                                                <div className="relative">
                                                                    <input
                                                                        type="file"
                                                                        accept="image/jpeg,image/png,image/jpg"
                                                                        onChange={async (e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (!file) return;

                                                                            setUploadingImage(true);
                                                                            try {
                                                                                const formData = new FormData();
                                                                                formData.append('file', file);

                                                                                const res = await fetch(`${API_BASE}/api/whatsapp/media/upload/public`, {
                                                                                    method: 'POST',
                                                                                    credentials: 'include',
                                                                                    body: formData
                                                                                });

                                                                                const data = await res.json();
                                                                                if (data.success && data.public_url) {
                                                                                    setStepHeaderImage(data.public_url);
                                                                                    toast.success('Image uploaded!');
                                                                                } else {
                                                                                    toast.error(data.error || 'Upload failed');
                                                                                }
                                                                            } catch (err) {
                                                                                toast.error('Failed to upload image');
                                                                            } finally {
                                                                                setUploadingImage(false);
                                                                            }
                                                                        }}
                                                                        className="hidden"
                                                                        id="drip-image-upload"
                                                                        disabled={uploadingImage}
                                                                    />
                                                                    <label
                                                                        htmlFor="drip-image-upload"
                                                                        className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingImage
                                                                            ? 'bg-gray-100 border-gray-300 cursor-wait'
                                                                            : 'hover:bg-purple-100 border-purple-300'
                                                                            }`}
                                                                    >
                                                                        {uploadingImage ? (
                                                                            <span className="text-xs text-gray-500">Uploading...</span>
                                                                        ) : (
                                                                            <>
                                                                                <span className="text-xl">📤</span>
                                                                                <span className="text-xs text-purple-700">Click to upload image (JPEG/PNG, max 5MB)</span>
                                                                            </>
                                                                        )}
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Template preview */}
                                                    {selectedTpl?.body_text && (
                                                        <div className="mb-3 p-2 bg-white rounded border text-xs">
                                                            <span className="font-medium text-gray-700 block mb-1">Template Preview: </span>
                                                            <span className="text-gray-600 leading-relaxed">
                                                                {selectedTpl.body_text}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Step-level Variable Mapping - based on trigger type */}
                                                    {varCount > 0 && (
                                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                            <Label className="text-xs font-medium text-blue-800 block mb-2">
                                                                🔗 Map Variables ({varCount})
                                                            </Label>
                                                            <p className="text-xs text-blue-600 mb-3">
                                                                {newCampaign.trigger_type === 'new_lead' && 'Map CRM lead fields to template variables:'}
                                                                {newCampaign.trigger_type === 'new_contact' && 'Map CRM contact fields to template variables:'}
                                                                {newCampaign.trigger_type === 'google_sheet_row' && 'Map sheet columns to template variables:'}
                                                                {newCampaign.trigger_type === 'manual' && 'Variables will be collected during enrollment.'}
                                                                {newCampaign.trigger_type === 'new_message' && 'Variables will be extracted from message context.'}
                                                            </p>

                                                            {/* Show mapping UI for auto-trigger types */}
                                                            {['new_lead', 'new_contact', 'google_sheet_row'].includes(newCampaign.trigger_type) && (
                                                                <div className="space-y-2">
                                                                    {varIndices.map(varNum => (
                                                                        <div key={varNum} className="flex items-center gap-2 bg-white p-2 rounded border">
                                                                            <span className="text-blue-800 font-mono text-xs font-medium whitespace-nowrap w-12">{`{{${varNum}}}`}</span>
                                                                            <span className="text-gray-400 text-xs">→</span>

                                                                            {/* Field dropdown based on trigger type */}
                                                                            <Select
                                                                                value={stepVariables[String(varNum)] || '_none'}
                                                                                onValueChange={(v) => setStepVariables({ ...stepVariables, [String(varNum)]: v === '_none' ? '' : v })}
                                                                            >
                                                                                <SelectTrigger className="h-7 text-xs flex-1">
                                                                                    <SelectValue placeholder="Select field" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    <SelectItem value="_none">-- Select --</SelectItem>
                                                                                    {newCampaign.trigger_type === 'new_lead' && (
                                                                                        <>
                                                                                            <SelectItem value="name">Name</SelectItem>
                                                                                            <SelectItem value="company">Company</SelectItem>
                                                                                            <SelectItem value="email">Email</SelectItem>
                                                                                            <SelectItem value="source">Source</SelectItem>
                                                                                            <SelectItem value="status">Status</SelectItem>
                                                                                            <SelectItem value="notes">Notes</SelectItem>
                                                                                        </>
                                                                                    )}
                                                                                    {newCampaign.trigger_type === 'new_contact' && (
                                                                                        <>
                                                                                            <SelectItem value="first_name">First Name</SelectItem>
                                                                                            <SelectItem value="last_name">Last Name</SelectItem>
                                                                                            <SelectItem value="email">Email</SelectItem>
                                                                                            <SelectItem value="company">Company</SelectItem>
                                                                                            <SelectItem value="address">Address</SelectItem>
                                                                                            <SelectItem value="tags">Tags</SelectItem>
                                                                                        </>
                                                                                    )}
                                                                                    {newCampaign.trigger_type === 'google_sheet_row' && sheetsPreviewData?.headers?.filter((h: string) => h && h.trim()).map((h: string) => (
                                                                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>

                                                                            {/* Fallback input */}
                                                                            <Input
                                                                                placeholder="Fallback"
                                                                                value={stepFallbacks[String(varNum)] || ''}
                                                                                onChange={(e) => setStepFallbacks({ ...stepFallbacks, [String(varNum)]: e.target.value })}
                                                                                className="h-7 text-xs w-24"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Data Preview - show resolved message with sample values */}
                                                            {Object.keys(stepVariables).some(k => stepVariables[k]) && selectedTpl?.body_text && (
                                                                <div className="mt-3 p-3 bg-white rounded border border-blue-200">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="text-xs font-medium text-blue-700">📝 Preview</span>
                                                                        <span className="text-xs text-gray-500">(sample values)</span>
                                                                    </div>
                                                                    <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                                                                        {(() => {
                                                                            // Sample data for preview
                                                                            const sampleData: Record<string, string> = {
                                                                                // Lead fields
                                                                                name: 'John Doe',
                                                                                company: 'Acme Corp',
                                                                                email: 'john@acme.com',
                                                                                source: 'Website',
                                                                                status: 'New',
                                                                                notes: 'Interested in demo',
                                                                                // Contact fields
                                                                                first_name: 'John',
                                                                                last_name: 'Doe',
                                                                                address: '123 Main St',
                                                                                tags: 'VIP, Enterprise'
                                                                            };

                                                                            // For sheets, use column header as sample
                                                                            if (sheetsPreviewData?.rows?.[0]) {
                                                                                const firstRow = sheetsPreviewData.rows[0];
                                                                                sheetsPreviewData.headers.forEach((h: string, i: number) => {
                                                                                    sampleData[h] = firstRow[i] || `[${h}]`;
                                                                                });
                                                                            }

                                                                            let preview = selectedTpl.body_text;

                                                                            // Replace variables with sample/fallback values
                                                                            for (let i = 1; i <= varCount; i++) {
                                                                                const fieldName = stepVariables[String(i)];
                                                                                const fallback = stepFallbacks[String(i)];
                                                                                const sampleValue = fieldName ? (sampleData[fieldName] || `[${fieldName}]`) : (fallback || `{{${i}}}`);

                                                                                preview = preview.replace(`{{${i}}}`, `<span class="font-medium text-blue-600">${sampleValue}</span>`);
                                                                            }

                                                                            return <span dangerouslySetInnerHTML={{ __html: preview }} />;
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                <div className="p-6 pt-2 border-t bg-gray-50/50">
                                    <DialogFooter>
                                        <Button
                                            onClick={handleCreate}
                                            disabled={currentSteps.length === 0}
                                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 font-semibold"
                                            title={currentSteps.length === 0 ? "Add at least one step with a template" : ""}
                                        >
                                            Create Campaign
                                        </Button>
                                    </DialogFooter>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid gap-4">
                        {campaigns.map(c => {
                            // Check if this is an auto-trigger campaign
                            const isAutoTrigger = ['new_lead', 'new_contact', 'google_sheet_row'].includes(c.trigger_type || '');
                            const triggerLabel = {
                                'new_lead': '📋 CRM Leads',
                                'new_contact': '👥 CRM Contacts',
                                'google_sheet_row': '📊 Google Sheet'
                            }[c.trigger_type || ''];

                            return (
                                <Card key={c.id} className={`overflow-hidden border-l-4 ${isAutoTrigger ? 'border-l-purple-500' : 'border-l-emerald-500'}`}>
                                    <div className="p-4 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg">{c.name}</h3>
                                                {isAutoTrigger && (
                                                    <Badge className="bg-purple-500 text-white text-xs">
                                                        {triggerLabel}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1">
                                                    <GitMerge className="w-3 h-3" /> {c.steps.length} Steps
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <UserPlus className="w-3 h-3" /> {c.enrolled_count} Enrolled
                                                </span>
                                                {isAutoTrigger && (
                                                    <span className="flex items-center gap-1 text-purple-600">
                                                        ⚡ Auto-enrolls
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* View Enrollees */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setViewEnrolleesCampaign(c);
                                                    loadEnrollees(c.id);
                                                }}
                                            >
                                                <Users className="w-4 h-4 mr-2 text-blue-600" />
                                                View
                                            </Button>

                                            {/* Single Enroll - HIDE for auto-trigger campaigns */}
                                            {!isAutoTrigger && (
                                                <Button variant="outline" size="sm" onClick={() => { setEnrollDefaultTab('manual'); setEnrollCampaign(c); }}>
                                                    <Play className="w-4 h-4 mr-2 text-green-600" />
                                                    Enroll
                                                </Button>
                                            )}

                                            {/* Bulk Enroll - HIDE for auto-trigger campaigns */}
                                            {!isAutoTrigger && (
                                                <Button variant="outline" size="sm" onClick={() => { setEnrollDefaultTab('csv'); setEnrollCampaign(c); }}>
                                                    <UserPlus className="w-4 h-4 mr-2 text-purple-600" />
                                                    Bulk Import
                                                </Button>
                                            )}

                                            {/* Manual Sync - ONLY for Google Sheet campaigns */}
                                            {c.trigger_type === 'google_sheet_row' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleManualSync(c.id)}
                                                    disabled={syncingCampaignId === c.id || !!syncCooldowns[c.id]}
                                                >
                                                    {syncingCampaignId === c.id ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            Syncing...
                                                        </>
                                                    ) : syncCooldowns[c.id] ? (
                                                        <>
                                                            <Clock className="w-4 h-4 mr-2 text-orange-500" />
                                                            {Math.floor(syncCooldowns[c.id] / 60)}:{(syncCooldowns[c.id] % 60).toString().padStart(2, '0')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RefreshCw className="w-4 h-4 mr-2 text-green-600" />
                                                            Sync Now
                                                        </>
                                                    )}
                                                </Button>
                                            )}

                                            {/* Analytics Button */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.location.href = `/dashboard/campaigns/${c.id}/analytics`}
                                            >
                                                <BarChart className="w-4 h-4 mr-2 text-indigo-600" />
                                                Analytics
                                            </Button>


                                            {/* CRM Audience Enrollment */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setCrmAudienceCampaign(c);
                                                    loadCrmAudience(c.id);
                                                }}
                                            >
                                                <Users className="w-4 h-4 mr-2 text-orange-600" />
                                                CRM
                                            </Button>

                                            {/* Delete */}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(c.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50/50 px-4 py-3 flex items-center gap-2 overflow-x-auto">
                                        {c.steps.map((step, i) => (
                                            <div key={i} className="flex items-center flex-shrink-0">
                                                <div className="flex items-center gap-2 bg-white border rounded-full px-3 py-1 text-xs shadow-sm">
                                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                                    <span>{step.delay_seconds / 60}m</span>
                                                    <ArrowRight className="w-3 h-3 text-gray-300" />
                                                    <span className="font-medium text-emerald-700">{step.template_name}</span>
                                                </div>
                                                {i < c.steps.length - 1 && <div className="w-8 h-[1px] bg-gray-300 mx-2" />}
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            );
                        })}
                        {campaigns.length === 0 && !loading && (
                            <div className="text-center py-8 text-muted-foreground bg-gray-50/50 rounded-lg border border-dashed">
                                No campaigns found. Create one to get started.
                            </div>
                        )}
                    </div>
                </CardContent>
            )
            }

            {/* Enhanced Enrollment Dialog with Variables */}
            <DripEnrollmentDialog
                open={!!enrollCampaign}
                onOpenChange={(open) => !open && setEnrollCampaign(null)}
                campaign={enrollCampaign}
                accountId={accountId}
                defaultTab={enrollDefaultTab}
                onEnrollmentComplete={() => {
                    setEnrollCampaign(null);
                    loadCampaigns();
                }}
            />

            {/* Legacy Bulk Enrollment Dialog - keeping for backwards compatibility */}
            <Dialog open={!!bulkEnrollCampaign} onOpenChange={(open) => !open && setBulkEnrollCampaign(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Bulk Enroll: {bulkEnrollCampaign?.name}</DialogTitle>
                        <DialogDescription>Add multiple contacts to this drip campaign</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Paste phone numbers */}
                        <div className="space-y-2">
                            <Label>Phone Numbers (one per line or comma-separated)</Label>
                            <textarea
                                value={bulkPhones}
                                onChange={e => setBulkPhones(e.target.value)}
                                placeholder={"919876543210\n919876543211\n919876543212"}
                                rows={6}
                                className="w-full border rounded-md p-3 text-sm font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                                {bulkPhones.split(/[\n,;]+/).filter(p => p.trim()).length} numbers detected
                            </p>
                        </div>

                        {/* Or Upload CSV */}
                        <div className="border-t pt-4">
                            <Label className="text-sm font-medium mb-2 block">Or Upload CSV/Excel File</Label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls"
                                    onChange={handleCSVUpload}
                                    className="hidden"
                                    id="csv-upload"
                                    disabled={uploadingCSV}
                                />
                                <label
                                    htmlFor="csv-upload"
                                    className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${uploadingCSV
                                        ? 'bg-gray-100 border-gray-300 cursor-wait'
                                        : 'hover:bg-purple-50 border-purple-300'
                                        }`}
                                >
                                    {uploadingCSV ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4 text-purple-600" />
                                    )}
                                    <span className="text-sm">
                                        {uploadingCSV ? 'Importing...' : 'Click to upload CSV or Excel file'}
                                    </span>
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                File must have a column named: phone, phone_number, mobile, contact, or number
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBulkEnrollCampaign(null)}>Cancel</Button>
                        <Button onClick={handleBulkEnroll} disabled={bulkEnrolling || !bulkPhones.trim()}>
                            {bulkEnrolling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Enroll All
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Enrollees Dialog */}
            <Dialog open={!!viewEnrolleesCampaign} onOpenChange={(open) => !open && setViewEnrolleesCampaign(null)}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            Enrolled Contacts: {viewEnrolleesCampaign?.name}
                        </DialogTitle>
                        <DialogDescription>
                            {enrolleesTotal} total enrollments
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        {loadingEnrollees ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : enrollees.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No contacts enrolled yet. Use Enroll or Bulk buttons to add contacts.
                            </div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead>Next Step</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {enrollees.map(e => (
                                            <TableRow key={e.id}>
                                                <TableCell className="font-mono text-sm">{e.phone_number}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        e.status === 'active' ? 'default' :
                                                            e.status === 'completed' ? 'secondary' :
                                                                e.status === 'paused' ? 'outline' : 'destructive'
                                                    } className={
                                                        e.status === 'active' ? 'bg-green-100 text-green-700' :
                                                            e.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                                                e.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : ''
                                                    }>
                                                        {e.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">
                                                        Step {e.current_step}/{e.total_steps}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {e.next_run_at ? new Date(e.next_run_at).toLocaleString() : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {e.status === 'active' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEnrollmentAction(e.id, 'pause')}
                                                                title="Pause"
                                                            >
                                                                <Pause className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                        {e.status === 'paused' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleEnrollmentAction(e.id, 'resume')}
                                                                title="Resume"
                                                            >
                                                                <Play className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEnrollmentAction(e.id, 'restart')}
                                                            title="Restart from beginning"
                                                        >
                                                            <RotateCcw className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRemoveEnrollment(e.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                            title="Remove"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {/* Pagination */}
                                {enrolleesTotal > 20 && (
                                    <div className="flex items-center justify-center gap-2 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={enrolleesPage === 1}
                                            onClick={() => viewEnrolleesCampaign && loadEnrollees(viewEnrolleesCampaign.id, enrolleesPage - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <span className="text-sm text-muted-foreground">
                                            Page {enrolleesPage} of {Math.ceil(enrolleesTotal / 20)}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={enrolleesPage * 20 >= enrolleesTotal}
                                            onClick={() => viewEnrolleesCampaign && loadEnrollees(viewEnrolleesCampaign.id, enrolleesPage + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* CRM Audience Enrollment Dialog with Guardrails */}
            <Dialog open={!!crmAudienceCampaign} onOpenChange={() => {
                setCrmAudienceCampaign(null);
                setCrmLeads([]);
                setSelectedCrmLeads(new Set());
                setCrmAudienceSummary(null);
            }}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-orange-600" />
                            Enroll from CRM - {crmAudienceCampaign?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Select leads from your CRM to enroll in this drip campaign
                        </DialogDescription>
                    </DialogHeader>

                    {loadingCrmAudience ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                            <span className="ml-2">Loading CRM audience...</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Guardrails Summary Cards */}
                            {crmAudienceSummary && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                                        <div className="text-2xl font-bold text-blue-700">
                                            {crmAudienceSummary.leads_with_phone}
                                        </div>
                                        <div className="text-xs text-blue-600">Leads with Phone</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                                        <div className="text-2xl font-bold text-red-700">
                                            {crmAudienceSummary.suppressed}
                                        </div>
                                        <div className="text-xs text-red-600">Suppressed (STOP)</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                                        <div className="text-2xl font-bold text-amber-700">
                                            {crmAudienceSummary.already_enrolled}
                                        </div>
                                        <div className="text-xs text-amber-600">Already Enrolled</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                                        <div className="text-2xl font-bold text-green-700">
                                            {crmAudienceSummary.estimated_enrollable}
                                        </div>
                                        <div className="text-xs text-green-600">Available to Enroll</div>
                                    </div>
                                </div>
                            )}

                            {/* Warning Messages */}
                            {crmAudienceSummary && crmAudienceSummary.estimated_enrollable > 100 && (
                                <div className="p-3 rounded-lg bg-amber-100 border border-amber-300 flex items-start gap-2">
                                    <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                                    <div className="text-sm">
                                        <span className="font-semibold text-amber-800">High Volume Warning:</span>
                                        <span className="text-amber-700 ml-1">
                                            Enrolling {crmAudienceSummary.estimated_enrollable}+ contacts may take time.
                                            WhatsApp tier limits apply.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Live Preview Section (filtered eligible only, with variable mapping UI) */}
                            {crmVariableSchema && ((crmLeads.length > 0) || (crmContacts.length > 0)) && (
                                (() => {
                                    // Only eligible: has name and phone
                                    const eligibleLeads = crmLeads.filter(l => l.name && l.phone);
                                    const eligibleContacts = crmContacts.filter(c => c.name && c.phone);
                                    const eligibleList = crmAudienceTab === 'leads' ? eligibleLeads : eligibleContacts;
                                    // Clamp preview index
                                    const safeIndex = Math.max(0, Math.min(crmPreviewIndex, eligibleList.length - 1));
                                    const currentItem = eligibleList[safeIndex] || {};
                                    // All CRM fields for mapping
                                    const crmFields = Object.keys(currentItem || {}).filter(f => typeof currentItem[f] === 'string' && currentItem[f]);
                                    // Variable mapping UI (above preview)
                                    const firstStep = crmVariableSchema.steps?.find((s: any) => s.body_text || s.template_name);
                                    const varMapping = firstStep?.variable_mapping || {};
                                    const variableCount = firstStep?.variable_count || 0;
                                    return (
                                        <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                                            {/* Variable Mapping UI */}
                                            {variableCount > 0 && (
                                                <div className="mb-4 p-2 bg-white border rounded flex flex-wrap gap-3 items-center">
                                                    <span className="text-xs font-semibold text-orange-700 mr-2">Variable Mapping:</span>
                                                    {Array.from({ length: variableCount }).map((_, i) => {
                                                        const idx = (i + 1).toString();
                                                        return (
                                                            <div key={idx} className="flex items-center gap-1">
                                                                <span className="text-xs text-gray-500">{'{{' + idx + '}}'}</span>
                                                                <select
                                                                    className="text-xs border rounded px-1 py-0.5"
                                                                    value={crmVarMapping[idx] || ''}
                                                                    onChange={e => {
                                                                        setCrmVarMapping(m => ({ ...m, [idx]: e.target.value }));
                                                                    }}
                                                                >
                                                                    <option value="">-- Map Field --</option>
                                                                    {crmFields.map(f => (
                                                                        <option key={f} value={f}>{f}</option>
                                                                    ))}
                                                                    <option value="__manual__">Manual Entry</option>
                                                                </select>
                                                                {crmVarMapping[idx] === '__manual__' && (
                                                                    <input
                                                                        className="text-xs border rounded px-1 py-0.5 ml-1"
                                                                        placeholder="Enter value"
                                                                        value={crmManualVars[idx] || ''}
                                                                        onChange={e => setCrmManualVars(m => ({ ...m, [idx]: e.target.value }))}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {/* Preview Header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-orange-700">🔄 Live Template Preview</span>
                                                    <Badge variant="outline" className="text-xs bg-white">
                                                        {crmAudienceTab === 'leads' ? 'Lead' : 'Contact'} {safeIndex + 1} of {eligibleList.length}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                                        onClick={() => {
                                                            setCrmPreviewIndex(prev => prev === 0 ? eligibleList.length - 1 : prev - 1);
                                                        }}>
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                                        onClick={() => setCrmIsPreviewPlaying(!crmIsPreviewPlaying)}>
                                                        {crmIsPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                                                        onClick={() => {
                                                            setCrmPreviewIndex(prev => (prev + 1) % eligibleList.length);
                                                        }}>
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Current Contact Info */}
                                            <div className="mb-3 p-2 bg-white rounded border flex items-center gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Name:</span>
                                                    <span className="ml-1 font-medium">{currentItem.name || 'Unknown'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Phone:</span>
                                                    <span className="ml-1 font-mono">{currentItem.phone || 'N/A'}</span>
                                                </div>
                                                {currentItem.email && (
                                                    <div>
                                                        <span className="text-gray-500">Email:</span>
                                                        <span className="ml-1">{currentItem.email}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Template Previews */}
                                            <div className="space-y-3">
                                                {crmVariableSchema.steps?.filter((s: any) => s.body_text || s.template_name).map((step: any) => {
                                                    let text = step.body_text || `Template: ${step.template_name}`;
                                                    for (let i = 1; i <= (step.variable_count || 0); i++) {
                                                        const idx = i.toString();
                                                        let value = '';
                                                        if (crmVarMapping[idx] === '__manual__') {
                                                            value = crmManualVars[idx] || '';
                                                        } else if (crmVarMapping[idx]) {
                                                            value = currentItem[crmVarMapping[idx]] || '';
                                                        } else {
                                                            // Try to auto-map by alias
                                                            const alias = (step.variable_mapping?.[idx] || '').toLowerCase();
                                                            if (alias.includes('name')) value = currentItem.name || '';
                                                            else if (alias.includes('phone')) value = currentItem.phone || '';
                                                            else if (alias.includes('email')) value = currentItem.email || '';
                                                        }
                                                        const placeholder = `{{${i}}}`;
                                                        if (value) {
                                                            text = text.replace(placeholder, `⟦${value}⟧`);
                                                        } else {
                                                            text = text.replace(placeholder, `⟦⚠ ${step.variable_mapping?.[idx] || `var_${i}`}⟧`);
                                                        }
                                                    }
                                                    const segments = text.split(/⟦|⟧/);
                                                    return (
                                                        <div key={step.step_order} className="bg-white rounded-md p-3 border shadow-sm">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                                                                    Step {step.step_order}
                                                                </Badge>
                                                                <span className="text-xs text-gray-500">{step.template_name}</span>
                                                            </div>
                                                            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                                                {segments.map((segment, idx) => {
                                                                    if (idx % 2 === 1) {
                                                                        const isMissing = segment.startsWith('⚠');
                                                                        return (
                                                                            <span
                                                                                key={`crm-${safeIndex}-${idx}`}
                                                                                className={`px-1.5 py-0.5 rounded font-medium mx-0.5 ${isMissing
                                                                                    ? 'bg-red-100 text-red-700 animate-pulse'
                                                                                    : 'bg-emerald-100 text-emerald-800'
                                                                                    }`}
                                                                            >
                                                                                {segment.replace('⚠ ', '')}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return <span key={idx}>{segment}</span>;
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()
                            )}

                            {/* Leads/Contacts Tabs */}
                            <div className="flex gap-2 border-b">
                                <button
                                    onClick={() => setCrmAudienceTab('leads')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${crmAudienceTab === 'leads'
                                        ? 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Leads ({crmLeads.length})
                                </button>
                                <button
                                    onClick={() => setCrmAudienceTab('contacts')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${crmAudienceTab === 'contacts'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                >
                                    Contacts ({crmContacts.length})
                                </button>
                            </div>

                            {/* Lead Selection */}
                            {crmAudienceTab === 'leads' && crmLeads.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedCrmLeads.size === crmLeads.filter(l => l.is_valid !== false).length && crmLeads.filter(l => l.is_valid !== false).length > 0}
                                                onChange={selectAllLeads}
                                                className="rounded"
                                            />
                                            <span className="text-sm font-medium">
                                                Select All Valid ({crmLeads.filter(l => l.is_valid !== false).length} leads)
                                            </span>
                                        </div>
                                        <Badge variant="secondary">
                                            {selectedCrmLeads.size} selected
                                        </Badge>
                                    </div>

                                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12"></TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Phone</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Source</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {crmLeads.map(lead => {
                                                    const isInvalid = lead.is_valid === false;
                                                    return (
                                                        <TableRow
                                                            key={lead.id}
                                                            className={`${selectedCrmLeads.has(lead.id) ? "bg-orange-50" : ""} ${isInvalid ? "bg-red-50 border-l-4 border-l-red-500" : ""}`}
                                                        >
                                                            <TableCell>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedCrmLeads.has(lead.id)}
                                                                    onChange={() => !isInvalid && toggleLeadSelection(lead.id)}
                                                                    disabled={isInvalid}
                                                                    className={`rounded ${isInvalid ? "cursor-not-allowed opacity-50" : ""}`}
                                                                />
                                                            </TableCell>
                                                            <TableCell className={`font-medium ${isInvalid ? "text-red-700" : ""}`}>
                                                                {lead.name || 'Unknown'}
                                                                {isInvalid && (
                                                                    <div className="text-xs text-red-500 mt-0.5">
                                                                        ⚠️ {lead.invalid_reason || 'Invalid'}
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className={`font-mono text-sm ${isInvalid ? "text-red-500" : ""}`}>
                                                                {lead.phone || <span className="italic text-red-400">No phone</span>}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className={`text-xs ${isInvalid ? "border-red-300 text-red-600" : ""}`}>
                                                                    {lead.status || 'new'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-xs">
                                                                {lead.source || '-'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}

                            {/* Empty state for leads */}
                            {crmAudienceTab === 'leads' && crmLeads.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No enrollable leads found in CRM</p>
                                    <p className="text-xs mt-1">All leads may be suppressed or already enrolled</p>
                                </div>
                            )}

                            {/* Contact Selection */}
                            {crmAudienceTab === 'contacts' && crmContacts.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={selectedCrmContacts.size === crmContacts.filter(c => c.phone).length && crmContacts.filter(c => c.phone).length > 0}
                                                onChange={selectAllContacts}
                                                className="rounded"
                                            />
                                            <span className="text-sm font-medium">
                                                Select All ({crmContacts.filter(c => c.phone).length} contacts)
                                            </span>
                                        </div>
                                        <Badge variant="secondary">
                                            {selectedCrmContacts.size} selected
                                        </Badge>
                                    </div>

                                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-12"></TableHead>
                                                    <TableHead>Name</TableHead>
                                                    <TableHead>Phone</TableHead>
                                                    <TableHead>Email</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {crmContacts.map(contact => (
                                                    <TableRow
                                                        key={contact.id}
                                                        className={selectedCrmContacts.has(contact.id) ? "bg-blue-50" : ""}
                                                    >
                                                        <TableCell>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCrmContacts.has(contact.id)}
                                                                onChange={() => toggleContactSelection(contact.id)}
                                                                disabled={!contact.phone}
                                                                className={`rounded ${!contact.phone ? "cursor-not-allowed opacity-50" : ""}`}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            {contact.name || 'Unknown'}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-sm">
                                                            {contact.phone || <span className="italic text-muted-foreground">No phone</span>}
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {contact.email || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}

                            {/* Empty state for contacts */}
                            {crmAudienceTab === 'contacts' && crmContacts.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                    <p>No contacts found in CRM</p>
                                    <p className="text-xs mt-1">Add contacts to your CRM to enroll them</p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="mt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setCrmAudienceCampaign(null);
                                setCrmLeads([]);
                                setCrmContacts([]);
                                setSelectedCrmLeads(new Set());
                                setSelectedCrmContacts(new Set());
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={enrollFromCrm}
                            disabled={(selectedCrmLeads.size + selectedCrmContacts.size) === 0 || enrollingFromCrm}
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            {enrollingFromCrm ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Enrolling...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Enroll {selectedCrmLeads.size + selectedCrmContacts.size} Selected
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card >
    );
}

