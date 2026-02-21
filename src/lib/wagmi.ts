import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'UniSignal',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo',
  chains: [mainnet],
  transports: {
    [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
  },
  ssr: true,
});
