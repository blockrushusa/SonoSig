"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type ChatMessage = {
  content: string;
  role: "assistant" | "user";
  sources?: string[];
};

const starterPrompts = [
  "What does SonoSig prove?",
  "How do PacStac and ENS work together?",
  "How do I verify an encoded audio file?",
];

const initialMessage: ChatMessage = {
  role: "assistant",
  content:
    "Ask me about SonoSig, audio provenance, wallet signing, verification, PacStac, ENS, transactions, or developer setup.",
};

export function SupportChatbot({
  className = "",
  compact = false,
  eyebrow = "Support assistant",
  showInitialMessage = true,
  title = "Ask about SonoSig",
}: {
  className?: string;
  compact?: boolean;
  eyebrow?: string;
  showInitialMessage?: boolean;
  title?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    showInitialMessage ? [initialMessage] : [],
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = useMemo(
    () => input.trim().length > 0 && !isSending,
    [input, isSending],
  );

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isSending) {
      return;
    }

    setError(null);
    setInput("");
    setIsSending(true);

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);

    try {
      const response = await fetch("/api/support/chat", {
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            content: message.content,
            role: message.role,
          })),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        sources?: string[];
      };

      if (!response.ok) {
        throw new Error(data.error || "Support chat is unavailable.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content:
            data.answer ||
            "I could not find a confident answer in the support materials.",
          sources: data.sources,
        },
      ]);
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Support chat is unavailable.";
      setError(message);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content:
            "I could not answer that right now. You can still use the site navigation or contact support with the details of what you need.",
        },
      ]);
    } finally {
      setIsSending(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section
      aria-label="SonoSig support chatbot"
      className={`overflow-hidden rounded-lg border border-cyan-300/20 bg-[#11161d] shadow-2xl shadow-black/30 ${className}`}
    >
      <div className="border-b border-white/10 bg-cyan-300/5 px-5 py-4">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-xl font-semibold text-white">
          {title}
        </h2>
      </div>

      <div
        className={`space-y-4 overflow-y-auto px-5 py-5 ${
          compact ? "max-h-[360px]" : "max-h-[520px]"
        }`}
      >
        {messages.map((message, index) => (
          <div
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
            key={`${message.role}-${index}`}
          >
            <div
              className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "bg-cyan-300 text-zinc-950"
                  : "border border-white/10 bg-zinc-950 text-zinc-200"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.sources?.length ? (
                <p className="mt-3 border-t border-white/10 pt-2 text-xs text-zinc-400">
                  Sources: {message.sources.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        ))}
        {isSending ? (
          <div className="flex justify-start">
            <div className="rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
              Checking SonoSig support materials...
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <button
              className="rounded-md border border-white/10 px-3 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSending}
              key={prompt}
              onClick={() => void sendMessage(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form className="grid gap-3" onSubmit={handleSubmit}>
          <textarea
            className="min-h-24 resize-none rounded-lg border border-white/10 bg-zinc-950 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/60"
            maxLength={1200}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question about SonoSig, PacStac, ENS, verification, or support..."
            ref={inputRef}
            value={input}
          />
          <div className="flex items-center justify-between gap-3">
            <span aria-hidden="true" />
            <button
              className="rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmit}
              type="submit"
            >
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
        {error ? (
          <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
