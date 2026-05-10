// apps/student-onboarding/src/components/student-onboarding/chat-assistant.tsx
// LLM-driven intake chat UI for the onboarding workspace.
// Keeps rendering client-side while routing each turn through the canonical backend.
"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, Compass, Send, SkipForward } from "lucide-react";

import { copy, type Locale } from "@/lib/onboarding-data";

export interface ChatAssistantState {
  conversationDone: boolean;
  progressCompletedCount?: number;
  progressTotalCount?: number;
  messages: Array<{
    id: string;
    role: "assistant" | "student";
    text: string;
    createdAt: string;
  }>;
  progress?: {
    resolvedFieldCount: number;
    totalFieldCount: number;
  } | null;
}

interface ChatAssistantProps {
  locale: Locale;
  userName: string;
  initialState?: ChatAssistantState | null;
  onSubmitTurn: (message: string | null) => Promise<ChatAssistantState>;
  onProgressChange: (current: number, total: number) => void;
  onFinished: () => void;
}

function getProgress(state: ChatAssistantState | null | undefined) {
  return {
    current:
      state?.progress?.resolvedFieldCount ?? state?.progressCompletedCount ?? 0,
    total: state?.progress?.totalFieldCount ?? state?.progressTotalCount ?? 26,
  };
}

export function ChatAssistant({
  locale,
  userName,
  initialState = null,
  onSubmitTurn,
  onProgressChange,
  onFinished,
}: ChatAssistantProps) {
  const text = copy[locale];
  const [sessionState, setSessionState] = useState<ChatAssistantState | null>(
    initialState
  );
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(!initialState?.messages.length);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(initialState?.messages.length ? true : false);
  const completedRef = useRef(initialState?.conversationDone ?? false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setSessionState(initialState);
    if (initialState?.messages.length) {
      startedRef.current = true;
    }
    if (initialState?.conversationDone) {
      completedRef.current = true;
    }
  }, [initialState]);

  useEffect(() => {
    const progress = getProgress(sessionState);
    onProgressChange(progress.current, progress.total);
  }, [onProgressChange, sessionState]);

  useEffect(() => {
    if (sessionState?.conversationDone && !completedRef.current) {
      completedRef.current = true;
      onFinished();
    }
  }, [onFinished, sessionState?.conversationDone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [isTyping, sessionState]);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    setIsTyping(true);
    void onSubmitTurn(null)
      .then((nextState) => {
        setSessionState(nextState);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to start the onboarding conversation."
        );
      })
      .finally(() => {
        setIsTyping(false);
      });
  }, [onSubmitTurn, userName]);

  async function submitTurn(message: string | null) {
    const trimmedMessage = message?.trim() ?? null;
    if (
      submittingRef.current ||
      isTyping ||
      sessionState?.conversationDone ||
      trimmedMessage === ""
    ) {
      return;
    }

    submittingRef.current = true;
    setIsTyping(true);
    setErrorMessage(null);
    setInputValue("");

    try {
      const nextState = await onSubmitTurn(trimmedMessage);
      setSessionState(nextState);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send that message."
      );
      if (trimmedMessage) {
        setInputValue(trimmedMessage);
      }
    } finally {
      submittingRef.current = false;
      setIsTyping(false);
    }
  }

  const messages = sessionState?.messages ?? [];
  const progress = getProgress(sessionState);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Compass className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm text-foreground">{text.chatTitle}</h3>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">
              {text.chatActive}
            </span>
          </div>
        </div>
        <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {progress.current}/{progress.total}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex max-w-[85%] gap-2 ${
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

          {isTyping ? (
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
      </div>

      <div className="border-t border-border bg-card p-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTurn(inputValue.trim());
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={
              sessionState?.conversationDone
                ? text.chatComplete
                : text.chatPlaceholder
            }
            disabled={sessionState?.conversationDone || isTyping}
            className="flex-1 rounded-lg bg-[var(--input-background)] px-4 py-2.5 text-sm outline-none disabled:opacity-50"
          />
          {!sessionState?.conversationDone ? (
            <button
              type="button"
              onClick={() =>
                void submitTurn("I prefer not to answer this question.")
              }
              className="flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" />
              {text.chatSkip}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={
              !inputValue.trim() || sessionState?.conversationDone || isTyping
            }
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
