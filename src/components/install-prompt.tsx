import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowPrompt(false);
      console.log('[PWA] App installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
    } else {
      console.log('[PWA] User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-fade-up">
      <div className="rounded-2xl shadow-2xl p-4" style={{ background: "#1f2c34", border: "1px solid #2a3942" }}>
        <button onClick={handleDismiss} className="absolute top-3 right-3 p-1 rounded-full hover:bg-[#2a3942] transition-colors" aria-label="Dismiss">
          <X className="h-4 w-4 text-[#8696a0]" />
        </button>

        <div className="flex items-start gap-3">
          <div className="shrink-0 h-11 w-11 rounded-full bg-[#00a884] flex items-center justify-center">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#e9edef] text-sm mb-0.5">Install Pulse Chat</h3>
            <p className="text-xs text-[#8696a0] mb-3">Add to your home screen for a better experience.</p>
            <div className="flex gap-2">
              <button onClick={handleInstall} className="flex-1 bg-[#00a884] text-white px-3 py-2 rounded-lg font-medium text-xs hover:opacity-90 transition-opacity">
                Install App
              </button>
              <button onClick={handleDismiss} className="px-3 py-2 rounded-lg font-medium text-xs text-[#8696a0] hover:bg-[#2a3942] transition-colors">
                Not now
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 grid grid-cols-2 gap-1.5" style={{ borderTop: "1px solid #2a3942" }}>
          {["Works offline", "Faster loading", "Push notifications", "Native app feel"].map(f => (
            <div key={f} className="flex items-center gap-1.5 text-[11px] text-[#8696a0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25d366] shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
