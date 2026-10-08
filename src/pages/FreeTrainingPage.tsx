// /free-training — SocioChat 20-min training opt-in + strategy call page.
// Self-contained static HTML at public/free-training/index.html — both forms
// (opt-in + book-a-call) POST to an Apps Script Web App that writes rows into
// a Google Sheet (Optin_Leads tab + Call_Bookings tab). Same iframe pattern
// as /bookacall and /offer so marketing can iterate on the HTML without
// touching the SPA.
export default function FreeTrainingPage() {
    return (
        <div className="h-screen w-full bg-white">
            <iframe
                title="SocioChat.ai — Free Training"
                src="/free-training/index.html"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation"
            />
        </div>
    );
}
