'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, dismiss, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] backdrop-blur-xl transition-all hover:bg-white/[0.1] hover:border-white/[0.16]"
      >
        <Bell className="h-4 w-4 text-white/60" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white"
            style={{ boxShadow: '0 0 8px rgba(255,0,122,0.5)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/[0.08] bg-[#0c0c14]/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="text-[13px] font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] font-medium text-white/30 hover:text-white/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="h-5 w-5 text-white/15 mb-2" />
                <p className="text-[12px] text-white/30">No notifications yet</p>
              </div>
            ) : (
              <div className="p-1.5">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-white/[0.04]',
                      !n.read && 'bg-white/[0.02]',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        n.read
                          ? 'bg-white/10'
                          : 'bg-primary shadow-[0_0_6px_rgba(255,0,122,0.5)]',
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-white/80 truncate">
                          {n.ruleName}
                        </span>
                        <span className="text-[10px] text-white/25 shrink-0">
                          {timeAgo(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 truncate mt-0.5">{n.message}</p>
                    </div>
                    <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
                          title="Mark read"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => dismiss(n.id)}
                        className="flex h-5 w-5 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.06]"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
