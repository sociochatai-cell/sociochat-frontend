/**
 * QuickActions — suggestion chips shown when chat is empty.
 */

import React from 'react';
import { useAgentStore } from '../agentStore';

interface QuickAction {
  emoji: string;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { emoji: '📊', label: 'Show analytics', prompt: 'Show analytics summary' },
  { emoji: '📝', label: 'Create template', prompt: 'Create a new template' },
  { emoji: '🎯', label: 'New drip campaign', prompt: 'Create a drip campaign' },
  { emoji: '📨', label: 'Send bulk message', prompt: 'Create bulk campaign' },
  { emoji: '⚙️', label: 'Setup welcome message', prompt: 'Setup a welcome message' },
  { emoji: '📱', label: 'Account info', prompt: 'Show my account details' },
];

const QuickActions: React.FC = () => {
  const sendMessage = useAgentStore((s) => s.sendMessage);

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-gray-400 mb-2 font-medium">Quick actions</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa.prompt}
            onClick={() => sendMessage(qa.prompt)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700
              border border-gray-200 hover:border-emerald-200
              transition-colors duration-150"
          >
            <span>{qa.emoji}</span>
            <span>{qa.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;
