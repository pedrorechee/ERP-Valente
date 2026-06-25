'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActionClient } from '@/lib/supabase/action'
import type { SupplierType } from '@/types/database'

type Result = { success: boolean; error?: string }

// Stats sob demanda do modal de detalhes: avaliação média + saldo da conta corrente
export async function getSupplierModalStats(supplierId: string): Promise<{
  success: boolean
  avgQuality?: number | null
  evaluationCount?: number
  saldoContaCorrente?: number
  error?: string
}> {
  const { supabase } = await getActionClient()

  const [evalsRes, accountRes] = await Promise.all([
    supabase
      .from('supplier_evaluations')
      .select('quality_score')
      .eq('supplier_id', supplierId),
    // Saldo derivado dos lançamentos controlados na conta corrente (fonte única)
    supabase
      .from('financial_entries')
      .select('entry_type, status, amount')
      .eq('supplier_id', supplierId)
      .eq('in_supplier_account', true),
  ])

  if (evalsRes.error) return { success: false, error: evalsRes.error.message }
  if (accountRes.error) return { success: false, error: accountRes.error.message }

  const scores = ((evalsRes.data as { quality_score: number | null }[]) ?? [])
    .map((e) => e.quality_score)
    .filter((s): s is number => s !== null)
  const avgQuality =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  // Saldo devedor: saídas controladas pendentes/agendadas, menos entradas (estornos)
  const saldoContaCorrente = (
    (accountRes.data as { entry_type: string; status: string; amount: number }[]) ?? []
  ).reduce((s, e) => {
    if (e.entry_type === 'income') return s - e.amount
    return e.status === 'pago' ? s : s + e.amount
  }, 0)

  return { success: true, avgQuality, evaluationCount: scores.length, saldoContaCorrente }
}

export async function createSupplier(formData: FormData): Promise<void> {
  const { supabase } = await getActionClient()

  const { data, error } = await supabase.from('suppliers').insert({
    name: formData.get('name') as string,
    type: (formData.get('type') as SupplierType) || 'outros',
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    document: (formData.get('document') as string) || null,
    pix_key: (formData.get('pix_key') as string) || null,
    notes: (formData.get('notes') as string) || null,
    is_active: true,
  }).select('id').single()

  if (error || !data) {
    redirect('/fornecedores?error=Erro+ao+cadastrar+fornecedor')
  }

  revalidatePath('/fornecedores')
  redirect(`/fornecedores/${(data as { id: string }).id}`)
}

export async function updateSupplier(id: string, formData: FormData): Promise<Result> {
  const { supabase } = await getActionClient()

  const { error } = await supabase.from('suppliers').update({
    name: formData.get('name') as string,
    type: (formData.get('type') as SupplierType) || 'outros',
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    document: (formData.get('document') as string) || null,
    pix_key: (formData.get('pix_key') as string) || null,
    notes: (formData.get('notes') as string) || null,
    is_active: formData.get('is_active') !== 'false',
  }).eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/fornecedores')
  revalidatePath(`/fornecedores/${id}`)
  return { success: true }
}

export async function deleteSupplier(id: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/fornecedores')
  return { success: true }
}

export async function createEvaluation(
  supplierId: string,
  formData: FormData,
): Promise<Result & { evaluation?: Record<string, unknown> }> {
  const { supabase, userId } = await getActionClient()

  const qualityRaw = Number(formData.get('quality_score'))
  const metRaw = formData.get('met_deadline')

  const { data, error } = await supabase
    .from('supplier_evaluations')
    .insert({
      supplier_id: supplierId,
      project_id: formData.get('project_id') as string,
      quality_score: qualityRaw > 0 ? qualityRaw : null,
      met_deadline: metRaw === 'true' ? true : metRaw === 'false' ? false : null,
      observation: (formData.get('observation') as string) || null,
      evaluated_by: userId,
    })
    .select('*, projects(id, name)')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/fornecedores/${supplierId}`)
  return { success: true, evaluation: data as Record<string, unknown> }
}

export async function deleteEvaluation(evalId: string, supplierId: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('supplier_evaluations').delete().eq('id', evalId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/fornecedores/${supplierId}`)
  return { success: true }
}
