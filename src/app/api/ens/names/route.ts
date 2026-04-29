import { isAddress } from "viem";

export const dynamic = "force-dynamic";

const DEFAULT_ENS_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/ensdomains/ens";

const ENS_NAMES_QUERY = `
  query SonoSigEnsNames($account: String!, $now: BigInt!) {
    account(id: $account) {
      domains(first: 50, orderBy: name, orderDirection: asc) {
        name
      }
      registrations(
        first: 50
        orderBy: expiryDate
        orderDirection: desc
        where: { expiryDate_gt: $now }
      ) {
        domain {
          name
        }
      }
      wrappedDomains(first: 50, orderBy: name, orderDirection: asc) {
        name
      }
    }
  }
`;

type EnsSubgraphNameNode = {
  name?: string | null;
};

type EnsSubgraphRegistration = {
  domain?: EnsSubgraphNameNode | null;
};

type EnsSubgraphResponse = {
  data?: {
    account?: {
      domains?: EnsSubgraphNameNode[];
      registrations?: EnsSubgraphRegistration[];
      wrappedDomains?: EnsSubgraphNameNode[];
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");

  if (!address || !isAddress(address)) {
    return Response.json({ error: "Valid address is required." }, { status: 400 });
  }

  const subgraphUrl = process.env.ENS_SUBGRAPH_URL ?? DEFAULT_ENS_SUBGRAPH_URL;
  const account = address.toLowerCase();

  try {
    const response = await fetch(subgraphUrl, {
      body: JSON.stringify({
        query: ENS_NAMES_QUERY,
        variables: {
          account,
          now: Math.floor(Date.now() / 1000).toString(),
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return Response.json(
        { error: "Unable to load ENS names." },
        { status: response.status },
      );
    }

    const result = (await response.json()) as EnsSubgraphResponse;

    if (result.errors?.length) {
      return Response.json(
        { error: result.errors[0]?.message ?? "Unable to load ENS names." },
        { status: 502 },
      );
    }

    const accountData = result.data?.account;
    const names = new Set<string>();

    for (const domain of accountData?.domains ?? []) {
      addEnsName(names, domain.name);
    }

    for (const registration of accountData?.registrations ?? []) {
      addEnsName(names, registration.domain?.name);
    }

    for (const wrappedDomain of accountData?.wrappedDomains ?? []) {
      addEnsName(names, wrappedDomain.name);
    }

    return Response.json({ names: Array.from(names).sort() });
  } catch {
    return Response.json(
      { error: "Unable to load ENS names." },
      { status: 502 },
    );
  }
}

function addEnsName(names: Set<string>, name: string | null | undefined) {
  const value = name?.trim();

  if (!value || !value.endsWith(".eth") || value.includes(".addr.reverse")) {
    return;
  }

  names.add(value);
}
