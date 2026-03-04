

# Fix: Check constraint blocks "text" asset_type for Info Tambahan

The `case_assets` table has a CHECK constraint limiting `asset_type` to `'image'` or `'video'`. When saving Info Tambahan, the code sets `asset_type: "text"`, which violates this constraint.

## Solution

Run a migration to add `'text'` to the allowed values:

```sql
ALTER TABLE case_assets DROP CONSTRAINT case_assets_asset_type_check;
ALTER TABLE case_assets ADD CONSTRAINT case_assets_asset_type_check CHECK (asset_type = ANY (ARRAY['image', 'video', 'text']));
```

Single migration file, no frontend changes needed.

