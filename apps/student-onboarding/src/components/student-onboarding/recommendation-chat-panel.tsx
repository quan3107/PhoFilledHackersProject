// apps/student-onboarding/src/components/student-onboarding/recommendation-chat-panel.tsx
// Results-stage assistant UI for follow-up questions about schools and ETEST guidance.
// Keeps transcript state client-side while routing each turn through the canonical backend.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bot, GraduationCap, Send } from "lucide-react";

import { SectionCard } from "../dashboard/primitives";

export interface RecommendationChatMessage {
  id: string;
  role: "assistant" | "student";
  text: string;
  createdAt: string;
}

export interface RecommendationChatTurnResult {
  assistantMessage: string;
  suggestedReplies: string[];
}

interface RecommendationChatPanelProps {
  sessionKey: string;
  recommendationRunId: string | null;
  onSubmitTurn: (
    message: string | null,
    recommendationRunId: string | null
  ) => Promise<RecommendationChatTurnResult>;
}

function createMessage(
  role: RecommendationChatMessage["role"],
  text: string
): RecommendationChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

export function RecommendationChatPanel({
  sessionKey,
  recommendationRunId,
  onSubmitTurn,
}: RecommendationChatPanelProps) {
  const [messages, setMessages] = useState<RecommendationChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]);
    setSuggestedReplies([]);
    setInputValue("");
    setErrorMessage(null);
    startedRef.current = false;
  }, [sessionKey]);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    setLoading(true);
    void onSubmitTurn(null, recommendationRunId)
      .then((result) => {
        setMessages([createMessage("assistant", result.assistantMessage)]);
        setSuggestedReplies(result.suggestedReplies);
      })
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to start the recommendations assistant."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [onSubmitTurn, recommendationRunId, sessionKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, messages]);

  const canSubmit = useMemo(
    () => inputValue.trim().length > 0 && !loading,
    [inputValue, loading]
  );

  async function submitTurn(message: string) {
    const trimmed = message.trim();
    if (!trimmed || loading) {
      return;
    }

    const nextStudentMessage = createMessage("student", trimmed);
    const historyWithStudent = [...messages, nextStudentMessage];

    setMessages(historyWithStudent);
    setInputValue("");
    setSuggestedReplies([]);
    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await onSubmitTurn(trimmed, recommendationRunId);
      setMessages((existing) => [
        ...existing,
        createMessage("assistant", result.assistantMessage),
      ]);
      setSuggestedReplies(result.suggestedReplies);
    } catch (error: unknown) {
      setMessages(messages);
      setInputValue(trimmed);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to continue the recommendations conversation."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Ask ETEST" icon={GraduationCap} className="h-full">
      <div className="flex h-full min-h-[34rem] flex-col">
        <div className="mb-3 rounded-[1.25rem] border border-border bg-[var(--surface-soft,#f4f7fb)] px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            Ask about fit, tradeoffs, shortlist logic, or what to do next.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This assistant is grounded in your saved profile and latest
            recommendation run.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[88%] gap-2 ${
                  message.role === "student" ? "flex-row-reverse" : ""
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                ) : null}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    message.role === "student"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted text-foreground"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            </div>
          ))}

          {errorMessage ? (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-2 pl-9">
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>

        {suggestedReplies.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestedReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => void submitTurn(reply)}
                disabled={loading}
                className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="mt-4 flex items-center gap-2 border-t border-border pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTurn(inputValue);
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask why a school fits, compare options, or ask what to do next."
            disabled={loading}
            className="flex-1 rounded-lg bg-[var(--input-background)] px-4 py-2.5 text-sm outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </SectionCard>
  );
}
