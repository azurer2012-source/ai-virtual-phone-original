import { AuthClient } from "@supabase/auth-js";
import { normalizeBackupUrl, type CloudBackupConfig } from "./config";
import { isPublicCloudKey } from "./public-key";

const clients = new Map<string, InstanceType<typeof AuthClient>>();

/** Public API keys identify the project; only a signed-in user's JWT authorizes storage. */
export function emailCloudClient(config: CloudBackupConfig): InstanceType<typeof AuthClient> {
  if (typeof window === "undefined") throw new Error("请在浏览器中登录云备份。");
  const url = normalizeBackupUrl(config.url);
  const key = config.key.trim();
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error("请填写有效的 Supabase 项目地址。"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("项目地址必须是 HTTPS 地址，不包含路径或登录信息。");
  }
  if (!isPublicCloudKey(key)) throw new Error("请填写 Publishable 或 anon 公钥，不要填写 service_role 或 secret 密钥。");
  const remember = config.rememberLogin !== false;
  const id = `${url}|${key}|${remember ? "device" : "tab"}`;
  let client = clients.get(id);
  if (!client) {
    client = new AuthClient({
      url: `${url}/auth/v1`,
      headers: { apikey: key },
      storageKey: `ai-phone-cloud-auth:${parsed.host}:${remember ? "device" : "tab"}`,
      // This namespace is excluded from backup/export/clear sources in modules.ts.
      storage: remember ? window.localStorage : window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    });
    clients.set(id, client);
  }
  return client;
}

export async function emailCloudAccessToken(config: CloudBackupConfig): Promise<string> {
  const { data, error } = await emailCloudClient(config).getSession();
  if (error || !data.session?.access_token) throw new Error("请先用邮箱登录云备份。");
  return data.session.access_token;
}
