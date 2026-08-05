'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ProductInputSchema } from '@stockpilot/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  Drawer,
  FormField,
  UnsavedChangesGuard,
} from '../../../components/ui/operations-ui';
import { closeFormSafely } from '../../../lib/formatters';
import { type ProductRecord } from '../../shared/types';

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type ProductFormValue = z.infer<typeof ProductInputSchema> & {
  isActive?: boolean;
};

export function ProductDrawer({
  open,
  editing,
  imageFile,
  imageError,
  onClose,
  onImageFileChange,
  onRemoveImage,
  onSave,
  pending,
  removeImage,
}: {
  open: boolean;
  editing: ProductRecord | null;
  imageFile: File | null;
  imageError?: string | null;
  onClose: () => void;
  onImageFileChange: (file: File | null) => void;
  onRemoveImage: () => void;
  onSave: (value: ProductFormValue) => void;
  pending: boolean;
  removeImage: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localImageError, setLocalImageError] = useState<string | null>(null);
  const form = useForm<ProductFormValue>({
    resolver: zodResolver(ProductInputSchema) as never,
    defaultValues: {
      description: null,
      name: '',
      reorderPoint: 0,
      salePrice: '0.00',
      sku: '',
    },
  });

  useEffect(() => {
    form.reset(
      editing
        ? {
            description: editing.description,
            isActive: editing.isActive,
            name: editing.name,
            reorderPoint: editing.reorderPoint,
            salePrice: editing.salePrice,
            sku: editing.sku,
          }
        : {
            description: null,
            name: '',
            reorderPoint: 0,
            salePrice: '0.00',
            sku: '',
          },
    );
  }, [editing, form]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const dirty =
    form.formState.isDirty ||
    Boolean(imageFile) ||
    removeImage ||
    Boolean(imageError) ||
    Boolean(localImageError);
  const close = closeFormSafely(dirty, onClose);
  const currentImageUrl =
    !removeImage && !previewUrl ? (editing?.image?.url ?? null) : null;
  const imagePreviewUrl = previewUrl ?? currentImageUrl;
  const imageAlt = editing ? `${editing.name} product image` : 'Product image';

  function selectImage(file: File | undefined) {
    if (!file) return;
    if (!PRODUCT_IMAGE_TYPES.has(file.type)) {
      setLocalImageError('Choose a JPEG, PNG, or WebP image.');
      onImageFileChange(null);
      return;
    }
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setLocalImageError('Product images must be smaller than 5 MiB.');
      onImageFileChange(null);
      return;
    }
    setLocalImageError(null);
    onImageFileChange(file);
  }

  return (
    <Drawer
      description="SKU stays unique inside the current organization."
      onClose={close}
      open={open}
      title={editing ? 'Edit product' : 'Add product'}
    >
      <UnsavedChangesGuard dirty={dirty} />
      <form
        className="form-stack"
        onSubmit={(event) => void form.handleSubmit(onSave)(event)}
      >
        <div className="form-grid">
          <FormField
            error={form.formState.errors.sku?.message}
            htmlFor="product-sku"
            label="SKU"
          >
            <input id="product-sku" {...form.register('sku')} />
          </FormField>
          <FormField
            error={form.formState.errors.name?.message}
            htmlFor="product-name"
            label="Product name"
          >
            <input id="product-name" {...form.register('name')} />
          </FormField>
        </div>
        <div className="form-grid">
          <FormField
            error={form.formState.errors.salePrice?.message}
            htmlFor="product-price"
            label="Sale price"
          >
            <input
              id="product-price"
              placeholder="0.00"
              {...form.register('salePrice')}
            />
          </FormField>
          <FormField
            error={form.formState.errors.reorderPoint?.message}
            htmlFor="product-reorder"
            label="Reorder point"
          >
            <input
              id="product-reorder"
              min="0"
              type="number"
              {...form.register('reorderPoint', { valueAsNumber: true })}
            />
          </FormField>
        </div>
        <FormField
          error={form.formState.errors.description?.message}
          htmlFor="product-description"
          label="Description"
        >
          <textarea
            id="product-description"
            {...form.register('description')}
          />
        </FormField>
        <FormField
          error={imageError ?? localImageError ?? undefined}
          hint="JPEG, PNG, or WebP · up to 5 MiB · one image per SKU"
          htmlFor="product-image"
          label="Product image"
        >
          <div className="product-image-picker">
            {pending ? (
              <span
                aria-live="polite"
                className="product-image-status"
                role="status"
              >
                {imageFile
                  ? 'Uploading image…'
                  : removeImage
                    ? 'Removing image…'
                    : 'Saving product…'}
              </span>
            ) : null}
            {imagePreviewUrl ? (
              <div className="product-image-preview">
                <img
                  alt={imageAlt}
                  height={160}
                  src={imagePreviewUrl}
                  width={160}
                />
                <div className="product-image-preview-copy">
                  <strong>{imageFile?.name ?? 'Current product image'}</strong>
                  <span>
                    {imageFile
                      ? 'Ready to upload when you save.'
                      : `${editing?.image?.width ?? 0} × ${editing?.image?.height ?? 0}px`}
                  </span>
                </div>
                <button
                  className="button button-secondary product-image-remove"
                  disabled={pending}
                  onClick={() => {
                    if (imageFile) {
                      onImageFileChange(null);
                      setLocalImageError(null);
                    } else onRemoveImage();
                  }}
                  type="button"
                >
                  {imageFile ? 'Discard selection' : 'Remove image'}
                </button>
              </div>
            ) : removeImage ? (
              <div className="product-image-removed" role="status">
                <span>Image will be removed when you save.</span>
                <button
                  className="text-link"
                  disabled={pending}
                  onClick={onRemoveImage}
                  type="button"
                >
                  Undo
                </button>
              </div>
            ) : null}
            <label
              className="product-image-dropzone"
              htmlFor="product-image"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                selectImage(event.dataTransfer.files[0]);
              }}
            >
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={pending}
                id="product-image"
                onChange={(event) => {
                  selectImage(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
                type="file"
              />
              <strong>
                {imagePreviewUrl ? 'Replace image' : 'Choose an image'}
              </strong>
              <span>Drop a product photo here or browse files.</span>
            </label>
          </div>
        </FormField>
        {editing ? (
          <label className="checkbox-field">
            <input type="checkbox" {...form.register('isActive')} /> Active
            product
          </label>
        ) : null}
        <div className="drawer-action-row">
          <button
            className="button button-secondary"
            onClick={close}
            type="button"
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
