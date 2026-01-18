import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptProps {
  className?: string;
  variant?: 'button' | 'banner';
}

export function InstallPrompt({ className, variant = 'button' }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Don't show if already installed
  if (isInstalled) return null;

  // Don't show if not installable (no prompt and not iOS)
  if (!deferredPrompt && !isIOS) return null;

  if (variant === 'banner' && showBanner) {
    return (
      <>
        <div className={cn(
          'fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex items-center justify-between gap-4 z-50 shadow-lg',
          className
        )}>
          <div className="flex-1">
            <p className="font-medium text-sm">Install Oud Note Trainer</p>
            <p className="text-xs text-muted-foreground">
              {isIOS 
                ? 'Add to Home Screen for the best experience' 
                : 'Install as an app for better audio performance'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              onClick={handleInstallClick}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Install
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setShowBanner(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* iOS Instructions Modal */}
        {showIOSInstructions && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowIOSInstructions(false)}
          >
            <div 
              className="bg-card rounded-lg p-6 max-w-sm w-full shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold text-lg mb-4">Install on iOS</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  Tap the Share button <span className="inline-block px-1 bg-muted rounded">⬆️</span> at the bottom of Safari
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  Scroll down and tap "Add to Home Screen"
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  Tap "Add" in the top right corner
                </li>
              </ol>
              <Button 
                className="w-full mt-4" 
                onClick={() => setShowIOSInstructions(false)}
              >
                Got it
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Button variant
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handleInstallClick}
        className={cn('h-10 w-10', className)}
        title="Install app"
      >
        <Download className="h-5 w-5" />
      </Button>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowIOSInstructions(false)}
        >
          <div 
            className="bg-card rounded-lg p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg mb-4">Install on iOS</h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-foreground">1.</span>
                Tap the Share button <span className="inline-block px-1 bg-muted rounded">⬆️</span> at the bottom of Safari
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">2.</span>
                Scroll down and tap "Add to Home Screen"
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-foreground">3.</span>
                Tap "Add" in the top right corner
              </li>
            </ol>
            <Button 
              className="w-full mt-4" 
              onClick={() => setShowIOSInstructions(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
