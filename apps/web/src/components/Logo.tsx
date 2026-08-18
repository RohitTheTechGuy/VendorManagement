import { cn } from "@/lib/utils";

/**
 * Brand mark + wordmark. Placeholder until the real asset is supplied — drop it
 * in by replacing the <span> mark with an <img>/<svg>. Drop-in points per the
 * brief: sidebar header, login/register, email header, favicon. Theme-aware via
 * tokens (no hardcoded color).
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
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
      >
        V
      </span>
      {showWordmark && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-foreground">Vendor Management</span>
          {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </span>
  );
}
