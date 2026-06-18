import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    MessageSquare, Zap, Bot, Layers, CheckCircle2,
    ArrowRight, ShieldCheck, Clock, TrendingUp, Users, Volume2, VolumeX
} from 'lucide-react';

const FADE_UP: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const STAGGER: any = {
    visible: { transition: { staggerChildren: 0.1 } }
};

export default function LandingPage() {
    const [isMuted, setIsMuted] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Sync volume and muted state when user toggles
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = 0.6;
        }
    }, [isMuted]);

    // Handle scroll-based playback
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch((err) => {
                                console.warn("Unmuted autoplay blocked natively. Falling back to muted visual loop:", err);
                                setIsMuted(true);
                                video.muted = true;
                                video.play().catch(e => console.error("Absolute playback failure", e));
                            });
                        }
                    } else {
                        video.pause();
                    }
                });
            },
            { threshold: 0.4 }
        );

        observer.observe(video);

        return () => {
            if (video) observer.unobserve(video);
            observer.disconnect();
        };
    }, []);

    const toggleMute = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    return (
        <div className="min-h-screen bg-slate-50 overflow-hidden font-sans selection:bg-brand-200">

            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-black/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/sociochat_logo.png" alt="SocioChat.ai" className="w-9 h-9 rounded-xl shadow-sm" />
                        <span className="text-xl font-bold text-[#0a6847]">
                            SocioChat<span className="text-brand-500">.ai</span>
                        </span>
                    </div>
                    <div className="flex gap-4 items-center">
                        <NavLink to="/login" className="text-sm font-medium hover:text-brand-600 transition-colors hidden sm:block">
                            Log In
                        </NavLink>
                        <NavLink
                            to="/signup"
                            className="px-5 py-2 text-sm font-medium rounded-full bg-brand-600 text-white hover:bg-brand-700 hover:shadow-lg hover:shadow-brand-500/20 transition-all active:scale-95"
                        >
                            Get Started
                        </NavLink>
                    </div>
                </div>
            </nav>

            <main className="pt-24 pb-20">

                {/* Hero Section */}
                <section className="relative max-w-7xl mx-auto px-6 pt-16 lg:pt-24 pb-16 text-center">
                    {/* Decorative blur elements */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-brand-300/30 rounded-full blur-3xl -z-10 pointer-events-none" />

                    <motion.div initial="hidden" animate="visible" variants={STAGGER} className="max-w-4xl mx-auto">
                        <motion.div variants={FADE_UP} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-sm font-medium mb-6">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500"></span>
                            </span>
                            The Ultimate WhatsApp Platform
                        </motion.div>

                        <motion.h1 variants={FADE_UP} className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1] px-2">
                            Solve your WhatsApp <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-[#0a6847]">
                                messaging chaos.
                            </span>
                        </motion.h1>

                        <motion.p variants={FADE_UP} className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                            Stop drowning in manual replies. Automate conversations, send personalized bulk messages, and reclaim your time. Lower your workload, multiply your sales.
                        </motion.p>

                        <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <NavLink
                                to="/signup"
                                className="group flex items-center justify-center gap-2 px-8 py-4 w-full sm:w-auto text-base font-semibold rounded-full bg-[#0a6847] text-white hover:bg-[#074b33] hover:shadow-xl hover:shadow-[#0a6847]/20 transition-all"
                            >
                                Start Free Trial
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </NavLink>
                            <a
                                href="#features"
                                className="flex items-center justify-center gap-2 px-8 py-4 w-full sm:w-auto text-base font-medium rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Explore Features
                            </a>
                        </motion.div>
                    </motion.div>

                    {/* Dashboard Preview Video */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="mt-20 relative mx-auto max-w-5xl group"
                    >
                        {/* Removed the large gradient overlay covering the whole component */}
                        <div className="rounded-2xl md:rounded-[2rem] p-2 bg-white/40 ring-1 ring-slate-900/5 backdrop-blur-xl shadow-2xl relative">
                            <div className="rounded-xl md:rounded-[1.5rem] overflow-hidden border border-slate-100 bg-slate-900 aspect-video relative flex items-center justify-center group/video cursor-pointer" onClick={toggleMute}>
                                <video
                                    ref={videoRef}
                                    src="/explainer_video.mp4"
                                    className="w-full h-full object-cover relative z-0"
                                    loop
                                    muted={isMuted}
                                    playsInline
                                >
                                    <track
                                        kind="captions"
                                        src="/captions.vtt"
                                        srcLang="en"
                                        label="English"
                                        default
                                    />
                                </video>

                                {/* Watermark fog overlay (bottom-right) */}
                                <div className="absolute bottom-[-20px] right-[-20px] w-[250px] h-[150px] bg-slate-900/100 blur-2xl z-10 pointer-events-none" />
                                <div className="absolute bottom-0 right-0 w-[80px] h-[50px] bg-gradient-to-tl from-slate-900 via-slate-900/100 to-transparent z-10 pointer-events-none" />

                                {/* Sound toggle overlay */}
                                <button
                                    onClick={toggleMute}
                                    className="absolute inset-0 m-auto w-20 h-20 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all shadow-2xl opacity-0 group-hover/video:opacity-100 focus:opacity-100 scale-90 group-hover/video:scale-100 z-20"
                                    aria-label="Toggle sound"
                                >
                                    {isMuted ? <VolumeX className="w-10 h-10" /> : <Volume2 className="w-10 h-10" />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* Pain Points / Solutions */}
                <section id="features" className="py-24 bg-white border-y border-slate-100">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="text-center max-w-3xl mx-auto mb-16">
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything you need to scale.</h2>
                            <p className="text-lg text-slate-600">
                                You invest heavily in marketing. Don't let leads slip away because you couldn't reply fast enough.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[
                                {
                                    icon: Bot,
                                    title: "Smart Automations",
                                    desc: "Build AI-powered chatbots and custom flows that answer FAQs and qualify leads 24/7 without human intervention.",
                                    color: "bg-blue-50 text-blue-600 border-blue-100"
                                },
                                {
                                    icon: Zap,
                                    title: "Bulk Messaging",
                                    desc: "Send personalized promos, updates, and newsletters to thousands of contacts instantly with 98% open rates.",
                                    color: "bg-brand-50 text-brand-600 border-brand-100"
                                },
                                {
                                    icon: Clock,
                                    title: "Reduce Workload",
                                    desc: "Free up your support team. Let our unified inbox and drip campaigns handle the routine follow-ups.",
                                    color: "bg-purple-50 text-purple-600 border-purple-100"
                                },
                                {
                                    icon: TrendingUp,
                                    title: "Maximize ROI",
                                    desc: "Every unseen lead is lost revenue. Boost conversions by meeting your customers exactly where they already are.",
                                    color: "bg-orange-50 text-orange-600 border-orange-100"
                                },
                                {
                                    icon: Users,
                                    title: "Audience Management",
                                    desc: "Import, tag, and segment your contacts perfectly so the right message always reaches the right person.",
                                    color: "bg-pink-50 text-pink-600 border-pink-100"
                                },
                                {
                                    icon: ShieldCheck,
                                    title: "Official API Access",
                                    desc: "Built on the official WhatsApp Cloud API. Secure, reliable, and compliant with Meta's messaging policies.",
                                    color: "bg-emerald-50 text-emerald-600 border-emerald-100"
                                }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border mb-6 ${feature.color}`}>
                                        <feature.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                    <p className="text-slate-600 leading-relaxed">
                                        {feature.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-24">
                    <div className="max-w-5xl mx-auto px-6">
                        <div className="relative rounded-[2.5rem] overflow-hidden bg-[#0a6847] p-10 md:p-16 text-center text-white">
                            {/* Abstract background shapes */}
                            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-brand-400 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
                            <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-96 h-96 bg-emerald-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>

                            <div className="relative z-10 max-w-3xl mx-auto">
                                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                                    Ready to transform your communication?
                                </h2>
                                <p className="text-emerald-100 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
                                    Join forward-thinking businesses who use SocioChat to automate conversations and drive massive growth.
                                </p>
                                <NavLink
                                    to="/signup"
                                    className="inline-flex items-center justify-center gap-2 px-10 py-5 text-lg font-bold rounded-full bg-white text-[#0a6847] hover:bg-slate-50 hover:scale-105 transition-all shadow-xl"
                                >
                                    Get Started Free
                                </NavLink>

                                <div className="mt-8 flex flex-wrap justify-center gap-6 text-emerald-100 text-sm font-medium">
                                    <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-brand-400" /> No credit card required</div>
                                    <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-brand-400" /> Instant Setup</div>
                                    <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-brand-400" /> 24/7 Automation</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </main>

            <footer className="bg-white border-t border-slate-100 py-12">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <img src="/sociochat_logo.png" alt="SocioChat.ai" className="w-8 h-8 rounded-lg grayscale" />
                        <span className="text-lg font-bold text-slate-400">SocioChat.ai</span>
                    </div>
                    <p className="text-sm text-slate-500">
                        © {new Date().getFullYear()} SocioChat.ai. All rights reserved. Built for WhatsApp Business.
                    </p>
                    <a href="/admin/login" className="text-xs text-slate-400 hover:text-emerald-600 transition-colors">
                        Admin Portal
                    </a>
                </div>
            </footer>
        </div>
    );
}
