/**
 * AI Flow Generator Dialog
 * Natural-language prompt → WhatsApp interactive automation draft
 */

import React, { useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { API_BASE_URL } from '@/config';
import type { AutomationFlow, FlowEdge, FlowNode, TriggerConfig, FlowConfig } from '../types';

export interface GeneratedFlowDraft {
    name: string;
    description?: string;
    trigger: TriggerConfig;
    nodes: FlowNode[];
    edges: FlowEdge[];
    variables?: Record<string, string>;
    flow_config?: FlowConfig;
    flowConfig?: FlowConfig;
}

const EXAMPLE_PROMPTS = [
    'Lead capture: greet, ask if they want a demo, collect name and email, then thank them.',
    'Support triage: ask billing vs technical, route billing to collect order ID, end with handoff message.',
    'Keyword flow for "pricing": show 3 plan options as buttons, ask for phone number if they pick Enterprise.',
];

interface AiFlowGeneratorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId: string;
    onGenerated: (draft: GeneratedFlowDraft) => void | Promise<void>;
    title?: string;
}

export function AiFlowGeneratorDialog({
    open,
    onOpenChange,
    workspaceId,
    onGenerated,
    title = 'Do with AI',
}: AiFlowGeneratorDialogProps) {
    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        const trimmed = prompt.trim();
        if (!trimmed) return;

        setGenerating(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE_URL}/api/whatsapp/interactive-automations/ai-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    prompt: trimmed,
                    workspace_id: workspaceId || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || `Generation failed (${res.status})`);
            }

            const draft = data.draft as GeneratedFlowDraft;
            if (!draft?.nodes?.length) {
                throw new Error('AI returned an empty flow. Try a more specific prompt.');
            }

            await onGenerated(draft);
            setPrompt('');
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'AI generation failed';
            setError(message);
        } finally {
            setGenerating(false);
        }
    };

    const handleClose = (next: boolean) => {
        if (!generating) {
            if (!next) setError(null);
            onOpenChange(next);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[560px] rounded-2xl p-0 overflow-hidden border-gray-200">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-indigo-50">
                    <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-600" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="text-gray-600">
                        Describe the conversation you want. AI will build messages, buttons, input steps, and branches.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="ai-flow-prompt" className="text-sm font-medium text-gray-700 mb-2 block">
                            What should this flow do?
                        </label>
                        <textarea
                            id="ai-flow-prompt"
                            className="w-full min-h-[140px] rounded-xl border border-violet-200 bg-white p-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-y"
                            placeholder="Example: When someone messages about coaching, ask if they want a free call. If yes, collect their name and email, then send a thank-you message."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={generating}
                            autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Tip: mention triggers (keywords), questions to ask, button choices, and how each branch should end.
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                            <Wand2 className="h-3.5 w-3.5" />
                            Try an example
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {EXAMPLE_PROMPTS.map((example) => (
                                <button
                                    key={example}
                                    type="button"
                                    disabled={generating}
                                    onClick={() => setPrompt(example)}
                                    className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 hover:bg-violet-50 hover:border-violet-200 text-gray-600 transition-colors max-w-full"
                                >
                                    {example.length > 72 ? `${example.slice(0, 72)}…` : example}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/80">
                    <Button variant="ghost" onClick={() => handleClose(false)} disabled={generating}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Building flow…
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate Flow
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Apply AI draft onto an AutomationFlow shell (keeps account/workspace ids). */
export function draftToAutomationFlow(
    draft: GeneratedFlowDraft,
    accountId: number,
    workspaceId: string,
    existingId?: number,
): AutomationFlow {
    return {
        id: existingId,
        name: draft.name,
        description: draft.description,
        accountId,
        workspaceId,
        nodes: draft.nodes,
        edges: draft.edges,
        trigger: draft.trigger,
        variables: draft.variables || {},
        flowConfig: draft.flowConfig || draft.flow_config || {},
        status: 'draft',
    };
}
