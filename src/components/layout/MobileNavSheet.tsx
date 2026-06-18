import { NavLink, useLocation } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePlan } from '@/contexts/PlanContext';
import { ROUTE_FEATURE_MAP } from '@/config/featureGating';

export interface MobileNavItem {
    label: string;
    path: string;
    icon: React.ElementType;
    exact?: boolean;
}

interface MobileNavSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    items: MobileNavItem[];
}

export function MobileNavSheet({ open, onOpenChange, title = 'Menu', items }: MobileNavSheetProps) {
    const location = useLocation();
    const { isFeatureEnabled } = usePlan();

    const visibleItems = items.filter(item => {
        const key = ROUTE_FEATURE_MAP[item.path];
        return !key || isFeatureEnabled(key);
    });

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="w-[min(100vw-2rem,280px)] p-0 flex flex-col">
                <SheetHeader className="p-4 border-b text-left">
                    <SheetTitle>{title}</SheetTitle>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {visibleItems.map(({ label, path, icon: Icon, exact }) => {
                        const isActive = exact
                            ? location.pathname === path
                            : location.pathname === path || location.pathname.startsWith(path + '/');
                        return (
                            <NavLink
                                key={path}
                                to={path}
                                end={exact}
                                onClick={() => onOpenChange(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                <Icon size={18} className="shrink-0" />
                                {label}
                            </NavLink>
                        );
                    })}
                </nav>
            </SheetContent>
        </Sheet>
    );
}
