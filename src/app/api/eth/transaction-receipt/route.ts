export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_ETHEREUM_RPC_URLS = [
  "https://ethereum-rpc.publicnode.com",
  "https://cloudflare-eth.com",
];

type JsonRpcReceipt = {
  blockHash?: string;
  blockNumber?: string;
  status?: string;
  transactionHash?: string;
};

type ReceiptResult = {
  blockNumber?: number;
  hash: string;
  source?: string;
  status: "confirmed" | "failed" | "submitted";
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get("hash")?.trim() ?? "";

  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return Response.json(
      { error: "Valid transaction hash is required." },
      { status: 400 },
    );
  }

  const rpcUrls = getEthereumRpcUrls();
  let lastError = "Unable to check transaction receipt.";

  for (const rpcUrl of rpcUrls) {
    try {
      const result = await getTransactionReceipt(rpcUrl, hash);

      if (result) {
        return Response.json(result);
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  return Response.json(
    {
      error: lastError,
      hash,
      status: "submitted",
    },
    { status: 202 },
  );
}

function getEthereumRpcUrls() {
  return Array.from(
    new Set(
      [
        process.env.ETHEREUM_RPC_URL?.trim(),
        process.env.EVM_MULTI_CHAIN_RPC_URL?.trim(),
        ...PUBLIC_ETHEREUM_RPC_URLS,
      ].filter((rpcUrl): rpcUrl is string => Boolean(rpcUrl)),
    ),
  );
}

async function getTransactionReceipt(
  rpcUrl: string,
  hash: string,
): Promise<ReceiptResult | null> {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getTransactionReceipt",
      params: [hash],
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Ethereum RPC returned ${response.status}.`);
  }

  const body = (await response.json()) as {
    error?: { message?: string };
    result?: JsonRpcReceipt | null;
  };

  if (body.error) {
    throw new Error(body.error.message ?? "Ethereum RPC returned an error.");
  }

  if (!body.result) {
    return null;
  }

  return {
    blockNumber: parseHexNumber(body.result.blockNumber),
    hash: body.result.transactionHash ?? hash,
    source: getRpcHost(rpcUrl),
    status: body.result.status === "0x1" ? "confirmed" : "failed",
  };
}

function parseHexNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 16);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getRpcHost(rpcUrl: string) {
  try {
    return new URL(rpcUrl).host;
  } catch {
    return "configured RPC";
  }
}
