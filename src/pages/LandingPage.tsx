// Landing page = the complete Sociovia "WhatsApp Automation" marketing export
// (public/landing_11/), rendered full-viewport in a same-origin iframe. Because
// it's a static export, we make it PER-TENANT dynamic by reaching into the
// iframe on load and applying the active tenant's branding (brand color, logo,
// company name) + rewiring the Login / trial buttons to SocioChat's routes.
import { useCallback, useEffect, useRef } from 'react';
import { useBranding } from '@/branding/BrandingContext';

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB | null {
    let h = (hex || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Mix a hex color toward `target` by t (0..1) and return hex.
function mix(hex: string, target: RGB, t: number): string {
    const rgb = hexToRgb(hex) || [60, 173, 74];
    const c = (i: number) => Math.round(rgb[i] + (target[i] - rgb[i]) * t);
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${toHex(c(0))}${toHex(c(1))}${toHex(c(2))}`;
}

export default function LandingPage() {
    const { branding } = useBranding();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const applyBranding = useCallback(() => {
        const doc = iframeRef.current?.contentDocument;
        if (!doc || !doc.body) return;
        const b = branding;

        // 1. Brand color — override the export's --green scale with the tenant primary.
        //    (The WhatsApp-mockup green #25d366 is a literal, not a var, so it stays.)
        const primary = b.primary_color || '#3cad4a';
        const dark = b.accent_color || mix(primary, [0, 0, 0], 0.2);
        const light = mix(primary, [255, 255, 255], 0.9);
        let style = doc.getElementById('sv-tenant-brand') as HTMLStyleElement | null;
        if (!style) {
            style = doc.createElement('style');
            style.id = 'sv-tenant-brand';
            doc.head.appendChild(style);
        }
        style.textContent =
            `:root{--green:${primary}!important;--green-dark:${dark}!important;--green-light:${light}!important;}`;

        // 2. Logo.
        doc.querySelectorAll<HTMLImageElement>('img[src*="sociovia-logo"]').forEach((img) => {
            if (b.logo_url) img.src = b.logo_url;
            img.alt = b.company_name;
        });

        // 3. Company name — replace "Sociovia" in visible text (skip scripts/styles).
        const name = b.company_name || 'SocioChat';
        if (name.toLowerCase() !== 'sociovia') {
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
                acceptNode: (n) => {
                    const p = n.parentNode?.nodeName;
                    if (p === 'SCRIPT' || p === 'STYLE') return NodeFilter.FILTER_REJECT;
                    return /sociovia/i.test(n.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                },
            });
            const texts: Text[] = [];
            let cur = walker.nextNode();
            while (cur) {
                texts.push(cur as Text);
                cur = walker.nextNode();
            }
            texts.forEach((t) => {
                t.nodeValue = (t.nodeValue || '').replace(/sociovia/gi, name);
            });
            doc.title = (doc.title || '').replace(/sociovia/gi, name);
        }

        // 4. Rewire the page's anchor buttons to SocioChat routes (navigate the top window).
        doc.querySelectorAll<HTMLAnchorElement>('a[href="#login"]').forEach((a) => {
            a.href = '/login';
            a.target = '_top';
        });
        doc.querySelectorAll<HTMLAnchorElement>('a[href="#trial"]').forEach((a) => {
            a.href = '/signup';
            a.target = '_top';
        });
        // Relabel/route specific nav items: turn "Book a Demo" into a "Get Started
        // for Free" sign-up CTA, and point "Pricing" at the pricing page (which
        // lists the plans). Runs after the #trial pass so Pricing wins over /signup.
        doc.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
            const txt = (a.textContent || '').trim().toLowerCase();
            if (txt === 'book a demo') {
                if (a.closest('footer')) {
                    // Footer menu link at the bottom — remove it entirely (don't
                    // turn a footer nav item into a CTA).
                    (a.closest('li') || a).remove();
                } else {
                    // Section CTA button — becomes the "Get Started for Free" CTA.
                    a.textContent = 'Get Started for Free';
                    a.href = '/signup';
                    a.target = '_top';
                    if (!/\bbtn-primary\b/.test(a.className)) a.className = 'btn btn-primary btn-sm';
                }
            } else if (txt === 'pricing') {
                a.href = '/pricing';
                a.target = '_top';
            }
        });

        // 5. Hero text overrides (tenant branding fields → iframe DOM).
        const heroH1 = doc.querySelector<HTMLElement>('.hero-content h1');
        if (heroH1 && b.landing_headline) {
            const hl = heroH1.querySelector('.highlight');
            if (hl) hl.textContent = '';
            heroH1.textContent = b.landing_headline;
        }
        const heroP = doc.querySelector<HTMLElement>('.hero-content p');
        if (heroP && b.landing_subheadline) heroP.innerHTML = b.landing_subheadline;
        const heroCta = doc.querySelector<HTMLAnchorElement>('.hero-ctas .btn-primary');
        if (heroCta && b.landing_cta_text) heroCta.textContent = b.landing_cta_text;
        const heroImg = doc.querySelector<HTMLImageElement>('.hero-visual .hero-composite-img');
        if (heroImg && b.landing_image_url) heroImg.src = b.landing_image_url;

        // 6. Feature section overrides (7 sections).
        const FEATURE_IDS = [
            'feature-broadcast', 'feature-lead-alerts', 'feature-crm',
            'feature-drip', 'feature-triggers', 'feature-flows', 'feature-chatbot',
        ];
        FEATURE_IDS.forEach((fid, i) => {
            const n = i + 1;
            const titleKey = `landing_feature${n}_title` as keyof typeof b;
            const descKey = `landing_feature${n}_desc` as keyof typeof b;
            const imgKey = `landing_feature${n}_image` as keyof typeof b;
            const section = doc.getElementById(fid);
            if (!section) return;
            const title = b[titleKey] as string;
            const desc = b[descKey] as string;
            const img = b[imgKey] as string;
            if (title) {
                const h2 = section.querySelector('h2');
                if (h2) h2.textContent = title;
            }
            if (desc) {
                const lead = section.querySelector('.feature-lead');
                if (lead) lead.textContent = desc;
            }
            const featureImg = section.querySelector<HTMLImageElement>('.hero-composite-img');
            if (featureImg) {
                if (img) {
                    featureImg.src = img;
                    featureImg.style.display = '';
                } else if (!featureImg.getAttribute('src')?.startsWith('/')) {
                    featureImg.style.display = 'none';
                }
            }
        });

        // 7. Add an Admin Portal link into the footer (once).
        const footer = doc.querySelector('footer') || doc.body;
        if (footer && !doc.getElementById('sv-admin-link')) {
            const a = doc.createElement('a');
            a.id = 'sv-admin-link';
            a.href = '/admin/login';
            a.target = '_top';
            a.textContent = 'Admin Portal';
            a.style.cssText = 'display:inline-block;margin-top:12px;font-size:12px;opacity:.55;color:inherit;';
            footer.appendChild(a);
        }
    }, [branding]);

    // Re-apply whenever branding resolves/changes (the iframe onLoad also calls it).
    useEffect(() => {
        applyBranding();
    }, [applyBranding]);

    return (
        <div className="h-screen w-full bg-[#f4faf5]">
            <iframe
                ref={iframeRef}
                title={`${branding.company_name} — WhatsApp Automation`}
                src="/landing_11/index.html"
                className="h-full w-full border-0"
                sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-top-navigation-by-user-activation"
                onLoad={applyBranding}
            />
        </div>
    );
}
