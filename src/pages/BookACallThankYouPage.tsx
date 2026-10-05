// /bookacall/thankyou — post-submit thank-you page for the Book a Call flow.
// Self-contained static HTML at public/bookacall/thankyou/index.html — fires
// the SocioviaTracker CompleteRegistration conversion with the lead's
// user_data (name/email/phone from sessionStorage) so Meta Pixel + CAPI
// can match + dedupe.
export default function BookACallThankYouPage() {
    return (
        <div className="h-screen w-full bg-white">
            <iframe
                title="SocioChat.ai — Thank You"
                src="/bookacall/thankyou/index.html"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation"
            />
        </div>
    );
}
