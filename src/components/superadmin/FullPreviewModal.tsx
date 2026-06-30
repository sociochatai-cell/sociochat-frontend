// src/components/superadmin/FullPreviewModal.tsx
// Full-screen overlay that renders the BrandingPreview at full size, letting the
// super admin navigate the themed mock app (Login/Dashboard/Sidebar/Settings/CRM/
// WhatsApp) across device sizes — all from the DRAFT branding, no saving.
import { useState } from 'react';
import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BrandingPreview, type PreviewDevice, type PreviewSection } from './BrandingPreview';
import type { Branding } from './useSuperAdminApi';

interface FullPreviewModalProps {
    open: boolean;
    onClose: () => void;
    branding: Partial<Branding>;
    initialDevice?: PreviewDevice;
    initialSection?: PreviewSection;
}

const DEVICES: { id: PreviewDevice; label: string; icon: typeof Monitor }[] = [
    { id: 'desktop', label: 'Desktop', icon: Monitor },
    { id: 'tablet', label: 'Tablet', icon: Tablet },
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

const SECTIONS: { id: PreviewSection; label: string }[] = [
    { id: 'landing', label: 'Landing' },
    { id: 'login', label: 'Login' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'sidebar', label: 'Sidebar' },
    { id: 'settings', label: 'Settings' },
    { id: 'crm', label: 'CRM' },
    { id: 'whatsapp', label: 'WhatsApp' },
];

export function FullPreviewModal({
    open,
    onClose,
    branding,
    initialDevice = 'desktop',
    initialSection = 'dashboard',
}: FullPreviewModalProps) {
    const [device, setDevice] = useState<PreviewDevice>(initialDevice);
    const [section, setSection] = useState<PreviewSection>(initialSection);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-white">
                    <span className="font-semibold text-sm">Full Preview</span>
                    <span className="text-xs text-white/50">Draft branding — nothing is saved</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Section tabs */}
                    <div className="hidden md:flex items-center gap-1 rounded-lg bg-white/10 p-1">
                        {SECTIONS.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSection(s.id)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                                    section === s.id ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white',
                                )}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* Device toggles */}
                    <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
                        {DEVICES.map((d) => (
                            <button
                                key={d.id}
                                type="button"
                                title={d.label}
                                onClick={() => setDevice(d.id)}
                                className={cn(
                                    'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
                                    device === d.id ? 'bg-white text-slate-900' : 'text-white/70 hover:text-white',
                                )}
                            >
                                <d.icon className="h-4 w-4" />
                            </button>
                        ))}
                    </div>

                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onClose}>
                        <X className="h-4 w-4 mr-1" /> Close
                    </Button>
                </div>
            </div>

            {/* Mobile section tabs */}
            <div className="md:hidden flex items-center gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setSection(s.id)}
                        className={cn(
                            'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                            section === s.id ? 'bg-white text-slate-900' : 'text-white/70',
                        )}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Stage */}
            <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center">
                <BrandingPreview branding={branding} device={device} section={section} hideTabs />
            </div>
        </div>
    );
}

export default FullPreviewModal;
