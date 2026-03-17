// Template Suggestion List Component
// ===================================
// Section 2: Static template presets curated by Sociovia

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TemplateCard, Template } from './TemplateCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, RefreshCw, Sparkles, Plus } from 'lucide-react';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

interface TemplateSuggestionListProps {
    onUseTemplate?: (template: Template) => void;
}

export function TemplateSuggestionList({ onUseTemplate }: TemplateSuggestionListProps) {
    const navigate = useNavigate();
    const [suggestions, setSuggestions] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSuggestions = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_BASE}/api/whatsapp/template-suggestions`, {
                    credentials: 'include',
                });
                const data = await res.json();

                if (data.success) {
                    setSuggestions(data.suggestions || []);
                }
            } catch (err) {
                console.error('Failed to fetch suggestions:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSuggestions();
    }, []);

    const handleUseTemplate = (template: Template) => {
        // Navigate to builder with suggestion ID
        navigate(`/dashboard/templates/new?suggestion=${template.id}`);
        // Also call the callback if provided (for closing modals etc.)
        onUseTemplate?.(template);
    };

    const handleCreateNew = () => {
        navigate('/dashboard/templates/new');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header with info */}
            <div className="p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold">Template Suggestions</h3>
                    </div>
                    <Button
                        size="sm"
                        onClick={handleCreateNew}
                        className="gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        Create New
                    </Button>
                </div>

                <Alert className="bg-primary/5 border-primary/20">
                    <Info className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        These are template ideas. Click "Use this template" to create your own version.
                        <strong> Templates require Meta approval before sending.</strong>
                    </AlertDescription>
                </Alert>
            </div>

            {/* Suggestions list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : suggestions.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p>No suggestions available</p>
                    </div>
                ) : (
                    suggestions.map((template) => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            isReal={false}
                            onUse={() => handleUseTemplate(template)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
