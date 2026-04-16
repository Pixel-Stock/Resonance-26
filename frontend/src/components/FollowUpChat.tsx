"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Loader2, Bot, User } from "lucide-react";
import type { Anomaly, AIBriefing } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SUGGESTED = [
  "Which user is most at risk?",
  "Was root actually compromised?",
  "Which IP is the biggest threat?",
  "What should I do first?",
  "Is the attacker still active?",
];

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface FollowUpChatProps {
  anomalies: Anomaly[];
  briefing: AIBriefing | null;
}

export function FollowUpChat({ anomalies, briefing }: FollowUpChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    if (!question.trim() || streaming) return;
    const q = question.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setStreaming(true);

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: "assistant", text: "" }]);

    try {
      const resp = await fetch(`${API_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          anomalies,
          question: q,
          briefing: briefing ?? {},
        }),
        signal: abort.signal,
      });

      if (!resp.ok || !resp.body) throw new Error(`Server error ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", evType = "", evData = "";

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) { evType = line.slice(7).trim(); evData = ""; }
          else if (line.startsWith("data: ")) { evData += line.slice(6); }
          else if (line.trim() === "" && evType) {
            if (evType === "answer_chunk" && evData) {
              const chunk = evData;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  text: updated[updated.length - 1].text + chunk,
                };
                return updated;
              });
            } else if (evType === "answer_done") {
              break outer;
            }
            evType = ""; evData = "";
          }
        }
      }
      reader.cancel().catch(() => {});
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", text: "Could not reach the backend. Is it running on port 8000?" };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 22, delay: 0.15 }}
      className="glass"
      style={{ padding: "1.25rem" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 mb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.35)" }}>
        <MessageCircle className="w-4 h-4 text-violet-500" />
        <h2 className="text-sm uppercase font-semibold tracking-wider" style={{ color: "#1e293b" }}>
          Ask the SOC AI
        </h2>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}
        >
          Groq · llama-3.3-70b
        </span>
      </div>

      {/* Suggested questions (shown when no messages yet) */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED.map(q => (
            <button
              key={q}
              onClick={() => ask(q)}
              disabled={streaming}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(124,58,237,0.07)",
                border: "1px solid rgba(124,58,237,0.2)",
                color: "#7c3aed",
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div
          className="flex flex-col gap-3 mb-3 max-h-[280px] overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                {/* Avatar */}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: msg.role === "assistant"
                    ? "linear-gradient(135deg, #a78bfa, #7c3aed)"
                    : "rgba(255,255,255,0.2)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}>
                  {msg.role === "assistant"
                    ? <Bot className="w-3 h-3 text-white" />
                    : <User className="w-3 h-3" style={{ color: "#64748b" }} />
                  }
                </div>

                {/* Bubble */}
                <div style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: msg.role === "assistant" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                  background: msg.role === "assistant"
                    ? "rgba(124,58,237,0.06)"
                    : "rgba(255,255,255,0.12)",
                  border: msg.role === "assistant"
                    ? "1px solid rgba(124,58,237,0.15)"
                    : "1px solid rgba(255,255,255,0.25)",
                  fontSize: 12,
                  lineHeight: 1.65,
                  color: "#334155",
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.text || (streaming && i === messages.length - 1
                    ? <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8" }}>
                        <Loader2 className="w-3 h-3 animate-spin" /> thinking…
                      </span>
                    : ""
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); ask(input); }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about the attack…"
          disabled={streaming}
          style={{
            flex: 1,
            padding: "8px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.12)",
            color: "#e2e8f0",
            fontSize: "0.8rem",
            fontFamily: "var(--font-sans)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          style={{
            padding: "8px 14px",
            borderRadius: 10,
            border: "none",
            background: input.trim() && !streaming ? "linear-gradient(135deg,#a78bfa,#7c3aed)" : "rgba(255,255,255,0.1)",
            color: input.trim() && !streaming ? "white" : "#94a3b8",
            cursor: input.trim() && !streaming ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </motion.div>
  );
}
