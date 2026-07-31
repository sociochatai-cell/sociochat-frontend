// WhatsApp Ads — Account Setup (Settings card)
// =============================================
// Pick the Ad Account + Facebook Page + WhatsApp Number ONCE per workspace and
// save it. The ad wizard reads this saved setup so users never have to re-select
// their accounts every time they build an ad.

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { Megaphone, Loader2, CheckCircle2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import { getCTWAAccounts, getAdSettings, saveAdSettings } from '@/ctwa';

interface AdAccountOption {
    id: string;
    name: string;
}

interface PageOption {
    id: string;
    name: string;
}

interface WhatsAppNumberOption {
    phone_number_id: string;
    display_phone_number: string;
    verified_name?: string | null;
}

export function AdAccountSettingsCard(): JSX.Element {
    const workspaceId = getWorkspaceId() || '';

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);

    const [adAccounts, setAdAccounts] = useState<AdAccountOption[]>([]);
    const [pages, setPages] = useState<PageOption[]>([]);
    const [numbers, setNumbers] = useState<WhatsAppNumberOption[]>([]);

    const [adAccountId, setAdAccountId] = useState('');
    const [pageId, setPageId] = useState('');
    const [whatsappNumberId, setWhatsappNumberId] = useState('');

    const loadData = useCallback(async () => {
        if (!workspaceId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [accounts, settings] = await Promise.all([
                getCTWAAccounts(workspaceId),
                getAdSettings(workspaceId),
            ]);

            setAdAccounts(accounts.ad_accounts);
            setPages(accounts.pages);
            setNumbers(accounts.whatsapp_numbers);

            if (settings) {
                if (settings.ad_account_id) setAdAccountId(settings.ad_account_id);
                if (settings.page_id) setPageId(settings.page_id);
                if (settings.whatsapp_phone_number_id) {
                    setWhatsappNumberId(settings.whatsapp_phone_number_id);
                }
                setHasSaved(
                    !!(settings.ad_account_id &&
                        settings.page_id &&
                        settings.whatsapp_phone_number_id),
                );
            }
        } catch (err) {
            toast({
                title: 'Could not load ad accounts',
                description: err instanceof Error ? err.message : 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const facebookConnected = adAccounts.length > 0 && pages.length > 0;

    const handleSave = useCallback(async () => {
        if (!adAccountId || !pageId || !whatsappNumberId) {
            toast({
                title: 'Pick all three',
                description: 'Choose an ad account, a Facebook page and a WhatsApp number before saving.',
                variant: 'destructive',
            });
            return;
        }

        const account = adAccounts.find((a) => a.id === adAccountId);
        const page = pages.find((p) => p.id === pageId);
        const number = numbers.find((n) => n.phone_number_id === whatsappNumberId);

        setSaving(true);
        try {
            await saveAdSettings(workspaceId, {
                ad_account_id: adAccountId,
                ad_account_name: account?.name,
                page_id: pageId,
                page_name: page?.name,
                whatsapp_phone_number_id: whatsappNumberId,
                whatsapp_display_number: number?.display_phone_number,
            });
            setHasSaved(true);
            toast({
                title: '✓ Setup saved',
                description: 'Ad setup saved — the wizard will use this automatically.',
            });
        } catch (err) {
            toast({
                title: 'Could not save setup',
                description: err instanceof Error ? err.message : 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }, [adAccountId, pageId, whatsappNumberId, adAccounts, pages, numbers, workspaceId]);

    return (
        <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-fuchsia-100 flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-fuchsia-600" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            WhatsApp Ads — Account Setup
                            {hasSaved && (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Saved
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Pick your ad account, page and WhatsApp number once. Every new ad uses this automatically.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {loading ? (
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading your accounts…
                    </div>
                ) : (
                    <>
                        {!facebookConnected && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                Connect your Facebook Ads account first (the card above).
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="ad-account-select">Ad Account</Label>
                            <Select
                                value={adAccountId}
                                onValueChange={setAdAccountId}
                                disabled={!facebookConnected || saving}
                            >
                                <SelectTrigger id="ad-account-select">
                                    <SelectValue placeholder="Select an ad account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {adAccounts.map((account) => (
                                        <SelectItem key={account.id} value={account.id}>
                                            {account.name} ({account.id})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="page-select">Facebook Page</Label>
                            <Select
                                value={pageId}
                                onValueChange={setPageId}
                                disabled={!facebookConnected || saving}
                            >
                                <SelectTrigger id="page-select">
                                    <SelectValue placeholder="Select a Facebook page" />
                                </SelectTrigger>
                                <SelectContent>
                                    {pages.map((page) => (
                                        <SelectItem key={page.id} value={page.id}>
                                            {page.name} ({page.id})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="whatsapp-number-select">WhatsApp Number</Label>
                            <Select
                                value={whatsappNumberId}
                                onValueChange={setWhatsappNumberId}
                                disabled={!facebookConnected || saving}
                            >
                                <SelectTrigger id="whatsapp-number-select">
                                    <SelectValue placeholder="Select a WhatsApp number" />
                                </SelectTrigger>
                                <SelectContent>
                                    {numbers.map((number) => (
                                        <SelectItem
                                            key={number.phone_number_id}
                                            value={number.phone_number_id}
                                        >
                                            {number.display_phone_number}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={handleSave}
                            disabled={!facebookConnected || saving}
                            className="w-full sm:w-auto"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {saving ? 'Saving…' : 'Save setup'}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default AdAccountSettingsCard;
