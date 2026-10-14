import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-image";

const SIZES = new Set([192, 512]);

/** PNG app icons for the web manifest (UX-015). `?maskable=1` adds the safe-zone padding. */
export async function GET(request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const maskable = new URL(request.url).searchParams.has("maskable");
  return new ImageResponse(
    <BrandMark size={size} padding={maskable ? Math.round(size * 0.12) : 0} />,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    },
  );
}
