import { authorizeVertex, vertexConfig, vertexError } from "@/lib/server/vertex-client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    authorizeVertex(request);
    return Response.json({ object: "list", data: [{ id: vertexConfig().model, object: "model", owned_by: "google" }] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return vertexError(error); }
}
