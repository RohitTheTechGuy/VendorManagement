import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "./ui.js";

// Custom overlay modal (never a native dialog/confirm, which would block automation).
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
  fullScreen = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  // Fill the viewport (sticky header + scrollable body) — for content-heavy views.
  fullScreen?: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Entrance: overlay fade + panel rise/scale. fromTo keeps the end state explicit
  // so the panel can never get stuck hidden. Skipped under reduced motion.
  useGSAP(
    () => {
      if (!open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap
        .timeline()
        .fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "power1.out" })
        .fromTo(
          panelRef.current,
          { opacity: 0, y: 10, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power3.out" },
          "-=0.08",
        );
    },
    { dependencies: [open] },
  );

  if (!open) return null;

  // Portal to <body> so `position: fixed` resolves against the viewport, not an
  // ancestor with a transform (e.g. the AppShell page-transition on <main>),
  // which would otherwise offset/clip the panel.
  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm",
        fullScreen ? "p-0" : "p-4 sm:p-8",
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={cn(
          "flex w-full flex-col bg-card text-card-foreground shadow-xl",
          fullScreen
            ? "h-[100dvh] max-w-none rounded-none"
            : cn("my-8 max-h-[calc(100dvh-4rem)] rounded-2xl", maxWidth),
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
