'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'

// Abre o orçamento ÚNICO da obra: devolve o existente (qualquer status) se já
// houver; caso contrário cria um em rascunho. NUNCA cria um segundo orçamento.
// `alreadyExists` indica que a obra já tinha orçamento (a UI avisa e redireciona).
export async function createBudget(
  projectId: string,
): Promise<{ success: boolean; id?: string; alreadyExists?: boolean; error?: string }> {
  if (!projectId) return { success: false, error: 'Obra não selecionada' }
  const { supabase } = await getActionClient()

  // Já existe orçamento para a obra? Então é ele — não cria outro.
  const { data: existing } = await supabase
    .from('budgets')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)

  const found = (existing as { id: string }[] | null)?.[0]
  if (found) return { success: true, id: found.id, alreadyExists: true }

  // BDI inicial vindo das Preferências (Configurações); fallback 12
  const { data: prefs } = await supabase
    .from('company_settings')
    .select('default_bdi_percent')
    .limit(1)
    .maybeSingle()
  const defaultBdi = (prefs as { default_bdi_percent: number | null } | null)?.default_bdi_percent ?? 12

  const { data, error } = await supabase
    .from('budgets')
    .insert({
      project_id:  projectId,
      version:     1,
      status:      'rascunho',
      bdi_percent: defaultBdi,
    })
    .select('id')
    .single()

  // Corrida: se o UNIQUE(project_id) barrar um insert simultâneo, devolve o existente.
  if (error) {
    const { data: again } = await supabase
      .from('budgets')
      .select('id')
      .eq('project_id', projectId)
      .limit(1)
    const other = (again as { id: string }[] | null)?.[0]
    if (other) return { success: true, id: other.id, alreadyExists: true }
    return { success: false, error: error.message }
  }

  revalidatePath('/orcamentos')
  return { success: true, id: (data as { id: string }).id }
}

// Item enviado pelo construtor (sem id — itens são regravados a cada save)
export interface SaveBudgetItem {
  phase_id:    string | null
  description: string
  unit:        string | null
  quantity:    number
  unit_price:  number
  bdi_override: number | null   // BDI específico do item (null = usa o BDI geral)
  category_id: string | null
  order_index: number
}

interface SaveBudgetPayload {
  bdi_percent:       number
  phase_bdi_enabled: boolean
  description:       string | null
  items:            SaveBudgetItem[]
}

// Regrava os itens, recalcula e persiste os totais (custo direto e preço com BDI).
// Mantém o status atual (rascunho continua rascunho; aprovado continua aprovado).
export async function saveBudget(
  budgetId: string,
  payload: SaveBudgetPayload,
): Promise<{ success: boolean; budget?: Record<string, unknown>; items?: Record<string, unknown>[]; error?: string }> {
  const { supabase } = await getActionClient()

  // Ignora linhas em branco (sem descrição)
  const clean = payload.items.filter((i) => i.description.trim() !== '')
  const directCost = clean.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const bdi = Number(payload.bdi_percent) || 0
  // Preço com BDI: cada item usa seu bdi_override quando houver; senão o BDI geral.
  // (Com BDI por fase desligado, bdi_override é null e cai no BDI geral → mesmo resultado de antes.)
  const withBdi = clean.reduce((s, i) => {
    const eff = i.bdi_override != null ? i.bdi_override : bdi
    return s + i.quantity * i.unit_price * (1 + eff / 100)
  }, 0)

  // Substitui todos os itens (budget_items não é referenciado por nada)
  const del = await supabase.from('budget_items').delete().eq('budget_id', budgetId)
  if (del.error) return { success: false, error: del.error.message }

  if (clean.length > 0) {
    const rows = clean.map((i, idx) => ({
      budget_id:    budgetId,
      phase_id:     i.phase_id,
      description:  i.description.trim(),
      unit:         i.unit,
      quantity:     i.quantity,
      unit_price:   i.unit_price,
      total:        i.quantity * i.unit_price,
      bdi_override: i.bdi_override,
      category_id:  i.category_id,
      order_index:  i.order_index ?? idx,
    }))
    const ins = await supabase.from('budget_items').insert(rows)
    if (ins.error) return { success: false, error: ins.error.message }
  }

  const { data: budget, error } = await supabase
    .from('budgets')
    .update({
      bdi_percent:       bdi,
      phase_bdi_enabled: payload.phase_bdi_enabled,
      description:       payload.description,
      total_direct_cost: directCost,
      total_with_bdi:    withBdi,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', budgetId)
    .select('*, projects(id, name)')
    .single()
  if (error) return { success: false, error: error.message }

  const { data: items } = await supabase
    .from('budget_items')
    .select('*')
    .eq('budget_id', budgetId)
    .order('order_index', { ascending: true })

  // Salvar pode mudar os totais usados em todas as telas derivadas (quando aprovado)
  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${budgetId}`)
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  return {
    success: true,
    budget: budget as Record<string, unknown>,
    items: (items ?? []) as Record<string, unknown>[],
  }
}

// Finaliza o orçamento: rascunho → aprovado. A partir daqui os valores passam a
// alimentar orçado x realizado, DRE, dashboard, etc. Como há UNIQUE(project_id),
// existe no máximo um orçamento por obra — não há nada a substituir.
export async function finalizeBudget(
  budgetId: string,
): Promise<{ success: boolean; budget?: Record<string, unknown>; error?: string }> {
  const { supabase } = await getActionClient()

  const now = new Date().toISOString()
  const { data: budget, error } = await supabase
    .from('budgets')
    .update({ status: 'aprovado', approved_at: now, updated_at: now })
    .eq('id', budgetId)
    .select('*, projects(id, name)')
    .single()
  if (error) return { success: false, error: error.message }

  const projectId = (budget as { project_id?: string } | null)?.project_id
  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${budgetId}`)
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  if (projectId) revalidatePath(`/obras/${projectId}`)
  return { success: true, budget: budget as Record<string, unknown> }
}

// Reabre um orçamento aprovado como rascunho (tira do ar enquanto reformula).
// Volta a NÃO alimentar os cálculos até ser finalizado de novo.
export async function reopenBudget(
  budgetId: string,
): Promise<{ success: boolean; budget?: Record<string, unknown>; error?: string }> {
  const { supabase } = await getActionClient()

  const now = new Date().toISOString()
  const { data: budget, error } = await supabase
    .from('budgets')
    .update({ status: 'rascunho', approved_at: null, updated_at: now })
    .eq('id', budgetId)
    .select('*, projects(id, name)')
    .single()
  if (error) return { success: false, error: error.message }

  const projectId = (budget as { project_id?: string } | null)?.project_id
  revalidatePath('/orcamentos')
  revalidatePath(`/orcamentos/${budgetId}`)
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  if (projectId) revalidatePath(`/obras/${projectId}`)
  return { success: true, budget: budget as Record<string, unknown> }
}

// Exclui o orçamento PERMANENTEMENTE (hard delete), junto com todos os itens.
// A FK budget_items.budget_id é ON DELETE CASCADE, mas removemos os itens
// explicitamente antes — defensivo, garante zero rastro mesmo sem o cascade.
export async function deleteBudget(
  budgetId: string,
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  const { supabase } = await getActionClient()

  // project_id é necessário para revalidar as telas derivadas da obra
  const { data: b } = await supabase
    .from('budgets')
    .select('project_id')
    .eq('id', budgetId)
    .single()

  const delItems = await supabase.from('budget_items').delete().eq('budget_id', budgetId)
  if (delItems.error) return { success: false, error: delItems.error.message }

  const { error } = await supabase.from('budgets').delete().eq('id', budgetId)
  if (error) return { success: false, error: error.message }

  const projectId = (b as { project_id: string } | null)?.project_id

  // Invalida tudo que deriva do orçamento (lista, dashboard, DRE, obra/Curva S)
  revalidatePath('/orcamentos')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  if (projectId) revalidatePath(`/obras/${projectId}`)

  return { success: true, projectId }
}
