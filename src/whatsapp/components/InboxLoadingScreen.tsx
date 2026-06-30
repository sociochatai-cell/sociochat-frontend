import React from 'react';
import socioviaLogo from '@/assets/sociovia_logo.png';

export const InboxLoadingScreen: React.FC = () => {
    const sidebarRows = Array.from({ length: 6 });
    const threadRows = Array.from({ length: 5 });

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
            <div className="border-b bg-gradient-to-r from-background via-background to-primary/5 px-4 py-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-[shimmer_2.8s_ease-in-out_infinite]" />
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-lg shadow-primary/10 border border-primary/10 flex items-center justify-center">
                        <img
                            src={socioviaLogo}
                            alt="Sociovia"
                            className="w-7 h-7 object-contain"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="h-5 w-40 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                        <div className="h-3 w-56 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                    </div>
                </div>
            </div>

            <div className="flex h-[calc(100vh-81px)]">
                <div className="w-full max-w-[420px] border-r bg-gradient-to-b from-background to-muted/20 p-4 space-y-3 hidden md:block">
                    <div className="h-10 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                    {sidebarRows.map((_, index) => (
                        <div key={index} className="rounded-2xl border bg-white/70 p-3 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse shrink-0" />
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="h-4 w-28 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                        <div className="h-5 w-10 rounded-full bg-gradient-to-r from-green-100 via-green-50 to-green-100 animate-pulse" />
                                    </div>
                                    <div className="h-3 w-40 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                    <div className="h-3 w-24 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-1 p-4 md:p-6 space-y-4">
                    <div className="rounded-2xl border bg-white/80 px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                <div className="space-y-2">
                                    <div className="h-4 w-36 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                    <div className="h-3 w-28 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="h-9 w-24 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                <div className="h-9 w-24 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 rounded-3xl border bg-white/60 p-4 md:p-6 shadow-inner space-y-4">
                        {threadRows.map((_, index) => (
                            <div
                                key={index}
                                className={`flex ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                            >
                                <div className={`max-w-[75%] rounded-2xl px-4 py-3 space-y-2 ${
                                    index % 2 === 0 ? 'bg-slate-100' : 'bg-emerald-50'
                                }`}>
                                    <div className="h-3 w-40 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                    <div className="h-3 w-28 rounded bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-2xl border bg-white/80 p-4 shadow-sm">
                        <div className="h-12 rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse" />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};
