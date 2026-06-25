'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { uploadFile, buildPath, getSignedUrl } from '@/lib/storage'
import { netoMedicao } from '@/lib/medicao'
import type { ContractStatus, AmendmentType, MeasurementStatus } from '@/types/database'

// Sincroniza a obra com o contrato: contract_value = Valor Total (original +
// aditivos de valor) e expected_end_date = Prazo Atual (término + dias dos
// aditivos). Só roda quando há contrato; se a obra não tiver contrato, ela
// continua funcionando como antes. (Conexão da Seção 6.)
async function syncProjectFromContract(
  supabase: Awaited<ReturnType<typeof getActionClient>>['supabase'],
  contractId: string,
): Promise<void> {
  const { data: contract } = await supabase
    .from('contracts')
    .select('project_id, original_value, end_date')
    .eq('id', contractId)
    .single()
  if (!contract) return
  const c = contract as { project_id: string; original_value: number; end_date: string | null }

  const { data: amends } = await supabase
    .from('contract_amendments')
    .select('value_change, days_change')
    .eq('contract_id', contractId)
  const list = (amends as { value_change: number; days_change: number }[] | null) ?? []

  const totalValue = (c.original_value || 0) + list.reduce((s, a) => s + (a.value_change || 0), 0)
  const daysAdded = list.reduce((s, a) => s + (a.days_change || 0), 0)

  const update: Record<string, unknown> = { contract_value: totalValue }
  if (c.end_date) {
    const d = new Date(c.end_date + 'T12:00:00')
    d.setDate(d.getDate() + daysAdded)
    update.expected_end_date = d.toISOString().slice(0, 10)
  }
  await supabase.from('projects').update(update).eq('id', c.project_id)
}

// Cria o contrato principal da obra e devolve o id (abre o detalhe).
// Bloqueia um 2º contrato para a mesma obra (também há índice único no banco).
export async function createContract(
  projectId: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!projectId) return { success: false, error: 'Obra não selecionada' }
  const { supabase } = await getActionClient()

  const { data: existing } = await supabase
    .from('contracts')
    .select('id')
    .eq('project_id', projectId)
    .limit(1)

  if (((existing as { id: string }[] | null) ?? []).length > 0) {
    return { success: false, error: 'Esta obra já possui um contrato.' }
  }

  // Retenção inicial vinda das Preferências (Configurações); fallback 0
  const { data: prefs } = await supabase
    .from('company_settings')
    .select('default_retention_percent')
    .limit(1)
    .maybeSingle()
  const defaultRetention = (prefs as { default_retention_percent: number | null } | null)?.default_retention_percent ?? 0

  const { data, error } = await supabase
    .from('contracts')
    .insert({ project_id: projectId, status: 'ativo', retention_percent: defaultRetention })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/contratos')
  return { success: true, id: (data as { id: string }).id }
}

// Atualiza os dados do cabeçalho do contrato + upload opcional do PDF.
export async function updateContract(
  contractId: string,
  formData: FormData,
): Promise<{ success: boolean; contract?: Record<string, unknown>; error?: string }> {
  const { supabase } = await getActionClient()

  const { data: existing, error: exErr } = await supabase
    .from('contracts')
    .select('project_id, document_path')
    .eq('id', contractId)
    .single()
  if (exErr) return { success: false, error: exErr.message }
  const { project_id: projectId, document_path: existingDoc } =
    existing as { project_id: string; document_path: string | null }

  let docPath: string | null = existingDoc
  const docFile = formData.get('document') as File | null
  if (docFile && docFile.size > 0) {
    const path = buildPath(['obras', projectId, 'contratos', `${Date.now()}-${docFile.name}`])
    try {
      docPath = await uploadFile('obra-documentos', path, docFile)
    } catch {
      // mantém o documento anterior se o upload falhar
    }
  }

  const { data, error } = await supabase
    .from('contracts')
    .update({
      contract_number:   (formData.get('contract_number') as string) || null,
      original_value:    Number(formData.get('original_value')) || 0,
      signing_date:      (formData.get('signing_date') as string) || null,
      start_date:        (formData.get('start_date') as string) || null,
      end_date:          (formData.get('end_date') as string) || null,
      retention_percent: Number(formData.get('retention_percent')) || 0,
      status:            ((formData.get('status') as ContractStatus) || 'ativo'),
      notes:             (formData.get('notes') as string) || null,
      document_path:     docPath,
    })
    .eq('id', contractId)
    .select('*, projects(id, name)')
    .single()

  if (error) return { success: false, error: error.message }

  // Reflete Valor Total e Prazo Atual na obra (Seção 6)
  await syncProjectFromContract(supabase, contractId)

  revalidatePath('/contratos')
  revalidatePath(`/contratos/${contractId}`)
  revalidatePath('/dashboard')
  if (projectId) revalidatePath(`/obras/${projectId}`)

  return { success: true, contract: data as Record<string, unknown> }
}

// URL assinada para visualizar o PDF do contrato.
export async function getContractDocUrl(
  path: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  await getActionClient() // garante sessão autenticada antes de assinar a URL
  try {
    const url = await getSignedUrl('obra-documentos', path)
    return { success: true, url }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao gerar URL' }
  }
}

// ── Aditivos ───────────────────────────────────────────────

// Cria um aditivo (número sequencial automático) + upload opcional do documento.
export async function createAmendment(
  contractId: string,
  formData: FormData,
): Promise<{ success: boolean; amendment?: Record<string, unknown>; error?: string }> {
  const { supabase } = await getActionClient()

  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select('project_id')
    .eq('id', contractId)
    .single()
  if (cErr) return { success: false, error: cErr.message }
  const projectId = (contract as { project_id: string }).project_id

  const { data: last } = await supabase
    .from('contract_amendments')
    .select('amendment_number')
    .eq('contract_id', contractId)
    .order('amendment_number', { ascending: false })
    .limit(1)
  const next = ((last as { amendment_number: number }[] | null)?.[0]?.amendment_number ?? 0) + 1

  let docPath: string | null = null
  const docFile = formData.get('document') as File | null
  if (docFile && docFile.size > 0) {
    const path = buildPath(['obras', projectId, 'contratos', 'aditivos', `${Date.now()}-${docFile.name}`])
    try {
      docPath = await uploadFile('obra-documentos', path, docFile)
    } catch {
      // segue sem documento se o upload falhar
    }
  }

  const { data, error } = await supabase
    .from('contract_amendments')
    .insert({
      contract_id:      contractId,
      amendment_number: next,
      type:             (formData.get('type') as AmendmentType) || 'valor',
      value_change:     Number(formData.get('value_change')) || 0,
      days_change:      Math.trunc(Number(formData.get('days_change')) || 0),
      date:             formData.get('date') as string,
      description:      (formData.get('description') as string) || null,
      document_path:    docPath,
    })
    .select('*')
    .single()
  if (error) return { success: false, error: error.message }

  // Recalcula Valor Total e Prazo Atual da obra (Seção 6)
  await syncProjectFromContract(supabase, contractId)

  revalidatePath('/contratos')
  revalidatePath(`/contratos/${contractId}`)
  revalidatePath(`/obras/${projectId}`)
  return { success: true, amendment: data as Record<string, unknown> }
}

// Atualiza um aditivo existente (mantém o número) + upload opcional de documento.
export async function updateAmendment(
  amendmentId: string,
  formData: FormData,
): Promise<{ success: boolean; amendment?: Record<string, unknown>; error?: string }> {
  const { supabase } = await getActionClient()

  const { data: existing, error: exErr } = await supabase
    .from('contract_amendments')
    .select('contract_id, document_path, contracts(project_id)')
    .eq('id', amendmentId)
    .single()
  if (exErr) return { success: false, error: exErr.message }
  const ex = existing as unknown as {
    contract_id: string
    document_path: string | null
    contracts: { project_id: string } | null
  }
  const projectId = ex.contracts?.project_id

  let docPath: string | null = ex.document_path
  const docFile = formData.get('document') as File | null
  if (docFile && docFile.size > 0 && projectId) {
    const path = buildPath(['obras', projectId, 'contratos', 'aditivos', `${Date.now()}-${docFile.name}`])
    try {
      docPath = await uploadFile('obra-documentos', path, docFile)
    } catch {
      // mantém o documento anterior se o upload falhar
    }
  }

  const { data, error } = await supabase
    .from('contract_amendments')
    .update({
      type:          (formData.get('type') as AmendmentType) || 'valor',
      value_change:  Number(formData.get('value_change')) || 0,
      days_change:   Math.trunc(Number(formData.get('days_change')) || 0),
      date:          formData.get('date') as string,
      description:   (formData.get('description') as string) || null,
      document_path: docPath,
    })
    .eq('id', amendmentId)
    .select('*')
    .single()
  if (error) return { success: false, error: error.message }

  // Recalcula Valor Total e Prazo Atual da obra (Seção 6)
  await syncProjectFromContract(supabase, ex.contract_id)

  revalidatePath('/contratos')
  revalidatePath(`/contratos/${ex.contract_id}`)
  if (projectId) revalidatePath(`/obras/${projectId}`)
  return { success: true, amendment: data as Record<string, unknown> }
}

// Exclui um aditivo. O Valor Total e o Prazo são recalculados na tela.
export async function deleteAmendment(
  amendmentId: string,
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()

  const { data: ex } = await supabase
    .from('contract_amendments')
    .select('contract_id')
    .eq('id', amendmentId)
    .single()

  const { error } = await supabase.from('contract_amendments').delete().eq('id', amendmentId)
  if (error) return { success: false, error: error.message }

  const contractId = (ex as { contract_id: string } | null)?.contract_id
  if (contractId) await syncProjectFromContract(supabase, contractId)
  revalidatePath('/contratos')
  if (contractId) revalidatePath(`/contratos/${contractId}`)
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Medições ───────────────────────────────────────────────
//
// Antiduplicação: cada medição gera, no máximo, UMA receita em
// financial_entries (vinculada por measurements.financial_entry_id).
// A receita só existe quando a medição está 'aprovada' ou 'faturada'.
// Ao mudar de status / valor → a receita é criada, atualizada ou
// removida em sincronia. Nunca há receita duplicada.

const RECEITA_STATUSES: MeasurementStatus[] = ['aprovada', 'faturada']
const todayStr = () => new Date().toISOString().slice(0, 10)

// Conta de receita do plano de contas usada nas medições (código 1.03 "Medição")
async function getMeasurementCategory(
  supabase: Awaited<ReturnType<typeof getActionClient>>['supabase'],
): Promise<{ id: string | null; name: string }> {
  const byCode = await supabase.from('cost_categories').select('id, name').eq('code', '1.03').limit(1)
  const r1 = (byCode.data as { id: string; name: string }[] | null)?.[0]
  if (r1) return { id: r1.id, name: r1.name }
  const byName = await supabase.from('cost_categories').select('id, name').eq('name', 'Medição').limit(1)
  const r2 = (byName.data as { id: string; name: string }[] | null)?.[0]
  if (r2) return { id: r2.id, name: r2.name }
  return { id: null, name: 'Medição' }
}

export async function createMeasurement(
  contractId: string,
  formData: FormData,
): Promise<{ success: boolean; measurement?: Record<string, unknown>; error?: string }> {
  const { supabase, userId } = await getActionClient()

  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select('project_id, retention_percent, projects(name)')
    .eq('id', contractId)
    .single()
  if (cErr) return { success: false, error: cErr.message }
  const c = contract as unknown as {
    project_id: string
    retention_percent: number
    projects: { name: string } | null
  }

  const { data: last } = await supabase
    .from('measurements')
    .select('measurement_number')
    .eq('contract_id', contractId)
    .order('measurement_number', { ascending: false })
    .limit(1)
  const next = ((last as { measurement_number: number }[] | null)?.[0]?.measurement_number ?? 0) + 1

  const amount = Number(formData.get('amount')) || 0
  const status = (formData.get('status') as MeasurementStatus) || 'medida'
  const periodStart = (formData.get('period_start') as string) || null
  const periodEnd = (formData.get('period_end') as string) || null
  const progressRaw = formData.get('progress_percent') as string
  const progress = progressRaw ? Number(progressRaw) : null
  const description = (formData.get('description') as string) || null
  // Retenção desta medição: usa o que veio do popup; sem valor, herda o do contrato
  const retRaw = formData.get('retention_percent') as string | null
  const retentionPercent = retRaw !== null && retRaw !== '' ? Number(retRaw) : (c.retention_percent ?? 0)

  // 1) Cria a medição (ainda sem receita)
  const { data: created, error } = await supabase
    .from('measurements')
    .insert({
      contract_id:        contractId,
      project_id:         c.project_id,
      measurement_number: next,
      period_start:       periodStart,
      period_end:         periodEnd,
      progress_percent:   progress,
      amount,
      retention_percent:  retentionPercent,
      description,
      status,
    })
    .select('*')
    .single()
  if (error) return { success: false, error: error.message }
  const measurement = created as Record<string, unknown>

  // 2) Gera a receita se já nasce aprovada/faturada (valor líquido)
  const net = netoMedicao(amount, retentionPercent)
  if (RECEITA_STATUSES.includes(status) && net > 0) {
    const cat = await getMeasurementCategory(supabase)
    const { data: entry, error: feErr } = await supabase
      .from('financial_entries')
      .insert({
        project_id:  c.project_id,
        entry_type:  'income',
        entry_date:  periodEnd ?? todayStr(),
        description: `Medição Nº ${next} - ${c.projects?.name ?? 'Obra'}`,
        amount:      net,
        category:    cat.name,
        category_id: cat.id,
        status:      'pendente',
        due_date:    periodEnd ?? null,
        created_by:  userId,
      })
      .select('id')
      .single()
    if (feErr) return { success: false, error: feErr.message }

    const entryId = (entry as { id: string }).id
    const { data: linked } = await supabase
      .from('measurements')
      .update({ financial_entry_id: entryId })
      .eq('id', measurement.id as string)
      .select('*')
      .single()
    if (linked) Object.assign(measurement, linked)
  }

  revalidatePath('/contratos')
  revalidatePath(`/contratos/${contractId}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  revalidatePath(`/obras/${c.project_id}`)
  return { success: true, measurement }
}

export async function updateMeasurement(
  measurementId: string,
  formData: FormData,
): Promise<{ success: boolean; measurement?: Record<string, unknown>; error?: string }> {
  const { supabase, userId } = await getActionClient()

  const { data: existing, error: exErr } = await supabase
    .from('measurements')
    .select('contract_id, project_id, measurement_number, financial_entry_id, contracts(retention_percent, projects(name))')
    .eq('id', measurementId)
    .single()
  if (exErr) return { success: false, error: exErr.message }
  const ex = existing as unknown as {
    contract_id: string
    project_id: string
    measurement_number: number
    financial_entry_id: string | null
    contracts: { retention_percent: number; projects: { name: string } | null } | null
  }

  const amount = Number(formData.get('amount')) || 0
  const status = (formData.get('status') as MeasurementStatus) || 'medida'
  const periodStart = (formData.get('period_start') as string) || null
  const periodEnd = (formData.get('period_end') as string) || null
  const progressRaw = formData.get('progress_percent') as string
  const progress = progressRaw ? Number(progressRaw) : null
  const description = (formData.get('description') as string) || null

  // Retenção desta medição: usa o que veio do popup; sem valor, herda o do contrato
  const retRaw = formData.get('retention_percent') as string | null
  const retentionPercent = retRaw !== null && retRaw !== '' ? Number(retRaw) : (ex.contracts?.retention_percent ?? 0)
  const net = netoMedicao(amount, retentionPercent)
  const shouldHaveReceita = RECEITA_STATUSES.includes(status) && net > 0

  // 1) Sincroniza a receita vinculada (antiduplicação)
  let financialEntryId: string | null = ex.financial_entry_id
  if (shouldHaveReceita) {
    const projName = ex.contracts?.projects?.name ?? 'Obra'
    const payload = {
      project_id:  ex.project_id,
      entry_type:  'income' as const,
      entry_date:  periodEnd ?? todayStr(),
      description: `Medição Nº ${ex.measurement_number} - ${projName}`,
      amount:      net,
      due_date:    periodEnd ?? null,
    }
    if (financialEntryId) {
      const upd = await supabase.from('financial_entries').update(payload).eq('id', financialEntryId)
      if (upd.error) return { success: false, error: upd.error.message }
    } else {
      const cat = await getMeasurementCategory(supabase)
      const { data: entry, error: feErr } = await supabase
        .from('financial_entries')
        .insert({ ...payload, category: cat.name, category_id: cat.id, status: 'pendente', created_by: userId })
        .select('id')
        .single()
      if (feErr) return { success: false, error: feErr.message }
      financialEntryId = (entry as { id: string }).id
    }
  } else if (financialEntryId) {
    // Voltou para prevista/medida (ou valor zerado): remove a receita
    const del = await supabase.from('financial_entries').delete().eq('id', financialEntryId)
    if (del.error) return { success: false, error: del.error.message }
    financialEntryId = null
  }

  // 2) Atualiza a medição
  const { data, error } = await supabase
    .from('measurements')
    .update({
      period_start:       periodStart,
      period_end:         periodEnd,
      progress_percent:   progress,
      amount,
      retention_percent:  retentionPercent,
      description,
      status,
      financial_entry_id: financialEntryId,
    })
    .eq('id', measurementId)
    .select('*')
    .single()
  if (error) return { success: false, error: error.message }

  revalidatePath('/contratos')
  revalidatePath(`/contratos/${ex.contract_id}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  revalidatePath(`/obras/${ex.project_id}`)
  return { success: true, measurement: data as Record<string, unknown> }
}

export async function deleteMeasurement(
  measurementId: string,
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()

  const { data: ex } = await supabase
    .from('measurements')
    .select('contract_id, project_id, financial_entry_id')
    .eq('id', measurementId)
    .single()
  const e = ex as { contract_id: string; project_id: string; financial_entry_id: string | null } | null

  // Remove a receita vinculada (se houver) antes de excluir a medição
  if (e?.financial_entry_id) {
    const delFe = await supabase.from('financial_entries').delete().eq('id', e.financial_entry_id)
    if (delFe.error) return { success: false, error: delFe.error.message }
  }

  const { error } = await supabase.from('measurements').delete().eq('id', measurementId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/contratos')
  if (e?.contract_id) revalidatePath(`/contratos/${e.contract_id}`)
  revalidatePath('/financeiro')
  revalidatePath('/dashboard')
  if (e?.project_id) revalidatePath(`/obras/${e.project_id}`)
  return { success: true }
}

// Exclui o contrato PERMANENTEMENTE. Aditivos e medições saem por cascade.
// Antes, remove as receitas geradas pelas medições (evita lançamentos órfãos
// no Financeiro — o financial_entry_id da medição é ON DELETE SET NULL).
export async function deleteContract(
  contractId: string,
): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await getActionClient()

  const { data: c } = await supabase
    .from('contracts')
    .select('project_id')
    .eq('id', contractId)
    .single()

  const { data: ms } = await supabase
    .from('measurements')
    .select('financial_entry_id')
    .eq('contract_id', contractId)

  const entryIds = ((ms as { financial_entry_id: string | null }[] | null) ?? [])
    .map((m) => m.financial_entry_id)
    .filter((id): id is string => !!id)

  if (entryIds.length > 0) {
    const delE = await supabase.from('financial_entries').delete().in('id', entryIds)
    if (delE.error) return { success: false, error: delE.error.message }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', contractId)
  if (error) return { success: false, error: error.message }

  const projectId = (c as { project_id: string } | null)?.project_id

  revalidatePath('/contratos')
  revalidatePath('/dashboard')
  revalidatePath('/financeiro')
  if (projectId) revalidatePath(`/obras/${projectId}`)

  return { success: true }
}
