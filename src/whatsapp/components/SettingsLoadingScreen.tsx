import React from 'react';
import { motion } from 'framer-motion';
import { Settings, BarChart3, Target, Zap } from 'lucide-react';

export const SettingsLoadingScreen: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
            <div className="relative w-48 h-48 flex items-center justify-center">

                {/* Background Glow */}
                <motion.div
                    className="absolute inset-0 bg-green-500/10 rounded-full blur-3xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* Main Gear (Settings) */}
                <motion.div
                    className="absolute"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                    <Settings className="w-24 h-24 text-slate-200 dark:text-slate-700" strokeWidth={1} />
                </motion.div>

                {/* Inner Gear (Counter-rotating) */}
                <motion.div
                    className="absolute"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                >
                    <Settings className="w-12 h-12 text-green-100 dark:text-green-900/30" strokeWidth={1.5} />
                </motion.div>

                {/* Floating "Marketing" Icons being "Fixed" */}
                {/* 1. Target Icon */}
                <motion.div
                    className="absolute top-0 right-0 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-green-100 dark:border-slate-700"
                    animate={{
                        y: [-10, 10, -10],
                        opacity: [0.5, 1, 0.5],
                        scale: [0.9, 1, 0.9]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                >
                    <Target className="w-5 h-5 text-green-600" />
                </motion.div>

                {/* 2. Chart Icon */}
                <motion.div
                    className="absolute bottom-4 left-4 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-indigo-100 dark:border-slate-700"
                    animate={{
                        y: [10, -10, 10],
                        opacity: [0.5, 1, 0.5],
                        scale: [0.9, 1, 0.9]
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                </motion.div>

                {/* 3. Automation Icon */}
                <motion.div
                    className="absolute bottom-8 right-8 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-green-100 dark:border-slate-700"
                    animate={{
                        y: [-5, 5, -5],
                        x: [-5, 5, -5],
                        opacity: [0.6, 1, 0.6]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                    <Zap className="w-5 h-5 text-green-500" />
                </motion.div>

                {/* Central Focus Ring */}
                <div className="absolute inset-0 rounded-full border border-dashed border-green-200 dark:border-green-800/30 animate-[spin_10s_linear_infinite]" />
            </div>

            {/* Loading Text */}
            <motion.div
                className="mt-6 text-center space-y-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <h3 className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-indigo-600">
                    Optimizing Marketing Settings
                </h3>
                <p className="text-sm text-muted-foreground">
                    Configuring your Sociovia environment...
                </p>
            </motion.div>
        </div>
    );
};
