ALTER TABLE case_assets DROP CONSTRAINT case_assets_asset_type_check;
ALTER TABLE case_assets ADD CONSTRAINT case_assets_asset_type_check CHECK (asset_type = ANY (ARRAY['image', 'video', 'text']));