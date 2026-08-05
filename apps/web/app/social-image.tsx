import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

const overviewPath = join(process.cwd(), 'public/assets/overview-desktop.png');

export async function createSocialImage() {
  const overview = await readFile(overviewPath, 'base64');

  return new ImageResponse(
    <div
      style={{
        background: '#F2F0EA',
        color: '#17201F',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial',
        height: '100%',
        padding: 64,
        width: '100%',
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
        <div
          style={{
            alignItems: 'center',
            background: '#17201F',
            borderRadius: 14,
            color: '#FCFBF7',
            display: 'flex',
            fontSize: 24,
            fontWeight: 700,
            height: 56,
            justifyContent: 'center',
            width: 56,
          }}
        >
          SP
        </div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>StockPilot</div>
      </div>
      <div style={{ display: 'flex', flex: 1, gap: 54, paddingTop: 44 }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 430 }}>
          <div
            style={{
              color: '#5D6562',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Inventory · Orders · Trust
          </div>
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
              paddingTop: 24,
            }}
          >
            Operations, under control.
          </div>
          <div
            style={{
              color: '#5D6562',
              fontSize: 24,
              lineHeight: 1.35,
              paddingTop: 24,
            }}
          >
            A working B2B inventory operations demo for small wholesale teams.
          </div>
        </div>
        <div
          style={{
            border: '1px solid #D9D6CE',
            borderRadius: 12,
            display: 'flex',
            overflow: 'hidden',
            width: 650,
          }}
        >
          <img
            alt="StockPilot operations overview"
            src={`data:image/png;base64,${overview}`}
            style={{ height: 'auto', objectFit: 'cover', width: '100%' }}
          />
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
