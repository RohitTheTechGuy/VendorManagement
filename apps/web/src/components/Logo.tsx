import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TrustLink brand mark + wordmark. Shield-check mark in the signature purple→pink
 * gradient; theme-aware wordmark. Drop-in points: app shell, login/register.
 */
export function Logo({
  className,
  showWordmark = true,
  subtitle,
}: {
  className?: string;
  showWordmark?: boolean;
  subtitle?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-gradient-accent text-white shadow-sm"
      >
        <ShieldCheck className="size-4" strokeWidth={2.5} />
      </span>
      {showWordmark && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-foreground">TrustLink</span>
          {subtitle && (
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
