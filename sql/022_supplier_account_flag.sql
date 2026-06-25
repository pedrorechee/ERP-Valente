-- ============================================================
-- 022 — Conta corrente do fornecedor como flag no lançamento
-- Rodar no SQL Editor do Supabase
--
-- A partir daqui, TODO lançamento é feito em "Lançamentos"
-- (financial_entries). A aba "Contas de Fornecedores" passa a
-- ser apenas VISUALIZAÇÃO, derivada dos lançamentos que tiverem
-- esta flag ligada e um fornecedor vinculado.
--
-- A tabela supplier_account_entries NÃO é excluída — apenas
-- deixa de ser lida/escrita pelo sistema.
-- ============================================================

-- Flag: quando true, o lançamento entra no saldo e no extrato
-- do fornecedor em Contas de Fornecedores.
ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS in_supplier_account boolean NOT NULL DEFAULT false;

-- Lançamentos existentes que já têm fornecedor vinculado passam
-- a ser controlados na conta corrente (assim a aba não nasce vazia).
UPDATE financial_entries
  SET in_supplier_account = true
  WHERE supplier_id IS NOT NULL
    AND in_supplier_account = false;
