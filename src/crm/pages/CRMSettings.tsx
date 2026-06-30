import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    SlidersHorizontal, Plus, X, Loader2, Save, Sparkles, Lock, AlertCircle,
    BrainCircuit, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';

/* ------------------------------------------------------------------ */
/* Lead status that a keyword (or the AI) can assign.                 */
/* ------------------------------------------------------------------ */
type KeywordStatus = 'new' | 'contacted' | 'qualified';

interface KeywordEntry {
    keyword: string;
    status: string;
}

const STATUS_OPTIONS: { value: KeywordStatus; label: string }[] = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
];

const STATUS_LABEL: Record<string, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
};

// Tailwind classes for the small status pill, keyed by status.
const STATUS_BADGE: Record<string, string> = {
    new: 'bg-sky-50 text-sky-700 border-sky-200',
    contacted: 'bg-amber-50 text-amber-700 border-amber-200',
    qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
}

export default function CRMSettings() {
    /* ---- Keywords state ---- */
    const [defaults, setDefaults] = useState<KeywordEntry[]>([]);
    const [custom, setCustom] = useState<KeywordEntry[]>([]);
    const [draft, setDraft] = useState('');
    const [draftStatus, setDraftStatus] = useState<KeywordStatus>('qualified');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    /* ---- AI classification state ---- */
    const [aiEnabled, setAiEnabled] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiDefaultPrompt, setAiDefaultPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(true);
    const [aiError, setAiError] = useState<string | null>(null);
    const [aiSaving, setAiSaving] = useState(false);

    /* ------------------------------ Keywords ----------------------------- */

    const fetchKeywords = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await crmApi.getQualifyKeywords();
            setDefaults(Array.isArray(data.defaults) ? data.defaults : []);
            setCustom(Array.isArray(data.custom) ? data.custom : []);
        } catch (e: any) {
            const msg = e?.message || 'Failed to load qualification keywords';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    /* ------------------------------ AI config ---------------------------- */

    const fetchAiConfig = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const data = await crmApi.getAiStatusConfig();
            setAiEnabled(!!data.enabled);
            setAiPrompt(data.prompt || '');
            setAiDefaultPrompt(data.default_prompt || '');
        } catch (e: any) {
            const msg = e?.message || 'Failed to load AI classification settings';
            setAiError(msg);
            toast.error(msg);
        } finally {
            setAiLoading(false);
        }
    };

    useEffect(() => {
        fetchKeywords();
        fetchAiConfig();
    }, []);

    const addKeyword = () => {
        const word = draft.trim();
        if (!word) return;
        const exists =
            custom.some((k) => k.keyword.toLowerCase() === word.toLowerCase()) ||
            defaults.some((k) => k.keyword.toLowerCase() === word.toLowerCase());
        if (exists) {
            toast.error(`"${word}" is already in the list`);
            setDraft('');
            return;
        }
        setCustom((prev) => [...prev, { keyword: word, status: draftStatus }]);
        setDraft('');
        setDraftStatus('qualified');
    };

    const removeKeyword = (word: string) => {
        setCustom((prev) => prev.filter((k) => k.keyword !== word));
    };

    const changeKeywordStatus = (word: string, status: string) => {
        setCustom((prev) =>
            prev.map((k) => (k.keyword === word ? { ...k, status } : k)),
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addKeyword();
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = await crmApi.updateQualifyKeywords(custom);
            setCustom(Array.isArray(data.custom) ? data.custom : []);
            if (Array.isArray(data.defaults) && data.defaults.length) setDefaults(data.defaults);
            toast.success('Qualification keywords saved');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save qualification keywords');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPrompt = () => {
        if (!aiDefaultPrompt) {
            toast.error('No default prompt available to reset to');
            return;
        }
        setAiPrompt(aiDefaultPrompt);
        toast.success('Prompt reset to default');
    };

    const handleSaveAi = async () => {
        setAiSaving(true);
        try {
            const data = await crmApi.updateAiStatusConfig({
                enabled: aiEnabled,
                prompt: aiPrompt,
            });
            setAiEnabled(!!data.enabled);
            setAiPrompt(data.prompt || '');
            if (data.default_prompt) setAiDefaultPrompt(data.default_prompt);
            toast.success('AI classification settings saved');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save AI classification settings');
        } finally {
            setAiSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <SlidersHorizontal className="h-6 w-6 text-emerald-600 shrink-0" /> CRM Settings
                    </h1>
                    <p className="text-slate-500 text-sm">Configure how WhatsApp leads are automatically qualified.</p>
                </div>
            </div>

            {/* Qualification keywords card */}
            <Card className="rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 space-y-6">
                    <div>
                        <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" /> Lead Qualification Keywords
                        </h2>
                        <p className="text-slate-500 text-sm mt-1 max-w-2xl">
                            When a customer&apos;s message contains a keyword, their lead is moved to the chosen status.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                            <AlertCircle className="h-8 w-8 text-rose-500" />
                            <p className="text-sm text-slate-500">{error}</p>
                            <Button variant="outline" onClick={fetchKeywords}>Try again</Button>
                        </div>
                    ) : (
                        <>
                            {/* Defaults — read-only */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Default keywords
                                    </span>
                                    <span className="text-[11px] text-slate-400">(built-in, read-only)</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {defaults.length === 0 ? (
                                        <span className="text-sm text-slate-400">No default keywords.</span>
                                    ) : (
                                        defaults.map((kw) => (
                                            <Badge
                                                key={kw.keyword}
                                                variant="outline"
                                                className="bg-slate-50 text-slate-600 border-slate-200 rounded-full px-3 py-1 text-xs font-medium"
                                            >
                                                {kw.keyword}
                                                <span className="ml-1.5 text-[9px] uppercase tracking-wide text-slate-400">
                                                    {statusLabel(kw.status)}
                                                </span>
                                            </Badge>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="h-px bg-slate-100" />

                            {/* Custom — editable list with per-keyword status */}
                            <div className="space-y-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Your custom keywords
                                </span>

                                {/* Add row: keyword input + status select + Add */}
                                <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                                    <Input
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Type a keyword…"
                                        className="bg-white"
                                    />
                                    <Select
                                        value={draftStatus}
                                        onValueChange={(v) => setDraftStatus(v as KeywordStatus)}
                                    >
                                        <SelectTrigger className="w-full sm:w-40 bg-white shrink-0">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STATUS_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={addKeyword}
                                        disabled={!draft.trim()}
                                        className="shrink-0"
                                    >
                                        <Plus className="mr-1 h-4 w-4" /> Add
                                    </Button>
                                </div>

                                {/* Existing custom keywords */}
                                <div className="space-y-2 min-h-[2rem]">
                                    {custom.length === 0 ? (
                                        <span className="text-sm text-slate-400">
                                            No custom keywords yet. Add words your customers use when they&apos;re ready to buy.
                                        </span>
                                    ) : (
                                        custom.map((kw) => (
                                            <div
                                                key={kw.keyword}
                                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 max-w-xl"
                                            >
                                                <Badge
                                                    className={cn(
                                                        'rounded-full px-3 py-1 text-xs font-medium shrink-0',
                                                        'bg-emerald-50 text-emerald-700 border border-emerald-200',
                                                    )}
                                                >
                                                    {kw.keyword}
                                                </Badge>

                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide hidden sm:inline-flex',
                                                        STATUS_BADGE[kw.status] ??
                                                            'bg-slate-50 text-slate-600 border-slate-200',
                                                    )}
                                                >
                                                    {statusLabel(kw.status)}
                                                </Badge>

                                                <div className="ml-auto flex items-center gap-2">
                                                    <Select
                                                        value={kw.status}
                                                        onValueChange={(v) => changeKeywordStatus(kw.keyword, v)}
                                                    >
                                                        <SelectTrigger className="h-8 w-36 bg-white text-xs">
                                                            <SelectValue placeholder="Status" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {STATUS_OPTIONS.map((opt) => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeKeyword(kw.keyword)}
                                                        className="rounded-full p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
                                                        title={`Remove ${kw.keyword}`}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Save */}
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {saving
                                        ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        : <Save className="mr-1.5 h-4 w-4" />}
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Card>

            {/* AI Classification card */}
            <Card className="rounded-xl overflow-hidden">
                <div className="p-5 sm:p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <BrainCircuit className="h-5 w-5 text-emerald-600 shrink-0" /> AI Classification
                            </h2>
                            <p className="text-slate-500 text-sm mt-1 max-w-2xl">
                                When no keyword or flow matches, AI reads the message and sets the lead status.
                                Uses AI credits. Keep <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{'{message}'}</code> in the prompt.
                            </p>
                        </div>
                        {!aiLoading && !aiError && (
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm text-slate-600">{aiEnabled ? 'Enabled' : 'Disabled'}</span>
                                <Switch
                                    checked={aiEnabled}
                                    onCheckedChange={setAiEnabled}
                                    aria-label="Enable AI classification"
                                />
                            </div>
                        )}
                    </div>

                    {aiLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                        </div>
                    ) : aiError ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                            <AlertCircle className="h-8 w-8 text-rose-500" />
                            <p className="text-sm text-slate-500">{aiError}</p>
                            <Button variant="outline" onClick={fetchAiConfig}>Try again</Button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Classification prompt
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleResetPrompt}
                                        disabled={!aiDefaultPrompt || aiPrompt === aiDefaultPrompt}
                                        className="text-slate-500 hover:text-slate-700"
                                    >
                                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to default
                                    </Button>
                                </div>
                                <Textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    disabled={!aiEnabled}
                                    placeholder="Describe how the AI should classify a lead from {message}…"
                                    className="min-h-[140px] bg-white font-mono text-xs leading-relaxed disabled:opacity-60"
                                />
                                <p className="text-[11px] text-slate-400">
                                    Tip: include the <code className="px-1 rounded bg-slate-100 text-slate-600">{'{message}'}</code> placeholder so the customer&apos;s text is inserted at classification time.
                                </p>
                            </div>

                            {/* Save */}
                            <div className="flex justify-end pt-2">
                                <Button
                                    onClick={handleSaveAi}
                                    disabled={aiSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    {aiSaving
                                        ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        : <Save className="mr-1.5 h-4 w-4" />}
                                    Save Changes
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}
