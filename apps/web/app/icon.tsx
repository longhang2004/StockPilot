import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

// next/og's WASM rasterizer (satori → resvg) is unreliable on repeated
// renders in dev: on Linux x86_64 every request after the first fails with
// "Input buffer contains unsupported image format" (the reused WASM heap
// produces a corrupted SVG for resvg to decode), which surfaces as a 500
// and can reset the connection. The icon is static, so render it once and
// serve the cached PNG bytes for every request. Production prerenders this
// route at build time, so the cache is only ever exercised in dev.
let iconPng: Promise<Uint8Array<ArrayBuffer>> | undefined;

export default async function Icon(): Promise<Response> {
  iconPng ??= new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#17201F',
        borderRadius: 14,
        color: '#FCFBF7',
        display: 'flex',
        fontFamily: 'Arial',
        fontSize: 22,
        fontWeight: 700,
        height: '100%',
        justifyContent: 'center',
        width: '100%',
      }}
    >
      SP
    </div>,
    size,
  )
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer))
    .catch((error) => {
      // Allow a retry on a transient first-render failure.
      iconPng = undefined;
      throw error;
    });

  const png = await iconPng;
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
    },
  });
}
