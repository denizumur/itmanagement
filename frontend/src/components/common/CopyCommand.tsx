import { IconCheck, IconCopy, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { cn } from "../../lib/cn";

interface CopyCommandProps {
  label: string;
  command: string;
  description?: string;
  testId?: string;
}

type CopyState = "idle" | "copied" | "failed";

export function CopyCommand({
  label,
  command,
  description,
  testId,
}: CopyCommandProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }

    window.setTimeout(() => setCopyState("idle"), 2400);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-sm">
      <div className="mb-xs flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="text-caption font-semibold text-text-primary">{label}</p>
          {description ? (
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={copyCommand}
          data-testid={testId}
          className="inline-flex h-8 shrink-0 items-center gap-xs rounded-lg border border-border bg-surface-1 px-sm text-[11px] font-semibold text-text-secondary transition duration-150 hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
        >
          {copyState === "copied" ? (
            <IconCheck size={14} aria-hidden={true} />
          ) : copyState === "failed" ? (
            <IconX size={14} aria-hidden={true} />
          ) : (
            <IconCopy size={14} aria-hidden={true} />
          )}
          {copyState === "copied"
            ? "Kopyalandı"
            : copyState === "failed"
              ? "Kopyalanamadı"
              : "Kopyala"}
        </button>
      </div>

      <code
        className={cn(
          "block select-all overflow-x-auto rounded-lg border border-border/70 bg-surface-1 px-sm py-xs text-[11px] leading-5 text-text-primary",
          copyState === "failed" && "border-warning/40"
        )}
      >
        {command}
      </code>

      {copyState === "failed" ? (
        <p className="mt-xs text-[11px] text-warning">
          Kopyalanamadı, komutu elle seçebilirsiniz.
        </p>
      ) : null}
    </div>
  );
}
