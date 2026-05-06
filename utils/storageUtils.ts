/**
 * Utility for safe localStorage management in the driver application.
 * Prevents app crashes due to QuotaExceededError and manages stale data.
 */

const DRAFT_PREFIX = 'delivery_draft_';

export const storageUtils = {
  /**
   * Safely set an item in localStorage with error handling
   */
  safeSetItem: (key: string, value: any): boolean => {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
      return true;
    } catch (error: any) {
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error('LocalStorage quota exceeded!', error);
        // We can't save this item. We might want to clear old data immediately.
        storageUtils.emergencyCleanup();
      } else {
        console.error('Error saving to localStorage:', error);
      }
      return false;
    }
  },

  /**
   * Get and parse an item from localStorage
   */
  getItem: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      
      // Try to parse as JSON if it looks like it
      if (typeof item === 'string' && (item.startsWith('{') || item.startsWith('['))) {
        try {
            return JSON.parse(item) as T;
        } catch (e) {
            return item as unknown as T;
        }
      }
      return item as unknown as T;
    } catch (e) {
      const raw = localStorage.getItem(key);
      return (raw as unknown as T) || defaultValue;
    }
  },

  /**
   * Remove an item
   */
  removeItem: (key: string) => {
    localStorage.removeItem(key);
  },

  /**
   * Emergency cleanup: remove all drafts to make space
   */
  emergencyCleanup: () => {
    console.warn('[Storage] Emergency cleanup triggered!');
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  },

  /**
   * Remove old drafts and stale cache data
   */
  cleanupStaleData: () => {
    const now = Date.now();
    const lastCleanup = parseInt(localStorage.getItem('fullenvios_last_cleanup') || '0');
    
    // Only cleanup once every 12 hours
    if (now - lastCleanup < 12 * 60 * 60 * 1000) {
        return;
    }

    console.log('[Storage] Starting scheduled cleanup...');
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(DRAFT_PREFIX) || key.startsWith('driver_packages_cache'))) {
        keysToRemove.push(key);
      }
    }

    // To be safe, we only remove items if there are many of them
    if (keysToRemove.length > 50) {
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[Storage] Cleanup finished. Removed ${keysToRemove.length} items.`);
    }
    
    localStorage.setItem('fullenvios_last_cleanup', now.toString());
  },

  /**
   * Sync local cache with server data to avoid 404s on stale packages
   */
  syncLocalCache: (currentPackageIds: string[]) => {
    const keysToRemove: string[] = [];
    const packageIdSet = new Set(currentPackageIds);
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        // Key format: delivery_draft_{pkgId}_{field}
        const parts = key.split('_');
        if (parts.length >= 3) {
            const pkgIdFromKey = parts[2];
            if (!packageIdSet.has(pkgIdFromKey)) {
              keysToRemove.push(key);
            }
        }
      }
    }

    if (keysToRemove.length > 0) {
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[Storage] Synced! Removed ${keysToRemove.length} orphaned package items.`);
    }
  }
};
