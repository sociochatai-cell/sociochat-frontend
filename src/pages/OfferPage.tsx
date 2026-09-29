// /offer — SocioChat launch-offer landing (v1).
// The page itself is a self-contained static HTML file at public/offer_v1/
// (single-file marketing page, no framework). We render it full-viewport in a
// same-origin iframe so the marketing team can iterate on the HTML without
// touching the SPA, exactly like LandingPage does with /landing_11.
//
// SocioChat-only: this page hard-codes SocioChat branding and prices; unlike
// LandingPage there is no per-tenant re-branding on this route.
export default function OfferPage() {
    return (
        <div className="h-screen w-full bg-white">
            <iframe
                title="SocioChat.ai — Launch Offer"
                src="/offer_v1/index.html"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation"
            />
        </div>
    );
}
