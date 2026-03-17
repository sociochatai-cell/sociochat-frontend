import { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, Search, BrainCircuit, Image as ImageIcon, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoaderMessage {
    text: string;
    icon?: any;
    color?: string;
}

interface SocioviaLoaderProps {
    isLoading: boolean;
    className?: string;
    messages?: LoaderMessage[];
    targetDuration?: number; // in ms
}

export default function SocioviaLoader({
    isLoading,
    className,
    messages: customMessages,
    targetDuration = 35000
}: SocioviaLoaderProps) {
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState("Initializing...");
    const [phase, setPhase] = useState(0);

    // Refs to handle intervals and animation frames
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);

    // Default messages corresponding to approximate progress points
    const defaultMessages = [
        { text: "Connecting to AI agents...", icon: Sparkles, color: "text-indigo-500" },
        { text: "Crawling website & extracting assets...", icon: Search, color: "text-blue-500" },
        { text: "Analyzing brand voice & style...", icon: BrainCircuit, color: "text-purple-500" },
        { text: "Generating high-converting copy...", icon: PenTool, color: "text-pink-500" },
        { text: "Creating AI-powered creatives...", icon: ImageIcon, color: "text-indigo-600" },
        { text: "Finalizing your campaign...", icon: CheckCircle2, color: "text-emerald-500" },
    ];

    const messages = customMessages || defaultMessages;

    useEffect(() => {
        if (isLoading) {
            // Start the loading sequence
            setProgress(0);
            setPhase(0);
            startTimeRef.current = Date.now();

            const targetDuration = 35000; // Aim for ~35s to reach 95% (leaving a buffer for 1 min)

            if (intervalRef.current) clearInterval(intervalRef.current);

            intervalRef.current = setInterval(() => {
                setProgress((prev) => {
                    // If we're already at the cap, stay there
                    if (prev >= 95) return 95;

                    const elapsed = Date.now() - startTimeRef.current;
                    const theoreticalProgress = (elapsed / targetDuration) * 95;

                    // Add randomness: +/- 2% from the theoretical linear path
                    // but ensure we never go backwards or exceed 95
                    const noise = (Math.random() - 0.5) * 4;
                    let next = theoreticalProgress + noise;

                    // Logic to simulate "stalls" and "bursts"
                    // Occasional burst
                    if (Math.random() > 0.95) next += 2;
                    // Occasional stall (by taking the min of current and calculated)
                    if (Math.random() > 0.95) next = prev;

                    // Clamping
                    if (next < prev) next = prev; // Don't go back
                    if (next > 95) next = 95;     // Cap at 95 until done

                    return next;
                });
            }, 500); // Update every 500ms

        } else {
            // When loading finishes (isLoading becomes false)
            // Rapidly complete the bar if it was in progress
            if (progress > 0 && progress < 100) {
                setProgress(100);
                setMessage("Complete!");
                setPhase(messages.length - 1);
            } else {
                setProgress(0);
            }

            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isLoading]);

    // Update message phase based on progress
    useEffect(() => {
        if (progress < 15) setPhase(0);
        else if (progress < 35) setPhase(1);
        else if (progress < 55) setPhase(2);
        else if (progress < 75) setPhase(3);
        else if (progress < 90) setPhase(4);
        else setPhase(5);
    }, [progress]);

    if (progress === 0 && !isLoading) return null;

    const CurrentIcon = messages[phase]?.icon || Sparkles;

    return (
        <div className={cn("w-full max-w-lg mx-auto p-6", className)}>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-indigo-100 dark:border-indigo-900/30 rounded-2xl shadow-xl p-6 space-y-6">

                {/* Header / Icon */}
                <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                        <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-center justify-center shadow-sm">
                            <CurrentIcon className={cn("w-8 h-8 transition-all duration-500", messages[phase]?.color || "text-indigo-600")} />
                        </div>
                    </div>

                    <div className="text-center space-y-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight transition-all duration-300">
                            {messages[phase]?.text}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {(progress >= 95 && isLoading) ? "Taking longer than expected..." : `${Math.floor(progress)}% Complete`}
                        </p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                </div>

                {/* Steps / Micro-indicators (Optional visual flair) */}
                <div className="flex justify-between px-1">
                    {[0, 20, 40, 60, 80].map((step, i) => (
                        <div key={step} className={cn(
                            "w-2 h-2 rounded-full transition-colors duration-500",
                            progress > step ? "bg-indigo-400 dark:bg-indigo-500" : "bg-slate-200 dark:bg-slate-700"
                        )} />
                    ))}
                </div>

            </div>

            {/* Footer text hint */}
            <p className="text-center text-xs text-slate-400 mt-4 animate-pulse">
                This process takes about 2 minutes to generate premium results.
            </p>
        </div>
    );
}
