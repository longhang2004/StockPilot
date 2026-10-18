import { ImageResponse } from 'next/og';

// Cache the static response in development; see app/icon.tsx for the reason.
let socialImagePng: Promise<Uint8Array<ArrayBuffer>> | undefined;

export async function createSocialImage(): Promise<Response> {
  socialImagePng ??= new ImageResponse(
    <div
      style={{
        background: '#F3F6F8',
        color: '#102A43',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial',
        height: '100%',
        padding: 54,
        width: '100%',
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex', gap: 14 }}>
        <div
          style={{
            alignItems: 'center',
            background: '#102A43',
            borderRadius: 4,
            color: '#FFFFFF',
            display: 'flex',
            fontSize: 21,
            fontWeight: 700,
            height: 48,
            justifyContent: 'center',
            width: 48,
          }}
        >
          SP
        </div>
        <div style={{ fontSize: 27, fontWeight: 700 }}>StockPilot</div>
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          paddingTop: 48,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600 }}>
          Inventory and B2B order operations
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 48,
            fontWeight: 700,
            lineHeight: 1.12,
            paddingTop: 18,
          }}
        >
          Review available stock. Trace the work.
        </div>
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #CDD6DF',
            display: 'flex',
            flexDirection: 'column',
            marginTop: 40,
            width: '100%',
          }}
        >
          <div
            style={{
              background: '#E8EEF4',
              display: 'flex',
              fontSize: 16,
              fontWeight: 700,
              padding: '12px 18px',
            }}
          >
            <span style={{ flex: 1 }}>Product</span>
            <span style={{ width: 160 }}>Available</span>
            <span style={{ width: 180 }}>Reorder point</span>
          </div>
          {[
            ['Arabica coffee, 1 kg', '152', '80'],
            ['Cold brew bottles', '8', '24'],
            ['Paper cups, 500 count', '0', '40'],
          ].map(([name, available, reorder]) => (
            <div
              key={name}
              style={{
                borderTop: '1px solid #CDD6DF',
                display: 'flex',
                fontSize: 16,
                padding: '13px 18px',
              }}
            >
              <span style={{ flex: 1 }}>{name}</span>
              <span style={{ width: 160 }}>{available}</span>
              <span style={{ width: 180 }}>{reorder}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  )
    .arrayBuffer()
    .then((buffer) => new Uint8Array(buffer))
    .catch((error) => {
      socialImagePng = undefined;
      throw error;
    });

  const png = await socialImagePng;
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
    },
  });
}
