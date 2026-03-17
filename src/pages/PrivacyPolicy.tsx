import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EFFECTIVE_DATE = "01st March 2026";

export default function PrivacyPolicy(): JSX.Element {
    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-5xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Privacy Policy</h1>
                        <p className="text-sm text-muted-foreground">Effective Date: {EFFECTIVE_DATE}</p>
                    </div>
                </header>

                <Card>
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>
                            SocioChat ("we", "our", or "us") is committed to protecting your privacy.
                            This Privacy Policy explains what information we collect, how we use and share it, and the choices you have.
                        </p>
                        <p className="mt-3">
                            By using our website, platform or services, you agree to the terms of this Privacy Policy.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Information We Collect</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc ml-5 space-y-2">
                            <li>
                                <strong>Information you provide:</strong> name, email, phone, business details, workspace and billing information, and credentials you submit to connect third-party services.
                            </li>
                            <li>
                                <strong>Third-party data:</strong> when you connect accounts (e.g. Meta/WhatsApp Business) we may access account IDs, phone numbers, message metadata, and conversation data as permitted.
                            </li>
                            <li>
                                <strong>Automatically collected:</strong> logs (IP, device, browser), usage data, cookies and analytics data to operate and improve the service.
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>How We Use Your Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>We use the data to:</p>
                        <ul className="list-disc ml-5 space-y-2">
                            <li>Provide and operate the Services (WhatsApp messaging, inbox, templates, automation).</li>
                            <li>Generate AI-driven insights, message rewrites, and analytics.</li>
                            <li>Support integrations and sync data with your connected WhatsApp Business Accounts.</li>
                            <li>Communicate important updates, billing, and support messages.</li>
                        </ul>
                        <p className="mt-3">We do not sell personal information to third parties.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Sharing &amp; Third Parties</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>
                            We share data only in limited scenarios: (a) with service providers (hosting, analytics, email), (b) with platforms you explicitly connect (Meta/WhatsApp Business API), (c) to comply with legal obligations, or (d) in connection with a business transaction (merger/acquisition).
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>WhatsApp &amp; Meta Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>
                            When you connect your WhatsApp Business Account, we access and store conversation messages, contact information, and template data to provide our inbox and automation services. This data is used solely to operate the SocioChat platform on your behalf.
                        </p>
                        <p className="mt-2">
                            We comply with Meta's Platform Terms and WhatsApp Business API policies. Message content is encrypted in transit and stored securely.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Security &amp; Storage</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>
                            We implement industry-standard technical and organizational safeguards such as encryption, access controls, and regular security reviews. While we strive to keep your data secure, no system is completely immune to risk.
                        </p>
                        <p className="mt-2">
                            If you disconnect your WhatsApp Business Account, related synced data will be deleted or anonymized within 30 days unless otherwise required by law.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Your Rights</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>
                            Depending on your jurisdiction (GDPR, CCPA, etc.), you may have the right to access, correct, or delete your personal data, withdraw consent, and export your data. To exercise any rights, contact us at <strong>sociochat.ai@gmail.com</strong>.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Children</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>SocioChat is not intended for individuals under the age of 18. We do not knowingly collect data from children.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Changes to This Policy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>We may update this policy periodically. The Effective Date at the top reflects the latest update.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Contact</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>
                            For questions about privacy, data requests or complaints contact us:
                        </p>
                        <ul className="list-disc ml-5 mt-2">
                            <li>📧 <strong><a
                                href="mailto:sociochat.ai@gmail.com"
                                className="hover:underline"
                            >sociochat.ai@gmail.com</a></strong></li>
                        </ul>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button asChild>
                        <a href="/" aria-label="Return home">Back to Home</a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
