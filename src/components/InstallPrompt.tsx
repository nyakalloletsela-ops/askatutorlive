import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Persistent "Add to Home Screen" prompt.
 * - Hides if the app is already installed / running standalone.
 * - On Android/Chromium: uses the native beforeinstallprompt event.
 * - On iOS Safari: shows manual Share → Add to Home Screen instructions.
 * - Reappears each session until the app is installed.
 *
 * Note: installation only works on the deployed site, not inside the
 * Lovable editor preview iframe.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed?
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Inside an iframe (Lovable preview) — installation isn't possible.
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua);
    setIsIOS(ios);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS doesn't fire beforeinstallprompt — show manual instructions instead.
    if (ios) setShow(true);

    const onInstalled = () => setShow(false);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 z-50 mx-auto w-[min(92vw,420px)] rounded-xl border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-aurora text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install Ask A Tutor</p>
          {isIOS ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> then
              <strong> Add to Home Screen</strong> for the full app experience.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Add it to your home screen for faster access and a full-screen experience.
            </p>
          )}
          {!isIOS && deferred && (
            <Button size="sm" onClick={install} className="mt-2 bg-aurora text-white">
              Add to Home Screen
            </Button>
          )}
        </div>
        <button
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
