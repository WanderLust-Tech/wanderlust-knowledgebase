// Service Worker Registration and PWA Utils
export class PWAManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private deferredPrompt: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    // Register service worker
    await this.registerServiceWorker();
    
    // Setup install prompt handling
    this.setupInstallPrompt();
    
    // Setup update handling
    this.setupUpdateHandling();
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        console.log('PWA: Registering service worker...');
        this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('PWA: Service worker registered successfully:', this.swRegistration);

        // Check for updates
        this.swRegistration.addEventListener('updatefound', () => {
          console.log('PWA: New service worker version found');
        });

      } catch (error) {
        console.error('PWA: Service worker registration failed:', error);
      }
    } else {
      console.log('PWA: Service workers not supported');
    }
  }

  private setupInstallPrompt() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA: Install prompt available');
      
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Stash the event so it can be triggered later
      this.deferredPrompt = e;
      
      // Show install button/notification
      this.showInstallOption();
    });

    // Listen for successful app installation
    window.addEventListener('appinstalled', () => {
      console.log('PWA: App installed successfully');
      this.hideInstallOption();
      this.deferredPrompt = null;
    });
  }

  private setupUpdateHandling() {
    if (!this.swRegistration) return;

    // Listen for service worker updates
    this.swRegistration.addEventListener('updatefound', () => {
      const newWorker = this.swRegistration!.installing;
      
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New update available
            this.showUpdateAvailable();
          }
        });
      }
    });
  }

  // Public method to trigger install
  public async installApp() {
    if (!this.deferredPrompt) {
      console.log('PWA: Install prompt not available');
      return false;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await this.deferredPrompt.userChoice;
      
      console.log('PWA: User choice:', outcome);
      
      if (outcome === 'accepted') {
        console.log('PWA: User accepted the install prompt');
      } else {
        console.log('PWA: User dismissed the install prompt');
      }
      
      // Clear the deferredPrompt
      this.deferredPrompt = null;
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('PWA: Install prompt failed:', error);
      return false;
    }
  }

  // Public method to update the app
  public async updateApp() {
    if (!this.swRegistration || !this.swRegistration.waiting) {
      console.log('PWA: No update available');
      return;
    }

    try {
      // Tell the waiting service worker to skip waiting
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page to apply updates
      window.location.reload();
    } catch (error) {
      console.error('PWA: Update failed:', error);
    }
  }

  // Check if app is installed
  public isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true;
  }

  // Check if app can be installed
  public canInstall(): boolean {
    return this.deferredPrompt !== null;
  }

  // Show install option in UI
  private showInstallOption() {
    // Create install notification
    const installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.className = 'fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 text-center z-50 transform transition-transform duration-300';
    installBanner.innerHTML = `
      <div class="flex items-center justify-center space-x-4">
        <span class="text-sm">📱 Install Wanderlust KB for easy offline access</span>
        <button id="pwa-install-btn" class="bg-white text-blue-600 px-4 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
          Install
        </button>
        <button id="pwa-dismiss-btn" class="text-white/80 hover:text-white text-sm">
          ✕
        </button>
      </div>
    `;

    // Add to page
    document.body.appendChild(installBanner);

    // Add event listeners
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-dismiss-btn');

    installBtn?.addEventListener('click', () => {
      this.installApp();
      this.hideInstallOption();
    });

    dismissBtn?.addEventListener('click', () => {
      this.hideInstallOption();
    });

    // Auto-hide after 10 seconds
    setTimeout(() => {
      this.hideInstallOption();
    }, 10000);
  }

  // Hide install option
  private hideInstallOption() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.style.transform = 'translateY(-100%)';
      setTimeout(() => banner.remove(), 300);
    }
  }

  // Show update available notification
  private showUpdateAvailable() {
    const updateBanner = document.createElement('div');
    updateBanner.id = 'pwa-update-banner';
    updateBanner.className = 'fixed bottom-0 left-0 right-0 bg-green-600 text-white p-3 text-center z-50 transform transition-transform duration-300';
    updateBanner.innerHTML = `
      <div class="flex items-center justify-center space-x-4">
        <span class="text-sm">🔄 A new version is available</span>
        <button id="pwa-update-btn" class="bg-white text-green-600 px-4 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors">
          Update
        </button>
        <button id="pwa-update-dismiss-btn" class="text-white/80 hover:text-white text-sm">
          Later
        </button>
      </div>
    `;

    document.body.appendChild(updateBanner);

    const updateBtn = document.getElementById('pwa-update-btn');
    const dismissBtn = document.getElementById('pwa-update-dismiss-btn');

    updateBtn?.addEventListener('click', () => {
      this.updateApp();
    });

    dismissBtn?.addEventListener('click', () => {
      const banner = document.getElementById('pwa-update-banner');
      if (banner) {
        banner.style.transform = 'translateY(100%)';
        setTimeout(() => banner.remove(), 300);
      }
    });
  }

  // Get offline status
  public isOnline(): boolean {
    return navigator.onLine;
  }

  // Setup offline/online status monitoring
  public setupOfflineHandling() {
    const showOfflineStatus = () => {
      const offlineBanner = document.createElement('div');
      offlineBanner.id = 'offline-banner';
      offlineBanner.className = 'fixed top-0 left-0 right-0 bg-orange-600 text-white p-2 text-center z-40';
      offlineBanner.innerHTML = '<span class="text-sm">📡 You are offline - cached content is available</span>';
      document.body.appendChild(offlineBanner);
    };

    const hideOfflineStatus = () => {
      const banner = document.getElementById('offline-banner');
      if (banner) banner.remove();
    };

    window.addEventListener('offline', showOfflineStatus);
    window.addEventListener('online', hideOfflineStatus);

    // Show initial status if offline
    if (!this.isOnline()) {
      showOfflineStatus();
    }
  }
}

// Initialize PWA manager
export const pwaManager = new PWAManager();
