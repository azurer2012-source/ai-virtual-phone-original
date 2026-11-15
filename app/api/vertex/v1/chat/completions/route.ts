import { authorizeVertex, readVertexBody, vertexConfig, vertexAccessToken, vertexPayload, vertexError, VertexError } from "@/lib/server/vertex-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Best-effort per-instance limits, not a durable account-wide budget.
let active = 0;
let windowStart = 0;
let requests = 0;
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const trace = (event: string, fields: Record<string, unknown> = {}) => {
    console.info(JSON.stringify({ route: "vertex-chat", requestId, event, elapsedMs: Date.now() - startedAt, ...fields }));
  };
  let acquired = false;
  try {
    authorizeVertex(request);
    trace("accepted");
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requests = 0; }
    if (active >= 2 || requests >= 20) throw new VertexError("Float 代理限流，请稍后重试", 429);
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
      trace("google_headers", { status: upstream.status, stream: payload.stream });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.json().catch(() => null);
        const reason = detail?.error?.status;
        const safeReason = typeof reason === "string" && /^[A-Z_]{1,48}$/.test(reason) ? `（${reason}）` : "";
        throw new VertexError(`Google 返回 HTTP ${upstream.status}${safeReason}`, upstream.status === 429 ? 429 : 502);
      }
      const reader = upstream.body.getReader();
      let receivedData = false;
      let ended = false;
      const finish = (outcome: string) => {
        if (ended) return;
        ended = true;
        trace("body_end", { outcome, receivedData });
        cleanup();
      };
      const stream = new ReadableStream<Uint8Array>({
        async pull(target) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              finish("eof");
              target.close();
            } else {
              if (!receivedData && value.byteLength) {
                receivedData = true;
                trace("first_body_bytes");
              }
              target.enqueue(value);
            }
          } catch {
            finish(request.signal.aborted ? "client_abort" : controller.signal.aborted ? "proxy_timeout" : "read_error");
            target.error(new Error("模型响应中断或超时"));
          }
        },
        async cancel() { controller.abort(); finish("downstream_cancel"); await reader.cancel(); },
      });
      return new Response(stream, { headers: {
        "Content-Type": payload.stream ? "text/event-stream; charset=utf-8" : "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-transform", "X-Content-Type-Options": "nosniff",
        "X-Float-Request-Id": requestId,
      } });
    } catch (error) {
      const timedOut = controller.signal.aborted && !request.signal.aborted;
      controller.abort();
      cleanup();
      if (timedOut) throw new VertexError("Float 代理等待 Google 响应超时", 504);
      throw error;
    }
  } catch (error) {
    if (acquired) active--;
    const response = vertexError(error);
    trace("rejected", { status: response.status, clientAborted: request.signal.aborted });
    response.headers.set("X-Float-Request-Id", requestId);
    return response;
  }
}
