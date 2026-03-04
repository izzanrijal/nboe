ALTER TABLE case_assets 
  ADD COLUMN category text NOT NULL DEFAULT 'examination',
  ADD COLUMN answer_text text NOT NULL DEFAULT '';