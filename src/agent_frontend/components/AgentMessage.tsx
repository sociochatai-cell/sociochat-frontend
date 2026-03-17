/**
 * AgentMessage — renders different message types from the agent.
 *
 * Types: text, list, confirmation, navigation, data card.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import type { AgentMessage as AgentMessageType } from '../agentStore';
import { useAgentStore } from '../agentStore';

interface Props {
  message: AgentMessageType;
}

/** Render markdown-like bold **text** */
function renderMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function renderLines(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={i}>
      {renderMarkdown(line)}
      {i < text.split('\n').length - 1 && <br />}
    </span>
  ));
}

const AgentMessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';
  const confirmAction = useAgentStore((s) => s.confirmAction);
  const cancelAction = useAgentStore((s) => s.cancelAction);
  const navigateTo = useAgentStore((s) => s.navigateTo);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-md'
            : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
        }`}
      >
        {/* Message text */}
        <div className="whitespace-pre-wrap">{renderLines(message.text)}</div>

        {/* Data list */}
        {message.ui_action === 'show_list' && Array.isArray(message.data) && message.data.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.data.slice(0, 10).map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 text-xs"
              >
                <span className="text-gray-500">{idx + 1}.</span>
                <span className="font-medium truncate">{item.name || item.verified_name || JSON.stringify(item)}</span>
                {item.status && (
                  <span className="ml-auto text-gray-400">{item.status}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Confirmation buttons */}
        {message.status === 'confirmation_required' && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={confirmAction}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Yes, proceed
            </button>
            <button
              onClick={cancelAction}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        )}

        {/* Navigate link */}
        {message.navigate_to && message.ui_action === 'navigate' && (
          <button
            onClick={() => navigateTo && navigateTo(message.navigate_to!)}
            className="mt-2 inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 text-xs font-medium"
          >
            Go to page <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] mt-1 ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </motion.div>
  );
};

/** Loading dots */
export const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex justify-start mb-3"
  >
    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
        <span className="text-xs text-gray-400">Thinking...</span>
      </div>
    </div>
  </motion.div>
);

export default AgentMessageBubble;
