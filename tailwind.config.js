import tailwindAnimate from "tailwindcss-animate";
import tailwindTypography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Brand scale is driven by CSS variables (channel form) so a
                // tenant's primary color can re-theme the whole palette at
                // runtime. Defaults live in index.css :root and reproduce the
                // original hand-picked hexes exactly. `<alpha-value>` keeps
                // Tailwind opacity modifiers (e.g. bg-brand-500/20) working.
                brand: {
                    50: "rgb(var(--brand-50) / <alpha-value>)",
                    100: "rgb(var(--brand-100) / <alpha-value>)",
                    200: "rgb(var(--brand-200) / <alpha-value>)",
                    300: "rgb(var(--brand-300) / <alpha-value>)",
                    400: "rgb(var(--brand-400) / <alpha-value>)",
                    500: "rgb(var(--brand-500) / <alpha-value>)",
                    600: "rgb(var(--brand-600) / <alpha-value>)",
                    700: "rgb(var(--brand-700) / <alpha-value>)",
                    800: "rgb(var(--brand-800) / <alpha-value>)",
                    900: "rgb(var(--brand-900) / <alpha-value>)",
                    950: "rgb(var(--brand-950) / <alpha-value>)",
                    DEFAULT: "rgb(var(--brand-500) / <alpha-value>)",
                },
                // The app paints a lot of brand UI with Tailwind's built-in
                // `emerald` palette (text-emerald-600, bg-emerald-500, …), which
                // would otherwise never theme. Re-point `emerald` at the SAME
                // `--brand-*` vars the `brand` palette uses so every emerald-*
                // class follows the tenant's primary color. `green` is left
                // untouched (it stays the generic success-green). Defaults come
                // from :root, so emerald-* renders the SocioChat green out of the
                // box (a small, intended shift from Tailwind's stock emerald).
                emerald: {
                    50: "rgb(var(--brand-50) / <alpha-value>)",
                    100: "rgb(var(--brand-100) / <alpha-value>)",
                    200: "rgb(var(--brand-200) / <alpha-value>)",
                    300: "rgb(var(--brand-300) / <alpha-value>)",
                    400: "rgb(var(--brand-400) / <alpha-value>)",
                    500: "rgb(var(--brand-500) / <alpha-value>)",
                    600: "rgb(var(--brand-600) / <alpha-value>)",
                    700: "rgb(var(--brand-700) / <alpha-value>)",
                    800: "rgb(var(--brand-800) / <alpha-value>)",
                    900: "rgb(var(--brand-900) / <alpha-value>)",
                    950: "rgb(var(--brand-950) / <alpha-value>)",
                    DEFAULT: "rgb(var(--brand-500) / <alpha-value>)",
                },
                lime: {
                    400: "#a8e063",
                },
                accent: {
                    DEFAULT: "#FFD700",
                    light: "#FFED4A",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            fontFamily: {
                // Driven by the branding CSS var so a tenant's selected font
                // applies app-wide; falls back to Inter when unset.
                sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
            },
            boxShadow: {
                'skeu': '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.1)',
                'skeu-lg': '0 2px 4px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.15)',
                'skeu-inset': 'inset 0 2px 4px rgba(0,0,0,0.06), inset 0 1px 2px rgba(0,0,0,0.04)',
                'glow-green': '0 0 20px rgba(37,211,102,0.25), 0 0 40px rgba(37,211,102,0.1)',
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [
        tailwindAnimate,
        tailwindTypography,
    ],
}
