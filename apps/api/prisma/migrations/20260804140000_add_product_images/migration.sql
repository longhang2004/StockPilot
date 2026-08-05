-- Product image metadata is deliberately nullable so existing catalog rows
-- remain valid and image storage can be enabled independently.
ALTER TABLE "products"
  ADD COLUMN "image_public_id" VARCHAR(255),
  ADD COLUMN "image_version" INTEGER,
  ADD COLUMN "image_width" INTEGER,
  ADD COLUMN "image_height" INTEGER,
  ADD COLUMN "image_format" VARCHAR(16),
  ADD COLUMN "image_bytes" INTEGER;

ALTER TABLE "products"
  ADD CONSTRAINT "products_image_dimensions_check"
  CHECK (
    ("image_public_id" IS NULL AND "image_version" IS NULL AND "image_width" IS NULL AND "image_height" IS NULL AND "image_format" IS NULL AND "image_bytes" IS NULL)
    OR ("image_public_id" IS NOT NULL AND "image_version" IS NOT NULL AND "image_width" > 0 AND "image_height" > 0 AND "image_format" IS NOT NULL AND "image_bytes" > 0)
  );

GRANT SELECT, INSERT, UPDATE ON TABLE "products" TO stockpilot_app;
