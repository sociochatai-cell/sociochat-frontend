import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Workflow, Zap, MessageCircle, Sparkles, Database } from 'lucide-react';

export const AutomationLoadingScreen: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[500px] w-full bg-slate-50/30 dark:bg-slate-900/30 backdrop-blur-sm rounded-xl">
            <div className="relative w-64 h-64 flex items-center justify-center">

                {/* 1. Central Bot pulsing */}
                <motion.div
                    className="relative z-20 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/50"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Bot className="w-12 h-12 text-indigo-600" />

                    {/* Bot eyes blinking */}
                    <motion.div
                        className="absolute top-7 left-7 w-1 h-1 bg-indigo-200 rounded-full"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                    />
                    <motion.div
                        className="absolute top-7 right-7 w-1 h-1 bg-indigo-200 rounded-full"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                    />
                </motion.div>

                {/* 2. Orbitting Nodes */}
                {/* Node 1: Zap (Trigger) */}
                <motion.div
                    className="absolute z-10 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-yellow-200 dark:border-yellow-900/50"
                    animate={{ rotate: 360 }}
                    style={{ originX: 4, originY: 0 }} // Orbit around center? No, simpler to rotate parent
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                    <div className="w-40 h-40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-slate-300 dark:border-slate-700" />
                </motion.div>

                {/* Actual Orbiting Elements container */}
                <motion.div
                    className="absolute inset-0"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                >
                    <motion.div
                        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-8 p-2 bg-white dark:bg-slate-800 rounded-full shadow-md border border-orange-100"
                        animate={{ rotate: -360 }} // Counter rotate to keep icon upright
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                        <Zap className="w-5 h-5 text-orange-500" />
                    </motion.div>

                    <motion.div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8 p-2 bg-white dark:bg-slate-800 rounded-full shadow-md border border-green-100"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                        <MessageCircle className="w-5 h-5 text-green-500" />
                    </motion.div>

                    <motion.div
                        className="absolute left-0 top-1/2 -translate-x-8 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 rounded-full shadow-md border border-blue-100"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                        <Database className="w-5 h-5 text-blue-500" />
                    </motion.div>

                    <motion.div
                        className="absolute right-0 top-1/2 translate-x-8 -translate-y-1/2 p-2 bg-white dark:bg-slate-800 rounded-full shadow-md border border-pink-100"
                        animate={{ rotate: -360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                        <Sparkles className="w-5 h-5 text-pink-500" />
                    </motion.div>
                </motion.div>

                {/* Connecting lines effect (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-50">
                    <circle cx="50%" cy="50%" r="80" fill="none" stroke="url(#spinner-gradient)" strokeWidth="1" strokeDasharray="4 4" />
                    <defs>
                        <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4F46E5" />
                            <stop offset="100%" stopColor="#22C55E" />
                        </linearGradient>
                    </defs>
                </svg>

            </div>

            {/* Loading Stats / Text */}
            <div className="mt-8 text-center space-y-3">
                <h3 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-green-600">
                    Initializing Automation Hub
                </h3>

                <div className="flex flex-col gap-1 items-center">
                    <motion.p
                        className="text-sm text-muted-foreground flex items-center gap-2"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <Workflow className="w-3 h-3 text-indigo-500" /> Loading workflows...
                    </motion.p>
                    <motion.p
                        className="text-sm text-muted-foreground flex items-center gap-2"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.0 }}
                    >
                        <Zap className="w-3 h-3 text-orange-500" /> Connecting triggers...
                    </motion.p>
                </div>

                {/* Progress Bar */}
                <div className="w-64 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-4 overflow-hidden mx-auto">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-green-500"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                </div>
            </div>
        </div>
    );
};
