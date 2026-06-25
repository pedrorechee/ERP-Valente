'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getActionClient } from '@/lib/supabase/action'
import type { Project, ProjectStatus, ProjectType } from '@/types/database'
import { DEFAULT_PHASES } from '@/types/database'

// Compõe a coluna address (text) a partir das partes estruturadas, ignorando
// partes vazias. Ex: "Rua X, 100 - Centro, Salvador - BA".
// Mantida para compatibilidade com telas que ainda exibem address.
function composeAddress(formData: FormData): string {
  const g = (k: string) => ((formData.get(k) as string) || '').trim()
  const streetNumber = [g('street'), g('address_number')].filter(Boolean).join(', ')
  const beforeCity = [streetNumber, g('neighborhood')].filter(Boolean).join(' - ')
  const cityState = [g('city'), g('state')].filter(Boolean).join(' - ')
  return [beforeCity, cityState].filter(Boolean).join(', ')
}

// Extrai todos os campos da obra do formulário (existentes + novos da migration 019/021)
function parseProjectForm(formData: FormData) {
  const txt = (k: string) => (formData.get(k) as string) || null
  const num = (k: string) => (formData.get(k) ? Number(formData.get(k)) : null)
  const int = (k: string) => {
    const v = formData.get(k) as string
    return v ? parseInt(v, 10) : null
  }
  // address composto a partir das partes; cai no valor legado (campo oculto)
  // quando o registro antigo ainda não tem os campos estruturados preenchidos.
  const composed = composeAddress(formData)
  return {
    name: formData.get('name') as string,
    address: composed || ((formData.get('address') as string) || ''),
    cep: txt('cep'),
    street: txt('street'),
    address_number: txt('address_number'),
    complement: txt('complement'),
    neighborhood: txt('neighborhood'),
    city: txt('city'),
    state: txt('state'),
    reference: txt('reference'),
    type: formData.get('type') as ProjectType,
    area_m2: num('area_m2'),
    land_area_m2: num('land_area_m2'),
    start_date: formData.get('start_date') as string,
    expected_end_date: formData.get('expected_end_date') as string,
    technical_responsible: txt('technical_responsible'),
    site_manager: txt('site_manager'),
    client_representative: txt('client_representative'),
    priority: txt('priority'),
    floors_count: int('floors_count'),
    construction_system: txt('construction_system'),
    foundation_type: txt('foundation_type'),
    finish_standard: txt('finish_standard'),
    permit_number: txt('permit_number'),
    art_number: txt('art_number'),
    cno_number: txt('cno_number'),
    property_registration: txt('property_registration'),
    municipal_registration: txt('municipal_registration'),
    insurance_company: txt('insurance_company'),
    insurance_policy: txt('insurance_policy'),
    insurance_expiry: txt('insurance_expiry'),
    habite_se_number: txt('habite_se_number'),
    habite_se_date: txt('habite_se_date'),
    warranty_start_date: txt('warranty_start_date'),
    warranty_months: int('warranty_months'),
    client_id: txt('client_id'),
    contract_value: num('contract_value'),
    description: txt('description'),
  }
}

export async function createProject(formData: FormData) {
  const { supabase, userId } = await getActionClient()

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      ...parseProjectForm(formData),
      created_by: userId,
      status: 'active',
      overall_progress: 0,
    })
    .select()
    .single()

  if (error || !project) return { error: error?.message || 'Erro ao criar obra' }

  const proj = project as Project

  const phases = DEFAULT_PHASES.map((name, index) => ({
    project_id: proj.id,
    name,
    order_index: index,
    progress: 0,
    status: 'not_started',
  }))

  await supabase.from('project_phases').insert(phases)

  revalidatePath('/obras')
  redirect(`/obras/${proj.id}?success=criada`)
}

export async function updateProject(id: string, formData: FormData) {
  const { supabase } = await getActionClient()

  const { error } = await supabase
    .from('projects')
    .update(parseProjectForm(formData))
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/obras/${id}`)
  revalidatePath('/obras')
  return { success: true }
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  options?: { actual_end_date?: string; cancellation_reason?: string }
) {
  const { supabase } = await getActionClient()

  const update: Record<string, unknown> = { status }

  if (status === 'completed') {
    update.actual_end_date = options?.actual_end_date ?? new Date().toISOString().split('T')[0]
    update.cancellation_reason = null
  } else if (status === 'cancelled') {
    update.cancellation_reason = options?.cancellation_reason ?? null
    update.actual_end_date = null
  } else {
    update.actual_end_date = null
    update.cancellation_reason = null
  }

  const { error } = await supabase.from('projects').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/obras/${id}`)
  revalidatePath('/obras')
  return { success: true }
}

export async function recalcProjectProgress(projectId: string) {
  const { supabase } = await getActionClient()

  const [{ data: phasesData }, { data: projectData }] = await Promise.all([
    supabase.from('project_phases').select('progress, weight').eq('project_id', projectId),
    supabase.from('projects').select('status').eq('id', projectId).single(),
  ])

  if (!phasesData || phasesData.length === 0) return

  // Média ponderada pelo peso da fase. Com todos os pesos = 1 (default),
  // o resultado equivale à média simples — retrocompatível.
  const phases = phasesData as { progress: number; weight: number | null }[]
  const totalWeight = phases.reduce((s, p) => s + (p.weight ?? 1), 0)
  const avg = totalWeight > 0
    ? Math.round(phases.reduce((s, p) => s + p.progress * (p.weight ?? 1), 0) / totalWeight)
    : Math.round(phases.reduce((s, p) => s + p.progress, 0) / phases.length)

  const currentStatus = (projectData as { status: string } | null)?.status
  const update: Record<string, unknown> = { overall_progress: avg }

  if (avg === 100) {
    update.status = 'completed'
    update.actual_end_date = new Date().toISOString().split('T')[0]
  } else if (currentStatus === 'completed') {
    update.status = 'active'
    update.actual_end_date = null
  }

  await supabase.from('projects').update(update).eq('id', projectId)

  revalidatePath(`/obras/${projectId}`)
  revalidatePath('/obras')
  revalidatePath('/dashboard')
}
