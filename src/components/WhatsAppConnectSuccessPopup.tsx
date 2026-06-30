import { useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { CheckCircle2, Sparkles, Unlink, Trash2, AlertTriangle, X } from 'lucide-react';

// Import Assets
import whatsappLogo from '../assets/wp-logo.png';
import socioviaLogo from '../assets/sociovia_logo.png';

export type PopupVariant = 'connect' | 'unlink' | 'delete' | 'error';

interface WhatsAppConnectSuccessPopupProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    duration?: number; // in milliseconds
    variant?: PopupVariant;
    accountName?: string;
    accountNumber?: string;
}

const WhatsAppConnectSuccessPopup = ({
    isOpen,
    onClose,
    title,
    subtitle,
    duration = 3000,
    variant = 'connect',
    accountName,
    accountNumber
}: WhatsAppConnectSuccessPopupProps) => {
    const hasTriggeredConfetti = useRef(false);
    const onCloseRef = useRef(onClose);

    // Keep onClose ref updated
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Variant specific configurations
    const config = useMemo(() => {
        switch (variant) {
            case 'unlink':
                return {
                    icon: Unlink,
                    secondaryIcon: AlertTriangle,
                    gradientFrom: 'from-orange-400',
                    gradientVia: 'via-amber-500',
                    gradientTo: 'to-orange-600',
                    borderColor: 'border-orange-200',
                    titleColor: 'text-gray-900',
                    defaultTitle: 'Account Unlinked',
                    defaultSubtitle: 'Your WhatsApp account has been deactivated.',
                    showIntegration: false
                };
            case 'delete':
                return {
                    icon: Trash2,
                    secondaryIcon: AlertTriangle,
                    gradientFrom: 'from-red-500',
                    gradientVia: 'via-rose-600',
                    gradientTo: 'to-red-700',
                    borderColor: 'border-red-200',
                    titleColor: 'text-gray-900',
                    defaultTitle: 'Account Deleted',
                    defaultSubtitle: 'All account data has been permanently removed.',
                    showIntegration: false
                };
            case 'error':
                return {
                    icon: AlertTriangle,
                    secondaryIcon: X,
                    gradientFrom: 'from-red-500',
                    gradientVia: 'via-red-600',
                    gradientTo: 'to-red-700',
                    borderColor: 'border-red-200',
                    titleColor: 'text-gray-900',
                    defaultTitle: 'Connection Failed',
                    defaultSubtitle: 'We could not connect to WhatsApp. Please try again.',
                    showIntegration: false
                };
            case 'connect':
            default:
                return {
                    // New Integration Animation Config
                    gradientFrom: 'from-[#008069]', // WhatsApp Teal
                    gradientVia: 'via-[#25D366]',
                    gradientTo: 'to-[#128C7E]',
                    borderColor: 'border-green-100',
                    titleColor: 'text-gray-900',
                    defaultTitle: 'WhatsApp Connected!',
                    defaultSubtitle: 'Your business account is now linked and ready to go.',
                    showIntegration: true
                };
        }
    }, [variant]);

    useEffect(() => {
        if (isOpen && !hasTriggeredConfetti.current) {
            hasTriggeredConfetti.current = true;

            // Trigger confetti
            if (variant === 'connect') {
                const duration = 3000;
                const end = Date.now() + duration;

                const frame = () => {
                    confetti({
                        particleCount: 5,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0, y: 0.6 },
                        colors: ['#25D366', '#128C7E', '#1877F2'] // WA + FB colors
                    });
                    confetti({
                        particleCount: 5,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1, y: 0.6 },
                        colors: ['#25D366', '#128C7E', '#1877F2']
                    });

                    if (Date.now() < end) {
                        requestAnimationFrame(frame);
                    }
                };
                frame();
            } else {
                // Simple burst for unlink/delete
                confetti({
                    particleCount: 50,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: variant === 'unlink' ? ['#f97316', '#fbbf24'] : ['#ef4444', '#b91c1c']
                });
            }

            const timer = setTimeout(() => {
                onCloseRef.current();
            }, duration);
            return () => clearTimeout(timer);
        }
        if (!isOpen) hasTriggeredConfetti.current = false;
    }, [isOpen, duration, variant, config]);

    const IntegrationAnimation = () => (
        <div className="flex flex-col items-center gap-6 mb-8 relative">
            {/* Top: Connection Success Visual */}
            <div className="flex items-center justify-center gap-6 relative">
                {/* Left Icon: WhatsApp */}
                <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="relative z-10"
                >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-lg overflow-hidden p-3">
                        <img
                            src={whatsappLogo}
                            alt="WhatsApp"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-500 whitespace-nowrap"
                    >
                        WhatsApp
                    </motion.p>
                </motion.div>

                {/* Connection Line with Animated Success */}
                <div className="relative w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                    {/* Success fill animation */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full"
                    />
                    {/* Success Check appearing in middle */}
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                    </motion.div>
                </div>

                {/* Right Icon: Sociovia */}
                <motion.div
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="relative z-10"
                >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 flex items-center justify-center shadow-lg shadow-gray-200/50 overflow-hidden p-3">
                        <img src={socioviaLogo} alt="Sociovia" className="w-full h-full object-contain" />
                    </div>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-gray-500 whitespace-nowrap"
                    >
                        Sociovia
                    </motion.p>
                </motion.div>
            </div>

            {/* Big Animated Success Tick */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 15 }}
                className="relative"
            >
                {/* Outer glow ring */}
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 0, 0.5]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-green-400 rounded-full blur-xl"
                />

                {/* Success circle with animated checkmark */}
                <motion.div
                    className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-xl shadow-green-400/30"
                    animate={{
                        boxShadow: [
                            '0 0 0 0 rgba(37, 211, 102, 0)',
                            '0 0 30px 15px rgba(37, 211, 102, 0.3)',
                            '0 0 0 0 rgba(37, 211, 102, 0)'
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    {/* Animated checkmark SVG */}
                    <motion.svg
                        className="w-12 h-12 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <motion.path
                            d="M5 13l4 4L19 7"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ delay: 1, duration: 0.5, ease: "easeOut" }}
                        />
                    </motion.svg>
                </motion.div>

                {/* Floating sparkles */}
                {[0, 1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                            scale: [0, 1, 0],
                            opacity: [0, 1, 0],
                            y: [-20, -40, -60],
                            x: [0, (i % 2 === 0 ? 1 : -1) * 20, (i % 2 === 0 ? 1 : -1) * 30]
                        }}
                        transition={{
                            delay: 1.2 + i * 0.15,
                            duration: 1.5,
                            repeat: Infinity,
                            repeatDelay: 1
                        }}
                        className="absolute top-0"
                        style={{
                            left: `${25 + i * 15}%`
                        }}
                    >
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );

    const content = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center"
                    style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
                >
                    {/* Background overlay */}
                    <div className="absolute inset-0 bg-black/40" onClick={() => onClose?.()} />

                    {/* Popup card */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{
                            type: 'spring',
                            damping: 20,
                            stiffness: 300,
                            delay: 0.1,
                        }}
                        className="relative z-10 w-full max-w-lg mx-4"
                    >
                        {/* Card Body */}
                        <div className="bg-white/95 backdrop-blur rounded-[2rem] shadow-2xl overflow-hidden p-8 border border-white/50">

                            {/* Header Gradient Line */}
                            <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo}`} />

                            <div className="flex flex-col items-center text-center">

                                {config.showIntegration ? (
                                    <IntegrationAnimation />
                                ) : (
                                    // Standard Icon Animation for Unlink/Delete
                                    <motion.div
                                        initial={{ rotate: -180, scale: 0 }}
                                        animate={{ rotate: 0, scale: 1 }}
                                        transition={{ type: "spring", damping: 12 }}
                                        className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} flex items-center justify-center mb-6 shadow-xl`}
                                    >
                                        <config.icon className="w-10 h-10 text-white" />
                                    </motion.div>
                                )}

                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className={`text-2xl font-bold ${config.titleColor} mb-2`}
                                >
                                    {title || config.defaultTitle}
                                </motion.h2>

                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="space-y-1"
                                >
                                    <p className="text-gray-600 font-medium">
                                        {subtitle || config.defaultSubtitle}
                                    </p>
                                    {variant === 'connect' && (
                                        <>
                                            {accountName && accountNumber && (
                                                <p className="text-sm text-gray-500 mt-2">
                                                    Account: <span className="font-semibold">{accountName}</span> ({accountNumber})
                                                </p>
                                            )}
                                            <p className="text-sm text-gray-500 mt-2 bg-gray-50 py-1 px-3 rounded-full inline-block border border-gray-100">
                                                Everything is synced and ready to go! 🚀
                                            </p>
                                        </>
                                    )}
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(content, document.body);
};

export default WhatsAppConnectSuccessPopup;
