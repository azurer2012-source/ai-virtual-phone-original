import { kvGet, kvSet, registerKvMigration } from "../kv-db";
import { isPublicCloudKey } from "./public-key";

/** Fixed bucket name — users never type this; the app auto-creates it via the service_role key. */
export const CLOUD_BACKUP_BUCKET = "ai-phone-backup";

const CLOUD_BACKUP_CONFIG_KEY = "ai_phone_cloud_backup_config_v1";
registerKvMigration(CLOUD_BACKUP_CONFIG_KEY);

export type CloudBackupConfig = {
  /** Email mode uses a public project key plus a separate short-lived user session. */
  authMode?: "email";
  /** Device-local preferences; config is excluded from all backups. */
  rememberLogin?: boolean;
  email?: string;
  /** User's Supabase project URL, e.g. https://xxxx.supabase.co */
  url: string;
  /** Public key in email mode; privileged keys exist only in legacy configs. */
  key: string;
  /** Auto-backup on/off (engine wired in a later step). */
  enabled: boolean;
  /** Auto-backup interval in hours. */
  intervalHours: number;
  /** How many healthy backups to keep (rolling). */
  keepCount: number;
  /** Strip images/multimedia from backups (local + cloud) to keep them small. */
  excludeMedia: boolean;
  /** Project provisioned by AI Phone. Old/manual configs deliberately have no marker. */
  managedProjectRef?: string;
  /** Organization selected by the user when the managed project was created. */
  managedOrganizationSlug?: string;
};

export const DEFAULT_CLOUD_BACKUP_CONFIG: CloudBackupConfig = {
  url: "",
  key: "",
  enabled: false,
  intervalHours: 6,
  keepCount: 3,
  excludeMedia: true,
};

/** Strip trailing slashes; tolerate a pasted URL with or without protocol. */
export function normalizeBackupUrl(url: string): string {
  const trimmed = (url || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function loadCloudBackupConfig(): CloudBackupConfig {
  try {
    const raw = kvGet(CLOUD_BACKUP_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CLOUD_BACKUP_CONFIG };
    const parsed = JSON.parse(raw) as Partial<CloudBackupConfig>;
    return {
      authMode: parsed.authMode === "email" ? "email" : undefined,
      rememberLogin: parsed.rememberLogin !== false,
      email: typeof parsed.email === "string" ? parsed.email : "",
      url: typeof parsed.url === "string" ? parsed.url : "",
      key: typeof parsed.key === "string" ? parsed.key : "",
      enabled: Boolean(parsed.enabled),
      intervalHours: clampInterval(parsed.intervalHours),
      keepCount: clampKeepCount(parsed.keepCount),
      excludeMedia: parsed.excludeMedia !== false,
      managedProjectRef: typeof parsed.managedProjectRef === "string" ? parsed.managedProjectRef : undefined,
      managedOrganizationSlug: typeof parsed.managedOrganizationSlug === "string" ? parsed.managedOrganizationSlug : undefined,
    };
  } catch {
    return { ...DEFAULT_CLOUD_BACKUP_CONFIG };
  }
}

export function saveCloudBackupConfig(config: CloudBackupConfig): void {
  if (config.authMode === "email" && !isPublicCloudKey(config.key.trim())) {
    throw new Error("邮箱连接只能保存项目公钥。");
  }
  kvSet(CLOUD_BACKUP_CONFIG_KEY, JSON.stringify({
    ...config,
    url: normalizeBackupUrl(config.url),
    key: (config.key || "").trim(),
    intervalHours: clampInterval(config.intervalHours),
    keepCount: clampKeepCount(config.keepCount),
    excludeMedia: config.excludeMedia !== false,
  }));
}

export function isCloudBackupConfigured(config: CloudBackupConfig): boolean {
  return Boolean(normalizeBackupUrl(config.url) && config.key.trim());
}

function clampInterval(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CLOUD_BACKUP_CONFIG.intervalHours;
  // Floor at 0.5h to avoid hammering; cap at a week.
  return Math.min(168, Math.max(0.5, n));
}

function clampKeepCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_CLOUD_BACKUP_CONFIG.keepCount;
  return Math.min(5, Math.max(2, n));
}
