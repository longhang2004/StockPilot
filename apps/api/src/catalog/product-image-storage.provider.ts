import { CloudinaryImageStorage } from './product-image-storage.js';

export const PRODUCT_IMAGE_STORAGE = Symbol('PRODUCT_IMAGE_STORAGE');

export const productImageStorageProvider = {
  provide: PRODUCT_IMAGE_STORAGE,
  useExisting: CloudinaryImageStorage,
};
