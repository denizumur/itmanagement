import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface SlideOverPanelProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function SlideOverPanel({
  open,
  title,
  description,
  children,
  onClose,
}: SlideOverPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[3px]"
            aria-label="Paneli kapat"
            onClick={onClose}
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="slide-over-title"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-surface-1 shadow-popover"
            initial={{
              x: "100%",
              opacity: 0,
            }}
            animate={{
              x: 0,
              opacity: 1,
            }}
            exit={{
              x: "100%",
              opacity: 0,
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 28,
            }}
          >
            <header className="flex items-start justify-between gap-md border-b border-border-subtle px-lg py-md">
              <div className="min-w-0">
                <h2
                  id="slide-over-title"
                  className="text-h2 font-semibold text-text-primary"
                >
                  {title}
                </h2>

                {description ? (
                  <p className="mt-xs max-w-md text-caption text-text-secondary">
                    {description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Paneli kapat"
                title="Kapat"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <IconX size={17} aria-hidden={true} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}