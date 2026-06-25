'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import type { CostCategory, CostNature, DreGroup } from '@/types/database'

type Result =
  | { success: true; category: CostCategory }
  | { success: false; error: string }

export interface CostCategoryInput {
  code: string
  name: string
  nature: CostNature
  dre_group: DreGroup
  dre_subgroup: string | null
  is_active: boolean
}

const VALID_GROUPS_BY_NATURE: Record<CostNature, DreGroup[]> = {
  income:  ['receita_bruta'],
  expense: ['deducoes', 'custo_direto', 'despesa_operacional', 'despesa_financeira'],
}

function validate(i: CostCategoryInput): string | null {
  if (!i.code?.trim()) return 'Informe o código da conta'
  if (!i.name?.trim()) return 'Informe a descrição da conta'
  if (i.nature !== 'income' && i.nature !== 'expense') return 'Tipo inválido'
  if (!VALID_GROUPS_BY_NATURE[i.nature].includes(i.dre_group)) {
    return i.nature === 'income'
      ? 'Receita só pode ir no grupo Receita Bruta'
      : 'Despesa não pode ir no grupo Receita Bruta'
  }
  return null
}

function clean(i: CostCategoryInput) {
  return {
    code: i.code.trim(),
    name: i.name.trim(),
    nature: i.nature,
    dre_group: i.dre_group,
    dre_subgroup: i.dre_subgroup?.trim() || null,
    is_active: i.is_active,
  }
}

export async function createCostCategory(input: CostCategoryInput): Promise<Result> {
  const err = validate(input)
  if (err) return { success: false, error: err }
  const { supabase } = await getActionClient()

  const { data, error } = await supabase
    .from('cost_categories')
    .insert(clean(input))
    .select('*')
    .single()

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'Já existe uma conta com esse código' : error.message,
    }
  }
  revalidatePath('/plano-custo')
  revalidatePath('/financeiro')
  return { success: true, category: data as CostCategory }
}

export async function updateCostCategory(id: string, input: CostCategoryInput): Promise<Result> {
  const err = validate(input)
  if (err) return { success: false, error: err }
  const { supabase } = await getActionClient()

  const { data, error } = await supabase
    .from('cost_categories')
    .update(clean(input))
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'Já existe uma conta com esse código' : error.message,
    }
  }
  revalidatePath('/plano-custo')
  revalidatePath('/financeiro')
  return { success: true, category: data as CostCategory }
}

export async function setCostCategoryActive(
  id: string,
  is_active: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()
  const { error } = await supabase
    .from('cost_categories')
    .update({ is_active })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/plano-custo')
  revalidatePath('/financeiro')
  return { success: true }
}
