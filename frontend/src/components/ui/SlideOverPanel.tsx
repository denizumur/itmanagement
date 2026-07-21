import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={!shouldReduceMotion}>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[3px]"
            aria-label="Paneli kapat"
            onClick={onClose}
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                  }
            }
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.18,
              ease: "easeOut",
            }}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="slide-over-title"
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-border bg-surface-1 shadow-popover"
            initial={
              shouldReduceMotion
                ? false
                : {
                    x: "100%",
                    opacity: 0,
                  }
            }
            animate={{
              x: 0,
              opacity: 1,
            }}
            exit={
              shouldReduceMotion
                ? {
                    opacity: 0,
                  }
                : {
                    x: "100%",
                    opacity: 0,
                  }
            }
            transition={
              shouldReduceMotion
                ? {
                    duration: 0,
                  }
                : {
                    type: "spring",
                    stiffness: 320,
                    damping: 34,
                    mass: 0.8,
                  }
            }
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
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30 motion-reduce:transition-none"
              >
                <IconX size={17} aria-hidden={true} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-lg py-md">
              {children}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}