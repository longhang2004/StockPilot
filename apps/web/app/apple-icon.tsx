import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Same single-render cache as app/icon.tsx: next/og's WASM rasterizer
// corrupts on repeated renders in dev on Linux x86_64 ("Input buffer
// contains unsupported image format"), so render once and serve the cached
// PNG bytes. Production prerenders this route at build time.
let appleIconPng: Promise<Uint8Array<ArrayBuffer>> | undefined;

export default async function AppleIcon(): Promise<Response> {
  appleIconPng ??= new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#17201F',
        borderRadius: 38,
        color: '#FCFBF7',
        display: 'flex',
        fontFamily: 'Arial',
        fontSize: 64,
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
      appleIconPng = undefined;
      throw error;
    });

  const png = await appleIconPng;
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
    },
  });
}
