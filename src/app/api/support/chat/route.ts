const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1200;

type ChatMessage = {
  content: string;
  role: "assistant" | "user";
};

const SUPPORT_INSTRUCTIONS = `
You are the SonoSig website support assistant for new visitors.

Answer questions about SonoSig, website navigation, audio provenance, wallet signing,
verification, ENS, PacStac integration, x402/API concepts, transactions, and support
next steps. Use the attached file search vector store when available.

Core facts:
- SonoSig is an agent-accessible identity and trust system for media, starting with audio.
- Creators can encode a proof into an audio file, sign the proof with a wallet, verify it later,
  and optionally register discovery signals with PacStac and ENS.
- PacStac registration makes signed claims discoverable and indexable for agents/apps.
- ENS can publish a pointer to a SonoSig/PacStac claim under a creator-controlled ENS name.
- SonoSig verifies technical provenance signals. It does not prove legal copyright ownership,
  settle ownership disputes, recover wallets, reverse blockchain transactions, or delete public
  on-chain/third-party records.
- The Create page is for encoding/signing, Verify is for checking files, Transactions is for
  web3/PacStac history, Developer has API/encoding docs, and Support is for help.

Safety and support rules:
- Never ask for seed phrases, private keys, passwords, or full payment card numbers.
- Do not provide legal advice or state that a claim proves copyright ownership.
- If the answer is not in the SonoSig materials or these instructions, say you are not sure and
  suggest contacting support through the site.
- Keep answers concise, practical, and friendly. Prefer 2-5 short paragraphs or bullets.
- Include links only when useful. For PacStac, use:
  https://pacstac.com/?utm_source=sonosig&utm_medium=chatbot&utm_campaign=audio_provenance
`.trim();

function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== "object") {
        return false;
      }

      const candidate = message as Partial<ChatMessage>;
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }));
}

function extractOutputText(responseBody: unknown): string {
  if (!responseBody || typeof responseBody !== "object") {
    return "";
  }

  const body = responseBody as {
    output?: Array<{
      content?: Array<{
        output_text?: string;
        text?: string;
      }>;
    }>;
    output_text?: string;
  };

  if (typeof body.output_text === "string") {
    return body.output_text.trim();
  }

  const chunks: string[] = [];
  for (const outputItem of body.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (typeof contentItem.output_text === "string") {
        chunks.push(contentItem.output_text);
      } else if (typeof contentItem.text === "string") {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractSources(responseBody: unknown): string[] {
  if (!responseBody || typeof responseBody !== "object") {
    return [];
  }

  const body = responseBody as {
    output?: Array<{
      results?: Array<{
        file_name?: string;
        filename?: string;
      }>;
      type?: string;
    }>;
  };

  const sources = new Set<string>();
  for (const outputItem of body.output ?? []) {
    if (outputItem.type !== "file_search_call") {
      continue;
    }

    for (const result of outputItem.results ?? []) {
      const source = result.file_name ?? result.filename;
      if (source) {
        sources.add(source);
      }
    }
  }

  return Array.from(sources).slice(0, 4);
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID?.trim();

  if (!apiKey || !vectorStoreId) {
    return Response.json(
      {
        error:
          "SonoSig support chat is not configured. Missing OpenAI API key or vector store.",
      },
      { status: 503 },
    );
  }

  let payload: { messages?: unknown };
  try {
    payload = (await request.json()) as { messages?: unknown };
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const messages = sanitizeMessages(payload.messages);
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return Response.json({ error: "Ask a question to start." }, { status: 400 });
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    body: JSON.stringify({
      include: ["file_search_call.results"],
      input: messages.map((message) => ({
        content: message.content,
        role: message.role,
      })),
      instructions: SUPPORT_INSTRUCTIONS,
      max_output_tokens: 700,
      model: process.env.OPENAI_SUPPORT_MODEL?.trim() || "gpt-5.4-mini",
      tools: [
        {
          max_num_results: 8,
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        },
      ],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const responseBody = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      responseBody && typeof responseBody === "object" && "error" in responseBody
        ? "OpenAI could not answer that request right now."
        : "SonoSig support chat is temporarily unavailable.";

    return Response.json({ error: message }, { status: response.status });
  }

  const answer = extractOutputText(responseBody);

  return Response.json({
    answer:
      answer ||
      "I could not find a confident answer in the SonoSig support materials. Please contact support through the site with your question.",
    sources: extractSources(responseBody),
  });
}
