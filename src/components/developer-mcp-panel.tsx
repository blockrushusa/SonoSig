const MCP_TOOLS = [
  {
    name: "sonosig_encode_file",
    purpose:
      "Embeds an already-signed SonoSig proof payload into an audio file by appending a SONOSIG1 proof block.",
  },
  {
    name: "sonosig_verify_file",
    purpose:
      "Reads an embedded proof from a SonoSig file and validates the payload; WAV/AIFF files also get an audio-hash check.",
  },
  {
    name: "sonosig_submit_pacstac",
    purpose:
      "Registers a signed proof with PacStac using the server-side PACSTAC_API_KEY.",
  },
  {
    name: "sonosig_prepare_ens_record",
    purpose:
      "Builds the ENS text record: com.sonosig = pacstac:wallet:<wallet>.",
  },
  {
    name: "sonosig_submit_ens",
    purpose:
      "Writes the com.sonosig ENS text record when RPC and either SONOSIG_ENS_PRIVATE_KEY or BASE_X402_WALLET_PRIVATE_KEY are configured.",
  },
  {
    name: "sonosig_scan_website",
    purpose:
      "Crawls a public website, discovers audio files, verifies SonoSig proofs, and returns JSON/Markdown scan summaries.",
  },
];

const mcpConfig = `{
  "mcpServers": {
    "sonosig": {
      "command": "npm",
      "args": ["run", "mcp:stdio"],
      "cwd": "/Users/bruceseymour/Documents/code/sonosig"
    }
  }
}`;

export function DeveloperMcpPanel() {
  return (
    <section className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">
            MCP
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            Local stdio server
          </h2>
        </div>
        <code className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300">
          npm run mcp:stdio
        </code>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
          <p className="text-sm font-semibold text-zinc-200">
            Client configuration
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md border border-white/10 bg-black/40 p-4 text-xs leading-6 text-zinc-300">
            <code>{mcpConfig}</code>
          </pre>
        </div>

        <aside className="rounded-md border border-white/10 bg-zinc-950 p-4">
          <p className="text-sm font-semibold text-zinc-200">Environment</p>
          <div className="mt-4 grid gap-3 font-mono text-xs text-zinc-300">
            <span>PACSTAC_API_KEY</span>
            <span>PACSTAC_SONOSIG_CLAIMS_URL</span>
            <span>EVM_MULTI_CHAIN_RPC_URL</span>
            <span>ETHEREUM_RPC_URL</span>
            <span>ENS_SUBGRAPH_URL</span>
            <span>SONOSIG_ENS_PRIVATE_KEY</span>
            <span>BASE_X402_WALLET_PRIVATE_KEY</span>
            <span>BASE_X402_WALLET_PUBLIC_KEY</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-500">
            ENS submission requires a private key that controls or manages the
            ENS name. BASE_X402_WALLET_PUBLIC_KEY is checked against the private
            key when present. The MCP server loads .env.local, .evm.local, and
            .env. Agents must pass confirm=true before an onchain write is sent.
          </p>
        </aside>
      </div>

      <div className="mt-6 grid gap-3">
        {MCP_TOOLS.map((tool) => (
          <div
            className="grid gap-2 rounded-md border border-white/10 bg-zinc-950 px-4 py-3 md:grid-cols-[240px_minmax(0,1fr)]"
            key={tool.name}
          >
            <code className="font-mono text-sm text-cyan-200">
              {tool.name}
            </code>
            <p className="text-sm leading-6 text-zinc-300">{tool.purpose}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
