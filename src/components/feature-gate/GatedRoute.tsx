import { useNavigate } from 'react-router-dom';
import { Crown, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import type { FeatureKey } from '@/config/featureGating';

interface GatedRouteProps {
    feature: FeatureKey;
    children: React.ReactNode;
}

export function GatedRoute({ feature, children }: GatedRouteProps) {
    const { allowed, upgradeMessage } = useFeatureGate(feature);
    const navigate = useNavigate();

    if (allowed) {
        return <>{children}</>;
    }

    return (
        <div className="flex items-center justify-center min-h-[80vh] p-8">
            <div className="max-w-md text-center space-y-6">
                <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                    <Crown className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Upgrade Required</h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        {upgradeMessage}. Upgrade your plan to unlock this feature.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-800">Premium feature</span>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                        onClick={() => navigate('/subscription')}
                        className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-6"
                    >
                        <Crown className="w-4 h-4 mr-2" />
                        View Plans & Upgrade
                    </Button>
                    <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-500">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Go Back
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default GatedRoute;
