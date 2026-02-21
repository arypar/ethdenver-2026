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
    setNotifications(prev => [{ ...n, read: false }, ...prev]);
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

export function useNotificationSync(actions: ActionItem[]) {
  const { addNotification } = useNotifications();
  const seenIds = useRef<Set<string>>(new Set());
  const initialised = useRef(false);

  useEffect(() => {
    if (actions.length === 0) return;

    if (!initialised.current) {
      for (const a of actions) seenIds.current.add(a.id);
      initialised.current = true;
      return;
    }

    for (const action of actions) {
      if (seenIds.current.has(action.id)) continue;
      seenIds.current.add(action.id);

      addNotification({
        id: action.id,
        ruleName: action.ruleName,
        message: action.suggestedAction,
        timestamp: action.timestamp,
      });

      toast(action.ruleName, {
        description: action.suggestedAction,
        duration: 5000,
      });
    }
  }, [actions, addNotification]);
}
