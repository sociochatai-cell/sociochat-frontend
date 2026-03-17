// Variable Mapping Editor Component
// ==================================
// Allows users to give friendly names to numbered template variables like {{1}}, {{2}}

import { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Settings2, Loader2, CheckCircle, Info, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";

interface VariableMappingEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templateId: number;
    templateName: string;
    variableCount: number;
    bodyText?: string;
    headerText?: string;
    footerText?: string;
    existingMapping?: Record<string, string> | null;
    onSaved?: (mapping: Record<string, string>) => void;
}

export function VariableMappingEditor({
    open,
    onOpenChange,
    templateId,
    templateName,
    variableCount,
    bodyText,
    headerText,
    footerText,
    existingMapping,
    onSaved,
}: VariableMappingEditorProps) {
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // Initialize mapping when modal opens
    useEffect(() => {
        if (open) {
            const initial: Record<string, string> = {};
            for (let i = 1; i <= variableCount; i++) {
                initial[String(i)] = existingMapping?.[String(i)] || '';
            }
            setMapping(initial);
        }
    }, [open, variableCount, existingMapping]);

    // Live preview with aliases replacing placeholders
    const livePreview = useMemo(() => {
        let preview = bodyText || '';
        for (let i = 1; i <= variableCount; i++) {
            const alias = mapping[String(i)]?.trim();
            if (alias) {
                // Replace {{i}} with {{alias}} for display
                preview = preview.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), `{{${alias}}}`);
            }
        }
        return preview;
    }, [bodyText, mapping, variableCount]);

    const handleSave = async () => {
        // Filter out empty values
        const cleanMapping: Record<string, string> = {};
        Object.entries(mapping).forEach(([key, value]) => {
            if (value.trim()) {
                cleanMapping[key] = value.trim();
            }
        });

        try {
            setSaving(true);
            const res = await fetch(
                `${API_BASE_URL}/api/whatsapp/templates/${templateId}/variable-mapping`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ variable_mapping: cleanMapping }),
                }
            );

            const data = await res.json();

            if (res.ok && data.success) {
                toast({
                    title: 'Variable Names Saved',
                    description: `${Object.keys(cleanMapping).length} variable names configured`,
                });
                onSaved?.(data.template?.variable_mapping || cleanMapping);
                onOpenChange(false);
            } else {
                toast({
                    title: 'Save Failed',
                    description: data.error || 'Failed to save variable names',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Save error:', err);
            toast({
                title: 'Save Failed',
                description: 'Network error',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5" />
                        Configure Variable Aliases
                    </DialogTitle>
                    <DialogDescription>
                        Give friendly names to each variable in <strong>{templateName}</strong>.
                        These names will appear when sending templates and in drip campaigns.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Live Preview */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            Live Preview
                        </Label>
                        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                            <CardContent className="p-4">
                                <div className="bg-white rounded-lg p-3 border border-green-100 shadow-sm">
                                    {headerText && (
                                        <p className="font-semibold text-sm mb-2">{headerText}</p>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap">{livePreview || 'No body text'}</p>
                                    {footerText && (
                                        <p className="text-xs text-muted-foreground mt-2">{footerText}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Info callout */}
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                        <Info className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
                        <div>
                            <p className="text-blue-800">
                                Type alias names below. The preview above will update in real-time.
                            </p>
                        </div>
                    </div>

                    {/* Variable inputs */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Variable Aliases</Label>
                        {Array.from({ length: variableCount }, (_, i) => i + 1).map((varNum) => {
                            return (
                                <div key={varNum} className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono shrink-0 w-12 justify-center">
                                        {`{{${varNum}}}`}
                                    </Badge>
                                    <span className="text-muted-foreground">→</span>
                                    <Input
                                        placeholder={`e.g., Name, Amount, Date...`}
                                        value={mapping[String(varNum)] || ''}
                                        onChange={(e) =>
                                            setMapping((prev) => ({
                                                ...prev,
                                                [String(varNum)]: e.target.value,
                                            }))
                                        }
                                        className="flex-1"
                                    />
                                    {mapping[String(varNum)]?.trim() && (
                                        <Badge variant="secondary" className="shrink-0">
                                            {`{{${mapping[String(varNum)]}}}`}
                                        </Badge>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Save Aliases
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
