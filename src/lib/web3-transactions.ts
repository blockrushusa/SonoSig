export type Web3TransactionStatus = "confirmed" | "failed" | "submitted";

export type Web3Transaction = {
  chainId?: number;
  claimId?: string;
  createdAt: string;
  ensName?: string;
  error?: string;
  hash?: string;
  id: string;
  idempotent?: boolean;
  indexerRpc?: string;
  namespace?: string;
  network: string;
  proofAudioHash?: string;
  registrationStatus?: string;
  rootHash?: string;
  rootHashes?: string[];
  status: Web3TransactionStatus;
  title: string;
  transactionHashes?: string[];
  type: "ens-text-record" | "pacstac-registration" | "zero-g-storage";
  updatedAt: string;
  wallet?: string;
};

const WEB3_TRANSACTIONS_KEY = "sonosig:web3-transactions";
export const WEB3_TRANSACTIONS_EVENT = "sonosig:web3-transactions-updated";

export function getWeb3Transactions() {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(WEB3_TRANSACTIONS_KEY);

  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed.filter(isWeb3Transaction)
      : [];
  } catch {
    return [];
  }
}

export function upsertWeb3Transaction(transaction: Web3Transaction) {
  if (typeof window === "undefined") {
    return;
  }

  const transactions = getWeb3Transactions();
  const existingIndex = transactions.findIndex(
    (storedTransaction) => storedTransaction.id === transaction.id,
  );

  if (existingIndex >= 0) {
    transactions[existingIndex] = transaction;
  } else {
    transactions.unshift(transaction);
  }

  window.localStorage.setItem(
    WEB3_TRANSACTIONS_KEY,
    JSON.stringify(transactions.slice(0, 100)),
  );
  window.dispatchEvent(new Event(WEB3_TRANSACTIONS_EVENT));
}

export function updateWeb3Transaction(
  id: string,
  update: Partial<Omit<Web3Transaction, "id">>,
) {
  if (typeof window === "undefined") {
    return;
  }

  const transactions = getWeb3Transactions();
  const existingTransaction = transactions.find(
    (transaction) => transaction.id === id,
  );

  if (!existingTransaction) {
    return;
  }

  upsertWeb3Transaction({
    ...existingTransaction,
    ...update,
    updatedAt: new Date().toISOString(),
  });
}

export function createWeb3TransactionId(hash: string) {
  return `web3:${hash.toLowerCase()}`;
}

export function createPacStacRegistrationTransactionId(parameters: {
  claimId?: string;
  proofAudioHash?: string;
}) {
  if (parameters.claimId) {
    return `pacstac:${parameters.claimId}`;
  }

  return `pacstac:${parameters.proofAudioHash ?? "unknown"}`;
}

export function createZeroGStorageTransactionId(parameters: {
  proofAudioHash?: string;
  rootHash?: string;
  transactionHash?: string;
}) {
  if (parameters.rootHash) {
    return `zerog:${parameters.rootHash}`;
  }

  if (parameters.transactionHash) {
    return `zerog:${parameters.transactionHash.toLowerCase()}`;
  }

  return `zerog:${parameters.proofAudioHash ?? "unknown"}`;
}

export function upsertPacStacRegistrationTransaction(parameters: {
  claimId?: string;
  createdAt?: string;
  idempotent?: boolean;
  namespace?: string;
  proofAudioHash?: string;
  registrationStatus?: string;
  wallet?: string;
}) {
  const now = new Date().toISOString();

  upsertWeb3Transaction({
    claimId: parameters.claimId,
    createdAt: parameters.createdAt ?? now,
    id: createPacStacRegistrationTransactionId({
      claimId: parameters.claimId,
      proofAudioHash: parameters.proofAudioHash,
    }),
    idempotent: parameters.idempotent,
    namespace: parameters.namespace,
    network: "PacStac",
    proofAudioHash: parameters.proofAudioHash,
    registrationStatus: parameters.registrationStatus,
    status: "confirmed",
    title: "PacStac claim registration",
    type: "pacstac-registration",
    updatedAt: now,
    wallet: parameters.wallet,
  });
}

export function upsertZeroGStorageTransaction(parameters: {
  claimId?: string;
  createdAt?: string;
  hash?: string;
  indexerRpc?: string;
  network?: string;
  proofAudioHash?: string;
  rootHash?: string;
  rootHashes?: string[];
  transactionHashes?: string[];
  wallet?: string;
}) {
  const now = new Date().toISOString();

  upsertWeb3Transaction({
    claimId: parameters.claimId,
    createdAt: parameters.createdAt ?? now,
    hash: parameters.hash,
    id: createZeroGStorageTransactionId({
      proofAudioHash: parameters.proofAudioHash,
      rootHash: parameters.rootHash,
      transactionHash: parameters.hash,
    }),
    indexerRpc: parameters.indexerRpc,
    network: parameters.network ?? "0G Storage",
    proofAudioHash: parameters.proofAudioHash,
    rootHash: parameters.rootHash,
    rootHashes: parameters.rootHashes,
    status: "confirmed",
    title: "0G Storage receipt upload",
    transactionHashes: parameters.transactionHashes,
    type: "zero-g-storage",
    updatedAt: now,
    wallet: parameters.wallet,
  });
}

function isWeb3Transaction(value: unknown): value is Web3Transaction {
  if (!value || typeof value !== "object") {
    return false;
  }

  const transaction = value as Partial<Web3Transaction>;

  return (
    typeof transaction.id === "string" &&
    typeof transaction.title === "string" &&
    typeof transaction.createdAt === "string" &&
    typeof transaction.updatedAt === "string" &&
    (transaction.type === "ens-text-record" ||
      transaction.type === "pacstac-registration" ||
      transaction.type === "zero-g-storage") &&
    (transaction.type !== "ens-text-record" ||
      typeof transaction.hash === "string") &&
    (transaction.status === "submitted" ||
      transaction.status === "confirmed" ||
      transaction.status === "failed")
  );
}
