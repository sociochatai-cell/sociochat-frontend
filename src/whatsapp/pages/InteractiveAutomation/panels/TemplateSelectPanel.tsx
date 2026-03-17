/**
 * TemplateSelectPanel Component
 * =============================
 * Modal panel for selecting approved WhatsApp templates
 * that have QUICK_REPLY buttons for use in automation flows.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText,
    Search,
    X,
    Loader2,
    ArrowRight,
    CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TemplateWithButtons {
    id: number;
    name: string;
    category: string;
    language: string;
    status: string;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    variableCount: number;
    buttons: Array<{
        index: number;
        text: string;
    }>;
}

interface TemplateSelectPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (template: TemplateWithButtons) => void;
    accountId: number;
    workspaceId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
    UTILITY: '#10B981',
    MARKETING: '#F59E0B',
    AUTHENTICATION: '#8B5CF6',
};

export const TemplateSelectPanel: React.FC<TemplateSelectPanelProps> = ({
    isOpen,
    onClose,
    onSelect,
    accountId,
    workspaceId,
}) => {
    const [templates, setTemplates] = useState<TemplateWithButtons[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen || !accountId || !workspaceId) return;

        const fetchTemplates = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({
                    workspace_id: workspaceId,
                    account_id: String(accountId),
                });
                const res = await fetch(
                    `/api/whatsapp/interactive-automations/templates-with-buttons?${params}`
                );
                const data = await res.json();
                if (data.success) {
                    setTemplates(data.templates || []);
                } else {
                    setError(data.error || 'Failed to load templates');
                }
            } catch (err) {
                setError('Network error loading templates');
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, [isOpen, accountId, workspaceId]);

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return templates;
        const q = searchQuery.toLowerCase();
        return templates.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                t.category.toLowerCase().includes(q) ||
                t.bodyText?.toLowerCase().includes(q)
        );
    }, [templates, searchQuery]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-800">
                            Select Template
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-6 py-3 border-b border-gray-50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                                       transition-all"
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        Showing templates with quick reply buttons ({filtered.length})
                    </p>
                </div>

                {/* Template List */}
                <div className="flex-1 overflow-y-auto px-6 py-3">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                            <span className="ml-2 text-sm text-gray-500">
                                Loading templates...
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {!loading && !error && filtered.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No templates with quick reply buttons found</p>
                            <p className="text-xs mt-1">
                                Create a template with quick reply buttons first
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        {filtered.map((template) => {
                            const catColor =
                                CATEGORY_COLORS[template.category] || '#6B7280';

                            return (
                                <button
                                    key={template.id}
                                    onClick={() => onSelect(template)}
                                    className="w-full text-left p-4 rounded-xl border border-gray-200
                                               hover:border-blue-300 hover:bg-blue-50/30
                                               transition-all duration-150 group"
                                >
                                    {/* Template header */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-gray-800 truncate">
                                            {template.name}
                                        </span>
                                        <Badge
                                            className="text-[10px] px-1.5 py-0 text-white shrink-0"
                                            style={{ backgroundColor: catColor }}
                                        >
                                            {template.category}
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] px-1.5 py-0 shrink-0"
                                        >
                                            {template.language}
                                        </Badge>
                                    </div>

                                    {/* Body preview */}
                                    {template.bodyText && (
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                                            {template.bodyText}
                                        </p>
                                    )}

                                    {/* Buttons preview */}
                                    <div className="flex flex-wrap gap-1">
                                        {template.buttons.map((btn) => (
                                            <span
                                                key={btn.index}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                                           bg-blue-50 text-blue-600 text-[10px] font-medium"
                                            >
                                                <ArrowRight className="w-3 h-3" />
                                                {btn.text}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Variable count */}
                                    {template.variableCount > 0 && (
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {template.variableCount} variable
                                            {template.variableCount > 1 ? 's' : ''}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateSelectPanel;
