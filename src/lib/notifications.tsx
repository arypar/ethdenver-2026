'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type { ActionItem } from './types';

export interface Notification {
  id: string;
  ruleName: string;
  message: string;
  triggerReason: string;
  pool: string;
  conditions: string[];
  timestamp: number;
  read: boolean;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((n: Omit<Notification, 'read'>) => {
    setNotifications(prev => {
      if (prev.some(existing => existing.id === n.id)) return prev;
      return [{ ...n, read: false }, ...prev];
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markRead, markAllRead, dismiss, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

const NOTIFY_MAX_AGE_MS = 60_000;
const TOAST_MAX_AGE_MS = 15_000;

export function useNotificationSync(actions: ActionItem[]) {
  const { addNotification } = useNotifications();
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const action of actions) {
      if (seenIds.current.has(action.id)) continue;
      seenIds.current.add(action.id);

      const ageMs = Date.now() - action.timestamp;
      if (ageMs > NOTIFY_MAX_AGE_MS) continue;

      addNotification({
        id: action.id,
        ruleName: action.ruleName,
        message: action.suggestedAction,
        triggerReason: action.triggerReason,
        pool: action.details?.pool ?? '',
        conditions: action.details?.conditionsMet ?? [],
        timestamp: action.timestamp,
      });

      if (ageMs < TOAST_MAX_AGE_MS) {
        toast(action.ruleName, {
          description: `${action.triggerReason} — ${action.suggestedAction}`,
          duration: 5000,
        });
      }
    }
  }, [actions, addNotification]);
}
