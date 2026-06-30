import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

export const AnalyticsLoadingScreen: React.FC = () => {
    // Simulated "insights" that float up
    const insights = useMemo(() => [
        "Analyzing engagement...",
        "Crunching conversations...",
        "Mapping user journeys...",
        "Optimizing ROI...",
        "Detecting trends...",
        "Visualizing growth..."
    ], []);

    // Random bar heights for the chart
    const bars = useMemo(() => [40, 70, 50, 90, 60, 80, 45, 75], []);

    return (
        <div className="flex flex-col items-center justify-center min-h-[500px] w-full bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl border border-slate-100 dark:border-slate-800">

            <div className="relative w-48 h-48 flex items-center justify-center">

// ...
                {/* 1. Pulsing "Brain" / Core Glow */}
                <motion.div
                    className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />

                {/* 2. Rotating Data Ring */}
                <motion.div
                    className="absolute inset-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                />

                {/* 3. Animated Bar Chart (Centerpiece) */}
                <div className="flex items-end justify-center gap-1 h-16 overflow-hidden z-10">
                    {bars.map((height, i) => (
                        <motion.div
                            key={i}
                            className="w-2.5 bg-gradient-to-t from-green-600 to-indigo-600 rounded-t-sm"
                            initial={{ height: 0 }}
                            animate={{
                                height: [`${height * 0.4}%`, `${height}%`, `${height * 0.4}%`],
                                opacity: [0.6, 1, 0.6]
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.1 // Staggered wave effect
                            }}
                        />
                    ))}
                </div>
// ...


                {/* 4. Floating "Metric" Pills */}
                {insights.map((text, i) => (
                    <motion.div
                        key={i}
                        className="absolute whitespace-nowrap px-3 py-1 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-100 dark:border-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 pointer-events-none"
                        initial={{ opacity: 0, scale: 0.8, x: 0, y: 0 }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            scale: [0.8, 1, 1, 0.9],
                            x: (Math.random() - 0.5) * 100, // Random drift
                            y: -60 // Float up
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            delay: i * 1.5, // Spread them out
                            ease: "easeOut"
                        }}
                        style={{
                            // Start from somewhat center
                            top: '60%',
                            left: '50%',
                            translateX: '-50%'
                        }}
                    >
                        {text}
                    </motion.div>
                ))}
            </div>

            {/* Loading Text */}
            <motion.div
                className="mt-8 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
            >
                <h3 className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-indigo-600">
                    Generating Insights
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Analyzing your business performance...
                </p>

                {/* Progress Line */}
                <div className="w-64 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-4 overflow-hidden mx-auto">
                    <motion.div
                        className="h-full bg-green-500"
                        animate={{ width: ["0%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                </div>
            </motion.div>

        </div>
    );
};
