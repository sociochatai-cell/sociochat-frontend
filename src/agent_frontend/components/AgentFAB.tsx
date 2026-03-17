/**
 * AgentFAB — Floating Action Button to open/close the agent panel.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronLeft } from 'lucide-react';
import { useAgentStore } from '../agentStore';

const AgentFAB: React.FC = () => {
  const { isOpen, toggle } = useAgentStore();

  return (
    <motion.button
      onClick={toggle}
      className="fixed right-0 top-3/4 -translate-y-1/2 z-50 flex items-center justify-center pl-3 pr-2 py-4 rounded-l-2xl shadow-xl focus:outline-none border-y border-l border-emerald-400/30"
      style={{
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      }}
      whileHover={{ scale: 1.05, x: -4 }}
      whileTap={{ scale: 0.95 }}
      title={isOpen ? 'Close Agent' : 'Open AI Agent (Ctrl+K)'}
    >
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-5 h-5 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ x: 10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 10, opacity: 0 }}
              className="flex flex-col items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4 text-emerald-200 animate-pulse" />
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pulse animation when closed */}
      {!isOpen && (
        <span className="absolute inset-0 rounded-l-2xl animate-pulse bg-emerald-400/20 pointer-events-none" />
      )}
    </motion.button>
  );
};

export default AgentFAB;
