import { useEffect, useState } from "react";

const TYPING_TEXT = "Step into a world where design meets technology.";

export function Preloader({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"loading" | "done">("loading");
  const [typed, setTyped] = useState("");

  // Progress bar
  useEffect(() => {
    const start = performance.now();
    const duration = 3500;
    function tick(now: number) {
      const pct = Math.min(100, Math.round(((now - start) / duration) * 100));
      setProgress(pct);
      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setPhase("done");
          setTimeout(onDone, 800);
        }, 600);
      }
    }
    requestAnimationFrame(tick);
  }, [onDone]);

  // Typing effect
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(TYPING_TEXT.slice(0, i));
      if (i >= TYPING_TEXT.length) clearInterval(interval);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        phase === "done" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/8 blur-3xl" />
      </div>

      {/* Photo */}
      <div className="relative mb-10">
        <svg className="absolute -inset-4 animate-spin-slow" width="152" height="152" viewBox="0 0 152 152" fill="none">
          <circle cx="76" cy="76" r="72" stroke="url(#ring-grad)" strokeWidth="1.5" strokeDasharray="6 5" />
          <defs>
            <linearGradient id="ring-grad" x1="0" y1="0" x2="152" y2="152" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--color-primary)" />
              <stop offset="1" stopColor="var(--color-primary-glow)" stopOpacity="0.15" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute -inset-1 rounded-full border border-primary/25 animate-ping" style={{ animationDuration: "2.5s" }} />
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl scale-110" />
        <div className="relative h-[120px] w-[120px] rounded-full overflow-hidden border-2 border-primary/40 shadow-glow">
          <img src="/ajibola.jpg" alt="Ajibola Gbenga Joseph" className="w-full h-full object-cover object-top scale-110" />
        </div>
      </div>

      {/* Name */}
      <div className="text-center mb-4 space-y-1">
        <div className="text-lg font-bold tracking-widest uppercase text-foreground">
          Ajibola Gbenga Joseph
        </div>
        <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
          Website Designer &amp; Developer
        </div>
      </div>

      {/* Typing text */}
      <div className="mb-8 h-5 text-center px-6">
        <span className="text-xs text-primary font-medium tracking-wide">
          {typed}
          <span className="inline-block w-px h-3 bg-primary ml-0.5 animate-pulse" />
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-48 space-y-2">
        <div className="h-px w-full bg-border overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, var(--color-primary), var(--color-primary-glow))",
              boxShadow: "0 0 8px var(--color-primary-glow)",
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>Loading</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
}
