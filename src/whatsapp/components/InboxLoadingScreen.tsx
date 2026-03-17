import React from 'react';
import socioviaLogo from '@/assets/sociovia_logo.png';

export const InboxLoadingScreen: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-br from-background via-background to-primary/5">
            {/* Centered content */}
            <div className="flex flex-col items-center gap-6">
                {/* Logo with subtle pulse */}
                <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-lg shadow-primary/10 border border-primary/10 flex items-center justify-center">
                        <img 
                            src={socioviaLogo} 
                            alt="Sociovia" 
                            className="w-12 h-12 object-contain"
                        />
                    </div>
                    {/* Subtle pulsing ring */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                </div>

                {/* Loading spinner */}
                <div className="flex flex-col items-center gap-3">
                    <div className="relative w-8 h-8">
                        {/* Spinner circle */}
                        <div className="absolute inset-0 rounded-full border-2 border-muted" />
                        <div 
                            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
                            style={{ animationDuration: '0.8s' }}
                        />
                    </div>
                    
                    {/* Loading text */}
                    <p className="text-sm text-muted-foreground font-medium">
                        Loading...
                    </p>
                </div>
            </div>
        </div>
    );
};
