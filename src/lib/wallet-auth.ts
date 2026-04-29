import { getAddress, isAddress } from "viem";

export const WALLET_LOGIN_STATEMENT =
  "Sign in to SonoSig with your Ethereum wallet.";

export type WalletLoginFields = {
  address: string;
  chainId: number;
  domain: string;
  issuedAt: string;
  nonce: string;
  uri: string;
};

export function createWalletLoginNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildWalletLoginMessage(fields: WalletLoginFields) {
  const address = isAddress(fields.address)
    ? getAddress(fields.address)
    : fields.address;

  return `${fields.domain} wants you to sign in with your Ethereum account:
${address}

${WALLET_LOGIN_STATEMENT}

URI: ${fields.uri}
Version: 1
Chain ID: ${fields.chainId}
Nonce: ${fields.nonce}
Issued At: ${fields.issuedAt}`;
}

export function parseWalletLoginMessage(message: string): WalletLoginFields {
  const lines = message.split(/\r?\n/);
  const domainMatch = lines[0]?.match(/^(.+) wants you to sign in with your Ethereum account:$/);
  const address = lines[1]?.trim();

  if (!domainMatch || !address || !isAddress(address)) {
    throw new Error("Invalid wallet login message.");
  }

  const fields = new Map<string, string>();

  for (const line of lines.slice(4)) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    fields.set(
      line.slice(0, separatorIndex).trim(),
      line.slice(separatorIndex + 1).trim(),
    );
  }

  const chainId = Number(fields.get("Chain ID"));
  const issuedAt = fields.get("Issued At") ?? "";
  const nonce = fields.get("Nonce") ?? "";
  const uri = fields.get("URI") ?? "";

  if (
    !Number.isInteger(chainId) ||
    chainId <= 0 ||
    !issuedAt ||
    !nonce.match(/^[a-f0-9]{32}$/) ||
    !uri
  ) {
    throw new Error("Invalid wallet login message fields.");
  }

  return {
    address: getAddress(address),
    chainId,
    domain: domainMatch[1],
    issuedAt,
    nonce,
    uri,
  };
}

export function getWalletLoginUid(address: string) {
  return `wallet:${getAddress(address).toLowerCase()}`;
}

export function getWalletDisplayName(address: string) {
  const checksum = getAddress(address);

  return `Wallet ${checksum.slice(0, 6)}...${checksum.slice(-4)}`;
}
