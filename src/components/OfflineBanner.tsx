import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showBack, setShowBack] = useState(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOffline() {
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
      setIsOffline(true);
      setShowBack(false);
    }

    function handleOnline() {
      setIsOffline(false);
      setShowBack(true);
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
      backTimerRef.current = setTimeout(() => setShowBack(false), 3000);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, []);

  if (!isOffline && !showBack) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium select-none"
      style={{
        background: isOffline ? "#1a1a1a" : "#005c4b",
        borderBottom: `1px solid ${isOffline ? "#333" : "#00a884"}`,
        animation: "banner-slide-down 0.25s cubic-bezier(0.22,1,0.36,1) forwards",
      }}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 text-[#f15c6d] shrink-0" />
          <span style={{ color: "#e9edef" }}>No internet connection</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 text-[#25d366] shrink-0" />
          <span style={{ color: "#e9edef" }}>Back online</span>
        </>
      )}
    </div>
  );
}
