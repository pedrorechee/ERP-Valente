ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS due_date date;