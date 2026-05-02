#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const EXPECTED_TOOLS = [
  "sonosig_encode_file",
  "sonosig_verify_file",
  "sonosig_submit_pacstac",
  "sonosig_prepare_ens_record",
  "sonosig_submit_ens",
  "sonosig_scan_website",
];

const TEST_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

async function main() {
  const client = new Client({
    name: "sonosig-mcp-smoke-test",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    args: ["scripts/sonosig-mcp-server.mjs"],
    command: process.execPath,
    cwd: process.cwd(),
    stderr: "pipe",
  });
  const stderrLines = [];

  transport.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();

    if (text) {
      stderrLines.push(text);
    }
  });

  try {
    await client.connect(transport);

    const serverVersion = client.getServerVersion();
    console.log(
      `Connected to MCP server: ${serverVersion?.name ?? "unknown"} ${serverVersion?.version ?? ""}`.trim(),
    );

    const toolsResponse = await client.listTools();
    const toolNames = toolsResponse.tools.map((tool) => tool.name).sort();
    const missingTools = EXPECTED_TOOLS.filter(
      (toolName) => !toolNames.includes(toolName),
    );

    console.log(`Tools advertised: ${toolNames.length}`);
    for (const toolName of toolNames) {
      console.log(`- ${toolName}`);
    }

    if (missingTools.length) {
      throw new Error(`Missing expected MCP tools: ${missingTools.join(", ")}`);
    }

    const prepareResult = await client.callTool({
      arguments: { wallet: TEST_WALLET },
      name: "sonosig_prepare_ens_record",
    });
    const parsedPrepareResult = parseJsonToolResult(prepareResult);
    const expectedValue = `pacstac:wallet:${TEST_WALLET.toLowerCase()}`;

    if (parsedPrepareResult.key !== "com.sonosig") {
      throw new Error(
        `Unexpected ENS key: ${String(parsedPrepareResult.key)}`,
      );
    }

    if (parsedPrepareResult.value !== expectedValue) {
      throw new Error(
        `Unexpected ENS value: ${String(parsedPrepareResult.value)}`,
      );
    }

    console.log("Harmless tool call passed:");
    console.log(
      JSON.stringify(
        {
          key: parsedPrepareResult.key,
          value: parsedPrepareResult.value,
        },
        null,
        2,
      ),
    );
    console.log("MCP smoke test passed.");
  } finally {
    await client.close();

    if (stderrLines.length) {
      console.error("\nMCP server stderr:");
      for (const line of stderrLines) {
        console.error(line);
      }
    }
  }
}

function parseJsonToolResult(result) {
  if (result.isError) {
    throw new Error(`Tool returned MCP error: ${JSON.stringify(result)}`);
  }

  const textContent = result.content?.find((item) => item.type === "text");

  if (!textContent?.text) {
    throw new Error(`Tool did not return text content: ${JSON.stringify(result)}`);
  }

  return JSON.parse(textContent.text);
}

main().catch((error) => {
  console.error("MCP smoke test failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
