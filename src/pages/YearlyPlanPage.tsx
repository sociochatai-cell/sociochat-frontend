// /yearlyplan — SocioChat yearly plans landing page.
// Self-contained static HTML at public/yearlyplan/index.html (single-file
// marketing page, Tailwind CDN + Font Awesome + Plus Jakarta Sans). We render
// it full-viewport in a same-origin iframe so the marketing team can iterate
// on the HTML without touching the SPA — same pattern as OfferPage / /offer.
//
// SocioChat-only: hard-codes SocioChat branding and prices; no per-tenant
// re-branding on this route.
export default function YearlyPlanPage() {
    return (
        <div className="h-screen w-full bg-white">
            <iframe
                title="SocioChat.ai — Yearly Plans"
                src="/yearlyplan/index.html"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation"
            />
        </div>
    );
}
