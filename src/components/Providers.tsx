'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { Toaster } from 'sonner';
import { config } from '@/lib/wagmi';
import { NotificationProvider } from '@/lib/notifications';
import { useState, type ReactNode } from 'react';

import '@rainbow-me/rainbowkit/styles.css';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#FF007A',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
        >
          <NotificationProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: 'rgba(12, 12, 20, 0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#E2E2EA',
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
                descriptionClassName: 'text-white/50',
                className: 'font-sans',
              }}
            />
          </NotificationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
