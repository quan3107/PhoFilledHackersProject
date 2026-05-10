// Chat intake and live-summary panel for the onboarding experience.
// This is the visible entry surface for the local assistant flow.
"use client";

import {
  ArrowRight,
  CheckCircle2,
  MessagesSquare,
  Sparkles,
  UserRound,
} from "lucide-react";

import { MetricCard, Pill, SectionCard } from "../dashboard/primitives";
import {
  type StudentOnboardingDocument,
  type StudentOnboardingMissingField,
  type StudentOnboardingSummary,
} from "./student-onboarding-model";

type ChatMessage = Readonly<{
  id: string;
  role: "assistant" | "student";
  text: string;
}>;

type ChatPanelProps = Readonly<{
  viewerName: string;
  viewerEmail: string;
  document: StudentOnboardingDocument;
  summary: StudentOnboardingSummary;
  messages: ChatMessage[];
  draft: string;
  missingFields: StudentOnboardingMissingField[];
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (value: string) => void;
  onViewerNameChange: (value: string) => void;
}>;

const quickPrompts = [
  "My name is Alex and I plan for fall 2027.",
  "My current GPA is 3.8 and I want projected GPA 96.",
  "I want to major in computer science, economics.",
  "My budget is $45,000 and I need financial aid.",
  "I will submit SAT scores and teacher recommendations are ready.",
];

export function StudentOnboardingChatPanel({
  viewerName,
  viewerEmail,
  summary,
  messages,
  draft,
  missingFields,
  onDraftChange,
  onSend,
  onQuickAction,
  onViewerNameChange,
}: ChatPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
      <SectionCard title="Intake chat" icon={MessagesSquare} className="h-full">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Field label="Display name">
              <input
                value={viewerName}
                onChange={(event) => onViewerNameChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none ring-0 transition focus:border-primary"
              />
            </Field>
            <Field label="Email">
              <input
                value={viewerEmail}
                readOnly
                className="h-11 w-full rounded-xl border border-border bg-muted px-3.5 text-sm text-muted-foreground outline-none"
              />
            </Field>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-[var(--surface-soft,#f4f7fb)] p-3">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Live intake transcript
                </p>
                <p className="text-xs text-muted-foreground">
                  Use quick prompts or type a request below.
                </p>
              </div>
              <Pill className="bg-primary/10 text-primary">
                {summary.completion}% ready
              </Pill>
            </div>

            <div className="mt-3 max-h-[18rem] space-y-3 overflow-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === "student"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-white text-foreground shadow-sm"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                rows={3}
                placeholder="Tell the assistant what to change in your profile."
                className="min-h-[5.5rem] flex-1 resize-none rounded-2xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="button"
                onClick={onSend}
                className="inline-flex h-[5.5rem] items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onQuickAction(prompt)}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Missing fields"
              value={String(summary.missingCount)}
            />
            <MetricCard
              label="Current gaps"
              value={String(summary.currentMissingCount)}
            />
            <MetricCard
              label="Projected gaps"
              value={String(summary.projectedMissingCount)}
            />
          </div>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Live profile" icon={Sparkles}>
          <SummaryList
            title="Current snapshot"
            items={summary.currentHighlights}
          />
          <SummaryList
            title="Projected snapshot"
            items={summary.projectedHighlights}
            className="mt-5"
          />
        </SectionCard>

        <SectionCard title="Missing fields" icon={CheckCircle2}>
          <div className="space-y-2">
            {missingFields.slice(0, 8).map((field) => (
              <MissingFieldRow
                key={`${field.snapshotKind}-${field.path}`}
                field={field}
              />
            ))}
            {missingFields.length > 8 ? (
              <p className="pt-2 text-xs text-muted-foreground">
                {missingFields.length - 8} more fields remain outside the
                current view.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Snapshot notes" icon={UserRound}>
          <div className="space-y-3">
            <NoteBlock
              title="Current assumptions"
              value={summary.nextSteps[0] ?? "Not set"}
            />
            <NoteBlock
              title="Projected assumptions"
              value={summary.nextSteps[1] ?? "Not set"}
            />
            <NoteBlock
              title="School control"
              value={summary.nextSteps[2] ?? "Not set"}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryList({
  title,
  items,
  className = "",
}: Readonly<{
  title: string;
  items: Array<{
    label: string;
    value: string;
    tone?: "neutral" | "warning" | "success";
  }>;
  className?: string;
}>) {
  return (
    <div className={className}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-white px-3.5 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {item.label}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {item.value}
                </p>
              </div>
              {item.tone ? (
                <Pill className={toneClass(item.tone)}>{item.tone}</Pill>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingFieldRow({
  field,
}: Readonly<{
  field: StudentOnboardingMissingField;
}>) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-white px-3 py-2.5">
      <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{field.message}</p>
        <p className="text-xs text-muted-foreground">
          {field.snapshotKind} / {field.path}
        </p>
      </div>
    </div>
  );
}

function NoteBlock({
  title,
  value,
}: Readonly<{
  title: string;
  value: string;
}>) {
  return (
    <div className="rounded-2xl border border-border bg-white px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-1.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

function toneClass(tone: "neutral" | "warning" | "success") {
  if (tone === "success") return "bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "bg-amber-50 text-amber-700";
  return "bg-muted text-foreground";
}
