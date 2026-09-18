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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === "done" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "#0b141a" }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl" style={{ background: "rgba(0,168,132,0.06)" }} />
      </div>

      {/* Photo */}
      <div className="relative mb-8">
        <svg className="absolute -inset-4 animate-spin-slow" width="152" height="152" viewBox="0 0 152 152" fill="none">
          <circle cx="76" cy="76" r="72" stroke="url(#ring-grad)" strokeWidth="1.5" strokeDasharray="6 5" />
          <defs>
            <linearGradient id="ring-grad" x1="0" y1="0" x2="152" y2="152" gradientUnits="userSpaceOnUse">
              <stop stopColor="#00a884" />
              <stop offset="1" stopColor="#25d366" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute -inset-1 rounded-full border border-[#00a884]/25 animate-ping" style={{ animationDuration: "2.5s" }} />
        <div className="absolute inset-0 rounded-full blur-xl scale-110" style={{ background: "rgba(0,168,132,0.15)" }} />
        <div className="relative h-[120px] w-[120px] rounded-full overflow-hidden border-2 border-[#00a884]/40">
          <img src="/ajibola.jpg" alt="Ajibola Gbenga Joseph" className="w-full h-full object-cover object-top scale-110" />
        </div>
      </div>

      {/* Name */}
      <div className="text-center mb-4 space-y-1">
        <div className="text-base font-bold tracking-widest uppercase text-[#e9edef]">
          Ajibola Gbenga Joseph
        </div>
        <div className="text-xs tracking-[0.3em] uppercase text-[#8696a0]">
          Website Designer &amp; Developer
        </div>
      </div>

      {/* Typing text */}
      <div className="mb-8 h-5 text-center px-6">
        <span className="text-xs text-[#00a884] font-medium tracking-wide">
          {typed}
          <span className="inline-block w-px h-3 bg-[#00a884] ml-0.5 animate-pulse" />
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-48 space-y-2">
        <div className="h-px w-full overflow-hidden rounded-full" style={{ background: "#2a3942" }}>
          <div
            className="h-full rounded-full transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #00a884, #25d366)",
              boxShadow: "0 0 8px rgba(0,168,132,0.5)",
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#8696a0] font-mono">
          <span>Loading</span>
          <span>{progress}%</span>
        </div>
      </div>
    </div>
  );
}
