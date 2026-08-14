import QRCode from "qrcode";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const value = params.get("text") || "COMPEX-2026-AS-428";
  const transparent = params.get("transparent") === "1";
  const png = await QRCode.toBuffer(value, { type: "png", width: 512, margin: transparent ? 2 : 4, errorCorrectionLevel: "H", color: { dark: "#081220", light: transparent ? "#ffffff00" : "#ffffff" } });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
}
