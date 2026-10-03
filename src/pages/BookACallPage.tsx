// /bookacall — SocioChat "Book a Call" landing page (hero + demo video +
// lead form, pricing cards). Self-contained static HTML at
// public/bookacall/index.html — Tailwind CDN + Font Awesome + Plus Jakarta
// Sans + ApsScript sheet integration. We render it full-viewport in a
// same-origin iframe so the marketing team can iterate on the HTML without
// touching the SPA — same pattern as OfferPage / /offer.
//
// SocioChat-only: hard-codes SocioChat branding and prices; no per-tenant
// re-branding on this route.
export default function BookACallPage() {
    return (
        <div className="h-screen w-full bg-white">
            <iframe
                title="SocioChat.ai — Book a Call"
                src="/bookacall/index.html"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation"
            />
        </div>
    );
}
