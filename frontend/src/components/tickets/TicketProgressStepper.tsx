import { IconCheck } from "@tabler/icons-react";
import { cn } from "../../lib/cn";
import type { Ticket } from "../../types/tickets";

type TicketStepState = "done" | "active" | "waiting" | "danger";

type TicketStep = {
  key: string;
  label: string;
  state: TicketStepState;
};

type TicketProgressStepperProps = {
  ticket: Ticket;
  compact?: boolean;
  className?: string;
};

function getTicketSteps(ticket: Ticket): TicketStep[] {
  const isRejected = ticket.approval_status === "rejected";
  const isPendingApproval = ticket.approval_status === "pending";
  const isApproved = ticket.approval_status === "approved";
  const isNoApproval = ticket.approval_status === "not_required";
  const isDone = ticket.status === "resolved" || ticket.status === "closed";

  const isItStage =
    !isPendingApproval &&
    !isRejected &&
    (ticket.status === "open" || ticket.status === "in_progress");

  const steps: TicketStep[] = [
    {
      key: "submitted",
      label: "Gönderildi",
      state: "done",
    },
  ];

  if (!isNoApproval) {
    steps.push({
      key: "approval",
      label: isRejected ? "Onaylanmadı" : "Onay",
      state: isRejected
        ? "danger"
        : isPendingApproval
          ? "active"
          : isApproved
            ? "done"
            : "waiting",
    });
  }

  steps.push({
    key: "it",
    label: "IT’de",
    state: isDone ? "done" : isItStage ? "active" : "waiting",
  });

  steps.push({
    key: "done",
    label: "Çözüldü",
    state: isDone ? "done" : "waiting",
  });

  return steps;
}

function getStepCircleClass(state: TicketStepState) {
  if (state === "done") {
    return "border-success/40 bg-success/10 text-success";
  }

  if (state === "active") {
    return "border-accent/40 bg-accent/10 text-accent";
  }

  if (state === "danger") {
    return "border-danger/40 bg-danger/10 text-danger";
  }

  return "border-border bg-surface-2 text-text-secondary";
}

function getStepLabelClass(state: TicketStepState) {
  if (state === "done") {
    return "text-success";
  }

  if (state === "active") {
    return "font-semibold text-accent";
  }

  if (state === "danger") {
    return "font-semibold text-danger";
  }

  return "text-text-secondary";
}

export function TicketProgressStepper({
  ticket,
  compact = true,
  className,
}: TicketProgressStepperProps) {
  const steps = getTicketSteps(ticket);

  return (
    <div className={cn(compact ? "mt-md" : "mt-sm", className)}>
      <div className="flex items-center gap-xs">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <div key={step.key} className="flex min-w-0 flex-1 items-center">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl border font-semibold shadow-sm",
                  compact
                    ? "h-8 w-8 text-[11px]"
                    : "h-9 w-9 text-caption",
                  getStepCircleClass(step.state)
                )}
              >
                {step.state === "done" ? (
                  <IconCheck size={compact ? 15 : 16} aria-hidden={true} />
                ) : (
                  index + 1
                )}
              </div>

              {!isLast ? (
                <div
                  className={cn(
                    "mx-xs h-[2px] flex-1 rounded-full",
                    step.state === "done" ? "bg-success/40" : "bg-border"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-xs grid gap-xs text-text-secondary",
          compact ? "text-[10px]" : "text-caption"
        )}
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step) => (
          <span
            key={step.key}
            className={cn("truncate", getStepLabelClass(step.state))}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}