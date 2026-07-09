import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { GlowButton } from "./GlowButton";

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
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
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
            className="glass-panel fixed right-0 top-0 z-50 h-full w-full max-w-xl overflow-y-auto border-l border-border p-lg"
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
            <div className="mb-lg flex items-start justify-between gap-md">
              <div>
                <h2 className="text-h2 text-text-primary">{title}</h2>
                {description && (
                  <p className="mt-sm text-caption text-text-secondary">
                    {description}
                  </p>
                )}
              </div>

              <GlowButton
                variant="ghost"
                onClick={onClose}
                aria-label="Paneli kapat"
                icon={<IconX size={16} aria-hidden={true} />}
              >
                Kapat
              </GlowButton>
            </div>

            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}