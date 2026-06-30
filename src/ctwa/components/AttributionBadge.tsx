// Attribution Badge Component
// ============================
// Displays CTWA attribution info on conversation items in the inbox

import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Megaphone, ExternalLink } from 'lucide-react';

// Local attribution type that matches what comes from the backend
interface AttributionData {
    ad_id: string;
    ctwa_clid: string;
    source_type?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    ad_name?: string;
    attributed_at?: string;
    enriched?: boolean;
}

interface AttributionBadgeProps {
    entrySource?: string;
    attribution?: AttributionData | null;
    compact?: boolean;
}

/**
 * Badge to show CTWA attribution on conversation items.
 * Shows "Ad" badge with tooltip containing campaign/ad details.
 */
export function AttributionBadge({
    entrySource,
    attribution,
    compact = false,
}: AttributionBadgeProps) {
    // Only show for CTWA conversations
    if (entrySource !== 'ctwa' || !attribution) {
        return null;
    }

    const campaignName = attribution.campaign_name || 'Unknown Campaign';
    const headline = attribution.headline;

    if (compact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-default text-xs px-1.5"
                        >
                            <Megaphone className="w-3 h-3" />
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                            <p className="font-medium">From Ad</p>
                            <p className="text-xs text-muted-foreground">{campaignName}</p>
                            {headline && <p className="text-xs">"{headline}"</p>}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-default"
                    >
                        <Megaphone className="w-3 h-3 mr-1" />
                        Ad
                    </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                    <AttributionDetails attribution={attribution} />
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/**
 * Detailed attribution info for tooltip content.
 */
function AttributionDetails({ attribution }: { attribution: AttributionData }) {
    return (
        <div className="space-y-2 p-1">
            <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-sm">Click-to-WhatsApp Ad</span>
            </div>

            <div className="space-y-1 text-xs">
                {attribution.campaign_name && (
                    <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Campaign</span>
                        <span className="font-medium truncate max-w-[180px]">
                            {attribution.campaign_name}
                        </span>
                    </div>
                )}

                {attribution.ad_name && (
                    <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Ad</span>
                        <span className="font-medium truncate max-w-[180px]">
                            {attribution.ad_name}
                        </span>
                    </div>
                )}

                {attribution.headline && (
                    <div className="pt-2 border-t">
                        <p className="text-muted-foreground mb-1">Headline</p>
                        <p className="italic">"{attribution.headline}"</p>
                    </div>
                )}

                {attribution.body && (
                    <div className="pt-1">
                        <p className="text-muted-foreground line-clamp-2">{attribution.body}</p>
                    </div>
                )}

                {attribution.image_url && (
                    <div className="pt-2">
                        <img
                            src={attribution.image_url}
                            alt="Ad preview"
                            className="w-full h-20 object-cover rounded"
                        />
                    </div>
                )}
            </div>

            {attribution.ad_id && (
                <div className="pt-2 border-t">
                    <a
                        href={`https://business.facebook.com/adsmanager/manage/ads?selected_ad_ids=${attribution.ad_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                        View in Ads Manager
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            )}
        </div>
    );
}

/**
 * Entry source indicator for conversation lists.
 * Shows different badges for different sources.
 */
export function EntrySourceBadge({ source }: { source?: string }) {
    if (!source || source === 'organic') {
        return null;
    }

    const badges: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
        ctwa: {
            label: 'Ad',
            className: 'bg-blue-100 text-blue-700',
            icon: <Megaphone className="w-3 h-3 mr-1" />,
        },
        qr: {
            label: 'QR',
            className: 'bg-purple-100 text-purple-700',
        },
        link: {
            label: 'Link',
            className: 'bg-green-100 text-green-700',
        },
    };

    const badge = badges[source];
    if (!badge) return null;

    return (
        <Badge variant="secondary" className={badge.className}>
            {badge.icon}
            {badge.label}
        </Badge>
    );
}

export default AttributionBadge;
