// Carousel Builder — ordered image cards for a carousel ad
// =========================================================
// A carousel ad is an ordered list of 2–10 cards. Each card is one swipeable
// panel: an image + a short headline + a short description. This component is
// fully controlled — it never owns the card list, it just renders `cards` and
// asks the parent to store the next version through `onChange`.
//
// Image uploads go through `uploadAdMedia`, which hands back a public https URL
// that Meta can fetch. Everything else (headline / description / order) is plain
// local text the parent persists.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Plus,
    X,
    Upload,
    Loader2,
    ArrowUp,
    ArrowDown,
    Image as ImageIcon,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { uploadAdMedia, generateAdImage, generateAdCopy } from '@/ctwa';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface CarouselCard {
    image_url: string;
    headline?: string;
    description?: string;
}

export interface CarouselBuilderProps {
    workspaceId: string;
    cards: CarouselCard[];
    onChange: (cards: CarouselCard[]) => void;
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

/** Meta caps carousels at 10 cards and needs at least 2 to be a carousel. */
const MAX_CARDS = 10;
const MIN_CARDS = 2;
const HEADLINE_MAX = 40;
const DESCRIPTION_MAX = 30;

const EMPTY_CARD: CarouselCard = { image_url: '', headline: '', description: '' };

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Turn a thrown upload error into something a shop owner can act on. The backend
 * leaks a config-y error code when object storage isn't wired up — translate it.
 */
function describeUploadError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err ?? '');
    if (raw.includes('storage_not_configured')) {
        return "File storage isn't configured on the server.";
    }
    return raw || 'Something went wrong while uploading. Please try again.';
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function CarouselBuilder({
    workspaceId,
    cards,
    onChange,
}: CarouselBuilderProps): JSX.Element {
    const uid = useId();

    // Which card indexes are mid-upload. Kept as a Set so simultaneous uploads
    // on different cards don't clobber each other's spinner state.
    const [uploading, setUploading] = useState<Set<number>>(new Set());

    // Always read the freshest card list when committing a change. Async upload
    // completions can land after the parent has re-rendered with a newer list,
    // so a stale closure over `cards` would drop concurrent edits.
    const cardsRef = useRef(cards);
    useEffect(() => {
        cardsRef.current = cards;
    }, [cards]);

    const patchCard = useCallback(
        (index: number, patch: Partial<CarouselCard>) => {
            const next = cardsRef.current.map((card, i) =>
                i === index ? { ...card, ...patch } : card,
            );
            onChange(next);
        },
        [onChange],
    );

    const addCard = useCallback(() => {
        if (cardsRef.current.length >= MAX_CARDS) return;
        onChange([...cardsRef.current, { ...EMPTY_CARD }]);
    }, [onChange]);

    const removeCard = useCallback(
        (index: number) => {
            onChange(cardsRef.current.filter((_, i) => i !== index));
        },
        [onChange],
    );

    const moveCard = useCallback(
        (index: number, direction: -1 | 1) => {
            const target = index + direction;
            const list = cardsRef.current;
            if (target < 0 || target >= list.length) return;
            const next = list.slice();
            [next[index], next[target]] = [next[target], next[index]];
            onChange(next);
        },
        [onChange],
    );

    const uploadForCard = useCallback(
        async (index: number, file: File | undefined) => {
            if (!file) return;
            setUploading((prev) => {
                const next = new Set(prev);
                next.add(index);
                return next;
            });
            try {
                const { url } = await uploadAdMedia(workspaceId, file);
                patchCard(index, { image_url: url });
            } catch (err) {
                toast({
                    title: 'Upload failed',
                    description: describeUploadError(err),
                    variant: 'destructive',
                });
            } finally {
                setUploading((prev) => {
                    const next = new Set(prev);
                    next.delete(index);
                    return next;
                });
            }
        },
        [workspaceId, patchCard],
    );

    // ---- AI: generate a whole carousel (N images + headlines) at once ----
    const [aiOpen, setAiOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiCount, setAiCount] = useState(3);
    const [aiBusy, setAiBusy] = useState(false);

    const handleAiGenerate = useCallback(async () => {
        const n = Math.min(MAX_CARDS, Math.max(MIN_CARDS, aiCount || MIN_CARDS));
        setAiBusy(true);
        try {
            // Images: the backend caps a single call at 4, so batch until we have N.
            const images: string[] = [];
            while (images.length < n) {
                const batch = await generateAdImage(workspaceId, aiPrompt || undefined, Math.min(4, n - images.length));
                if (!batch.length) break;
                images.push(...batch.map(b => b.url));
            }
            if (!images.length) throw new Error('No images were generated.');

            // Headlines/descriptions: best-effort — cycle through a few AI variations.
            let copy: { primary_text: string; headline?: string }[] = [];
            try {
                copy = await generateAdCopy(workspaceId, aiPrompt || undefined);
            } catch { /* headlines are optional */ }

            const newCards: CarouselCard[] = images.slice(0, n).map((url, i) => ({
                image_url: url,
                headline: (copy[i % (copy.length || 1)]?.headline || '').slice(0, HEADLINE_MAX),
                description: (copy[i % (copy.length || 1)]?.primary_text || '').slice(0, DESCRIPTION_MAX),
            }));
            onChange(newCards);
            toast({ title: 'Carousel generated', description: `${newCards.length} cards created with AI.` });
            setAiOpen(false);
        } catch (err) {
            toast({
                title: 'Generation failed',
                description: err instanceof Error ? err.message : 'Could not generate the carousel.',
                variant: 'destructive',
            });
        } finally {
            setAiBusy(false);
        }
    }, [workspaceId, aiPrompt, aiCount, onChange]);

    const count = cards.length;
    const belowMinimum = count < MIN_CARDS;

    return (
        <div className="space-y-4">
            {/* ---- Header: counter + guidance ---- */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                    <p className="text-sm font-medium">
                        {count} {count === 1 ? 'card' : 'cards'}
                    </p>
                    <p
                        className={cn(
                            'text-xs',
                            belowMinimum ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground',
                        )}
                    >
                        A carousel needs at least 2 cards. Each card is a swipeable panel in the ad.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setAiOpen(o => !o)}>
                        <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addCard}
                        disabled={count >= MAX_CARDS}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add card
                    </Button>
                </div>
            </div>

            {/* ---- AI generate panel: choose how many cards, optional prompt ---- */}
            {aiOpen && (
                <Card className="border-fuchsia-200 bg-fuchsia-50/40">
                    <CardContent className="space-y-3 p-4">
                        <p className="text-sm font-medium">Generate a carousel with AI</p>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Number of cards</Label>
                                <Input
                                    type="number"
                                    min={MIN_CARDS}
                                    max={MAX_CARDS}
                                    value={aiCount}
                                    onChange={e => setAiCount(parseInt(e.target.value) || MIN_CARDS)}
                                    className="w-24"
                                    disabled={aiBusy}
                                />
                            </div>
                            <div className="flex-1 space-y-1 min-w-[200px]">
                                <Label className="text-xs">Prompt (optional — leave empty to use your business details)</Label>
                                <Input
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    placeholder="e.g. summer sale, 3 product shots"
                                    disabled={aiBusy}
                                />
                            </div>
                        </div>
                        <Button type="button" size="sm" onClick={handleAiGenerate} disabled={aiBusy}>
                            {aiBusy
                                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating {aiCount} cards…</>
                                : <><Sparkles className="mr-2 h-4 w-4" /> Generate {aiCount} cards</>}
                        </Button>
                        <p className="text-[11px] text-muted-foreground">
                            Replaces the current cards with {aiCount} AI-generated images + headlines. You can edit them after.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* ---- Empty state ---- */}
            {count === 0 && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            No cards yet. Add at least 2 to build your carousel.
                        </p>
                        <Button type="button" variant="outline" size="sm" onClick={addCard}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add card
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ---- Cards ---- */}
            <div className="space-y-3">
                {cards.map((card, index) => {
                    const isUploading = uploading.has(index);
                    const headlineId = `${uid}-headline-${index}`;
                    const descriptionId = `${uid}-description-${index}`;

                    return (
                        <Card key={index}>
                            <CardContent className="flex gap-4 p-4">
                                {/* Reorder controls + position badge */}
                                <div className="flex flex-col items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveCard(index, -1)}
                                        disabled={index === 0}
                                        aria-label="Move card earlier"
                                        title="Move earlier"
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                        {index + 1}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => moveCard(index, 1)}
                                        disabled={index === count - 1}
                                        aria-label="Move card later"
                                        title="Move later"
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Image area — hidden file input inside a label */}
                                <label
                                    className={cn(
                                        'group relative flex aspect-square w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted transition sm:w-32',
                                        isUploading ? 'cursor-default' : 'cursor-pointer hover:border-primary/50',
                                    )}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={isUploading}
                                        onChange={(e) => {
                                            void uploadForCard(index, e.target.files?.[0]);
                                            // Reset so re-picking the same file fires onChange again.
                                            e.target.value = '';
                                        }}
                                    />
                                    {isUploading ? (
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    ) : card.image_url ? (
                                        <>
                                            <img
                                                src={card.image_url}
                                                alt={`Card ${index + 1}`}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                                                <Upload className="mr-1.5 h-3.5 w-3.5" />
                                                Change
                                            </span>
                                        </>
                                    ) : (
                                        <span className="flex flex-col items-center gap-1 px-2 text-center text-xs text-muted-foreground">
                                            <Upload className="h-5 w-5" />
                                            Upload image
                                        </span>
                                    )}
                                </label>

                                {/* Headline + description */}
                                <div className="flex flex-1 flex-col justify-center gap-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor={headlineId} className="text-xs">
                                            Headline
                                        </Label>
                                        <Input
                                            id={headlineId}
                                            value={card.headline ?? ''}
                                            onChange={(e) => patchCard(index, { headline: e.target.value })}
                                            maxLength={HEADLINE_MAX}
                                            placeholder="Short, punchy title"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor={descriptionId} className="text-xs">
                                            Description
                                        </Label>
                                        <Input
                                            id={descriptionId}
                                            value={card.description ?? ''}
                                            onChange={(e) => patchCard(index, { description: e.target.value })}
                                            maxLength={DESCRIPTION_MAX}
                                            placeholder="One extra line"
                                        />
                                    </div>
                                </div>

                                {/* Remove */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeCard(index)}
                                    aria-label={`Remove card ${index + 1}`}
                                    title="Remove card"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ---- Footer add (kept reachable after a long list) ---- */}
            {count > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCard}
                    disabled={count >= MAX_CARDS}
                    className="w-full"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    {count >= MAX_CARDS ? 'Maximum of 10 cards' : 'Add card'}
                </Button>
            )}
        </div>
    );
}

export default CarouselBuilder;
