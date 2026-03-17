/**
 * AgentChatPanel — main floating chat panel (bottom-right).
 *
 * Features:
 * - Opens/closes with FAB or Ctrl+K
 * - Chat history with scroll-to-bottom
 * - Quick action chips when empty
 * - Spring animation transitions
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Trash2, Sparkles } from 'lucide-react';
import { useAgentStore } from '../agentStore';
import AgentMessageBubble, { TypingIndicator } from './AgentMessage';
import QuickActions from './QuickActions';
import AgentFAB from './AgentFAB';

const AgentChatPanel: React.FC = () => {
  const {
    isOpen, messages, isLoading, sendMessage, clearChat, toggle,
  } = useAgentStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = React.useState('');

  // Keyboard shortcut: Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    setInputValue('');
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <AgentFAB />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed right-6 top-[15%] bottom-[15%] z-50 w-[400px] flex flex-col rounded-3xl shadow-2xl border border-gray-200 overflow-hidden"
            style={{ background: '#fafbfc' }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-2 px-4 py-3 border-b border-gray-100"
              style={{
                background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
              }}
            >
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-800">SocioChat Agent</h3>
                <p className="text-[10px] text-gray-500">Ask me anything about your workspace</p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
              {messages.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <Sparkles className="w-10 h-10 text-emerald-300 mb-3" />
                  <p className="text-sm text-gray-500 text-center mb-4">
                    Hi! I can help you manage templates, campaigns, automation, and more.
                  </p>
                  <QuickActions />
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <AgentMessageBubble key={msg.id} message={msg} />
                  ))}
                  {isLoading && <TypingIndicator />}
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 px-3 py-2.5 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 text-sm px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-300 placeholder:text-gray-400"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isLoading}
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 text-center">
                Press <kbd className="px-1 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px]">Ctrl+K</kbd> to toggle
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AgentChatPanel;
