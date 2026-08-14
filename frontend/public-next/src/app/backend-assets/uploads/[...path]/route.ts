const BACKEND_URL = (process.env.COMPEX_BACKEND_URL || "http://127.0.0.1:3100").replace(/\/$/, "");

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, context: RouteContext) {
  const { path } = await context.params;
  const safePath = path.map((part) => encodeURIComponent(part)).join("/");
  const response = await fetch(`${BACKEND_URL}/uploads/${safePath}`, { cache: "no-store" });
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("cache-control", "private, max-age=300");
  return new Response(response.body, { status: response.status, headers });
}
