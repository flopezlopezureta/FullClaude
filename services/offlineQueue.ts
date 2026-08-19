/**
 * Offline action queue for the driver web app. Mirrors driver-app/src/services/OfflineManager.ts'
 * queueAction/getPendingActions/removeActionFromQueue pattern (React Native/AsyncStorage), adapted
 * to localStorage since the web app has no equivalent today. Drivers who lose connection mid-delivery
 * previously had no way to submit at all; this lets the confirm/problem/return actions be saved
 * locally and retried automatically once the connection comes back, instead of just failing.
 */

const QUEUE_KEY = 'offline_action_queue';

export type QueuedActionType = 'DELIVER' | 'PROBLEM' | 'RETURN';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  pkgId: string;
  data: any;
  timestamp: number;
}

function readQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('[OfflineQueue] Failed to read queue', e);
    return [];
  }
}

function writeQueue(queue: QueuedAction[]) {
  // Deliberately NOT try/catch-swallowed here anymore. It used to be: a quota failure
  // (a delivery with 1-2+ base64-encoded photos can be a few MB, and localStorage's total
  // per-origin limit — usually 5-10MB — is shared with everything else the app caches) was
  // logged to the console and otherwise ignored, so callers had no way to know the save
  // hadn't actually happened. enqueue() still returned normally, the delivery modal closed
  // as if it succeeded, and its own draft (the only other local copy of the photos) got
  // cleared right after — silently losing the entire delivery, photos included, with no
  // error ever shown to the driver. Letting this throw lets callers catch it and keep the
  // draft intact instead.
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  // Same-tab components (e.g. the pending-count banner in DriverDashboard.tsx) don't get
  // notified by the browser's native 'storage' event, which only fires in OTHER tabs — this
  // custom event is how any mounted component finds out the queue changed in this tab.
  window.dispatchEvent(new Event('offline-queue-changed'));
}

export const offlineQueue = {
  isOnline: (): boolean => navigator.onLine,

  // Throws if the write fails (see writeQueue) — callers must handle this explicitly rather
  // than assuming the action was safely queued.
  enqueue: (type: QueuedActionType, pkgId: string, data: any): QueuedAction => {
    const queue = readQueue();
    const action: QueuedAction = {
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      pkgId,
      data,
      timestamp: Date.now(),
    };
    queue.push(action);
    writeQueue(queue);
    return action;
  },

  getPending: (): QueuedAction[] => readQueue(),

  getPendingCount: (): number => readQueue().length,

  remove: (actionId: string) => {
    const queue = readQueue().filter(a => a.id !== actionId);
    writeQueue(queue);
  },

  hasPendingForPackage: (pkgId: string): boolean =>
    readQueue().some(a => a.pkgId === pkgId),
};
