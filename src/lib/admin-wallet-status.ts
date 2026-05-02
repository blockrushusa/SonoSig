import "server-only";

import {
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

type WalletConfig = {
  id: string;
  label: string;
  privateKeyEnv: string;
  publicAddressEnv?: string;
};

type RpcCandidate = {
  fallback: boolean;
  source: string;
  url: string;
};

export type WalletBalance = {
  chain: string;
  native: {
    amount: string | null;
    symbol: string;
  };
  rpcFallback: boolean;
  rpcSource: string | null;
  usdc: {
    amount: string | null;
    symbol: "USDC";
  };
  error: string | null;
};

export type AdminWallet = {
  id: string;
  label: string;
  address: Address | null;
  addressSource: string | null;
  configuredPublicAddress: Address | null;
  configuredPublicAddressEnv: string | null;
  configuredPublicAddressMatches: boolean | null;
  privateKeyConfigured: boolean;
  privateKeyEnv: string;
  balances: WalletBalance[];
  notices: string[];
};

export const ADMIN_WALLETS: WalletConfig[] = [
  {
    id: "base-x402",
    label: "Base x402 wallet",
    privateKeyEnv: "BASE_X402_WALLET_PRIVATE_KEY",
    publicAddressEnv: "BASE_X402_WALLET_PUBLIC_KEY",
  },
  {
    id: "sonosig-ens",
    label: "SonoSig ENS writer",
    privateKeyEnv: "SONOSIG_ENS_PRIVATE_KEY",
  },
];

const BASE_MAINNET_PUBLIC_RPC_URL = "https://mainnet.base.org";

const CHAINS = [
  {
    fallbackRpcUrls: [
      {
        label: "Base public fallback RPC",
        url: BASE_MAINNET_PUBLIC_RPC_URL,
      },
    ],
    id: "base",
    label: "Base",
    nativeSymbol: "ETH",
    rpcEnvNames: ["BASE_RPC_URL", "EVM_MULTI_CHAIN_RPC_URL"],
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  },
  {
    fallbackRpcUrls: [],
    id: "ethereum",
    label: "Ethereum",
    nativeSymbol: "ETH",
    rpcEnvNames: ["ETHEREUM_RPC_URL"],
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
  },
];

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export async function getAdminWallets() {
  return await Promise.all(ADMIN_WALLETS.map(getAdminWalletSafe));
}

export async function getAdminWalletById(id: string) {
  const config = ADMIN_WALLETS.find((wallet) => wallet.id === id);

  return config ? await getAdminWalletSafe(config) : null;
}

export function getPrivateKeyFromEnv(envName: string) {
  return normalizePrivateKey(process.env[envName]);
}

async function getAdminWalletSafe(config: WalletConfig): Promise<AdminWallet> {
  try {
    return await getAdminWallet(config);
  } catch (error) {
    console.error(`[admin-wallets] ${config.id} failed.`, error);

    return {
      id: config.id,
      label: config.label,
      address: null,
      addressSource: null,
      configuredPublicAddress: getConfiguredAddress(config.publicAddressEnv),
      configuredPublicAddressEnv: config.publicAddressEnv ?? null,
      configuredPublicAddressMatches: null,
      privateKeyConfigured: Boolean(process.env[config.privateKeyEnv]?.trim()),
      privateKeyEnv: config.privateKeyEnv,
      balances: [],
      notices: ["This wallet slot could not be inspected by the server."],
    };
  }
}

async function getAdminWallet(config: WalletConfig): Promise<AdminWallet> {
  const privateKey = normalizePrivateKey(process.env[config.privateKeyEnv]);
  const configuredPublicAddress = getConfiguredAddress(config.publicAddressEnv);
  const notices: string[] = [];
  let address: Address | null = null;
  let addressSource: string | null = null;

  if (privateKey) {
    try {
      address = privateKeyToAccount(privateKey).address;
      addressSource = config.privateKeyEnv;
    } catch {
      notices.push(`${config.privateKeyEnv} is configured but is not a valid EVM private key.`);
    }
  }

  if (!address && configuredPublicAddress) {
    address = configuredPublicAddress;
    addressSource = config.publicAddressEnv ?? null;
  }

  if (!privateKey && !configuredPublicAddress) {
    notices.push("No wallet value is configured for this slot.");
  }

  let configuredPublicAddressMatches: boolean | null = null;

  if (address && configuredPublicAddress) {
    configuredPublicAddressMatches =
      address.toLowerCase() === configuredPublicAddress.toLowerCase();
  }

  if (address && configuredPublicAddressMatches === false) {
    notices.push(
      `${config.publicAddressEnv} does not match the address derived from ${config.privateKeyEnv}.`,
    );
  }

  const balances = address ? await getBalances(address) : [];

  return {
    id: config.id,
    label: config.label,
    address,
    addressSource,
    configuredPublicAddress,
    configuredPublicAddressEnv: config.publicAddressEnv ?? null,
    configuredPublicAddressMatches,
    privateKeyConfigured: Boolean(privateKey),
    privateKeyEnv: config.privateKeyEnv,
    balances,
    notices,
  };
}

async function getBalances(address: Address): Promise<WalletBalance[]> {
  const chainsWithRpcCandidates = CHAINS.map((chain) => ({
    chain,
    rpcCandidates: getRpcCandidates(chain),
  }));
  const activeChains = chainsWithRpcCandidates.filter(
    ({ rpcCandidates }) => rpcCandidates.length > 0,
  );

  if (activeChains.length === 0) {
    return [
      {
        chain: "Base",
        native: { amount: null, symbol: "ETH" },
        rpcFallback: false,
        rpcSource: null,
        usdc: { amount: null, symbol: "USDC" },
        error: "No EVM RPC URL is configured.",
      },
    ];
  }

  return Promise.all(
    activeChains.map(async ({ chain, rpcCandidates }) => {
      if (!rpcCandidates.length) {
        return {
          chain: chain.label,
          native: { amount: null, symbol: chain.nativeSymbol },
          rpcFallback: false,
          rpcSource: null,
          usdc: { amount: null, symbol: "USDC" },
          error: "RPC URL is not configured.",
        };
      }

      for (const rpcCandidate of rpcCandidates) {
        try {
          const client = createPublicClient({
            transport: http(rpcCandidate.url),
          });
          const [nativeBalance, usdcBalance] = await Promise.all([
            client.getBalance({ address }),
            client.readContract({
              abi: ERC20_BALANCE_ABI,
              address: chain.usdcAddress,
              args: [address],
              functionName: "balanceOf",
            }),
          ]);

          return {
            chain: chain.label,
            native: {
              amount: formatUnits(nativeBalance, 18),
              symbol: chain.nativeSymbol,
            },
            rpcFallback: rpcCandidate.fallback,
            rpcSource: rpcCandidate.source,
            usdc: {
              amount: formatUnits(usdcBalance, 6),
              symbol: "USDC",
            },
            error: null,
          };
        } catch {
          continue;
        }
      }

      return {
        chain: chain.label,
        native: { amount: null, symbol: chain.nativeSymbol },
        rpcFallback: false,
        rpcSource: rpcCandidates.map((candidate) => candidate.source).join(", "),
        usdc: { amount: null, symbol: "USDC" },
        error: rpcCandidates.some((candidate) => candidate.fallback)
          ? "Unable to read balances from configured RPC endpoints or the Base public fallback RPC."
          : "Unable to read balances from the configured RPC endpoint.",
      };
    }),
  );
}

function getConfiguredAddress(envName: string | undefined) {
  if (!envName) {
    return null;
  }

  const value = stripEnvQuotes(process.env[envName]?.trim());

  return value && isAddress(value) ? value : null;
}

function getRpcCandidates(chain: (typeof CHAINS)[number]): RpcCandidate[] {
  const candidates: RpcCandidate[] = [];

  for (const envName of chain.rpcEnvNames) {
    const value = stripEnvQuotes(process.env[envName]?.trim());

    if (value) {
      candidates.push({
        fallback: false,
        source: envName,
        url: value,
      });
    }
  }

  for (const fallbackRpcUrl of chain.fallbackRpcUrls) {
    candidates.push({
      fallback: true,
      source: fallbackRpcUrl.label,
      url: fallbackRpcUrl.url,
    });
  }

  return candidates;
}

function normalizePrivateKey(value: string | undefined) {
  const trimmed = stripEnvQuotes(value?.trim());

  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("0x")
    ? (trimmed as `0x${string}`)
    : (`0x${trimmed}` as `0x${string}`);
}

function stripEnvQuotes(value: string | undefined) {
  if (!value) {
    return value;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}
