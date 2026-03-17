/**
 * CTWA Attribution Badge Stub
 * Click-to-WhatsApp Ad attribution badge — stub for standalone product.
 */

export function AttributionBadge({ ctwaClid, compact, ...props }: any) {
    if (!ctwaClid) return null;
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
            📢 CTWA
        </span>
    );
}

export default AttributionBadge;
