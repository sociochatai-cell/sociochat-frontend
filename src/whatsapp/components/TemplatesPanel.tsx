// Templates Panel Component
// ==========================
// Main container for templates with tabs for My Templates and Suggestions

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { MyTemplatesList } from './MyTemplatesList';
import { TemplateSuggestionList } from './TemplateSuggestionList';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import { TemplateCreateModal } from './TemplateCreateModal';
import { Template } from './TemplateCard';
import { FileText, Sparkles, LayoutTemplate } from 'lucide-react';

interface TemplatesPanelProps {
    accountId: number | null;
    recipientPhone: string;
    recipientName?: string;
    phoneNumberId: string;
    trigger?: React.ReactNode;
    onTemplateSent?: (message: any, conversationId: number) => void;
}

export function TemplatesPanel({
    accountId,
    recipientPhone,
    recipientName,
    phoneNumberId,
    trigger,
    onTemplateSent,
}: TemplatesPanelProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('my-templates');

    // Modal states
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [selectedSuggestion, setSelectedSuggestion] = useState<Template | null>(null);

    const handleSendTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setPreviewModalOpen(true);
    };

    const handleUseSuggestion = (suggestion: Template) => {
        setSelectedSuggestion(suggestion);
        setCreateModalOpen(true);
    };

    const handleTemplateCreated = () => {
        // Switch to My Templates tab to see the new pending template
        setActiveTab('my-templates');
    };

    return (
        <>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    {trigger || (
                        <Button variant="outline" size="sm" className="gap-2">
                            <LayoutTemplate className="w-4 h-4" />
                            Templates
                        </Button>
                    )}
                </SheetTrigger>

                <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b">
                        <SheetTitle className="flex items-center gap-2">
                            <LayoutTemplate className="w-5 h-5 text-primary" />
                            Templates
                        </SheetTitle>
                    </SheetHeader>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="mx-4 mt-4 grid grid-cols-2">
                            <TabsTrigger value="my-templates" className="gap-1">
                                <FileText className="w-4 h-4" />
                                My Templates
                            </TabsTrigger>
                            <TabsTrigger value="suggestions" className="gap-1">
                                <Sparkles className="w-4 h-4" />
                                Suggestions
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="my-templates" className="flex-1 overflow-hidden m-0">
                            <MyTemplatesList
                                accountId={accountId}
                                onSendTemplate={handleSendTemplate}
                            />
                        </TabsContent>

                        <TabsContent value="suggestions" className="flex-1 overflow-hidden m-0">
                            <TemplateSuggestionList
                                onUseTemplate={handleUseSuggestion}
                            />
                        </TabsContent>
                    </Tabs>
                </SheetContent>
            </Sheet>

            {/* Preview Modal for sending */}
            <TemplatePreviewModal
                open={previewModalOpen}
                onOpenChange={setPreviewModalOpen}
                template={selectedTemplate}
                recipientPhone={recipientPhone}
                recipientName={recipientName}
                phoneNumberId={phoneNumberId}
                onTemplateSent={(msg, cid) => {
                    setOpen(false); // Close panel when sent
                    if (onTemplateSent) onTemplateSent(msg, cid);
                }}
            />

            {/* Create Modal for suggestions */}
            <TemplateCreateModal
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
                suggestion={selectedSuggestion}
                accountId={accountId}
                onCreated={handleTemplateCreated}
            />
        </>
    );
}
