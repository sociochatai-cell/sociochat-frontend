// src/components/superadmin/BrandingForm.tsx
// Controlled form for editing a DRAFT branding object. Pure: emits the full
// updated branding via onChange so the live preview can re-render instantly.
// Never persists anything itself.
import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { API_BASE_URL } from '@/config';
import type { Branding, ButtonStyle, ThemeMode } from './useSuperAdminApi';
import { FONT_OPTIONS, BUTTON_STYLE_OPTIONS, THEME_OPTIONS, RADIUS_OPTIONS } from './useSuperAdminApi';

interface BrandingFormProps {
    branding: Branding;
    onChange: (next: Branding) => void;
}

type UploadKind = 'logo' | 'favicon' | 'background' | 'hero_video' | 'hero_image';

interface UploadResponse {
    success: boolean;
    url?: string;
    kind?: string | null;
    error?: string;
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-10 w-12 rounded-md border border-input bg-background p-1 cursor-pointer"
                    aria-label={`${label} color picker`}
                />
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                    className="font-mono"
                />
            </div>
        </div>
    );
}

// A URL value renders as an <img>; anything else (e.g. a CSS gradient or #hex
// used for the login background) renders as a flat swatch.
function isImageValue(value: string): boolean {
    if (!value) return false;
    return /^(https?:\/\/|\/|data:image\/|blob:)/.test(value);
}

function PreviewThumb({ value, kind }: { value: string; kind: UploadKind }) {
    const box = 'h-10 w-10 shrink-0 rounded-md border border-input bg-slate-50 overflow-hidden';
    if (!value) {
        return (
            <div className={`${box} grid place-items-center text-[10px] text-slate-400`}>
                none
            </div>
        );
    }
    if (kind === 'background' && !isImageValue(value)) {
        // CSS color / gradient string — show it directly as the swatch background.
        return <div className={box} style={{ background: value }} aria-label="background preview" />;
    }
    if (kind === 'hero_video') {
        return (
            <video
                src={value}
                className={`${box} object-cover`}
                muted
                playsInline
                aria-label="hero video preview"
            />
        );
    }
    return (
        <img
            src={value}
            alt={`${kind} preview`}
            className={`${box} object-contain`}
        />
    );
}

interface ImageUploadFieldProps {
    label: string;
    placeholder: string;
    value: string;
    kind: UploadKind;
    onValue: (v: string) => void;
    accept?: string;
    help?: string;
}

function ImageUploadField({ label, placeholder, value, kind, onValue, accept = 'image/*', help }: ImageUploadFieldProps) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openPicker = () => {
        setError(null);
        inputRef.current?.click();
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Reset so picking the same file again re-triggers onChange.
        e.target.value = '';
        if (!file) return;

        setUploading(true);
        setError(null);
        try {
            const form = new FormData();
            form.append('file', file);
            form.append('kind', kind);

            const res = await fetch(`${API_BASE_URL}/api/superadmin/uploads`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'X-Admin-Id': localStorage.getItem('sv_admin_id') || '',
                },
                body: form,
            });

            const data: UploadResponse = await res
                .json()
                .catch(() => ({ success: false, error: 'invalid_response' }) as UploadResponse);

            if (!res.ok || !data.success || !data.url) {
                const msg = data.error || `Upload failed (${res.status})`;
                setError(msg);
                return;
            }
            onValue(data.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <PreviewThumb value={value} kind={kind} />
                <Input
                    value={value}
                    onChange={(e) => onValue(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1"
                />
                <button
                    type="button"
                    onClick={openPicker}
                    disabled={uploading}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {uploading ? (
                        <>
                            <span
                                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
                                aria-hidden="true"
                            />
                            <span>Uploading…</span>
                        </>
                    ) : (
                        'Upload'
                    )}
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={handleFile}
                />
            </div>
            {help && <p className="text-xs text-muted-foreground">{help}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

export function BrandingForm({ branding, onChange }: BrandingFormProps) {
    const set = <K extends keyof Branding>(key: K, value: Branding[K]) =>
        onChange({ ...branding, [key]: value });

    return (
        <div className="space-y-6">
            {/* Identity */}
            <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Identity</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Company name</Label>
                        <Input value={branding.company_name} onChange={(e) => set('company_name', e.target.value)} placeholder="SocioChat" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Short name</Label>
                        <Input value={branding.short_name} onChange={(e) => set('short_name', e.target.value)} placeholder="SocioChat" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Name suffix</Label>
                        <Input value={branding.name_suffix} onChange={(e) => set('name_suffix', e.target.value)} placeholder=".ai" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Support email</Label>
                        <Input value={branding.support_email} onChange={(e) => set('support_email', e.target.value)} placeholder="support@company.com" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Tagline</Label>
                        <Textarea value={branding.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="WhatsApp marketing, simplified." className="min-h-[60px]" />
                    </div>
                </div>
            </section>

            {/* Logos */}
            <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Logos &amp; images</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                    <ImageUploadField
                        label="Logo URL"
                        placeholder="/sociochat_logo.png"
                        value={branding.logo_url}
                        kind="logo"
                        onValue={(v) => set('logo_url', v)}
                    />
                    <div className="space-y-1.5">
                        <Label>Logo URL (dark)</Label>
                        <Input value={branding.logo_dark_url} onChange={(e) => set('logo_dark_url', e.target.value)} placeholder="/logo-dark.png" />
                    </div>
                    <ImageUploadField
                        label="Favicon URL"
                        placeholder="/favicon.ico"
                        value={branding.favicon_url}
                        kind="favicon"
                        onValue={(v) => set('favicon_url', v)}
                    />
                    <ImageUploadField
                        label="Login background (URL or #hex)"
                        placeholder="/bg.jpg or #128C7E"
                        value={branding.login_background}
                        kind="background"
                        onValue={(v) => set('login_background', v)}
                    />
                </div>
            </section>

            {/* Colors */}
            <section className="space-y-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-700">Colors</h3>
                    <p className="text-xs text-muted-foreground">
                        Leave a color blank to keep the default UI look.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <ColorField label="Primary" value={branding.primary_color} onChange={(v) => set('primary_color', v)} />
                    <ColorField label="Secondary" value={branding.secondary_color} onChange={(v) => set('secondary_color', v)} />
                    <ColorField label="Accent" value={branding.accent_color} onChange={(v) => set('accent_color', v)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    <ColorField label="Background" value={branding.background_color} onChange={(v) => set('background_color', v)} />
                    <ColorField label="Surface / cards" value={branding.surface_color} onChange={(v) => set('surface_color', v)} />
                    <ColorField label="Text" value={branding.text_color} onChange={(v) => set('text_color', v)} />
                    <ColorField label="Border" value={branding.border_color} onChange={(v) => set('border_color', v)} />
                </div>
            </section>

            {/* Typography & style */}
            <section className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Typography &amp; style</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>Font family</Label>
                        <Select value={branding.font_family} onValueChange={(v) => set('font_family', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {FONT_OPTIONS.map((f) => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Button style</Label>
                        <Select value={branding.button_style} onValueChange={(v) => set('button_style', v as ButtonStyle)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {BUTTON_STYLE_OPTIONS.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Theme</Label>
                        <Select value={branding.theme} onValueChange={(v) => set('theme', v as ThemeMode)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {THEME_OPTIONS.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Heading font</Label>
                        <Select
                            value={branding.heading_font_family || 'default'}
                            onValueChange={(v) => set('heading_font_family', v === 'default' ? '' : v)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default (same as body)</SelectItem>
                                {FONT_OPTIONS.map((f) => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Corner radius</Label>
                        <Select
                            value={branding.corner_radius || 'default'}
                            onValueChange={(v) => set('corner_radius', v === 'default' ? '' : v)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                {RADIUS_OPTIONS.map((r) => (
                                    <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </section>

            {/* Landing page */}
            <section className="space-y-4 border-t pt-6">
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-700">Landing Page</h3>
                    <p className="text-xs text-muted-foreground">
                        Customize the public landing page hero. Leave blank to use the default SocioChat content.
                    </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <ImageUploadField
                        label="Hero video URL"
                        placeholder="https://… .mp4 or .webm"
                        value={branding.landing_video_url}
                        kind="hero_video"
                        accept="video/*"
                        help="MP4 or WebM, up to 50MB. Leave blank to use the default SocioChat content."
                        onValue={(v) => set('landing_video_url', v)}
                    />
                    <ImageUploadField
                        label="Hero image URL"
                        placeholder="https://… .jpg or .png"
                        value={branding.landing_image_url}
                        kind="hero_image"
                        accept="image/*"
                        help="Used as the hero background / video poster. Leave blank to use the default SocioChat content."
                        onValue={(v) => set('landing_image_url', v)}
                    />
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Headline</Label>
                        <Input
                            value={branding.landing_headline}
                            onChange={(e) => set('landing_headline', e.target.value)}
                            placeholder="All-in-one WhatsApp Business Platform"
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave blank to use the default SocioChat content.
                        </p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Subtitle</Label>
                        <Textarea
                            value={branding.landing_subheadline}
                            onChange={(e) => set('landing_subheadline', e.target.value)}
                            placeholder="Engage customers, automate conversations, and grow your business."
                            className="min-h-[60px]"
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave blank to use the default SocioChat content.
                        </p>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>CTA text</Label>
                        <Input
                            value={branding.landing_cta_text}
                            onChange={(e) => set('landing_cta_text', e.target.value)}
                            placeholder="Get started today"
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave blank to use the default SocioChat content.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default BrandingForm;
