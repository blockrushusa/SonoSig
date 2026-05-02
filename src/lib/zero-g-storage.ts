import "server-only";

import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";

const DEFAULT_ZEROG_RPC_URL = "https://evmrpc-testnet.0g.ai";
const DEFAULT_ZEROG_INDEXER_RPC =
  "https://indexer-storage-testnet-turbo.0g.ai";
const DEFAULT_ZEROG_NETWORK = "0G Galileo Testnet";

type ZeroGUploadResponse =
  | {
      rootHash: string;
      txHash: string;
      txSeq?: number;
    }
  | {
      rootHashes: string[];
      txHashes: string[];
      txSeqs?: number[];
    };

export type ZeroGStorageReceipt = {
  indexerRpc: string;
  network: string;
  rootHash?: string;
  rootHashes?: string[];
  transactionHash?: string;
  transactionHashes?: string[];
  uploadedAt: string;
};

export function getZeroGStorageStatus() {
  return {
    configured: isZeroGStorageConfigured(),
    indexerRpc: getZeroGIndexerRpc(),
    network: getZeroGNetwork(),
    rpcUrl: getZeroGRpcUrl(),
  };
}

export function isZeroGStorageConfigured() {
  return Boolean(process.env.ZEROG_STORAGE_PRIVATE_KEY?.trim());
}

export async function uploadSonoSigReceiptToZeroG(
  receipt: Record<string, unknown>,
): Promise<ZeroGStorageReceipt> {
  const privateKey = process.env.ZEROG_STORAGE_PRIVATE_KEY?.trim();

  if (!privateKey) {
    throw new Error("ZEROG_STORAGE_PRIVATE_KEY is not configured.");
  }

  const rpcUrl = getZeroGRpcUrl();
  const indexerRpc = getZeroGIndexerRpc();
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const indexer = new Indexer(indexerRpc);
  const payload = {
    ...receipt,
    format: "sonosig.registration.receipt.v1",
    uploadedAt: new Date().toISOString(),
  };
  const data = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  const memData = new MemData(data);
  const [tree, treeError] = await memData.merkleTree();

  if (treeError !== null) {
    throw new Error(`0G receipt Merkle tree failed: ${treeError.message}`);
  }

  const [upload, uploadError] = (await indexer.upload(
    memData,
    rpcUrl,
    signer,
    {
      tags: new TextEncoder().encode("sonosig"),
    },
  )) as [ZeroGUploadResponse, Error | null];

  if (uploadError !== null) {
    throw new Error(`0G receipt upload failed: ${uploadError.message}`);
  }

  const uploadedAt =
    typeof payload.uploadedAt === "string"
      ? payload.uploadedAt
      : new Date().toISOString();

  if ("rootHash" in upload) {
    return {
      indexerRpc,
      network: getZeroGNetwork(),
      rootHash: upload.rootHash || tree?.rootHash() || "",
      transactionHash: upload.txHash,
      uploadedAt,
    };
  }

  return {
    indexerRpc,
    network: getZeroGNetwork(),
    rootHashes: upload.rootHashes,
    transactionHashes: upload.txHashes,
    uploadedAt,
  };
}

function getZeroGRpcUrl() {
  return process.env.ZEROG_STORAGE_RPC_URL?.trim() || DEFAULT_ZEROG_RPC_URL;
}

function getZeroGIndexerRpc() {
  return (
    process.env.ZEROG_STORAGE_INDEXER_RPC?.trim() ||
    DEFAULT_ZEROG_INDEXER_RPC
  );
}

function getZeroGNetwork() {
  return process.env.ZEROG_STORAGE_NETWORK?.trim() || DEFAULT_ZEROG_NETWORK;
}
