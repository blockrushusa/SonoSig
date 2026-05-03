"use client";

import "@rainbow-me/rainbowkit/styles.css";

import {
  darkTheme,
  getDefaultConfig,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { base, mainnet, sepolia } from "wagmi/chains";
import { WagmiProvider } from "wagmi";
import { defineChain, http } from "viem";
import { useState, type ReactNode } from "react";

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID";

export const zeroGGalileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "0G",
    symbol: "0G",
  },
  rpcUrls: {
    default: {
      http: ["https://evmrpc-testnet.0g.ai"],
    },
  },
  blockExplorers: {
    default: {
      name: "0G Galileo ChainScan",
      url: "https://chainscan-galileo.0g.ai",
    },
  },
  iconBackground: "#070A0F",
  iconUrl: "/0g-network.svg",
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: "Sonosig",
  appDescription: "Audio signature verification onchain",
  appUrl: "https://sonosig.com",
  projectId,
  chains: [mainnet, base, sepolia, zeroGGalileo],
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
    [zeroGGalileo.id]: http(),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
