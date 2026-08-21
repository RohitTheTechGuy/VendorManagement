import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "./ui.js";

/**
 * A fixed-length numeric code entry rendered as one box per digit, with
 * focus-advance on type, backspace-to-previous, arrow navigation and paste.
 *
 * `value` is the source of truth — a left-packed string of 0..length digits
 * (no gaps). The parent owns it; `onComplete` fires when all boxes are filled.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus,
  onComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function focus(i: number) {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  }

  function commit(next: string) {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    return clean;
  }

  function onInput(i: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // Can't fill a box ahead of the current fill front.
    const idx = Math.min(i, value.length);
    // A single char replaces this box; multiple (autofill/paste) spread rightward.
    const next =
      typed.length === 1
        ? commit(value.slice(0, idx) + typed + value.slice(idx + 1))
        : commit(value.slice(0, idx) + typed);
    focus(next.length >= length ? length - 1 : next.length);
    if (next.length === length) onComplete?.(next);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const idx = digits[i] ? i : i - 1;
      if (idx < 0) return;
      commit(value.slice(0, idx) + value.slice(idx + 1));
      focus(idx);
    } else if (e.key === "ArrowLeft") {
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      focus(i + 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const next = commit(e.clipboardData.getData("text"));
    if (!next) return;
    focus(next.length >= length ? length - 1 : next.length);
    if (next.length === length) onComplete?.(next);
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.currentTarget.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "h-12 w-11 rounded-lg border border-border bg-background text-center text-lg font-semibold outline-none focus:border-ring",
            disabled && "opacity-60",
          )}
        />
      ))}
    </div>
  );
}
