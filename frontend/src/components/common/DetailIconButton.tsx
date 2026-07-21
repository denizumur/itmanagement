import { IconEye } from "@tabler/icons-react";
import type { MouseEvent } from "react";
import { cn } from "../../lib/cn";

type DetailIconButtonProps = {
  label?: string;
  className?: string;
  onClick: () => void;
};

export function DetailIconButton({
  label = "Detayları gör",
  className,
  onClick,
}: DetailIconButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onClick();
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30",
        className
      )}
    >
      <IconEye size={18} aria-hidden={true} />
    </button>
  );
}