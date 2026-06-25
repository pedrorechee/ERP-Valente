-- Conta corrente de fornecedores: notas e pagamentos com saldo corrido
CREATE TABLE IF NOT EXISTS supplier_account_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('nota', 'pagamento')),
  description    TEXT NOT NULL,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('cash','pix','boleto','card','transfer','check')),
  receipt_url    TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplier_account_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_admin_supplier_account_entries"
  ON supplier_account_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner', 'admin')
    )
  );
