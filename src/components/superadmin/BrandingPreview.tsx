// src/components/superadmin/BrandingPreview.tsx
// Self-contained, real-time preview of the themed white-label app.
// Renders entirely from the `branding` prop using SCOPED inline styles — it
// never mutates global CSS variables, so it stays a pure draft preview.
//
// The mocks deliberately mirror the REAL SocioChat pages:
//   - Login        → src/pages/LoginPage.tsx (split brand panel + credential card)
//   - App shell    → src/layouts/DashboardLayout.tsx (NAV_ITEMS sidebar + header)
//   - Dashboard    → src/pages/DashboardHome.tsx (command center / KPI cards)
//   - Settings     → src/whatsapp/pages/WhatsAppSettings.tsx (sectioned cards)
//   - CRM/Contacts → src/whatsapp/pages/WhatsAppContacts.tsx (data table + toolbar)
//   - WhatsApp     → src/whatsapp/pages/WhatsAppInbox.tsx (3-pane inbox)
//
// Sizing: the device frame has a fixed logical width/height. A ResizeObserver on
// the wrapper measures the available width and the frame is `transform: scale()`d
// down to fit — so the preview NEVER overflows its container at any width.
import { useState, useLayoutEffect, useRef } from 'react';
import {
    Home,
    LayoutTemplate,
    Inbox,
    Send,
    Bot,
    Zap,
    Workflow,
    ClipboardList,
    Link2,
    Users,
    Database,
    BarChart3,
    Settings,
    Search,
    Bell,
    Plus,
    Phone,
    MoreVertical,
    Mail,
    Building2,
    ArrowRight,
    ChevronRight,
    ShieldCheck,
    RefreshCw,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Branding } from './useSuperAdminApi';
import { DEFAULT_BRANDING } from './useSuperAdminApi';

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';
export type PreviewSection = 'landing' | 'login' | 'dashboard' | 'sidebar' | 'settings' | 'crm' | 'whatsapp';

interface BrandingPreviewProps {
    branding: Partial<Branding>;
    device?: PreviewDevice;
    /** Controlled active section (optional). */
    section?: PreviewSection;
    onSectionChange?: (s: PreviewSection) => void;
    /** Hide the internal section tab bar (used when the host renders its own). */
    hideTabs?: boolean;
    /** When true, fills the available height instead of using a fixed frame height. */
    fill?: boolean;
    className?: string;
}

// Logical viewport widths per device. The frame is scaled to fit its container.
const DEVICE_WIDTH: Record<PreviewDevice, number> = {
    desktop: 1180,
    tablet: 820,
    mobile: 390,
};
const DEVICE_HEIGHT: Record<PreviewDevice, number> = {
    desktop: 720,
    tablet: 640,
    mobile: 720,
};

const SECTIONS: { id: PreviewSection; label: string }[] = [
    { id: 'landing', label: 'Landing' },
    { id: 'login', label: 'Login' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sidebar', label: 'Sidebar' },
    { id: 'settings', label: 'Settings' },
    { id: 'crm', label: 'CRM' },
    { id: 'whatsapp', label: 'WhatsApp' },
];

// Mirrors NAV_ITEMS in src/layouts/DashboardLayout.tsx. `to` maps the nav entry
// to a preview section so the right item highlights for each mock.
type NavEntry = { label: string; icon: LucideIcon; to: PreviewSection };
const NAV_ITEMS: NavEntry[] = [
    { label: 'Dashboard', icon: Home, to: 'dashboard' },
    { label: 'Hub', icon: LayoutTemplate, to: 'dashboard' },
    { label: 'Inbox', icon: Inbox, to: 'whatsapp' },
    { label: 'Bulk Send', icon: Send, to: 'dashboard' },
    { label: 'Templates', icon: LayoutTemplate, to: 'dashboard' },
    { label: 'Automation', icon: Bot, to: 'dashboard' },
    { label: 'Drip', icon: Zap, to: 'dashboard' },
    { label: 'Interactive Flows', icon: Workflow, to: 'dashboard' },
    { label: 'Forms', icon: ClipboardList, to: 'dashboard' },
    { label: 'Catalog', icon: Link2, to: 'dashboard' },
    { label: 'Contacts', icon: Users, to: 'crm' },
    { label: 'Datasets', icon: Database, to: 'dashboard' },
    { label: 'Tracking', icon: BarChart3, to: 'dashboard' },
    { label: 'Settings', icon: Settings, to: 'settings' },
];

function radiusFor(style: string | undefined): string {
    if (style === 'pill') return '9999px';
    if (style === 'square') return '4px';
    return '10px'; // rounded (default)
}

/** Convert a #rrggbb color + alpha (0..1) into an rgba() string for tints. */
function withAlpha(hex: string, alpha: number): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return hex;
    const int = parseInt(m[1], 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const bl = int & 255;
    return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

export function BrandingPreview({
    branding,
    device = 'desktop',
    section,
    onSectionChange,
    hideTabs = false,
    fill = false,
    className,
}: BrandingPreviewProps) {
    const b: Branding = { ...DEFAULT_BRANDING, ...branding };
    const [internalSection, setInternalSection] = useState<PreviewSection>('login');
    const active = section ?? internalSection;
    const setSection = (s: PreviewSection) => {
        if (onSectionChange) onSectionChange(s);
        else setInternalSection(s);
    };

    const isDark = b.theme === 'dark';
    const radius = radiusFor(b.button_style);
    // Sidebar items use a softened radius — a full pill on a list row looks odd.
    const itemRadius = radius === '9999px' ? '12px' : radius;
    const fullName = `${b.company_name || ''}${b.name_suffix || ''}`;

    // Scoped theme tokens — used only inside this preview's inline styles.
    // These PREFER the tenant's chrome colors when set, falling back to the
    // built-in light/dark defaults otherwise. Every mock surface reads off these,
    // so the whole preview follows the tenant's colors.
    const surface = b.surface_color || (isDark ? '#0f172a' : '#ffffff');
    const surfaceAlt = b.background_color || (isDark ? '#1e293b' : '#f8fafc');
    const surfaceSoft = b.surface_color ? withAlpha(b.text_color || '#000000', 0.04) : (isDark ? '#162032' : '#f1f5f9');
    const border = b.border_color || (isDark ? '#334155' : '#e2e8f0');
    const text = b.text_color || (isDark ? '#f1f5f9' : '#0f172a');
    const muted = b.text_color ? withAlpha(b.text_color, 0.62) : (isDark ? '#94a3b8' : '#64748b');
    const faint = b.text_color ? withAlpha(b.text_color, 0.42) : (isDark ? '#64748b' : '#94a3b8');

    // Optional heading font — falls back to the body font when unset.
    const headingFont = b.heading_font_family
        ? `${b.heading_font_family}, ${b.font_family}, system-ui, sans-serif`
        : undefined;

    const primaryGradient = `linear-gradient(135deg, ${b.primary_color}, ${b.secondary_color})`;
    const buttonGradient = `linear-gradient(to right, ${b.accent_color}, ${b.secondary_color})`;

    const rootStyle: React.CSSProperties = {
        fontFamily: `${b.font_family}, system-ui, sans-serif`,
        background: surface,
        color: text,
    };

    const primaryBtn: React.CSSProperties = {
        background: b.primary_color,
        color: '#ffffff',
        borderRadius: radius,
    };

    const Logo = ({ size = 28, square = false }: { size?: number; square?: boolean }) =>
        b.logo_url ? (
            <img
                src={b.logo_url}
                alt="logo"
                style={{ height: size, width: size, objectFit: 'cover', borderRadius: square ? size * 0.28 : 6 }}
                onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
            />
        ) : (
            <div
                style={{
                    height: size,
                    width: size,
                    borderRadius: square ? size * 0.28 : 6,
                    background: primaryGradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: size * 0.5,
                }}
            >
                {(b.short_name || b.company_name || 'S').charAt(0).toUpperCase()}
            </div>
        );

    const Brand = ({ size = 28, suffixSub }: { size?: number; suffixSub?: boolean }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={size} square />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontWeight: 700, fontSize: size * 0.52, color: text }}>
                    {b.short_name || b.company_name}
                    <span style={{ color: b.primary_color }}>{b.name_suffix}</span>
                </span>
                {suffixSub && (
                    <span style={{ fontSize: size * 0.3, color: faint, marginTop: 1 }}>WhatsApp Business</span>
                )}
            </div>
        </div>
    );

    /* ------------------------------- Sections ------------------------------ */

    // (0) LANDING — compact mirror of src/pages/LandingPage.tsx (nav + hero + features + CTA).
    const LandingMock = () => {
        const isNarrow = device === 'mobile';
        const pageBg = surfaceAlt;

        const navGhostBtn: React.CSSProperties = {
            fontSize: 12.5,
            fontWeight: 500,
            color: muted,
            background: 'transparent',
            border: 'none',
            cursor: 'default',
            padding: '6px 4px',
        };
        const navPrimaryBtn: React.CSSProperties = {
            fontSize: 12.5,
            fontWeight: 600,
            color: '#fff',
            background: buttonGradient,
            border: 'none',
            borderRadius: radius === '4px' ? '8px' : '9999px',
            padding: '8px 16px',
            cursor: 'default',
        };

        // Real LandingPage.tsx default copy (chaos headline / drowning subtitle / CTA).
        const headline = b.landing_headline || 'Solve your WhatsApp messaging chaos.';
        const subtitle =
            b.landing_subheadline ||
            'Stop drowning in manual replies. Automate conversations, send personalized bulk messages, and reclaim your time. Lower your workload, multiply your sales.';
        const ctaText = b.landing_cta_text || 'Get Started';

        const features = [
            { icon: Bot, title: 'Smart Automations', desc: 'AI chatbots and flows that qualify leads 24/7.' },
            { icon: Zap, title: 'Bulk Messaging', desc: 'Personalized broadcasts with 98% open rates.' },
            { icon: BarChart3, title: 'Maximize ROI', desc: 'Meet customers where they already are.' },
        ];

        // Hero media card: tenant image > tenant video > gradient placeholder w/ play button.
        const mediaCard = (
            <div
                style={{
                    borderRadius: radius === '4px' ? '12px' : '18px',
                    border: `1px solid ${border}`,
                    overflow: 'hidden',
                    background: surface,
                    aspectRatio: '16 / 10',
                    width: '100%',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
                }}
            >
                {b.landing_image_url ? (
                    <img
                        src={b.landing_image_url}
                        alt="preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : b.landing_video_url ? (
                    <video
                        src={b.landing_video_url}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        loop
                        playsInline
                        autoPlay
                    />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, background: primaryGradient }}>
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 54,
                                height: 54,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
                            }}
                        >
                            <div
                                style={{
                                    width: 0,
                                    height: 0,
                                    borderTop: '9px solid transparent',
                                    borderBottom: '9px solid transparent',
                                    borderLeft: `15px solid ${b.primary_color}`,
                                    marginLeft: 4,
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        );

        const heroText = (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Badge pill (accent tint) */}
                <div
                    style={{
                        display: 'inline-flex',
                        alignSelf: 'flex-start',
                        alignItems: 'center',
                        gap: 7,
                        padding: '5px 12px',
                        borderRadius: 999,
                        background: withAlpha(b.primary_color, isDark ? 0.18 : 0.1),
                        border: `1px solid ${withAlpha(b.primary_color, 0.25)}`,
                        color: b.primary_color,
                        fontSize: 11.5,
                        fontWeight: 600,
                    }}
                >
                    <span
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: b.primary_color,
                            display: 'inline-block',
                        }}
                    />
                    The Ultimate WhatsApp Platform
                </div>
                <div
                    style={{
                        fontSize: isNarrow ? 26 : 34,
                        fontWeight: 800,
                        lineHeight: 1.12,
                        color: text,
                        letterSpacing: '-0.02em',
                        fontFamily: headingFont,
                    }}
                >
                    {headline}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: muted, maxWidth: 460 }}>{subtitle}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                    <button
                        style={{
                            background: buttonGradient,
                            color: '#fff',
                            border: 'none',
                            borderRadius: radius === '4px' ? '8px' : '9999px',
                            padding: '11px 20px',
                            fontWeight: 600,
                            fontSize: 13.5,
                            cursor: 'default',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                        }}
                    >
                        {ctaText} <ArrowRight size={15} />
                    </button>
                    <button
                        style={{
                            background: surface,
                            color: text,
                            border: `1px solid ${border}`,
                            borderRadius: radius === '4px' ? '8px' : '9999px',
                            padding: '11px 20px',
                            fontWeight: 500,
                            fontSize: 13.5,
                            cursor: 'default',
                        }}
                    >
                        Watch demo
                    </button>
                </div>
            </div>
        );

        return (
            <div style={{ height: '100%', overflow: 'auto', background: pageBg, color: text }}>
                {/* Top nav bar */}
                <div
                    style={{
                        height: 54,
                        background: surface,
                        borderBottom: `1px solid ${border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 20px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                    }}
                >
                    <Brand size={26} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {!isNarrow && <button style={navGhostBtn}>Log in</button>}
                        <button style={navPrimaryBtn}>Sign up</button>
                    </div>
                </div>

                {/* Hero */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: isNarrow ? 'column' : 'row',
                        alignItems: 'center',
                        gap: isNarrow ? 22 : 32,
                        padding: isNarrow ? '28px 22px' : '40px 36px',
                        maxWidth: 1040,
                        margin: '0 auto',
                    }}
                >
                    {heroText}
                    <div style={{ flex: 1, minWidth: 0, width: '100%' }}>{mediaCard}</div>
                </div>

                {/* Features row */}
                <div
                    style={{
                        background: surface,
                        borderTop: `1px solid ${border}`,
                        borderBottom: `1px solid ${border}`,
                        padding: isNarrow ? '26px 22px' : '34px 36px',
                    }}
                >
                    <div style={{ maxWidth: 1040, margin: '0 auto' }}>
                        <div
                            style={{
                                fontSize: isNarrow ? 19 : 22,
                                fontWeight: 700,
                                color: text,
                                textAlign: 'center',
                                marginBottom: 6,
                                fontFamily: headingFont,
                            }}
                        >
                            Everything you need to scale.
                        </div>
                        <div style={{ fontSize: 12.5, color: muted, textAlign: 'center', marginBottom: 22 }}>
                            Don't let leads slip away because you couldn't reply fast enough.
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
                                gap: 14,
                            }}
                        >
                            {features.map((f) => (
                                <div
                                    key={f.title}
                                    style={{
                                        background: surfaceAlt,
                                        border: `1px solid ${border}`,
                                        borderRadius: 16,
                                        padding: 18,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            background: withAlpha(b.primary_color, isDark ? 0.2 : 0.12),
                                            color: b.primary_color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: 12,
                                        }}
                                    >
                                        <f.icon size={20} />
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 4 }}>
                                        {f.title}
                                    </div>
                                    <div style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>{f.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* CTA band */}
                <div style={{ padding: isNarrow ? '28px 22px' : '40px 36px' }}>
                    <div
                        style={{
                            maxWidth: 880,
                            margin: '0 auto',
                            background: primaryGradient,
                            borderRadius: 24,
                            padding: isNarrow ? '32px 24px' : '44px 40px',
                            textAlign: 'center',
                            color: '#fff',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        <div
                            style={{
                                fontSize: isNarrow ? 22 : 28,
                                fontWeight: 800,
                                marginBottom: 10,
                                lineHeight: 1.2,
                                fontFamily: headingFont,
                            }}
                        >
                            {b.landing_cta_text || 'Ready to get started?'}
                        </div>
                        <div
                            style={{
                                fontSize: 13.5,
                                color: 'rgba(255,255,255,0.88)',
                                marginBottom: 22,
                                maxWidth: 460,
                                marginLeft: 'auto',
                                marginRight: 'auto',
                            }}
                        >
                            Join forward-thinking businesses who use {b.company_name} to automate conversations and
                            drive growth.
                        </div>
                        <button
                            style={{
                                background: '#fff',
                                color: b.primary_color,
                                border: 'none',
                                borderRadius: radius === '4px' ? '8px' : '9999px',
                                padding: '12px 26px',
                                fontWeight: 700,
                                fontSize: 13.5,
                                cursor: 'default',
                            }}
                        >
                            Get Started Free
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // (1) LOGIN — split layout mirroring src/pages/LoginPage.tsx.
    const LoginMock = () => {
        const bgStyle: React.CSSProperties = b.login_background
            ? b.login_background.startsWith('#')
                ? { background: b.login_background }
                : { backgroundImage: `url(${b.login_background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: primaryGradient };

        const fieldLabel = (t: string) => (
            <div style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#cbd5e1' : '#334155', marginBottom: 6 }}>{t}</div>
        );
        const field = (placeholder: string, icon?: LucideIcon) => {
            const Icon = icon;
            return (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        border: `1px solid ${border}`,
                        borderRadius: 12,
                        padding: '11px 12px',
                        fontSize: 13,
                        color: faint,
                        background: isDark ? surfaceAlt : '#fff',
                    }}
                >
                    {Icon && <Icon size={15} color={faint} />}
                    {placeholder}
                </div>
            );
        };

        const isNarrow = device === 'mobile';

        return (
            <div style={{ display: 'flex', height: '100%', background: surfaceAlt }}>
                {/* Left brand panel (hidden on mobile, like the real lg:flex) */}
                {!isNarrow && (
                    <div
                        style={{
                            ...bgStyle,
                            width: '45%',
                            position: 'relative',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 40,
                            color: '#fff',
                        }}
                    >
                        <div style={{ position: 'absolute', top: 60, left: 20, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(40px)' }} />
                        <div style={{ position: 'absolute', bottom: 40, right: 10, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(40px)' }} />
                        <div style={{ position: 'relative', zIndex: 1, maxWidth: 320 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                                <div style={{ padding: 8, borderRadius: 16, background: 'rgba(255,255,255,0.15)', display: 'flex' }}>
                                    <Logo size={32} square />
                                </div>
                                <span style={{ fontSize: 22, fontWeight: 700 }}>{fullName}</span>
                            </div>
                            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, marginBottom: 14, fontFamily: headingFont }}>Welcome back!</div>
                            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>
                                {b.tagline || 'Log in to manage your WhatsApp conversations, automations, and analytics all in one place.'}
                            </div>
                        </div>
                    </div>
                )}

                {/* Right credential card */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
                    <div style={{ width: '100%', maxWidth: 320 }}>
                        {isNarrow && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                                <div style={{ padding: 6, borderRadius: 12, background: primaryGradient, display: 'flex' }}>
                                    <Logo size={22} square />
                                </div>
                                <span style={{ fontSize: 18, fontWeight: 700, color: b.accent_color }}>
                                    {b.short_name}
                                    <span style={{ color: b.primary_color }}>{b.name_suffix}</span>
                                </span>
                            </div>
                        )}
                        <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>Log in to your account</div>
                        <div style={{ fontSize: 13, color: muted, marginBottom: 24 }}>Enter your credentials to continue</div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                {fieldLabel('Tenant Code')}
                                {field('ABC001', Building2)}
                                <div style={{ fontSize: 11, color: faint, marginTop: 5 }}>Leave blank to use the default workspace.</div>
                            </div>
                            <div>
                                {fieldLabel('Email Address')}
                                {field('john@company.com', Mail)}
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, color: isDark ? '#cbd5e1' : '#334155' }}>Password</div>
                                    <span style={{ fontSize: 11, fontWeight: 500, color: b.secondary_color }}>Forgot password?</span>
                                </div>
                                {field('••••••••')}
                            </div>
                            <button
                                style={{
                                    background: buttonGradient,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: radius,
                                    padding: '12px 16px',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    cursor: 'default',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                }}
                            >
                                Log In <ArrowRight size={15} />
                            </button>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 12, color: muted, marginTop: 22 }}>
                            Don't have an account? <span style={{ color: b.secondary_color, fontWeight: 600 }}>Sign up</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // App shell sidebar mirroring DashboardLayout's expanded sidebar + NAV_ITEMS.
    const Sidebar = ({ activeSection }: { activeSection: PreviewSection }) => (
        <div
            style={{
                width: 200,
                background: isDark ? '#0b1424' : 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
                borderRight: `1px solid ${border}`,
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
            }}
        >
            <div style={{ padding: '14px 16px' }}>
                <Brand size={28} suffixSub />
            </div>
            <div style={{ height: 1, background: border, margin: '0 14px 8px' }} />
            <div style={{ flex: 1, overflow: 'hidden', padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {NAV_ITEMS.map((it) => {
                    const isActive = it.to === activeSection;
                    return (
                        <div
                            key={it.label}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '7px 10px',
                                borderRadius: itemRadius,
                                fontSize: 12.5,
                                fontWeight: isActive ? 600 : 500,
                                background: isActive ? withAlpha(b.primary_color, isDark ? 0.22 : 0.12) : 'transparent',
                                color: isActive ? b.primary_color : muted,
                                boxShadow: isActive ? `inset 0 0 0 1px ${withAlpha(b.primary_color, 0.3)}` : 'none',
                            }}
                        >
                            <it.icon size={15} strokeWidth={isActive ? 2.2 : 1.6} />
                            {it.label}
                        </div>
                    );
                })}
            </div>
            <div style={{ height: 1, background: border, margin: '6px 14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 14px 12px' }}>
                <div
                    style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: primaryGradient,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                >
                    AD
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Admin User</div>
                    <div style={{ color: faint, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        admin@{(b.short_name || 'app').toLowerCase()}
                    </div>
                </div>
            </div>
        </div>
    );

    // Top header bar mirroring DashboardLayout's <Header/> (breadcrumb + search + bell + avatar).
    const TopBar = ({ crumbs }: { crumbs: string[] }) => (
        <div
            style={{
                height: 52,
                borderBottom: `1px solid ${border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 18px',
                flexShrink: 0,
                background: isDark ? withAlpha('#0f172a', 0.7) : 'rgba(255,255,255,0.72)',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, minWidth: 0 }}>
                {crumbs.map((c, i) => (
                    <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {i > 0 && <ChevronRight size={13} color={faint} />}
                        <span style={{ fontWeight: i === crumbs.length - 1 ? 600 : 500, color: i === crumbs.length - 1 ? text : muted }}>{c}</span>
                    </span>
                ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        border: `1px solid ${border}`,
                        borderRadius: 999,
                        padding: '6px 12px',
                        fontSize: 11.5,
                        color: faint,
                        background: surface,
                    }}
                >
                    <Search size={13} /> Search…
                </div>
                <Bell size={16} color={muted} />
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: primaryGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>AD</div>
            </div>
        </div>
    );

    // Wraps a section with the real app shell (sidebar + header + scrollable body).
    const Shell = ({
        activeSection,
        crumbs,
        children,
        bodyBg,
        bodyPad = 18,
    }: {
        activeSection: PreviewSection;
        crumbs: string[];
        children: React.ReactNode;
        bodyBg?: string;
        bodyPad?: number;
    }) => (
        <div style={{ display: 'flex', height: '100%' }}>
            <Sidebar activeSection={activeSection} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <TopBar crumbs={crumbs} />
                <div style={{ flex: 1, overflow: 'hidden', background: bodyBg ?? surfaceAlt, padding: bodyPad }}>{children}</div>
            </div>
        </div>
    );

    // (2) DASHBOARD — command center mirroring DashboardHome (greeting + KPI cards + panel).
    const StatCard = ({ label, value, delta, color }: { label: string; value: string; delta: string; color: string }) => (
        <div style={{ flex: 1, minWidth: 0, background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 10.5, color: muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: withAlpha(color, 0.14), color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BarChart3 size={14} />
                </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 8, color: text }}>{value}</div>
            <div style={{ fontSize: 11, color, marginTop: 2 }}>{delta}</div>
        </div>
    );

    const DashboardMock = () => (
        <Shell activeSection="dashboard" crumbs={['Dashboard']}>
            <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div
                    style={{
                        display: 'inline-flex',
                        alignSelf: 'flex-start',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 999,
                        background: withAlpha(b.accent_color, 0.12),
                        color: b.accent_color,
                        fontSize: 11.5,
                        fontWeight: 600,
                        marginBottom: 12,
                    }}
                >
                    <ShieldCheck size={13} /> {b.company_name} Command Center
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: text, marginBottom: 2, fontFamily: headingFont }}>Good morning, Admin 👋</div>
                <div style={{ fontSize: 12.5, color: muted, marginBottom: 14 }}>Here's what's happening across your workspace today.</div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                    <StatCard label="Contacts" value="12,480" delta="+4.2% this week" color={b.primary_color} />
                    <StatCard label="Messages" value="48.2k" delta="+12% this week" color={b.secondary_color} />
                    <StatCard label="Open rate" value="71%" delta="+1.8% this week" color={b.accent_color} />
                    <StatCard label="Campaigns" value="36" delta="6 active now" color={b.primary_color} />
                </div>

                <div style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: text }}>Campaign performance</div>
                        <button style={{ ...primaryBtn, border: 'none', padding: '7px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}>
                            <Plus size={13} /> New campaign
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 110 }}>
                        {[40, 65, 50, 80, 60, 95, 72, 58, 88].map((h, i) => (
                            <div
                                key={i}
                                style={{
                                    flex: 1,
                                    height: `${h}%`,
                                    background: i % 2 === 0 ? b.primary_color : withAlpha(b.secondary_color, 0.85),
                                    borderRadius: '5px 5px 0 0',
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </Shell>
    );

    // (3) SIDEBAR — focuses on the themed navigation, showing the brand palette.
    const SidebarMock = () => (
        <Shell activeSection="sidebar" crumbs={['Navigation']} bodyPad={24}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
                <div style={{ maxWidth: 360, fontSize: 13.5, color: muted, lineHeight: 1.6 }}>
                    The navigation sidebar on the left uses your brand palette — the active item, logo and accents all
                    follow the colors you pick.
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                    {[
                        { c: b.primary_color, label: 'Primary' },
                        { c: b.secondary_color, label: 'Secondary' },
                        { c: b.accent_color, label: 'Accent' },
                    ].map((s) => (
                        <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 52, height: 52, borderRadius: 14, background: s.c, border: `1px solid ${border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: text }}>{s.label}</span>
                            <span style={{ fontSize: 10, color: faint }}>{s.c}</span>
                        </div>
                    ))}
                </div>
            </div>
        </Shell>
    );

    // (4) SETTINGS — sectioned cards mirroring WhatsAppSettings.
    const SettingsMock = () => {
        const fieldRow = (label: string, value: string) => (
            <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: muted, marginBottom: 5 }}>{label}</div>
                <div style={{ border: `1px solid ${border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12.5, background: isDark ? surfaceAlt : '#fff', color: text }}>{value}</div>
            </div>
        );
        return (
            <Shell activeSection="settings" crumbs={['Dashboard', 'Settings']}>
                <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Tabs row, like WhatsAppSettings' <Tabs> */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        {['Workspace', 'WhatsApp', 'Agents', 'Notifications'].map((t, i) => (
                            <div
                                key={t}
                                style={{
                                    padding: '6px 14px',
                                    borderRadius: 999,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    background: i === 0 ? b.primary_color : surface,
                                    color: i === 0 ? '#fff' : muted,
                                    border: `1px solid ${i === 0 ? b.primary_color : border}`,
                                }}
                            >
                                {t}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
                        <div style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 18, overflow: 'hidden' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, color: text, marginBottom: 2 }}>Workspace profile</div>
                            <div style={{ fontSize: 11.5, color: muted, marginBottom: 16 }}>Manage how your brand appears to your team.</div>
                            {fieldRow('Company name', fullName)}
                            {fieldRow('Support email', b.support_email || 'support@company.com')}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: `1px solid ${border}` }}>
                                <div>
                                    <div style={{ fontSize: 12.5, fontWeight: 500, color: text }}>Enable notifications</div>
                                    <div style={{ fontSize: 11, color: muted }}>Receive campaign and inbox alerts</div>
                                </div>
                                <div style={{ width: 38, height: 22, borderRadius: 999, background: b.primary_color, position: 'relative', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: '#fff' }} />
                                </div>
                            </div>
                            <button style={{ ...primaryBtn, border: 'none', padding: '9px 18px', fontSize: 13, fontWeight: 600, marginTop: 4, cursor: 'default' }}>Save changes</button>
                        </div>

                        <div style={{ width: 180, flexShrink: 0, background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: text, marginBottom: 12 }}>Connected number</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: withAlpha(b.primary_color, 0.14), color: b.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Phone size={15} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: text }}>+1 555 0148</div>
                                    <div style={{ fontSize: 10.5, color: '#16a34a' }}>● Connected</div>
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: muted, lineHeight: 1.5 }}>Quality rating: High · Tier 1,000/24h</div>
                        </div>
                    </div>
                </div>
            </Shell>
        );
    };

    // (5) CRM — contacts data table mirroring WhatsAppContacts.
    const CrmMock = () => {
        const rows = [
            { name: 'Aarav Sharma', phone: '+91 98100 11223', status: 'opted_in', win: 'Open', tag: 'Lead' },
            { name: 'Priya Patel', phone: '+1 415 555 0132', status: 'opted_in', win: 'Open', tag: 'Customer' },
            { name: 'Liam Chen', phone: '+44 7700 900145', status: 'pending', win: 'Closed', tag: 'Lead' },
            { name: 'Sara Khan', phone: '+971 50 123 4567', status: 'opted_in', win: 'Open', tag: 'VIP' },
            { name: 'Noah Diaz', phone: '+34 612 345 678', status: 'opted_out', win: 'Closed', tag: 'Customer' },
        ];
        return (
            <Shell activeSection="crm" crumbs={['Dashboard', 'Contacts']}>
                <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, fontWeight: 700, color: text }}>
                                <Users size={17} color={b.primary_color} /> WhatsApp Contacts
                            </div>
                            <div style={{ fontSize: 11.5, color: muted, marginTop: 2 }}>Manage your unified contact profiles.</div>
                        </div>
                        <button style={{ ...primaryBtn, border: 'none', padding: '8px 14px', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}>
                            <Plus size={14} /> Add Contact
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <div style={{ flex: 1, maxWidth: 260, display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: faint, background: surface }}>
                            <Search size={13} /> Search by name or phone…
                        </div>
                        <div style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${border}`, background: surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: muted }}>
                            <RefreshCw size={14} />
                        </div>
                    </div>
                    <div style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 12, overflow: 'hidden', minHeight: 0 }}>
                        <div style={{ display: 'flex', padding: '10px 14px', fontSize: 10.5, color: muted, textTransform: 'uppercase', letterSpacing: 0.4, background: surfaceSoft, borderBottom: `1px solid ${border}` }}>
                            <div style={{ flex: 2 }}>Name</div>
                            <div style={{ flex: 2 }}>Phone</div>
                            <div style={{ flex: 1 }}>Status</div>
                            <div style={{ flex: 1 }}>24hr Window</div>
                        </div>
                        {rows.map((r) => (
                            <div key={r.phone} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', fontSize: 12.5, borderBottom: `1px solid ${border}`, color: text }}>
                                <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: primaryGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                        {r.name.charAt(0)}
                                    </div>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                                </div>
                                <div style={{ flex: 2, color: muted }}>{r.phone}</div>
                                <div style={{ flex: 1 }}>
                                    <span
                                        style={{
                                            fontSize: 10.5,
                                            fontWeight: 600,
                                            padding: '3px 9px',
                                            borderRadius: 999,
                                            background: r.status === 'opted_in' ? withAlpha('#16a34a', 0.14) : surfaceSoft,
                                            color: r.status === 'opted_in' ? '#16a34a' : muted,
                                        }}
                                    >
                                        {r.status}
                                    </span>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <span
                                        style={{
                                            fontSize: 10.5,
                                            fontWeight: 600,
                                            padding: '3px 9px',
                                            borderRadius: 999,
                                            background: r.win === 'Open' ? withAlpha(b.secondary_color, 0.16) : surfaceSoft,
                                            color: r.win === 'Open' ? b.secondary_color : muted,
                                        }}
                                    >
                                        {r.win}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Shell>
        );
    };

    // (6) WHATSAPP — 3-pane inbox mirroring WhatsAppInbox.
    const WhatsAppMock = () => {
        const chats = [
            { name: 'Aarav Sharma', last: 'Thanks, got it!', time: '09:24', unread: 2, active: true },
            { name: 'Priya Patel', last: 'Can you send the invoice?', time: '08:51', unread: 0, active: false },
            { name: 'Liam Chen', last: 'See you tomorrow', time: 'Yest', unread: 0, active: false },
            { name: 'Sara Khan', last: 'Order confirmed ✅', time: 'Yest', unread: 1, active: false },
            { name: 'Noah Diaz', last: 'Perfect, thank you!', time: 'Mon', unread: 0, active: false },
        ];
        const msgs = [
            { me: false, text: 'Hi! Is the offer still available?' },
            { me: true, text: 'Yes! It runs until Sunday 🎉' },
            { me: false, text: 'Great, I will take it.' },
            { me: true, text: 'Awesome — sending you the link now.' },
        ];
        const chatBg = isDark ? '#0b1120' : '#efeae2';
        return (
            <div style={{ display: 'flex', height: '100%' }}>
                <Sidebar activeSection="whatsapp" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    {/* Inbox header (logo + title + New Chat) like WhatsAppInbox */}
                    <div style={{ height: 52, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0, background: surface }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <div style={{ padding: 5, borderRadius: 10, background: withAlpha(b.primary_color, 0.12), display: 'flex' }}>
                                <Logo size={20} square />
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: text }}>
                                <span style={{ color: b.primary_color }}>{b.short_name}</span> Inbox
                            </div>
                        </div>
                        <button style={{ ...primaryBtn, border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}>
                            <Plus size={13} /> New Chat
                        </button>
                    </div>
                    <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                        {/* chat list */}
                        <div style={{ width: 230, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: surface }}>
                            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${border}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${border}`, borderRadius: 999, padding: '6px 10px', fontSize: 11.5, color: faint, background: surfaceAlt }}>
                                    <Search size={12} /> Search chats
                                </div>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                {chats.map((c) => (
                                    <div
                                        key={c.name}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 12px',
                                            borderBottom: `1px solid ${border}`,
                                            background: c.active ? withAlpha(b.primary_color, isDark ? 0.16 : 0.08) : 'transparent',
                                            borderLeft: c.active ? `3px solid ${b.primary_color}` : '3px solid transparent',
                                        }}
                                    >
                                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: primaryGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                            {c.name.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                            <div style={{ fontSize: 11, color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last}</div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                            <span style={{ fontSize: 10, color: faint }}>{c.time}</span>
                                            {c.unread > 0 && (
                                                <span style={{ background: b.primary_color, color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                                                    {c.unread}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* conversation */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: chatBg }}>
                            <div style={{ height: 50, background: surface, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: primaryGradient, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>A</div>
                                    <div>
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: text }}>Aarav Sharma</div>
                                        <div style={{ fontSize: 10, color: '#16a34a' }}>● online</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 14, color: muted }}>
                                    <Phone size={16} />
                                    <MoreVertical size={16} />
                                </div>
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                                {msgs.map((m, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            alignSelf: m.me ? 'flex-end' : 'flex-start',
                                            maxWidth: '72%',
                                            background: m.me ? b.primary_color : surface,
                                            color: m.me ? '#fff' : text,
                                            padding: '8px 12px',
                                            borderRadius: m.me ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                            fontSize: 12.5,
                                            boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                                        }}
                                    >
                                        {m.text}
                                    </div>
                                ))}
                            </div>
                            <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', background: surface, borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                                <div style={{ flex: 1, background: surfaceAlt, border: `1px solid ${border}`, borderRadius: 999, padding: '9px 14px', fontSize: 12, color: faint }}>Type a message…</div>
                                <button style={{ background: b.primary_color, color: '#fff', border: 'none', width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'default' }}>
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSection = () => {
        switch (active) {
            case 'landing':
                return <LandingMock />;
            case 'login':
                return <LoginMock />;
            case 'dashboard':
                return <DashboardMock />;
            case 'sidebar':
                return <SidebarMock />;
            case 'settings':
                return <SettingsMock />;
            case 'crm':
                return <CrmMock />;
            case 'whatsapp':
                return <WhatsAppMock />;
            default:
                return <DashboardMock />;
        }
    };

    const width = DEVICE_WIDTH[device];
    const height = DEVICE_HEIGHT[device];

    /* --------------------------- Responsive scaling -------------------------- */
    // Measure the wrapper and scale the fixed-size frame down to always fit.
    const wrapRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(width);

    useLayoutEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const measure = () => {
            const w = el.clientWidth;
            if (w > 0) setContainerWidth(w);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Never scale up past 1 — only shrink to fit narrow containers. The frame is a
    // fixed-size element; `transform: scale()` with origin top-left keeps its layout
    // box at the logical size, so we wrap it in a "sizer" whose box equals the SCALED
    // dimensions. That makes surrounding layout reserve exactly the right space (no
    // gap, no clipping) and lets the flex parent center it horizontally.
    const scale = Math.min(1, containerWidth / width);
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    const frame = (
        <div
            className={cn(
                'rounded-xl border shadow-sm overflow-hidden bg-white',
                device === 'mobile' && 'rounded-[28px] border-[6px] border-slate-800',
                device === 'tablet' && 'rounded-2xl border-[8px] border-slate-700',
            )}
            style={{
                width,
                [fill ? 'minHeight' : 'height']: height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                flexShrink: 0,
                ...rootStyle,
            } as React.CSSProperties}
        >
            {renderSection()}
        </div>
    );

    return (
        <div className={cn('flex flex-col items-center w-full min-w-0', className)}>
            {!hideTabs && (
                <div className="flex flex-wrap gap-1 mb-3 rounded-lg bg-slate-100 p-1">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setSection(s.id)}
                            className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                                active === s.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800',
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Measured wrapper. overflow-hidden guarantees the preview can never push
                the page wider than its container at ANY width. */}
            <div ref={wrapRef} className="w-full overflow-hidden flex justify-center">
                {/* Sizer: occupies exactly the scaled footprint so layout reserves the
                    right height and the frame stays centered. In fill mode the frame
                    grows with content, so we only pin the width. */}
                <div style={{ width: scaledWidth, height: fill ? undefined : scaledHeight, position: 'relative' }}>
                    {frame}
                </div>
            </div>
        </div>
    );
}

export default BrandingPreview;
