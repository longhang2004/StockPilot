import { createSocialImage } from './social-image';

export const runtime = 'nodejs';
export const alt =
  'StockPilot inventory and B2B order operations workspace overview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function TwitterImage() {
  return createSocialImage();
}
