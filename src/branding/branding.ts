// src/branding/branding.ts
// Shared white-label branding core: types, defaults, and runtime theming helpers.
//
// The app's design system (src/index.css) drives colors via HSL-channel CSS
// variables consumed by Tailwind as `hsl(var(--primary))`. To re-theme at
// runtime we override those channel vars AND expose hex convenience vars
// (`--brand-*`) that components can use directly in inline styles to replace
// previously hardcoded brand hexes.

export interface TenantBranding {
    company_name: string;
    short_name: string;
    name_suffix: string;
    tagline: string;
    logo_url: string;
    logo_dark_url: string;
    favicon_url: string;
    primary_color: string;   // hex, e.g. "#25D366"
    secondary_color: string; // hex
    accent_color: string;    // hex
    font_family: string;
    button_style: string;    // e.g. "rounded"
    theme: string;           // "light" | "dark"
    support_email: string;
    login_background: string; // CSS background value (gradient or color)
    landing_video_url: string;   // hero video URL (mp4/webm) or ""
    landing_image_url: string;   // hero image/background/poster URL or ""
    landing_headline: string;    // hero headline or ""
    landing_subheadline: string; // hero subtitle/description or ""
    landing_cta_text: string;    // CTA heading text or ""
    background_color: string;    // hex page background, ""=design-system default
    surface_color: string;       // hex card/popover/muted surface, ""=default
    text_color: string;          // hex foreground text, ""=default
    border_color: string;        // hex border/input, ""=default
    heading_font_family: string; // heading font name, ""=same as body
    corner_radius: string;       // "" | "none" | "small" | "medium" | "large" | "xl"
}

export const DEFAULT_BRANDING: TenantBranding = {
    company_name: "SocioChat",
    short_name: "SocioChat",
    name_suffix: ".ai",
    tagline: "All-in-one WhatsApp Business Platform",
    logo_url: "/sociochat_logo.png",
    logo_dark_url: "/sociochat_logo.png",
    favicon_url: "/sociochat_logo.png",
    primary_color: "#25D366",
    secondary_color: "#128C7E",
    accent_color: "#0a6847",
    font_family: "Inter",
    button_style: "rounded",
    theme: "light",
    support_email: "support@sociochat.ai",
    login_background: "linear-gradient(135deg, #0a6847 0%, #128C7E 50%, #25D366 100%)",
    landing_video_url: "",
    landing_image_url: "",
    landing_headline: "",
    landing_subheadline: "",
    landing_cta_text: "",
    background_color: "",
    surface_color: "",
    text_color: "",
    border_color: "",
    heading_font_family: "",
    corner_radius: "",
};

// localStorage keys (shared across the branding layer)
export const BRANDING_STORAGE_KEY = "sv_tenant_branding";
export const TENANT_CODE_STORAGE_KEY = "sv_tenant_code";
// Precomputed CSS-var map persisted by applyBranding(), read by the inline
// pre-paint script in index.html so the tenant's colors are in place BEFORE the
// first paint (no flash of the default SocioChat green).
export const BRAND_VARS_STORAGE_KEY = "sv_brand_vars";

/**
 * Convert a hex color to the `"H S% L%"` channel string used by the existing
 * CSS variables (e.g. "145 70% 42%"). Handles 3- and 6-digit hex (with or
 * without leading `#`). Falls back to the SocioChat primary channels on any
 * parse failure so theming never breaks the UI.
 */
export function hexToHslChannels(hex: string): string {
    const FALLBACK = "145 70% 42%";
    if (!hex || typeof hex !== "string") return FALLBACK;

    let h = hex.trim().replace(/^#/, "");

    // Expand 3-digit shorthand to 6-digit.
    if (h.length === 3) {
        h = h.split("").map((c) => c + c).join("");
    }
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return FALLBACK;

    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let sat = 0;
    let hue = 0;
    const d = max - min;

    if (d !== 0) {
        sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                hue = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                hue = (b - r) / d + 2;
                break;
            default: // b
                hue = (r - g) / d + 4;
                break;
        }
        hue /= 6;
    }

    const H = Math.round(hue * 360);
    const S = Math.round(sat * 100);
    const L = Math.round(l * 100);
    return `${H} ${S}% ${L}%`;
}

/**
 * Parse a hex color into its `[r, g, b]` byte components (0–255 each).
 * Handles 3- and 6-digit hex with or without a leading `#`. Returns `null`
 * on any parse failure so callers can fall back safely.
 */
function hexToRgb(hex: string): [number, number, number] | null {
    if (!hex || typeof hex !== "string") return null;
    let h = hex.trim().replace(/^#/, "");
    if (h.length === 3) {
        h = h.split("").map((c) => c + c).join("");
    }
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b];
}

/**
 * Convert a hex color to the `"R G B"` channel string consumed by the
 * `rgb(var(--brand-*) / <alpha-value>)` Tailwind palette and the index.css
 * skeu styles. Falls back to the SocioChat primary channels on parse failure.
 */
export function hexToRgbChannels(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return "37 211 102"; // SocioChat #25D366 fallback
    return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

/** Linearly mix two byte channels by `t` (0 = a, 1 = b) and round. */
function mix(a: number, b: number, t: number): number {
    return Math.round(a + (b - a) * t);
}

/**
 * Mix two hex colors by `t` (0 = fg, 1 = bg) and return the result as an
 * `"H S% L%"` channel string. Used to derive a softened muted-foreground by
 * blending the text color toward its surface. Falls back to plain
 * `hexToHslChannels(fgHex)` if either color fails to parse.
 */
function mixedHslChannels(fgHex: string, bgHex: string, t: number): string {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    if (!fg || !bg) return hexToHslChannels(fgHex);
    const r = mix(fg[0], bg[0], t);
    const g = mix(fg[1], bg[1], t);
    const b = mix(fg[2], bg[2], t);
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    return hexToHslChannels(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
}

/**
 * Map a branding `corner_radius` keyword to a CSS length for the shadcn
 * `--radius` token. Returns `null` for "" or any unknown value so callers leave
 * the existing radius handling untouched. Exported for reuse by the admin UI.
 */
export function cornerRadiusValue(v: string): string | null {
    switch ((v || "").trim().toLowerCase()) {
        case "none":
            return "0px";
        case "small":
            return "0.375rem";
        case "medium":
            return "0.75rem";
        case "large":
            return "1rem";
        case "xl":
            return "1.5rem";
        default:
            return null;
    }
}

/** The full set of brand-scale stop keys generated/overridden at runtime. */
const BRAND_SCALE_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

/**
 * Generate an 11-stop brand scale (keys 50…950) from a single primary hex.
 * Shade 500 is the primary itself; lighter stops (50–400) mix it toward white
 * by decreasing amounts, darker stops (600–950) mix it toward black.
 * Each value is returned as an `"R G B"` channel string. Deterministic.
 */
export function generateBrandScale(primaryHex: string): Record<string, string> {
    const rgb = hexToRgb(primaryHex) || [37, 211, 102];
    const [r, g, b] = rgb;

    // Mix-toward-white weight per light stop, and mix-toward-black per dark stop.
    const lightMix: Record<string, number> = {
        "50": 0.92,
        "100": 0.82,
        "200": 0.66,
        "300": 0.46,
        "400": 0.24,
    };
    const darkMix: Record<string, number> = {
        "600": 0.18,
        "700": 0.34,
        "800": 0.5,
        "900": 0.66,
        "950": 0.8,
    };

    const scale: Record<string, string> = {};
    for (const [key, t] of Object.entries(lightMix)) {
        scale[key] = `${mix(r, 255, t)} ${mix(g, 255, t)} ${mix(b, 255, t)}`;
    }
    scale["500"] = `${r} ${g} ${b}`;
    for (const [key, t] of Object.entries(darkMix)) {
        scale[key] = `${mix(r, 0, t)} ${mix(g, 0, t)} ${mix(b, 0, t)}`;
    }
    return scale;
}

/**
 * Toggle the `.dark` class on the document root based on the branding theme.
 * The app's dark styles key off `.dark`, so this is what makes the
 * Light/Dark/System selection actually take effect.
 *   - "dark"            → force dark
 *   - "light"           → force light
 *   - "system"/empty    → follow the OS `prefers-color-scheme`
 */
function applyThemeMode(theme: string, root: HTMLElement): void {
    if (typeof document === "undefined") return;
    const mode = (theme || "").trim().toLowerCase();

    let dark: boolean;
    if (mode === "dark") {
        dark = true;
    } else if (mode === "light") {
        dark = false;
    } else {
        // "system" (or empty/unknown) → follow the OS preference.
        dark =
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    root.classList.toggle("dark", dark);
}

/** Map a branding `button_style` to a CSS border-radius value. */
function buttonRadius(style: string): string {
    switch ((style || "").toLowerCase()) {
        case "pill":
            return "9999px";
        case "square":
            return "0.15rem";
        case "rounded":
        default:
            return "0.75rem"; // matches the default --radius / today's rounded-lg
    }
}

/** Build the Google Fonts CSS2 URL for a given family (skips Inter — already imported). */
function googleFontHref(fontFamily: string): string | null {
    if (!fontFamily) return null;
    const primary = fontFamily.split(",")[0].trim().replace(/['"]/g, "");
    if (!primary || primary.toLowerCase() === "inter") return null;
    const family = primary.replace(/\s+/g, "+");
    return `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800&display=swap`;
}

/** Inject a Google Font <link> once (idempotent via data attribute). */
function ensureFontLoaded(fontFamily: string): void {
    if (typeof document === "undefined") return;
    const href = googleFontHref(fontFamily);
    if (!href) return;

    const existing = document.querySelector<HTMLLinkElement>(
        `link[data-brand-font][href="${href}"]`,
    );
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-brand-font", "true");
    document.head.appendChild(link);
}

/** Ensure a <link rel="icon"> exists and points it at the given href. */
function ensureFavicon(href: string): void {
    if (typeof document === "undefined") return;
    const url = href || DEFAULT_BRANDING.favicon_url;
    if (!url) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }
    link.href = url;
}

/**
 * Apply a branding object to the live document: CSS variables, fonts, title,
 * and favicon. `target` defaults to `document.documentElement`.
 */
export function applyBranding(
    branding: TenantBranding,
    target?: HTMLElement,
): void {
    if (typeof document === "undefined") return;
    const root = target || document.documentElement;
    const b = { ...DEFAULT_BRANDING, ...branding };

    const primaryChannels = hexToHslChannels(b.primary_color);
    const secondaryChannels = hexToHslChannels(b.secondary_color);
    const accentChannels = hexToHslChannels(b.accent_color);

    // ── HSL-channel vars (override the design-system defaults) ──
    root.style.setProperty("--primary", primaryChannels);
    root.style.setProperty("--ring", primaryChannels);
    root.style.setProperty("--secondary", secondaryChannels);
    root.style.setProperty("--accent", accentChannels);

    // ── Brand palette channels (--brand-50..950) ──
    // Skip overriding for the default SocioChat primary so the app stays
    // pixel-identical to the hand-picked :root scale in index.css. Only a
    // tenant with a custom primary regenerates the scale — and when it does we
    // set the FULL 50..950 range so both the `brand-*` and `emerald-*` Tailwind
    // palettes (which share these vars) follow the tenant's color.
    const isCustomPrimary =
        b.primary_color.trim().toLowerCase() !== DEFAULT_BRANDING.primary_color.toLowerCase();
    const scale = isCustomPrimary ? generateBrandScale(b.primary_color) : null;
    if (scale) {
        for (const key of BRAND_SCALE_KEYS) {
            const channels = scale[key];
            if (channels) root.style.setProperty(`--brand-${key}`, channels);
        }
    } else {
        // Clear any previously-set overrides so we fall back to :root defaults.
        for (const key of BRAND_SCALE_KEYS) {
            root.style.removeProperty(`--brand-${key}`);
        }
    }

    // ── Hex convenience vars (replace hardcoded hexes in inline styles) ──
    root.style.setProperty("--brand-primary", b.primary_color);
    root.style.setProperty("--brand-secondary", b.secondary_color);
    root.style.setProperty("--brand-accent", b.accent_color);
    root.style.setProperty("--brand-login-bg", b.login_background);
    root.style.setProperty("--brand-font", b.font_family);

    // ── Button radius (and shadcn --radius) from button_style ──
    const radius = buttonRadius(b.button_style);
    root.style.setProperty("--btn-radius", radius);
    // Keep the shadcn --radius consistent for rounded/square; leave the global
    // --radius untouched for "pill" so cards/inputs don't become fully round.
    if ((b.button_style || "").toLowerCase() === "square") {
        root.style.setProperty("--radius", "0.15rem");
    } else if ((b.button_style || "").toLowerCase() === "rounded") {
        root.style.removeProperty("--radius"); // fall back to :root default
    }

    // ── Font: drive --font-sans and the body font-family ──
    const fontStack = `${b.font_family}, Inter, system-ui, sans-serif`;
    root.style.setProperty("--font-sans", fontStack);
    if (document.body) {
        document.body.style.fontFamily = fontStack;
    }
    ensureFontLoaded(b.font_family);

    // ── Light / Dark / System theme ──
    // Toggle the `.dark` class the design system keys off of, so the tenant's
    // theme selection actually takes effect app-wide.
    applyThemeMode(b.theme, root);

    // ── Design-system "chrome" overrides (page bg / surfaces / text / borders) ──
    // Applied AFTER applyThemeMode so custom chrome wins over the light/dark
    // defaults. Each field only overrides when non-empty; otherwise we
    // removeProperty so the token falls back to the :root/.dark default and the
    // default app stays pixel-identical. Every var set here is collected into
    // `chromeVars` so it can also be persisted for the pre-paint script.
    const chromeVars: Record<string, string> = {};
    const setChrome = (name: string, value: string) => {
        root.style.setProperty(name, value);
        chromeVars[name] = value;
    };

    if (b.background_color) {
        setChrome("--background", hexToHslChannels(b.background_color));
    } else {
        root.style.removeProperty("--background");
    }

    if (b.surface_color) {
        const surfaceChannels = hexToHslChannels(b.surface_color);
        setChrome("--card", surfaceChannels);
        setChrome("--popover", surfaceChannels);
        setChrome("--muted", surfaceChannels);
    } else {
        root.style.removeProperty("--card");
        root.style.removeProperty("--popover");
        root.style.removeProperty("--muted");
    }

    if (b.text_color) {
        const textChannels = hexToHslChannels(b.text_color);
        setChrome("--foreground", textChannels);
        setChrome("--card-foreground", textChannels);
        setChrome("--popover-foreground", textChannels);
        setChrome("--secondary-foreground", textChannels);
        // Softened secondary text: blend the text color toward its surface.
        const mutedBg = b.surface_color || b.background_color || "#ffffff";
        setChrome("--muted-foreground", mixedHslChannels(b.text_color, mutedBg, 0.45));
    } else {
        root.style.removeProperty("--foreground");
        root.style.removeProperty("--card-foreground");
        root.style.removeProperty("--popover-foreground");
        root.style.removeProperty("--secondary-foreground");
        root.style.removeProperty("--muted-foreground");
    }

    if (b.border_color) {
        const borderChannels = hexToHslChannels(b.border_color);
        setChrome("--border", borderChannels);
        setChrome("--input", borderChannels);
    } else {
        root.style.removeProperty("--border");
        root.style.removeProperty("--input");
    }

    if (b.heading_font_family) {
        setChrome("--font-heading", `${b.heading_font_family}, Inter, system-ui, sans-serif`);
        ensureFontLoaded(b.heading_font_family);
    } else {
        root.style.removeProperty("--font-heading");
    }

    // Corner radius: when set, overrides the button_style square --radius logic
    // above. When "" / unknown, cornerRadiusValue returns null and we leave the
    // existing --radius handling as-is.
    const cr = cornerRadiusValue(b.corner_radius);
    if (cr !== null) {
        setChrome("--radius", cr);
    }

    // ── Document title + favicon ──
    document.title = `${b.company_name}${b.name_suffix}`;
    ensureFavicon(b.favicon_url);

    // ── Persist the COMPUTED vars for the inline pre-paint script ──
    // The inline script in index.html re-applies these BEFORE first paint on the
    // next load, so the tenant's colors never flash the default green first.
    // Storing the already-computed values means zero color-math duplication.
    try {
        const persistVars: Record<string, string> = {
            "--primary": primaryChannels,
            "--ring": primaryChannels,
            "--secondary": secondaryChannels,
            "--accent": accentChannels,
            "--brand-primary": b.primary_color,
            "--brand-secondary": b.secondary_color,
            "--brand-accent": b.accent_color,
            "--brand-login-bg": b.login_background,
            "--brand-font": b.font_family,
            "--btn-radius": radius,
            "--font-sans": fontStack,
        };
        if (scale) {
            for (const key of BRAND_SCALE_KEYS) {
                if (scale[key]) persistVars[`--brand-${key}`] = scale[key];
            }
        }
        if ((b.button_style || "").toLowerCase() === "square") {
            persistVars["--radius"] = "0.15rem";
        }
        // Chrome overrides last so a user-picked corner_radius (--radius) wins
        // over the square button_style default above. Only non-empty fields were
        // added to chromeVars, so empty fields stay absent and fall back.
        Object.assign(persistVars, chromeVars);
        localStorage.setItem(
            BRAND_VARS_STORAGE_KEY,
            JSON.stringify({ vars: persistVars, dark: root.classList.contains("dark"), font: fontStack }),
        );
    } catch {
        // storage unavailable — ignore
    }
}

/** Load cached branding from localStorage (returns null if absent/invalid). */
export function loadCachedBranding(): TenantBranding | null {
    try {
        const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            return { ...DEFAULT_BRANDING, ...parsed } as TenantBranding;
        }
        return null;
    } catch {
        return null;
    }
}

/** Persist branding (and the resolved tenant code) to localStorage. */
export function cacheBranding(branding: TenantBranding, tenantCode?: string): void {
    try {
        localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
        if (tenantCode) {
            localStorage.setItem(TENANT_CODE_STORAGE_KEY, tenantCode);
        }
    } catch {
        // storage may be unavailable (private mode quota) — ignore
    }
}

/** Read the last-used tenant code, if any. */
export function loadTenantCode(): string | null {
    try {
        return localStorage.getItem(TENANT_CODE_STORAGE_KEY);
    } catch {
        return null;
    }
}

/**
 * True when the given host (default: current hostname) is the SHARED SocioChat
 * platform host — localhost, 127.0.0.1, any *.devtunnels.ms / *.localhost, or a
 * configured platform domain (sociochat.ai by default). These always represent
 * the platform (tenant T0000), NOT a tenant custom domain. Mirrors the backend
 * `is_platform_host()` so the front and back agree.
 */
export function isPlatformHost(host?: string): boolean {
    const h = (host ?? (typeof window !== "undefined" ? window.location.hostname : ""))
        .trim()
        .toLowerCase();
    if (!h) return true;
    const configured = String(
        (import.meta as any).env?.VITE_PLATFORM_DOMAINS || "sociochat.ai,www.sociochat.ai",
    )
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
    if (configured.includes(h)) return true;
    if (h === "localhost" || h === "127.0.0.1") return true;
    if (h.endsWith(".devtunnels.ms") || h.endsWith(".localhost")) return true;
    return false;
}

/** Clear all cached tenant-branding state (used when returning to the platform). */
export function clearBrandingCache(): void {
    try {
        localStorage.removeItem(BRANDING_STORAGE_KEY);
        localStorage.removeItem(TENANT_CODE_STORAGE_KEY);
        localStorage.removeItem(BRAND_VARS_STORAGE_KEY);
        localStorage.removeItem("sv_domain");
        localStorage.removeItem("sv_domain_branding_version");
    } catch {
        // storage unavailable — ignore
    }
}
