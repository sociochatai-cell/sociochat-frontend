import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
    Phone, ShieldCheck, Settings, X,
    Lock, Crown, MessageCircle, Users, Megaphone, BarChart3, Loader2
} from 'lucide-react';
import { API_BASE_URL } from '@/config';

const WhatsAppAnalytics = lazy(() => import('../whatsapp/pages/WhatsAppAnalytics'));

export default function DashboardHome() {
    const [showConnectModal, setShowConnectModal] = useState(false);
    const navigate = useNavigate();

    // Connection state
    const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = loading

    // Check WhatsApp connection status on load
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const workspaceId =
                    localStorage.getItem('sv_whatsapp_workspace_id') ||
                    sessionStorage.getItem('sv_whatsapp_workspace_id') ||
                    localStorage.getItem('sv_selected_workspace_id') ||
                    sessionStorage.getItem('sv_selected_workspace_id');

                if (!workspaceId) {
                    setIsConnected(false);
                    return;
                }

                const res = await fetch(
                    `${API_BASE_URL}/api/whatsapp/connection-path?workspace_id=${workspaceId}`,
                    { credentials: 'include' }
                );
                const data = await res.json();

                setIsConnected(data.status === 'CONNECTED' && !!data.account_summary);
            } catch {
                setIsConnected(false);
            }
        };
        checkConnection();
    }, []);

    // ── Loading state ──
    if (isConnected === null) {
        return (
            <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50/50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    // ── Connected → show analytics ──
    if (isConnected) {
        return (
            <Suspense
                fallback={
                    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50/50">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    </div>
                }
            >
                <WhatsAppAnalytics />
            </Suspense>
        );
    }

    // ── Not connected → show the connect screen ──
    return <ConnectScreen showConnectModal={showConnectModal} setShowConnectModal={setShowConnectModal} navigate={navigate} />;
}

// ──────────────────────────────────────────────
// Original "WhatsApp API Hub" connect screen
// extracted into its own component for clarity
// ──────────────────────────────────────────────
function ConnectScreen({
    showConnectModal,
    setShowConnectModal,
    navigate,
}: {
    showConnectModal: boolean;
    setShowConnectModal: (v: boolean) => void;
    navigate: ReturnType<typeof useNavigate>;
}) {
    // 3D Parallax logic
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const mouseXSpring = useSpring(x, { stiffness: 100, damping: 20 });
    const mouseYSpring = useSpring(y, { stiffness: 100, damping: 20 });
    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["30deg", "-30deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-30deg", "30deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
    };

    const handleMouseLeave = () => { x.set(0); y.set(0); };

    return (
        <div
            className="w-full min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col items-center justify-between pb-10 pt-6 px-4 bg-slate-50/50"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: 1500 }}
        >
            {/* Royal Background Aura */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-emerald-500/20 via-amber-500/10 to-emerald-700/20 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />

            <div className="w-full max-w-4xl relative z-10 flex flex-col items-center text-center flex-1 justify-center gap-10 md:gap-20">

                {/* Royal Badge */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200/50 text-amber-700 font-semibold text-sm shadow-[0_4px_20px_rgba(217,119,6,0.15)] pointer-events-none mt-2 mb-3"
                    style={{ transform: 'translateZ(10px)' }}
                >
                    <Crown className="w-4 h-4" /> SocioChat AI
                </motion.div>

                {/* Main Command Orb 3D Container */}
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100, delay: 0.2 }}
                    className="relative cursor-pointer group my-7"
                    onClick={() => setShowConnectModal(true)}
                    style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                >
                    <div className="absolute inset-0 bg-emerald-500/40 rounded-full blur-3xl scale-150 group-hover:bg-emerald-400/60 transition-colors duration-500" style={{ transform: 'translateZ(-50px)' }} />

                    <div className="w-48 h-48 md:w-56 md:h-56 rounded-full relative z-10 flex items-center justify-center p-1 transition-transform duration-500 group-hover:scale-105"
                        style={{
                            background: 'linear-gradient(135deg, #a7f3d0, #059669)',
                            boxShadow: 'inset -10px -10px 30px rgba(0,0,0,0.3), inset 10px 10px 30px rgba(255,255,255,0.8), 0 30px 60px -15px rgba(5,150,105,0.5)',
                            transform: 'translateZ(30px)'
                        }}>
                        <div className="w-full h-full rounded-full bg-white/20 backdrop-blur-sm border border-white/50 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/40 blur-2xl rounded-full translate-x-10 -translate-y-10" />
                            <img src="/sociochat_logo.png" alt="SocioChat.ai" className="w-16 h-16 md:w-20 md:h-20 rounded-3xl shadow-2xl mb-2 z-10 pointer-events-none" />
                            <h2 className="text-xl md:text-2xl font-black text-emerald-950 tracking-tight z-10 drop-shadow-sm pointer-events-none">Command Center</h2>
                        </div>
                    </div>

                    {/* Orbital floating elements */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-[-60px] md:inset-[-90px] border border-emerald-500/20 rounded-full border-dashed pointer-events-none"
                        style={{ transform: 'translateZ(150px)' }}
                    >
                        <motion.div animate={{ rotate: -360 }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                            className="absolute top-0 left-1/2 -mt-[26px] -ml-[26px] w-13 h-13 md:w-14 md:h-14 bg-white/95 backdrop-blur-md rounded-full shadow-2xl border border-emerald-100 flex items-center justify-center text-emerald-600 pointer-events-auto hover:bg-emerald-50 hover:scale-125 transition-all cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setShowConnectModal(true); }} title="Team Inbox">
                            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 drop-shadow-sm" />
                        </motion.div>

                        <motion.div animate={{ rotate: -360 }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                            className="absolute top-1/2 right-0 -mr-[26px] -mt-[26px] w-13 h-13 md:w-14 md:h-14 bg-white/95 backdrop-blur-md rounded-full shadow-2xl border border-sky-100 flex items-center justify-center text-sky-600 pointer-events-auto hover:bg-sky-50 hover:scale-125 transition-all cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setShowConnectModal(true); }} title="Contacts & CRM">
                            <Users className="w-5 h-5 md:w-6 md:h-6 drop-shadow-sm" />
                        </motion.div>

                        <motion.div animate={{ rotate: -360 }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                            className="absolute bottom-0 left-1/2 -mb-[26px] -ml-[26px] w-13 h-13 md:w-14 md:h-14 bg-white/95 backdrop-blur-md rounded-full shadow-2xl border border-amber-100 flex items-center justify-center text-amber-600 pointer-events-auto hover:bg-amber-50 hover:scale-125 transition-all cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setShowConnectModal(true); }} title="Campaign Broadcasts">
                            <Megaphone className="w-5 h-5 md:w-6 md:h-6 drop-shadow-sm" />
                        </motion.div>

                        <motion.div animate={{ rotate: -360 }} transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
                            className="absolute top-1/2 left-0 -ml-[26px] -mt-[26px] w-13 h-13 md:w-14 md:h-14 bg-white/95 backdrop-blur-md rounded-full shadow-2xl border border-emerald-100 flex items-center justify-center text-emerald-600 pointer-events-auto hover:bg-emerald-50 hover:scale-125 transition-all cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); setShowConnectModal(true); }} title="Growth Analytics">
                            <BarChart3 className="w-5 h-5 md:w-6 md:h-6 drop-shadow-sm" />
                        </motion.div>
                    </motion.div>
                </motion.div>

                {/* Title & Call to Action */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="pointer-events-none px-4 relative z-20"
                >
                    <h1 className="text-3xl md:text-5xl font-black text-slate-800 mb-4 tracking-tight drop-shadow-sm">
                        WhatsApp API <span className="text-emerald-700">Hub</span>
                    </h1>
                    <p className="text-base text-slate-500 max-w-lg mx-auto font-medium mb-8">
                        Authenticate your Meta account to access powerful automated tools and broadcasting capabilities.
                    </p>

                    <button
                        onClick={() => setShowConnectModal(true)}
                        className="pointer-events-auto group relative px-8 py-3.5 md:px-10 md:py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-base md:text-lg flex items-center justify-center gap-3 overflow-hidden shadow-xl hover:shadow-emerald-500/20 transition-all hover:-translate-y-1 mx-auto"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                        <Lock className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                        Authenticate & Connect
                    </button>
                </motion.div>
            </div>

            {/* Connect Account Modal */}
            <AnimatePresence>
                {showConnectModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowConnectModal(false)}
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
                        style={{ zIndex: 100 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white/95 backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl relative overflow-hidden ring-1 ring-white/50"
                            style={{ boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.4), inset 0 2px 4px 0 rgba(255, 255, 255, 0.9)' }}
                        >
                            <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                            <button
                                onClick={() => setShowConnectModal(false)}
                                className="absolute top-6 right-6 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mb-6 ring-1 ring-emerald-200 shadow-[inset_0_2px_10px_rgba(255,255,255,1),_0_10px_20px_rgba(16,185,129,0.2)] relative z-10">
                                <Phone className="w-10 h-10 text-emerald-600" />
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border border-emerald-50">
                                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                </div>
                            </div>

                            <h2 className="text-3xl font-black text-slate-900 mb-3 relative z-10 tracking-tight">Connect Meta Core</h2>
                            <p className="text-slate-600 mb-8 relative z-10 text-lg leading-relaxed font-medium">
                                Establish a secure connection with your official Meta API to initialize the Command Center.
                            </p>

                            <div className="flex flex-col gap-4 relative z-10">
                                <button
                                    onClick={() => navigate('/dashboard/connect')}
                                    className="w-full py-4 px-6 bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 text-white rounded-[1.25rem] font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/30 hover:translate-y-[-2px]"
                                >
                                    <Settings className="w-5 h-5" /> Initialize Connection
                                </button>
                                <button
                                    onClick={() => setShowConnectModal(false)}
                                    className="w-full py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[1.25rem] font-bold text-lg transition-colors"
                                >
                                    Explore Later
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
