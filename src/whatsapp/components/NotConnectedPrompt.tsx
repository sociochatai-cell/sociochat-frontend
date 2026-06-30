// src/whatsapp/components/NotConnectedPrompt.tsx
// Shared "Connect your WhatsApp number" empty-state, shown on any WhatsApp page
// when the current workspace has no WhatsApp account connected. Uses the
// brand-remapped emerald palette so it renders in the active tenant's color.
import { MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface NotConnectedPromptProps {
    /** Feature name to slot into the default copy, e.g. "Forms", "Templates". */
    feature?: string;
    title?: string;
    description?: string;
    /** Where the Connect button navigates (defaults to the WhatsApp settings page). */
    connectTo?: string;
}

export function NotConnectedPrompt({ feature, title, description, connectTo }: NotConnectedPromptProps) {
    const navigate = useNavigate();
    return (
        <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
            <Card className="w-full max-w-md text-center border-slate-200">
                <CardContent className="p-8 space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                        <MessageCircle className="h-7 w-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        {title ?? 'Connect your WhatsApp number'}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {description ??
                            `Connect a WhatsApp Business number to use ${feature ?? 'this feature'}.`}
                    </p>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => navigate(connectTo ?? '/dashboard/connect')}
                    >
                        Connect WhatsApp
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

export default NotConnectedPrompt;
