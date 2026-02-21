import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { defineChain } from 'viem';

export const monad = defineChain({
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://monadscan.com' },
  },
});

export const config = getDefaultConfig({
  appName: 'Chaintology',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo',
  chains: [mainnet, monad],
  transports: {
    [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
    [monad.id]: http('https://rpc.monad.xyz'),
  },
  ssr: true,
});
