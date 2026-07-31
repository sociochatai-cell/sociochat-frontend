// AI Generate Dialog — ad images & ad copy
// ========================================
// One reusable modal used in two modes:
//   mode="image" → generates ad creatives, shown in a grid, user picks one
//   mode="copy"  → generates ad text variations, shown as a list, user picks one
//
// The prompt is ALWAYS OPTIONAL. Hitting "Generate" with an empty box is a
// first-class path: the backend then writes the prompt itself from the
// workspace's saved business details.

import { useCallback, useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Check, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { generateAdCopy, generateAdImage } from '@/ctwa';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface GeneratedImage {
    url: string;
}

export interface GeneratedVariation {
    primary_text: string;
    headline?: string;
}

export interface AiGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'image' | 'copy';
    workspaceId: string;
    /** Passed through to the copy generator (e.g. 'ctwa', 'status'). Copy mode only. */
    adType?: string;
    /** Called with the chosen image URL. Image mode only. */
    onSelectImage?: (url: string) => void;
    /** Called with the chosen text variation. Copy mode only. */
    onSelectCopy?: (v: GeneratedVariation) => void;
}

// How many images to ask for per run.
const IMAGE_COUNT = 2;

const PLACEHOLDERS: Record<AiGenerateDialogProps['mode'], string> = {
    image: 'e.g. a festive diwali sale banner with sweets and lamps',
    copy: 'e.g. friendly tone, mention 20% off',
};

/**
 * Turn a thrown error into something a shop owner can actually act on.
 * The backend leaks a couple of config-y error codes — translate those.
 */
function describeError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err ?? '');
    if (raw.includes('storage_not_configured')) {
        return "Image storage isn't configured on the server.";
    }
    if (raw.includes('genai_client_not_initialized')) {
        return "AI image generation isn't configured on the server.";
    }
    return raw || 'Something went wrong. Please try again.';
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function AiGenerateDialog({
    open,
    onOpenChange,
    mode,
    workspaceId,
    adType,
    onSelectImage,
    onSelectCopy,
}: AiGenerateDialogProps): JSX.Element {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [variations, setVariations] = useState<GeneratedVariation[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [hasRun, setHasRun] = useState(false);

    const isImage = mode === 'image';
    const results: number = isImage ? images.length : variations.length;
    const hasResults = results > 0;

    // Fresh slate every time the dialog is opened.
    useEffect(() => {
        if (open) {
            setPrompt('');
            setImages([]);
            setVariations([]);
            setSelected(null);
            setHasRun(false);
            setLoading(false);
        }
    }, [open, mode]);

    const handleGenerate = useCallback(async () => {
        setLoading(true);
        setSelected(null);
        try {
            const trimmed = prompt.trim();
            if (isImage) {
                const out = await generateAdImage(workspaceId, trimmed || undefined, IMAGE_COUNT);
                setImages(out);
                setVariations([]);
            } else {
                const out = await generateAdCopy(workspaceId, trimmed || undefined, adType);
                setVariations(out);
                setImages([]);
            }
            setHasRun(true);
        } catch (err) {
            toast({
                title: 'Generation failed',
                description: describeError(err),
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [prompt, isImage, workspaceId, adType]);

    const handleUse = useCallback(() => {
        if (selected === null) return;
        if (isImage) {
            const picked = images[selected];
            if (picked) onSelectImage?.(picked.url);
        } else {
            const picked = variations[selected];
            if (picked) onSelectCopy?.(picked);
        }
        onOpenChange(false);
    }, [selected, isImage, images, variations, onSelectImage, onSelectCopy, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-2xl">
                <DialogHeader className="pb-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {isImage ? 'Generate image with AI' : 'Generate ad text with AI'}
                    </DialogTitle>
                    <DialogDescription>
                        {isImage
                            ? 'Describe the creative you want — or just hit Generate and we’ll design one from your business details.'
                            : 'Describe the angle you want — or just hit Generate and we’ll write from your business details.'}
                    </DialogDescription>
                </DialogHeader>

                {/* ---- Prompt (optional) ---- */}
                <div className="space-y-2">
                    <Label htmlFor="ai-generate-prompt">
                        Prompt <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                        id="ai-generate-prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={PLACEHOLDERS[mode]}
                        disabled={loading}
                        rows={3}
                        className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                        Leave empty to auto-generate from your business details.
                    </p>
                </div>

                {/* ---- Generate ---- */}
                <div className="pt-4">
                    <Button type="button" onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating…
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                Generate
                            </>
                        )}
                    </Button>
                </div>

                {/* ---- Results ---- */}
                {hasResults && (
                    <div className="space-y-3 pt-6">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                                {isImage ? 'Pick an image' : 'Pick a version'}
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleGenerate}
                                disabled={loading}
                            >
                                <RefreshCw className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')} />
                                Generate again
                            </Button>
                        </div>

                        {isImage ? (
                            <div className="grid grid-cols-2 gap-3">
                                {images.map((img, i) => (
                                    <button
                                        key={`${img.url}-${i}`}
                                        type="button"
                                        onClick={() => setSelected(i)}
                                        aria-pressed={selected === i}
                                        className={cn(
                                            'group relative aspect-[9/16] overflow-hidden rounded-lg border bg-muted transition',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                            selected === i
                                                ? 'ring-2 ring-primary ring-offset-2'
                                                : 'hover:border-primary/50',
                                        )}
                                    >
                                        <img
                                            src={img.url}
                                            alt={`AI generated option ${i + 1}`}
                                            loading="lazy"
                                            className="h-full w-full object-cover"
                                        />
                                        {selected === i && (
                                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                                                <Check className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {variations.map((v, i) => (
                                    <button
                                        key={`${v.headline ?? ''}-${i}`}
                                        type="button"
                                        onClick={() => setSelected(i)}
                                        aria-pressed={selected === i}
                                        className={cn(
                                            'relative w-full rounded-lg border p-3 pr-10 text-left transition',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                            selected === i
                                                ? 'ring-2 ring-primary ring-offset-2'
                                                : 'hover:border-primary/50 hover:bg-accent/40',
                                        )}
                                    >
                                        {v.headline && (
                                            <p className="mb-1 text-sm font-semibold leading-snug">{v.headline}</p>
                                        )}
                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                            {v.primary_text}
                                        </p>
                                        {selected === i && (
                                            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                                                <Check className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Ran, but the model gave us nothing back. */}
                {hasRun && !hasResults && !loading && (
                    <p className="pt-6 text-sm text-muted-foreground">
                        Nothing came back this time. Try again, or add a short description above.
                    </p>
                )}

                <DialogFooter className="gap-2 pt-6">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleUse} disabled={selected === null}>
                        Use this
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default AiGenerateDialog;
