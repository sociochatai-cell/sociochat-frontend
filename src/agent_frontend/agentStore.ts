/**
 * Agent Store — Zustand state management for the AI agent.
 * =========================================================
 */

import { create } from 'zustand';
import { agentApi, type AgentResponse } from './agentApi';

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  timestamp: number;
  status?: AgentResponse['status'];
  data?: any;
  navigate_to?: string;
  ui_action?: string;
}

interface AgentState {
  // UI
  isOpen: boolean;
  isLoading: boolean;

  // Session
  sessionId: string | null;
  messages: AgentMessage[];

  // Pending confirmation
  pendingAction: AgentResponse | null;

  // Navigation callback (set by DashboardLayout)
  navigateTo: ((path: string) => void) | null;

  // Actions
  toggle: () => void;
  open: () => void;
  close: () => void;
  setNavigate: (fn: (path: string) => void) => void;
  sendMessage: (text: string) => Promise<void>;
  confirmAction: () => Promise<void>;
  cancelAction: () => Promise<void>;
  clearChat: () => void;
}

let msgCounter = 0;
const nextId = () => `msg_${Date.now()}_${++msgCounter}`;

export const useAgentStore = create<AgentState>((set, get) => ({
  isOpen: false,
  isLoading: false,
  sessionId: null,
  messages: [],
  pendingAction: null,
  navigateTo: null,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setNavigate: (fn) => set({ navigateTo: fn }),

  sendMessage: async (text: string) => {
    const userMsg: AgentMessage = {
      id: nextId(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      isLoading: true,
      pendingAction: null,
    }));

    try {
      const res = await agentApi.chat(text, get().sessionId || undefined);

      const agentMsg: AgentMessage = {
        id: nextId(),
        role: 'agent',
        text: res.message,
        timestamp: Date.now(),
        status: res.status,
        data: res.data,
        navigate_to: res.navigate_to,
        ui_action: res.ui_action,
      };

      set((s) => ({
        messages: [...s.messages, agentMsg],
        sessionId: res.session_id || s.sessionId,
        isLoading: false,
        pendingAction: res.status === 'confirmation_required' ? res : null,
      }));

      // Auto-navigate
      if (res.navigate_to && res.ui_action === 'navigate') {
        const nav = get().navigateTo;
        if (nav) {
          setTimeout(() => nav(res.navigate_to!), 800);
        }
      }
    } catch (err: any) {
      const errorMsg: AgentMessage = {
        id: nextId(),
        role: 'agent',
        text: err?.message || 'Something went wrong. Please try again.',
        timestamp: Date.now(),
        status: 'error',
      };
      set((s) => ({
        messages: [...s.messages, errorMsg],
        isLoading: false,
      }));
    }
  },

  confirmAction: async () => {
    await get().sendMessage('yes');
  },

  cancelAction: async () => {
    set({ pendingAction: null });
    await get().sendMessage('cancel');
  },

  clearChat: () => {
    const sid = get().sessionId;
    if (sid) {
      agentApi.clearSession(sid).catch(() => {});
    }
    set({
      messages: [],
      sessionId: null,
      pendingAction: null,
    });
  },
}));

export default useAgentStore;
