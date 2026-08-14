import { z } from 'zod';

import {
  DateTimeSchema,
  MoneyStringSchema,
  OptionalContactSchema,
  OptionalEmailSchema,
  OptionalPhoneSchema,
  PageShapeSchema,
  UuidSchema,
} from './common.js';

// ---------------------------------------------------------------------------
// Input contracts (parsed by the API and reused by web forms)
// ---------------------------------------------------------------------------

export const ProductInputSchema = z.object({
  description: z.string().trim().max(2_000).nullable().optional().default(null),
  name: z.string().trim().min(2).max(160),
  reorderPoint: z.number().int().min(0).max(1_000_000),
  salePrice: z
    .string()
    .regex(/^\d{1,10}\.\d{2}$/)
    .refine((value) => Number(value) >= 0, 'Sale price cannot be negative.'),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
    .transform((value) => value.toUpperCase()),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

/** Public metadata returned after a product image is stored. */
export const ProductImageSchema = z.object({
  url: z.url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string().trim().min(1),
});
export type ProductImage = z.infer<typeof ProductImageSchema>;

export const CustomerInputSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: OptionalContactSchema,
  email: OptionalEmailSchema,
  phone: OptionalPhoneSchema,
});
export type CustomerInput = z.infer<typeof CustomerInputSchema>;

export const SupplierInputSchema = CustomerInputSchema;
export type SupplierInput = z.infer<typeof SupplierInputSchema>;

// ---------------------------------------------------------------------------
// Response contracts (wire shape produced by the API serializers)
// ---------------------------------------------------------------------------

export const ProductSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  salePrice: MoneyStringSchema,
  reorderPoint: z.number().int().min(0),
  isActive: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  image: ProductImageSchema.nullable(),
});
export type Product = z.infer<typeof ProductSchema>;

export const CustomerSchema = z.object({
  id: UuidSchema,
  organizationId: UuidSchema,
  companyName: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
});
export type Customer = z.infer<typeof CustomerSchema>;

export const SupplierSchema = CustomerSchema;
export type Supplier = z.infer<typeof SupplierSchema>;

export const ProductListSchema = PageShapeSchema.extend({
  items: z.array(ProductSchema),
});
export type ProductList = z.infer<typeof ProductListSchema>;

export const CustomerListSchema = PageShapeSchema.extend({
  items: z.array(CustomerSchema),
});
export type CustomerList = z.infer<typeof CustomerListSchema>;

export const SupplierListSchema = PageShapeSchema.extend({
  items: z.array(SupplierSchema),
});
export type SupplierList = z.infer<typeof SupplierListSchema>;
