import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Unlock, Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface UnlockDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onUnlock: (level: number) => void;
    targetLevel: 2 | 3;
    title: string;
}

const CODES: Record<string, number> = {
    'GROWTH': 2,
    'ENTERPRISE': 3
};

export function UnlockDialog({ isOpen, onClose, onUnlock, targetLevel, title }: UnlockDialogProps) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleUnlock = () => {
        const uppercaseCode = code.toUpperCase().trim();

        if (CODES[uppercaseCode] === targetLevel) {
            setSuccess(true);
            setTimeout(() => {
                onUnlock(targetLevel);
                setSuccess(false);
                setCode('');
                setError('');
                onClose();
            }, 1500);
        } else {
            setError('Invalid access code. Please try again.');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                <DialogHeader>
                    <div className="mx-auto bg-emerald-100 p-3 rounded-full mb-4 w-fit">
                        {success ? (
                            <Unlock className="w-8 h-8 text-emerald-600 animate-bounce" />
                        ) : (
                            <Lock className="w-8 h-8 text-emerald-600" />
                        )}
                    </div>
                    <DialogTitle className="text-center text-xl font-bold bg-gradient-to-r from-emerald-600 to-indigo-600 bg-clip-text text-transparent">
                        {success ? 'Access Granted!' : `Unlock ${title} Features`}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {success
                            ? 'Redirecting to your new workspace...'
                            : 'Enter your access code to unlock this tier.'}
                    </DialogDescription>
                </DialogHeader>

                {!success && (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="code" className="text-sm font-medium">Access Code</Label>
                            <Input
                                id="code"
                                placeholder={targetLevel === 2 ? "try 'GROWTH'" : "try 'ENTERPRISE'"}
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value);
                                    setError('');
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                className="text-center uppercase tracking-widest font-mono border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500"
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive" className="py-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="bg-slate-50 p-3 rounded-lg text-xs text-muted-foreground border text-center">
                            Pro Tip: Use code <strong>{targetLevel === 2 ? 'GROWTH' : 'ENTERPRISE'}</strong> for this demo.
                        </div>
                    </div>
                )}

                {!success && (
                    <DialogFooter className="sm:justify-center">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="mr-2"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleUnlock}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                        >
                            {targetLevel === 3 && <Sparkles className="w-4 h-4 mr-2" />}
                            Unlock Now
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
