import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";

export type PopupKind = "detail" | "confirm" | "custom";

export interface PopupInstance {
  id: string;
  content: ReactNode;
  kind: PopupKind;
  onClose?: () => void;
}

export interface PopupOpenOptions {
  kind?: PopupKind;
  onClose?: () => void;
  singleton?: boolean;
  maxDepth?: number;
}

interface PopupContextValue {
  stack: PopupInstance[];
  open: (content: ReactNode, options?: PopupOpenOptions) => string;
  openDetail: (content: ReactNode, options?: Omit<PopupOpenOptions, "kind">) => string;
  openConfirm: (content: ReactNode, options?: Omit<PopupOpenOptions, "kind">) => string;
  close: (id: string) => void;
  closeTop: () => void;
  closeAll: () => void;
}

const PopupContext = createContext<PopupContextValue | null>(null);

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function createPopupId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `popup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hasAttribute("disabled"))
    .filter((element) => element.getAttribute("aria-hidden") !== "true");
}

export function PopupProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<PopupInstance[]>([]);

  const close = useCallback((id: string) => {
    setStack((currentStack) => {
      const closingPopup = currentStack.find((popup) => popup.id === id);

      closingPopup?.onClose?.();

      return currentStack.filter((popup) => popup.id !== id);
    });
  }, []);

  const closeTop = useCallback(() => {
    setStack((currentStack) => {
      const closingPopup = currentStack[currentStack.length - 1];

      closingPopup?.onClose?.();

      return currentStack.slice(0, -1);
    });
  }, []);

  const closeAll = useCallback(() => {
    setStack((currentStack) => {
      [...currentStack].reverse().forEach((popup) => popup.onClose?.());

      return [];
    });
  }, []);

  const open = useCallback(
    (content: ReactNode, options: PopupOpenOptions = {}) => {
      const id = createPopupId();
      const kind = options.kind ?? "detail";

      const nextPopup: PopupInstance = {
        id,
        content,
        kind,
        onClose: options.onClose,
      };

      setStack((currentStack) => {
        const shouldBeSingleton =
          options.singleton === true || kind === "detail";

        if (shouldBeSingleton) {
          return [nextPopup];
        }

        const maxDepth = options.maxDepth ?? 2;

        if (currentStack.length >= maxDepth) {
          return [...currentStack.slice(0, maxDepth - 1), nextPopup];
        }

        return [...currentStack, nextPopup];
      });

      return id;
    },
    []
  );

  const openDetail = useCallback(
    (content: ReactNode, options: Omit<PopupOpenOptions, "kind"> = {}) => {
      return open(content, {
        ...options,
        kind: "detail",
        singleton: true,
      });
    },
    [open]
  );

  const openConfirm = useCallback(
    (content: ReactNode, options: Omit<PopupOpenOptions, "kind"> = {}) => {
      return open(content, {
        ...options,
        kind: "confirm",
        maxDepth: options.maxDepth ?? 2,
      });
    },
    [open]
  );

  const value = useMemo<PopupContextValue>(
    () => ({
      stack,
      open,
      openDetail,
      openConfirm,
      close,
      closeTop,
      closeAll,
    }),
    [stack, open, openDetail, openConfirm, close, closeTop, closeAll]
  );

  return (
    <PopupContext.Provider value={value}>{children}</PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);

  if (!context) {
    throw new Error("usePopup must be used inside PopupProvider.");
  }

  return context;
}

export function PopupRoot() {
  const { stack, closeTop } = usePopup();
  const topDialogRef = useRef<HTMLDivElement | null>(null);
  const topPopupId = stack[stack.length - 1]?.id;

  useEffect(() => {
    if (!topPopupId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const topDialog = topDialogRef.current;
      const focusableElements = getFocusableElements(topDialog);

      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        return;
      }

      topDialog?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [topPopupId]);

  useEffect(() => {
    if (stack.length === 0) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeTop();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const topDialog = topDialogRef.current;
      const focusableElements = getFocusableElements(topDialog);

      if (!topDialog || focusableElements.length === 0) {
        event.preventDefault();
        topDialog?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === firstElement || !topDialog.contains(activeElement)) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (activeElement === lastElement || !topDialog.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [stack.length, closeTop]);

  if (stack.length === 0) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.button
        key="popup-shared-overlay"
        type="button"
        aria-label="Popup kapat"
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-[3px]"        style={{ zIndex: 1000 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeTop}
      />

      {stack.map((popup, index) => {
        const isTop = index === stack.length - 1;

        return (
          <motion.div
            key={popup.id}
            ref={isTop ? topDialogRef : undefined}
            tabIndex={-1}
            role="dialog"
            aria-modal={isTop}
            className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-y-auto px-md py-lg outline-none sm:px-lg"
            style={{ zIndex: 1001 + index * 2 }}
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
          >
            <div className="pointer-events-auto w-full">{popup.content}</div>
          </motion.div>
        );
      })}
    </AnimatePresence>,
    document.body
  );
}

interface PopupPanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  onClose?: () => void;
}

const popupPanelSizeClass: Record<NonNullable<PopupPanelProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function PopupPanel({
  title,
  description,
  children,
  footer,
  size = "md",
  onClose,
}: PopupPanelProps) {
  return (
    <section
      className={cn(
       "mx-auto max-h-[calc(100vh-48px)] overflow-hidden rounded-panel border border-border bg-surface-1 shadow-popover",
        popupPanelSizeClass[size]
      )}
    >
      <header className="flex items-start justify-between gap-md border-b border-border-subtle bg-surface-1 px-lg py-md">
        <div className="min-w-0">
          <h2 className="text-h2 font-semibold text-text-primary">{title}</h2>

          {description ? (
            <p className="mt-xs text-body text-text-secondary">{description}</p>
          ) : null}
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-1 text-text-secondary shadow-sm transition hover:border-accent hover:bg-accent-bg hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            aria-label="Popup kapat"
          >
            <IconX size={17} aria-hidden={true} />
          </button>
        ) : null}
      </header>

      <div className="max-h-[calc(100vh-210px)] overflow-y-auto bg-surface-1 px-lg py-md">
        {children}
      </div>

      {footer ? (
        <footer className="border-t border-border-subtle bg-surface-0 px-lg py-md">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

interface ConfirmPopupProps {
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  isConfirmDisabled?: boolean;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmPopup({
  title,
  description,
  children,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  confirmVariant = "primary",
  isConfirmDisabled = false,
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ConfirmPopupProps) {
  return (
    <PopupPanel
      title={title}
      description={description}
      size="sm"
      onClose={onCancel}
      footer={
        <div className="flex justify-end gap-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border border-border bg-surface-1 px-md py-sm text-body font-medium text-text-primary transition hover:border-accent hover:bg-accent-bg hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled || isSubmitting}
            className={cn(
              "rounded-xl px-md py-sm text-body font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60",
              confirmVariant === "danger" ? "bg-danger" : "bg-accent"
            )}
          >
            {isSubmitting ? "İşleniyor..." : confirmLabel}
          </button>
        </div>
      }
    >
      {children}
    </PopupPanel>
  );
}