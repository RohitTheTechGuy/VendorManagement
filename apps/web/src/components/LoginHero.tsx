import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ShieldCheck, FileCheck2, BarChart3, Handshake, UserCheck } from "lucide-react";

// Feature chips that orbit the central mark (positions are % within the stage).
const FEATURES = [
  { icon: UserCheck, label: "Verified Vendors", pos: "left-[64%] top-[14%]" },
  { icon: FileCheck2, label: "Verified Documents", pos: "left-[72%] top-[47%]" },
  { icon: BarChart3, label: "Real-time Visibility", pos: "left-[60%] top-[80%]" },
  { icon: ShieldCheck, label: "Compliant", pos: "left-[18%] top-[72%]" },
  { icon: Handshake, label: "Trusted Collaboration", pos: "left-[12%] top-[26%]" },
];

/**
 * Animated brand hero for the login front-door. A TrustLink shield-check orbited
 * by floating feature chips over faint concentric rings. GSAP staggered reveal +
 * gentle infinite float; reduced-motion-safe. Positioning lives on static outer
 * wrappers; GSAP only touches the inner .hero-* elements (opacity/scale/y), so it
 * never collides with the Tailwind -translate centering.
 */
export function LoginHero() {
  const stage = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Content-first: if the page mounts in a hidden/background tab, rAF is
        // paused and GSAP can't tick — show the final state rather than leave the
        // hero stuck at opacity 0.
        if (document.hidden) {
          gsap.set([".hero-ring", ".hero-shield", ".hero-card"], { opacity: 1, scale: 1, y: 0 });
          return;
        }
        // fromTo (not from) so the end state is explicit — safe under StrictMode.
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(".hero-ring", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, stagger: 0.12 })
          .fromTo(
            ".hero-shield",
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.7)" },
            "-=0.5",
          )
          .fromTo(
            ".hero-card",
            { y: 20, opacity: 0, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, duration: 0.55, stagger: 0.09 },
            "-=0.25",
          );

        gsap.to(".hero-card", {
          y: "-=9",
          duration: 2.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: 2,
          stagger: { each: 0.35, from: "random" },
        });
        gsap.to(".hero-rings", { rotate: 360, duration: 90, ease: "none", repeat: -1, transformOrigin: "center center" });
        gsap.to(".hero-glow", { scale: 1.1, opacity: 0.55, duration: 3.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([".hero-ring", ".hero-shield", ".hero-card"], { opacity: 1, scale: 1, y: 0 });
      });
    },
    { scope: stage },
  );

  return (
    <div ref={stage} className="relative h-full w-full overflow-hidden" aria-hidden>
      {/* Ambient purple→pink glow (dimmed so the mark and chips stay legible). */}
      <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-accent opacity-40 blur-[80px]" />

      {/* Concentric rings. */}
      <svg
        className="hero-rings absolute left-1/2 top-1/2 h-[94%] w-[94%] -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 400 400"
        fill="none"
      >
        {[70, 120, 175].map((r, i) => (
          <circle
            key={r}
            className="hero-ring"
            cx="200"
            cy="200"
            r={r}
            strokeWidth={i === 1 ? 1 : 0.6}
            strokeDasharray={i === 2 ? "2 6" : undefined}
            style={{ stroke: "hsl(var(--border))" }}
          />
        ))}
      </svg>

      {/* Central TrustLink shield-check (ring + shadow lift it off the glow). */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="hero-shield grid h-24 w-24 place-items-center rounded-3xl bg-gradient-accent text-white shadow-[0_24px_70px_-12px_rgba(168,85,247,0.75)] ring-1 ring-white/20">
          <ShieldCheck className="size-11" strokeWidth={2.2} />
        </div>
      </div>

      {/* Floating feature chips. */}
      {FEATURES.map(({ icon: Icon, label, pos }) => (
        <div key={label} className={`absolute ${pos} -translate-x-1/2 -translate-y-1/2`}>
          <div className="hero-card flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
            <span className="grid size-6 place-items-center rounded-md bg-gradient-accent text-white">
              <Icon className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-foreground">
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
