import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { mainnet, sepolia, base, arbitrum, optimism, polygon, unichain } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'UniSignal',
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'demo',
  chains: [mainnet, base, arbitrum, optimism, polygon, unichain, sepolia],
  transports: {
    [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
    [base.id]: http('https://base-rpc.publicnode.com'),
    [arbitrum.id]: http('https://arbitrum-one-rpc.publicnode.com'),
    [optimism.id]: http('https://optimism-rpc.publicnode.com'),
    [polygon.id]: http('https://polygon-bor-rpc.publicnode.com'),
    [unichain.id]: http(),
    [sepolia.id]: http('https://ethereum-sepolia-rpc.publicnode.com'),
  },
  ssr: true,
});
