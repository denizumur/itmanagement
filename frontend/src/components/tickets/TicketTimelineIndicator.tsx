import {
  IconCheck,
  IconClock,
  IconMinus,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import type { MouseEvent } from "react";
import { Skeleton } from "../common/Skeleton";
import { useTicketTimeline } from "../../hooks/useTickets";
import { cn } from "../../lib/cn";
import { PopupPanel, usePopup } from "../../lib/popupManager";
import type {
  TicketTimelineStage,
  TicketTimelineStageName,
  TicketTimelineStageState,
} from "../../types/tickets";

interface TicketTimelineIndicatorProps {
  ticketId: number;
  ticketTitle?: string;
  className?: string;
}

interface TicketTimelinePopupProps {
  ticketId: number;
  ticketTitle?: string;
  onClose: () => void;
}

type StateVisual = {
  label: string;
  circleClassName: string;
  badgeClassName: string;
  connectorClassName: string;
};

const stageTypeLabel: Record<TicketTimelineStageName, string> = {
  created: "Açılış",
  approval: "Onay",
  it_review: "IT İnceleme",
  resolved: "Çözüm",
};

const stateVisuals: Record<TicketTimelineStageState, StateVisual> = {
  done: {
    label: "Tamamlandı",
    circleClassName: "border-success/40 bg-success/10 text-success",
    badgeClassName: "border-success/30 bg-success/10 text-success",
    connectorClassName: "bg-success/40",
  },
  approved: {
    label: "Onaylandı",
    circleClassName: "border-success/40 bg-success/10 text-success",
    badgeClassName: "border-success/30 bg-success/10 text-success",
    connectorClassName: "bg-success/40",
  },
  resolved: {
    label: "Çözüldü",
    circleClassName: "border-success/40 bg-success/10 text-success",
    badgeClassName: "border-success/30 bg-success/10 text-success",
    connectorClassName: "bg-success/40",
  },
  rejected: {
    label: "Reddedildi",
    circleClassName: "border-danger/40 bg-danger/10 text-danger",
    badgeClassName: "border-danger/30 bg-danger/10 text-danger",
    connectorClassName: "bg-danger/30",
  },
  returned: {
    label: "Geri gönderildi",
    circleClassName: "border-danger/40 bg-danger/10 text-danger",
    badgeClassName: "border-danger/30 bg-danger/10 text-danger",
    connectorClassName: "bg-danger/30",
  },
  in_progress: {
    label: "Devam ediyor",
    circleClassName: "border-accent/40 bg-accent/10 text-accent",
    badgeClassName: "border-accent/30 bg-accent/10 text-accent",
    connectorClassName: "bg-accent/30",
  },
  pending: {
    label: "Bekliyor",
    circleClassName: "border-border bg-surface-2 text-text-secondary",
    badgeClassName: "border-border bg-surface-2 text-text-secondary",
    connectorClassName: "bg-border",
  },
  skipped: {
    label: "Gerekmedi",
    circleClassName: "border-border bg-surface-2 text-text-secondary",
    badgeClassName: "border-border bg-surface-2 text-text-secondary",
    connectorClassName: "bg-border",
  },
};

function formatTimelineDate(value: string | null) {
  if (!value) {
    return "Henüz yok";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderStateIcon(state: TicketTimelineStageState) {
  if (state === "done" || state === "approved" || state === "resolved") {
    return <IconCheck size={16} aria-hidden={true} />;
  }

  if (state === "rejected" || state === "returned") {
    return <IconX size={16} aria-hidden={true} />;
  }

  if (state === "skipped") {
    return <IconMinus size={16} aria-hidden={true} />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-current" />;
}

function getStageDescription(stage: TicketTimelineStage) {
  if (stage.comment) {
    return stage.comment;
  }

  if (stage.state === "skipped") {
    return "Bu aşama bu talep için gerekmedi.";
  }

  if (stage.state === "pending") {
    return "Bu aşama henüz beklemede.";
  }

  if (stage.state === "in_progress") {
    return "Bu aşama şu anda devam ediyor.";
  }

  return "Bu aşama tamamlandı.";
}

function TimelineStageRow({
  stage,
  isLast,
}: {
  stage: TicketTimelineStage;
  isLast: boolean;
}) {
  const visual = stateVisuals[stage.state];

  return (
    <li className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-md">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "z-10 flex h-10 w-10 items-center justify-center rounded-full border text-sm",
            visual.circleClassName
          )}
        >
          {renderStateIcon(stage.state)}
        </div>

        {!isLast ? (
          <div className={cn("mt-xs h-full min-h-10 w-px", visual.connectorClassName)} />
        ) : null}
      </div>

      <article className={cn("pb-lg", isLast ? "pb-0" : "")}>
        <div className="rounded-2xl border border-border-subtle bg-surface-1 p-md shadow-panel">
          <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-xs">
                <span className="rounded-full border border-border bg-surface-1 px-sm py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  Tur {stage.round}
                </span>

                <span className="rounded-full border border-border bg-surface-1 px-sm py-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  {stageTypeLabel[stage.stage]}
                </span>

                <span
                  className={cn(
                    "rounded-full border px-sm py-1 text-[11px] font-semibold",
                    visual.badgeClassName
                  )}
                >
                  {visual.label}
                </span>
              </div>

              <h3 className="mt-sm text-h3 text-text-primary">{stage.label}</h3>

              <p className="mt-xs text-body text-text-secondary">
                {getStageDescription(stage)}
              </p>
            </div>

            <div className="shrink-0 text-left text-caption text-text-secondary sm:text-right">
              <p>{formatTimelineDate(stage.timestamp)}</p>

              {stage.actor_name ? (
                <p className="mt-xs text-text-primary">{stage.actor_name}</p>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function TicketTimelinePopup({
  ticketId,
  ticketTitle,
  onClose,
}: TicketTimelinePopupProps) {
  const timelineQuery = useTicketTimeline(ticketId, true);
  const timeline = timelineQuery.data;
  const stages = timeline?.stages ?? [];

  return (
    <PopupPanel
      title="Talep zaman çizelgesi"
      description={
        ticketTitle
          ? `#${ticketId} — ${ticketTitle}`
          : `#${ticketId} numaralı talebin aşamaları`
      }
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-text-secondary">
            Bu görünüm talebin onay, IT inceleme ve çözüm adımlarını gösterir.
          </p>

          <button
            type="button"
            onClick={() => timelineQuery.refetch()}
            disabled={timelineQuery.isFetching}
            className="inline-flex items-center justify-center gap-xs rounded-xl border border-border bg-surface-1 px-md py-sm text-body font-medium text-text-primary transition hover:border-accent hover:bg-accent-bg hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconRefresh
              size={16}
              aria-hidden={true}
              className={timelineQuery.isFetching ? "animate-spin" : undefined}
            />
            Yenile
          </button>
        </div>
      }
    >
      {timelineQuery.isLoading ? (
        <div className="space-y-sm">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : null}

      {timelineQuery.isError ? (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-md text-body text-danger">
          Zaman çizelgesi alınamadı. Lütfen tekrar deneyin.
        </div>
      ) : null}

      {!timelineQuery.isLoading && !timelineQuery.isError ? (
        <div>
          {timeline ? (
            <div className="mb-lg grid gap-sm rounded-2xl border border-border-subtle bg-surface-0 p-md sm:grid-cols-2">
              <div>
                <p className="text-caption text-text-secondary">Mevcut durum</p>
                <p className="mt-xs text-body font-semibold text-text-primary">
                  {timeline.current_status_label}
                </p>
              </div>

              <div>
                <p className="text-caption text-text-secondary">Onay durumu</p>
                <p className="mt-xs text-body font-semibold text-text-primary">
                  {timeline.current_approval_status_label}
                </p>
              </div>
            </div>
          ) : null}

          {stages.length > 0 ? (
            <ol className="space-y-0">
              {stages.map((stage, index) => (
                <TimelineStageRow
                  key={stage.id}
                  stage={stage}
                  isLast={index === stages.length - 1}
                />
              ))}
            </ol>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface-0 p-md text-body text-text-secondary">
              Bu talep için henüz zaman çizelgesi verisi yok.
            </div>
          )}
        </div>
      ) : null}
    </PopupPanel>
  );
}

export function TicketTimelineIndicator({
  ticketId,
  ticketTitle,
  className,
}: TicketTimelineIndicatorProps) {
  const { openDetail, closeTop } = usePopup();

  function handleOpenTimeline(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    openDetail(
      <TicketTimelinePopup
        ticketId={ticketId}
        ticketTitle={ticketTitle}
        onClose={closeTop}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpenTimeline}
      className={cn(
        "inline-flex items-center justify-center gap-xs rounded-app border border-border bg-surface-1 px-md py-sm text-body font-medium text-text-primary transition hover:border-accent hover:bg-accent/5 hover:text-accent",
        className
      )}
      aria-label={`#${ticketId} talep zaman çizelgesini aç`}
    >
      <IconClock size={16} aria-hidden={true} />
      Zaman çizelgesi
    </button>
  );
}