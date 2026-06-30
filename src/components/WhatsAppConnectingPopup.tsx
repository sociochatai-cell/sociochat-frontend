/**
 * WhatsApp Connecting Animation Popup
 * ====================================
 * Shows animated connection progress between Facebook/WhatsApp and Sociovia
 * during OAuth authentication process.
 */

import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Import Assets
import metaLogo from '../assets/metaa2.png';
import whatsappLogo from '../assets/wp-logo.png';
import socioviaLogo from '../assets/sociovia_logo.png';

export type ConnectingVariant = 'facebook' | 'whatsapp' | 'authenticating';

interface WhatsAppConnectingPopupProps {
    isOpen: boolean;
    variant?: ConnectingVariant;
    title?: string;
    subtitle?: string;
}

const WhatsAppConnectingPopup = ({
    isOpen,
    variant = 'whatsapp',
    title,
    subtitle
}: WhatsAppConnectingPopupProps) => {

    // Variant specific configurations
    const config = useMemo(() => {
        switch (variant) {
            case 'facebook':
                return {
                    leftGradient: 'from-[#1877F2] to-[#0D5DC7]',
                    leftImage: metaLogo,
                    defaultTitle: 'Connecting to Facebook',
                    defaultSubtitle: 'Please complete the login in the popup window...'
                };
            case 'authenticating':
                return {
                    leftGradient: 'from-[#1877F2] to-[#008069]',
                    leftImage: metaLogo, // Use Meta for combined/auth state too, or maybe whatsapp? User said Meta icon -> WhatsApp icon -> Sociovia icon logic. 
                    // But prompt says "instead of facebook use meta icon and then whatsapp icon and ten sociovia icon". 
                    // For "Authenticating", it's usually both. Let's use Meta as base.
                    defaultTitle: 'Authenticating...',
                    defaultSubtitle: 'Verifying your credentials with Meta...'
                };
            case 'whatsapp':
            default:
                return {
                    leftGradient: 'from-[#25D366] to-[#128C7E]',
                    leftImage: whatsappLogo,
                    defaultTitle: 'Connecting WhatsApp',
                    defaultSubtitle: 'Setting up your WhatsApp Business Account...'
                };
        }
    }, [variant]);

    // Animated connection line with particles
    const ConnectionAnimation = () => (
        <div className="flex items-center justify-center gap-4 mb-8 relative py-8">
            {/* Left Icon: Meta or WhatsApp */}
            <motion.div
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative z-10"
            >
                <motion.div
                    animate={{
                        scale: [1, 1.05, 1],
                        boxShadow: [
                            '0 0 0 0 rgba(37, 211, 102, 0)',
                            '0 0 20px 10px rgba(37, 211, 102, 0.3)',
                            '0 0 0 0 rgba(37, 211, 102, 0)'
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className={`w-20 h-20 rounded-2xl bg-white border-2 border-gray-100 flex items-center justify-center shadow-lg overflow-hidden p-3`}
                >
                    <img
                        src={config.leftImage}
                        alt="Platform Logo"
                        className="w-full h-full object-contain"
                    />
                </motion.div>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-500 whitespace-nowrap"
                >
                    {variant === 'facebook' ? 'Meta' : variant === 'authenticating' ? 'Meta' : 'WhatsApp'}
                </motion.p>
            </motion.div>

            {/* Connection Line with Animated Particles */}
            <div className="relative w-28 h-2 flex items-center">
                {/* Base Line */}
                <div className="absolute inset-0 bg-gray-200 rounded-full" />

                {/* Animated Progress */}
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#25D366] rounded-full"
                />

                {/* Flying Particles */}
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        initial={{ x: 0, opacity: 0, scale: 0.5 }}
                        animate={{
                            x: [0, 112],
                            opacity: [0, 1, 1, 0],
                            scale: [0.5, 1, 1, 0.5]
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.4,
                            ease: "easeInOut"
                        }}
                        className="absolute w-3 h-3 bg-[#25D366] rounded-full shadow-md shadow-green-400/50"
                        style={{ left: 0 }}
                    />
                ))}

                {/* Pulse Effect */}
                <motion.div
                    animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5]
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-green-400 rounded-full"
                />
            </div>

            {/* Right Icon: Sociovia */}
            <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative z-10"
            >
                <motion.div
                    animate={{
                        scale: [1, 1.05, 1],
                        boxShadow: [
                            '0 0 0 0 rgba(99, 102, 241, 0)',
                            '0 0 20px 10px rgba(99, 102, 241, 0.2)',
                            '0 0 0 0 rgba(99, 102, 241, 0)'
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="w-20 h-20 rounded-2xl bg-white border-2 border-gray-100 flex items-center justify-center shadow-lg overflow-hidden p-3"
                >
                    <img
                        src={socioviaLogo}
                        alt="Sociovia"
                        className="w-full h-full object-contain"
                    />
                </motion.div>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-xs font-semibold text-gray-500 whitespace-nowrap"
                >
                    Sociovia
                </motion.p>
            </motion.div>
        </div>
    );

    // Loading dots animation
    const LoadingDots = () => (
        <div className="flex items-center justify-center gap-1 mt-4">
            {[0, 1, 2].map((i) => (
                <motion.div
                    key={i}
                    animate={{
                        y: [0, -8, 0],
                        opacity: [0.4, 1, 0.4]
                    }}
                    transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.15
                    }}
                    className="w-2 h-2 bg-green-500 rounded-full"
                />
            ))}
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
                    <div className="absolute inset-0 bg-black/40" />

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
                        className="relative z-10 w-full max-w-md mx-4"
                    >
                        {/* Card Body */}
                        <div className="bg-white/95 backdrop-blur rounded-[2rem] shadow-2xl overflow-hidden p-8 border border-white/50">

                            {/* Header Gradient Line */}
                            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#25D366] via-[#1877F2] to-[#128C7E]" />

                            <div className="flex flex-col items-center text-center">
                                {/* Connection Animation */}
                                <ConnectionAnimation />

                                {/* Title */}
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-xl font-bold text-gray-900 mb-2"
                                >
                                    {title || config.defaultTitle}
                                </motion.h2>

                                {/* Subtitle */}
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-gray-600 font-medium"
                                >
                                    {subtitle || config.defaultSubtitle}
                                </motion.p>

                                {/* Loading Dots */}
                                <LoadingDots />

                                {/* Progress Indicator */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.5 }}
                                    className="mt-6 flex items-center gap-2 text-sm text-gray-500"
                                >
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Please wait...</span>
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

export default WhatsAppConnectingPopup;
