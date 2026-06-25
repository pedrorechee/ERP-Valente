-- Adiciona campos status e paid_by à tabela financial_entries

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pago'
    CHECK (status IN ('pago', 'pendente', 'agendado')),
  ADD COLUMN IF NOT EXISTS paid_by TEXT;
