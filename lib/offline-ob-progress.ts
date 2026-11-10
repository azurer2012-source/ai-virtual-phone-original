import { kvGet, kvSet, registerDynamicPrefix } from './kv-db';
export const OFFLINE_OB_PREFIX = 'ai_phone_offline_ob_review:';
export const OFFLINE_OB_PROGRESS_EVENT = 'offline-ob-progress';
registerDynamicPrefix(OFFLINE_OB_PREFIX);
export type OfflineObLedger = Record<string, { status: 'sending' | 'done' | 'uncertain'; turnIds: string[]; skipped?: boolean }>;
export function loadOfflineObLedger(key: string): OfflineObLedger { try { return JSON.parse(kvGet(key) || '{}'); } catch { return {}; } }
export function saveOfflineObLedger(key: string, rows: OfflineObLedger) { kvSet(key, JSON.stringify(rows)); if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_OB_PROGRESS_EVENT)); }
