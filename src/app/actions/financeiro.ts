'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { uploadFile, buildPath, getSignedUrl } from '@/lib/storage'
import type { EntryType, PaymentMethod, FinancialEntryStatus } from '@/types/database'
import {
  generateRecurrenceDates,
  RECURRENCE_LIMIT,
  type RecurrenceFrequency,
} from '@/lib/recurrence'

type Result = { success: boolean; error?: string }
type CreateResult = { success: boolean; entry?: Record<string, unknown>; error?: string }

export async function createFinancialEntry(formData: FormData): Promise<CreateResult> {
  const { supabase, userId } = await getActionClient()

  const projectId = formData.get('project_id') as string
  if (!projectId) return { success: false, error: 'Obra não selecionada' }

  let proofPath: string | null = null
  const proofFile = formData.get('proof') as File | null

  if (proofFile && proofFile.size > 0) {
    const path = buildPath([
      'obras', projectId, 'comprovantes', `${Date.now()}-${proofFile.name}`,
    ])
    try {
      proofPath = await uploadFile('obra-comprovantes', path, proofFile)
    } catch {
      // Salva sem comprovante se upload falhar
    }
  }

  const supplierIdRaw = formData.get('supplier_id') as string
  const supplierId = supplierIdRaw && supplierIdRaw !== 'none' ? supplierIdRaw : null

  const { data, error } = await supabase
    .from('financial_entries')
    .insert({
      project_id: projectId,
      entry_type: formData.get('entry_type') as EntryType,
      entry_date: formData.get('entry_date') as string,
      description: formData.get('description') as string,
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
      category_id: (formData.get('category_id') as string) || null,
      payment_method: (formData.get('payment_method') as PaymentMethod) || null,
      counterpart: (formData.get('counterpart') as string) || null,
      supplier_id: supplierId,
      phase_id: (formData.get('phase_id') as string) || null,
      storage_path_proof: proofPath,
      notes: (formData.get('notes') as string) || null,
      status: (formData.get('status') as FinancialEntryStatus) || 'pago',
      payment_date: (formData.get('status') as string) === 'pago'
        ? ((formData.get('payment_date') as string) || null)
        : null,
      scheduled_date: (formData.get('status') as string) === 'agendado'
        ? ((formData.get('scheduled_date') as string) || null)
        : null,
      due_date: (formData.get('due_date') as string) || null,
      paid_by: (formData.get('paid_by') as string) || null,
      nf_number: (formData.get('nf_number') as string) || null,
      // Só controla na conta corrente quando há fornecedor vinculado
      in_supplier_account:
        ((formData.get('in_supplier_account') as string) === 'true') && !!supplierId,
      created_by: userId,
    })
    .select('*, projects(id, name)')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/obras/${projectId}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true, entry: data as Record<string, unknown> }
}

export async function createRecurringFinancialEntries(
  formData: FormData,
): Promise<{ success: boolean; count?: number; error?: string }> {
  const { supabase, userId } = await getActionClient()

  const projectId = formData.get('project_id') as string
  if (!projectId) return { success: false, error: 'Obra não selecionada' }

  const startDate = formData.get('entry_date') as string
  const until     = formData.get('recurrence_until') as string
  const frequency = formData.get('recurrence_frequency') as RecurrenceFrequency
  if (!until) return { success: false, error: 'Informe a data final da recorrência' }
  if (!['semanal', 'quinzenal', 'mensal'].includes(frequency)) {
    return { success: false, error: 'Frequência inválida' }
  }

  const dates = generateRecurrenceDates(startDate, until, frequency)
  if (dates.length === 0) {
    return { success: false, error: 'A data final é anterior à data do lançamento' }
  }
  if (dates.length > RECURRENCE_LIMIT) {
    return { success: false, error: `Limite de ${RECURRENCE_LIMIT} repetições excedido` }
  }

  let proofPath: string | null = null
  const proofFile = formData.get('proof') as File | null
  if (proofFile && proofFile.size > 0) {
    const path = buildPath([
      'obras', projectId, 'comprovantes', `${Date.now()}-${proofFile.name}`,
    ])
    try {
      proofPath = await uploadFile('obra-comprovantes', path, proofFile)
    } catch {
      // Salva sem comprovante se upload falhar
    }
  }

  const supplierIdRaw = formData.get('supplier_id') as string
  const supplierId = supplierIdRaw && supplierIdRaw !== 'none' ? supplierIdRaw : null
  const description = formData.get('description') as string

  const rows = dates.map((date, i) => ({
    project_id: projectId,
    entry_type: formData.get('entry_type') as EntryType,
    entry_date: date,
    description: `${description} (${i + 1}/${dates.length})`,
    amount: Number(formData.get('amount')),
    category: formData.get('category') as string,
    category_id: (formData.get('category_id') as string) || null,
    payment_method: (formData.get('payment_method') as PaymentMethod) || null,
    counterpart: (formData.get('counterpart') as string) || null,
    supplier_id: supplierId,
    phase_id: (formData.get('phase_id') as string) || null,
    storage_path_proof: proofPath,
    notes: (formData.get('notes') as string) || null,
    status: 'agendado' as FinancialEntryStatus,
    payment_date: null,
    scheduled_date: date,
    due_date: date,
    paid_by: (formData.get('paid_by') as string) || null,
    in_supplier_account:
      ((formData.get('in_supplier_account') as string) === 'true') && !!supplierId,
    created_by: userId,
  }))

  // Insert em lote: uma única query para todas as ocorrências
  const { error } = await supabase.from('financial_entries').insert(rows)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/obras/${projectId}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true, count: rows.length }
}

export async function updateFinancialEntry(
  entryId: string,
  formData: FormData,
): Promise<{ success: boolean; entry?: Record<string, unknown>; error?: string }> {
  const { supabase } = await getActionClient()

  const existingRes = await supabase
    .from('financial_entries')
    .select('project_id, storage_path_proof')
    .eq('id', entryId)
    .single()
  if (existingRes.error) return { success: false, error: existingRes.error.message }
  const { project_id: projectId, storage_path_proof: existingProof } = existingRes.data

  let proofPath: string | null = existingProof
  const proofFile = formData.get('proof') as File | null
  if (proofFile && proofFile.size > 0) {
    const path = buildPath(['obras', projectId, 'comprovantes', `${Date.now()}-${proofFile.name}`])
    try {
      proofPath = await uploadFile('obra-comprovantes', path, proofFile)
    } catch {
      // mantém comprovante anterior se upload falhar
    }
  }

  const supplierIdRaw = formData.get('supplier_id') as string
  const supplierId = supplierIdRaw && supplierIdRaw !== 'none' ? supplierIdRaw : null

  const { data, error } = await supabase
    .from('financial_entries')
    .update({
      entry_type:          formData.get('entry_type') as EntryType,
      entry_date:          formData.get('entry_date') as string,
      description:         formData.get('description') as string,
      amount:              Number(formData.get('amount')),
      category:            formData.get('category') as string,
      category_id:         (formData.get('category_id') as string) || null,
      payment_method:      (formData.get('payment_method') as PaymentMethod) || null,
      counterpart:         (formData.get('counterpart') as string) || null,
      supplier_id:         supplierId,
      phase_id:            (formData.get('phase_id') as string) || null,
      storage_path_proof:  proofPath,
      notes:               (formData.get('notes') as string) || null,
      status:              (formData.get('status') as FinancialEntryStatus) || 'pago',
      payment_date:        (formData.get('status') as string) === 'pago'
        ? ((formData.get('payment_date') as string) || null)
        : null,
      scheduled_date:      (formData.get('status') as string) === 'agendado'
        ? ((formData.get('scheduled_date') as string) || null)
        : null,
      due_date:            (formData.get('due_date') as string) || null,
      paid_by:             (formData.get('paid_by') as string) || null,
      nf_number:           (formData.get('nf_number') as string) || null,
      // Só controla na conta corrente quando há fornecedor vinculado
      in_supplier_account:
        ((formData.get('in_supplier_account') as string) === 'true') && !!supplierId,
    })
    .eq('id', entryId)
    .select('*, projects(id, name)')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath(`/obras/${projectId}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true, entry: data as Record<string, unknown> }
}

export async function getProofUrl(
  path: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  await getActionClient() // garante sessão autenticada antes de assinar a URL
  try {
    const url = await getSignedUrl('obra-comprovantes', path)
    return { success: true, url }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao gerar URL' }
  }
}

export async function bulkMarkPaid(
  entryIds: string[],
  paymentDate: string,
  paymentMethod?: PaymentMethod | null,
): Promise<Result> {
  if (entryIds.length === 0) return { success: false, error: 'Nenhum lançamento selecionado' }
  const { supabase } = await getActionClient()

  const update: Record<string, unknown> = { status: 'pago', payment_date: paymentDate, scheduled_date: null }
  if (paymentMethod) update.payment_method = paymentMethod

  const { error } = await supabase
    .from('financial_entries')
    .update(update)
    .in('id', entryIds)

  if (error) return { success: false, error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function bulkDeleteEntries(entryIds: string[]): Promise<Result> {
  if (entryIds.length === 0) return { success: false, error: 'Nenhum lançamento selecionado' }
  const { supabase } = await getActionClient()

  const { error } = await supabase
    .from('financial_entries')
    .delete()
    .in('id', entryIds)

  if (error) return { success: false, error: error.message }

  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteFinancialEntry(entryId: string, projectId: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('financial_entries').delete().eq('id', entryId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  return { success: true }
}
