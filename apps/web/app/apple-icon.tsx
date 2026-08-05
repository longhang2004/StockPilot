import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
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
  );
}
