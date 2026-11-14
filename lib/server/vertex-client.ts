import { createHash, timingSafeEqual } from "node:crypto";
import { GoogleAuth } from "google-auth-library";

export class VertexError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function authorizeVertex(request: Request) {
  const secret = process.env.VERTEX_PROXY_TOKEN;
  if (!secret || secret.length < 32) throw new VertexError("服务端访问令牌未配置（至少 32 字符）", 503);
  const actual = request.headers.get("authorization") || "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(actual), digest(`Bearer ${secret}`))) {
    throw new VertexError("访问令牌无效", 401);
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new VertexError("仅允许同站点访问", 403);
}

export function vertexConfig() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || "";
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const model = process.env.VERTEX_MODEL || "";
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)
    || !/^(global|[a-z]+-[a-z]+[0-9]+)$/.test(location)
    || !/^google\/gemini-[a-zA-Z0-9._-]+$/.test(model)) {
    throw new VertexError("服务端项目、位置或模型配置无效", 503);
  }
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  return { model, url: `https://${host}/v1/projects/${project}/locations/${location}/endpoints/openapi/chat/completions` };
}

let auth: GoogleAuth | undefined;
export async function vertexAccessToken() {
  if (!auth) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new VertexError("服务端 Google 凭据未配置", 503);
    const credentials = JSON.parse(raw);
    if (credentials.type !== "service_account" || !credentials.client_email || !credentials.private_key) {
      throw new VertexError("服务账号凭据格式无效", 503);
    }
    auth = new GoogleAuth({
      credentials: { client_email: credentials.client_email, private_key: credentials.private_key },
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  const token = await auth.getAccessToken();
  if (!token) throw new VertexError("Google 认证失败", 502);
  return token;
}

export function vertexError(error: unknown) {
  return Response.json({ error: { message: error instanceof VertexError ? error.message : "上游请求失败，请检查服务端配置或稍后重试" } },
    { status: error instanceof VertexError ? error.status : 502, headers: { "Cache-Control": "no-store" } });
}

// Read incrementally: Content-Length is optional and cannot enforce the limit alone.
export async function readVertexBody(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new VertexError("缺少请求体");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) { await reader.cancel(); throw new VertexError("请求超过 1 MiB", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new VertexError("请求必须为 JSON 对象"); }
}

export function vertexPayload(body: Record<string, unknown>, model: string) {
  if (body.model !== model) throw new VertexError("模型不在服务器允许范围内");
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 500) throw new VertexError("消息数量必须为 1–500");
  if (body.tools || body.tool_choice) throw new VertexError("请先关闭原生工具调用；此版本仅接入文本聊天");
  const messages = body.messages.map((m: unknown) => {
    if (!m || typeof m !== "object") throw new VertexError("消息格式无效");
    const item = m as Record<string, unknown>;
    if (!["system", "user", "assistant"].includes(String(item.role)) || typeof item.content !== "string") throw new VertexError("此版本仅支持文本消息");
    return { role: item.role, content: item.content };
  });
  if (body.stream !== undefined && typeof body.stream !== "boolean") throw new VertexError("stream 必须为布尔值");
  const result: Record<string, unknown> = { model, messages, stream: body.stream === true, max_tokens: 4096 };
  for (const [key, min, max] of [["temperature", 0, 2], ["top_p", 0, 1], ["max_tokens", 1, 8192]] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (key === "max_tokens" && !Number.isInteger(value))) throw new VertexError(`${key} 超出允许范围`);
    result[key] = value;
  }
  return result;
}
