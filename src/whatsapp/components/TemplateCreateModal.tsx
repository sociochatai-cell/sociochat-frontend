// Template Create Modal Component
// ================================
// Modal for creating a new template from a suggestion

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Template } from './TemplateCard';
import { FileText, Loader2, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

interface TemplateCreateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    suggestion: Template | null;
    accountId: number | null;
    onCreated: () => void;
}

const LANGUAGES = [
    { code: 'en_US', label: 'English (US)' },
    { code: 'en_GB', label: 'English (UK)' },
    { code: 'hi', label: 'Hindi' },
    { code: 'es', label: 'Spanish' },
    { code: 'pt_BR', label: 'Portuguese (BR)' },
    { code: 'ar', label: 'Arabic' },
    { code: 'fr', label: 'French' },
];

const CATEGORIES = [
    { value: 'UTILITY', label: 'Utility' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'AUTHENTICATION', label: 'Authentication' },
];

export function TemplateCreateModal({
    open,
    onOpenChange,
    suggestion,
    accountId,
    onCreated,
}: TemplateCreateModalProps) {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('UTILITY');
    const [language, setLanguage] = useState('en_US');
    const [bodyText, setBodyText] = useState('');
    const [creating, setCreating] = useState(false);

    // Initialize from suggestion when it changes
    useState(() => {
        if (suggestion) {
            setName(suggestion.id?.toString().replace(/_/g, '') || '');
            setCategory(suggestion.category?.toUpperCase() || 'UTILITY');
            setLanguage(suggestion.language || 'en_US');
            setBodyText(suggestion.preview || suggestion.body_text || '');
        }
    });

    const handleCreate = async () => {
        if (!accountId || !name || !bodyText) {
            toast({
                title: 'Missing Fields',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        // Validate template name (lowercase, underscores, no spaces)
        const validName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

        try {
            setCreating(true);

            const res = await fetch(`${API_BASE}/api/whatsapp/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    account_id: accountId,
                    name: validName,
                    category: category,
                    language: language,
                    components: [
                        { type: 'BODY', text: bodyText }
                    ],
                }),
            });

            const data = await res.json();

            if (data.success) {
                toast({
                    title: 'Template Created!',
                    description: 'Template submitted for Meta approval. Status: PENDING',
                });
                onOpenChange(false);
                onCreated();
                // Reset form
                setName('');
                setBodyText('');
            } else {
                toast({
                    title: 'Creation Failed',
                    description: data.error || 'Failed to create template',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Create template error:', err);
            toast({
                title: 'Creation Failed',
                description: 'Network error',
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    };

    // Reset form when suggestion changes
    const resetForm = () => {
        if (suggestion) {
            setName(suggestion.id?.toString().replace(/_/g, '') || '');
            setCategory(suggestion.category?.toUpperCase() || 'UTILITY');
            setLanguage(suggestion.language || 'en_US');
            setBodyText(suggestion.preview || suggestion.body_text || '');
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (o) resetForm(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Create Template
                    </DialogTitle>
                </DialogHeader>

                <Alert className="bg-yellow-50 border-yellow-200">
                    <Info className="w-4 h-4 text-yellow-600" />
                    <AlertDescription className="text-sm text-yellow-800">
                        Templates must be approved by Meta before you can send them.
                        This typically takes 1-24 hours.
                    </AlertDescription>
                </Alert>

                <div className="space-y-4">
                    {/* Template name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Template Name *</Label>
                        <Input
                            id="name"
                            placeholder="e.g., order_confirmation"
                            value={name}
                            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Lowercase letters, numbers, and underscores only
                        </p>
                    </div>

                    {/* Category and Language */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Language</Label>
                            <Select value={language} onValueChange={setLanguage}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LANGUAGES.map(l => (
                                        <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Body text */}
                    <div className="space-y-2">
                        <Label htmlFor="body">Message Body *</Label>
                        <Textarea
                            id="body"
                            placeholder="Hi {{1}}, your order {{2}} has been confirmed!"
                            value={bodyText}
                            onChange={(e) => setBodyText(e.target.value)}
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Use {`{{1}}`}, {`{{2}}`}, etc. for variables
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={creating || !name || !bodyText}
                    >
                        {creating ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                        ) : (
                            <>Submit for Approval</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
