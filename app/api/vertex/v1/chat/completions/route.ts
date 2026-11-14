import { authorizeVertex, readVertexBody, vertexConfig, vertexAccessToken, vertexPayload, vertexError, VertexError } from "@/lib/server/vertex-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Best-effort per-instance limits, not a durable account-wide budget.
let active = 0;
let windowStart = 0;
let requests = 0;
export async function POST(request: Request) {
  let acquired = false;
  try {
    authorizeVertex(request);
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
    if (active >= 2 || requests >= 20) throw new VertexError("请求过于频繁，请稍后重试", 429);
    active++; requests++; acquired = true;
    const config = vertexConfig();
    const payload = vertexPayload(await readVertexBody(request), config.model);
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const timer = setTimeout(abort, 55_000);
    let released = false;
    const cleanup = () => {
      if (released) return;
      released = true;
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
      active--;
    };
    acquired = false;
    try {
      const token = await vertexAccessToken();
      const upstream = await fetch(config.url, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        throw new VertexError(`Google 返回 HTTP ${upstream.status}，请检查模型权限、配额及参数`, upstream.status === 429 ? 429 : 502);
      }
      const reader = upstream.body.getReader();
      const stream = new ReadableStream<Uint8Array>({
        async pull(target) {
          try {
            const { done, value } = await reader.read();
            if (done) { cleanup(); target.close(); } else target.enqueue(value);
          } catch { cleanup(); target.error(new Error("模型响应中断或超时")); }
        },
        async cancel() { controller.abort(); cleanup(); await reader.cancel(); },
      });
      return new Response(stream, { headers: {
        "Content-Type": payload.stream ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-transform", "X-Content-Type-Options": "nosniff",
      } });
    } catch (error) { controller.abort(); cleanup(); throw error; }
  } catch (error) {
    if (acquired) active--;
    return vertexError(error);
  }
}
