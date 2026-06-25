ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;
