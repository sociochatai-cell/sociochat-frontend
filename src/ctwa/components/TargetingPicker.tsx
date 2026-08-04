// TargetingPicker — advanced ad targeting
// ========================================
// Two blocks, fully controlled via `value` / `onChange`:
//   1. Interests      — debounced search against Meta's targeting graph,
//                        results add to `value.interests` as removable chips.
//   2. Saved Audiences — the workspace's custom + lookalike audiences, shown
//                        as a checkbox list, toggling `value.custom_audiences`.
//
// Selections have NO internal source of truth — they always live in `value`.
// Only the search results and the fetched audience list are kept locally.

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Loader2, X, Users, Sparkles, ExternalLink, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { searchTargeting, listAudiences } from '@/ctwa';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

/** A single interest as returned by the targeting search. */
interface TargetingResult {
    id: string;
    name: string;
    audience_size?: number;
    type?: string;
}

/** A saved custom/lookalike audience for the workspace. */
interface AudienceItem {
    id: string;
    name: string;
    approximate_count?: number;
    subtype?: string;
}

export interface TargetingSelection {
    interests: { id: string; name: string }[];
    custom_audiences: { id: string; name: string }[];
}

export interface TargetingPickerProps {
    workspaceId: string;
    value: TargetingSelection;
    onChange: (next: TargetingSelection) => void;
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_LEN = 2;

/** Compact, locale-aware number for the muted audience-size hints. */
function formatCount(n: number): string {
    try {
        return new Intl.NumberFormat().format(n);
    } catch {
        return String(n);
    }
}

function errorMessage(err: unknown): string {
    return err instanceof Error && err.message
        ? err.message
        : 'Please try again.';
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function TargetingPicker({
    workspaceId,
    value,
    onChange,
}: TargetingPickerProps): JSX.Element {
    // ---- Interests (search) ----
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TargetingResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);

    // ---- Saved audiences ----
    const [audiences, setAudiences] = useState<AudienceItem[]>([]);
    const [audiencesLoading, setAudiencesLoading] = useState(true);
    const [audiencesError, setAudiencesError] = useState(false);

    const trimmedQuery = query.trim();
    const isActiveSearch = trimmedQuery.length >= MIN_QUERY_LEN;

    // Debounced interest search. Re-runs on every keystroke; the cleanup flag
    // discards responses from superseded requests.
    useEffect(() => {
        if (trimmedQuery.length < MIN_QUERY_LEN) {
            setResults([]);
            setSearched(false);
            setSearching(false);
            return;
        }

        let ignore = false;
        setSearching(true);

        const timer = setTimeout(async () => {
            try {
                const out = await searchTargeting(workspaceId, trimmedQuery);
                if (ignore) return;
                setResults(Array.isArray(out) ? (out as TargetingResult[]) : []);
                setSearched(true);
            } catch (err) {
                if (ignore) return;
                setResults([]);
                setSearched(true);
                toast({
                    title: 'Search failed',
                    description: errorMessage(err),
                    variant: 'destructive',
                });
            } finally {
                if (!ignore) setSearching(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [trimmedQuery, workspaceId]);

    // Load the workspace's saved audiences once (per workspace).
    useEffect(() => {
        let ignore = false;
        setAudiencesLoading(true);
        setAudiencesError(false);

        (async () => {
            try {
                const out = await listAudiences(workspaceId);
                if (ignore) return;
                setAudiences(Array.isArray(out) ? (out as AudienceItem[]) : []);
            } catch (err) {
                if (ignore) return;
                setAudiencesError(true);
                toast({
                    title: 'Could not load audiences',
                    description: errorMessage(err),
                    variant: 'destructive',
                });
            } finally {
                if (!ignore) setAudiencesLoading(false);
            }
        })();

        return () => {
            ignore = true;
        };
    }, [workspaceId]);

    // ---- Selection helpers (all route through onChange) ----

    const addInterest = (item: TargetingResult): void => {
        if (value.interests.some((i) => i.id === item.id)) return;
        onChange({
            ...value,
            interests: [...value.interests, { id: item.id, name: item.name }],
        });
    };

    const removeInterest = (id: string): void => {
        onChange({
            ...value,
            interests: value.interests.filter((i) => i.id !== id),
        });
    };

    const isAudienceSelected = (id: string): boolean =>
        value.custom_audiences.some((a) => a.id === id);

    const toggleAudience = (item: AudienceItem, checked: boolean): void => {
        const exists = isAudienceSelected(item.id);
        if (checked && !exists) {
            onChange({
                ...value,
                custom_audiences: [
                    ...value.custom_audiences,
                    { id: item.id, name: item.name },
                ],
            });
        } else if (!checked && exists) {
            onChange({
                ...value,
                custom_audiences: value.custom_audiences.filter(
                    (a) => a.id !== item.id,
                ),
            });
        }
    };

    // Results not already picked — added ones live in the chip row instead.
    const visibleResults = results.filter(
        (r) => !value.interests.some((i) => i.id === r.id),
    );
    const showNoMatches =
        isActiveSearch && !searching && searched && results.length === 0;

    return (
        <div className="space-y-6">
            {/* ============================================================ */}
            {/* Interests */}
            {/* ============================================================ */}
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <h3 className="text-sm font-semibold">Interests</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Reach people by their interests, hobbies and the pages they
                            engage with. Search and add as many as you like.
                        </p>
                    </div>

                    {/* Selected interest chips */}
                    {value.interests.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {value.interests.map((i) => (
                                <Badge
                                    key={i.id}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                >
                                    <span className="max-w-[16rem] truncate">{i.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeInterest(i.id)}
                                        aria-label={`Remove ${i.name}`}
                                        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Search input */}
                    <div className="space-y-2">
                        <Label htmlFor="targeting-interest-search" className="sr-only">
                            Search interests
                        </Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="targeting-interest-search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search interests, e.g. fitness, coffee, travel…"
                                className="pl-9"
                                autoComplete="off"
                            />
                            {searching && (
                                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                            )}
                        </div>

                        {/* Results dropdown */}
                        {isActiveSearch && (
                            <div className="rounded-md border">
                                {searching && visibleResults.length === 0 ? (
                                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Searching…
                                    </div>
                                ) : visibleResults.length > 0 ? (
                                    <ul className="max-h-64 divide-y overflow-y-auto">
                                        {visibleResults.map((r) => (
                                            <li key={r.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => addInterest(r)}
                                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                                                >
                                                    <span className="truncate font-medium">
                                                        {r.name}
                                                    </span>
                                                    {typeof r.audience_size === 'number' && (
                                                        <span className="shrink-0 text-xs text-muted-foreground">
                                                            {formatCount(r.audience_size)} people
                                                        </span>
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : showNoMatches ? (
                                    <div className="px-3 py-3 text-sm text-muted-foreground">
                                        No matches for “{trimmedQuery}”.
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ============================================================ */}
            {/* Saved Audiences */}
            {/* ============================================================ */}
            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <h3 className="text-sm font-semibold">
                                    Saved Audiences (Custom &amp; Lookalike)
                                </h3>
                            </div>
                            {/* One-click into Meta Ads Manager → Audiences page */}
                            <a
                                href="https://adsmanager.facebook.com/adsmanager/audiences"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button type="button" variant="outline" size="sm">
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                    Open Meta Audiences
                                </Button>
                            </a>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Target your own custom audiences, or lookalikes modelled on
                            them. Pick any that fit this campaign.
                        </p>
                    </div>

                    {/* Detailed how-to note — always visible so anyone can create them */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900">
                        <p className="flex items-center gap-1.5 font-medium">
                            <Info className="h-3.5 w-3.5" /> How to create audiences (once, in Meta)
                        </p>
                        <ol className="mt-2 ml-4 list-decimal space-y-1">
                            <li>
                                Click <b>Open Meta Audiences</b> above — sign in with the Facebook
                                account linked to your ad account.
                            </li>
                            <li>
                                Top-left, make sure the <b>Ad Account</b> selector shows the SAME
                                account you saved in <b>Settings → WhatsApp Ads — Account Setup</b>
                                (audiences are per-account).
                            </li>
                            <li>
                                Click <b>Create audience</b>:
                                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                                    <li><b>Custom Audience</b> → from a customer list (upload phones/emails), your website (Pixel), or engagement.</li>
                                    <li><b>Lookalike Audience</b> → pick a Custom Audience as the source; Meta finds similar people.</li>
                                </ul>
                            </li>
                            <li>Name it, save it — that's it. Come back here and hit refresh; it'll appear below.</li>
                        </ol>
                        <p className="mt-2 text-[11px] text-blue-800">
                            Audiences can only be <b>created</b> inside Meta (they use Meta's own data).
                            We can only <b>read + pick</b> them here.
                        </p>
                    </div>

                    {audiencesLoading ? (
                        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading audiences…
                        </div>
                    ) : audiencesError ? (
                        <p className="py-3 text-sm text-muted-foreground">
                            Couldn’t load your saved audiences. Please try again.
                        </p>
                    ) : audiences.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">
                            No saved audiences yet — use the button above to create one in Meta, then come back and refresh.
                        </p>
                    ) : (
                        <ul className="space-y-1">
                            {audiences.map((a) => {
                                const isLookalike = a.subtype === 'LOOKALIKE';
                                const checkboxId = `targeting-audience-${a.id}`;
                                return (
                                    <li key={a.id}>
                                        <div className="flex items-start gap-3 rounded-md px-1 py-2">
                                            <Checkbox
                                                id={checkboxId}
                                                checked={isAudienceSelected(a.id)}
                                                onCheckedChange={(next) =>
                                                    toggleAudience(a, next === true)
                                                }
                                                className="mt-0.5"
                                            />
                                            <Label
                                                htmlFor={checkboxId}
                                                className="flex flex-1 cursor-pointer flex-col gap-1"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="font-medium">{a.name}</span>
                                                    <Badge
                                                        variant={isLookalike ? 'default' : 'secondary'}
                                                        className="text-[10px]"
                                                    >
                                                        {isLookalike ? 'Lookalike' : 'Custom'}
                                                    </Badge>
                                                </span>
                                                {typeof a.approximate_count === 'number' && (
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                        ~{formatCount(a.approximate_count)} people
                                                    </span>
                                                )}
                                            </Label>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default TargetingPicker;
