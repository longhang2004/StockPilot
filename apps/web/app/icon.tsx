import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
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
  );
}
