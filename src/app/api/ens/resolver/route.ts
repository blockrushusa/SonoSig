import { isAddress } from "viem";
import { normalize } from "viem/ens";

export const dynamic = "force-dynamic";

const DEFAULT_ENS_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/ensdomains/ens";

const ENS_RESOLVER_QUERY = `
  query SonoSigEnsResolver($name: String!) {
    domains(first: 1, where: { name: $name }) {
      resolver {
        address
      }
    }
  }
`;

type EnsResolverResponse = {
  data?: {
    domains?: Array<{
      resolver?: {
        address?: string | null;
      } | null;
    }>;
  };
  errors?: Array<{ message?: string }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawName = url.searchParams.get("name");
  let name = "";

  try {
    name = rawName ? normalize(rawName) : "";
  } catch {
    return Response.json({ error: "Valid ENS name is required." }, { status: 400 });
  }

  if (!name) {
    return Response.json({ error: "Valid ENS name is required." }, { status: 400 });
  }

  const subgraphUrls = Array.from(
    new Set([
      process.env.ENS_SUBGRAPH_URL ?? DEFAULT_ENS_SUBGRAPH_URL,
      DEFAULT_ENS_SUBGRAPH_URL,
    ]),
  );

  try {
    const result = await queryEnsResolver(subgraphUrls, name);
    const resolver = result.data?.domains?.[0]?.resolver?.address;

    if (!resolver || !isAddress(resolver)) {
      return Response.json(
        { error: "This ENS name has no resolver configured." },
        { status: 404 },
      );
    }

    return Response.json({ resolver });
  } catch {
    return Response.json(
      { error: "Unable to load ENS resolver." },
      { status: 502 },
    );
  }
}

async function queryEnsResolver(subgraphUrls: string[], name: string) {
  let lastError = "Unable to load ENS resolver.";

  for (const subgraphUrl of subgraphUrls) {
    const response = await fetch(subgraphUrl, {
      body: JSON.stringify({
        query: ENS_RESOLVER_QUERY,
        variables: { name },
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      lastError = `ENS resolver upstream returned ${response.status}.`;
      continue;
    }

    const result = (await response.json()) as EnsResolverResponse;

    if (result.errors?.length) {
      lastError = result.errors[0]?.message ?? lastError;
      continue;
    }

    return result;
  }

  throw new Error(lastError);
}
