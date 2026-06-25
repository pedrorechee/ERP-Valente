'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { recalcProjectProgress } from './obras'
import { recalcPhaseProgress } from './tarefas'

type Result = { success: boolean; error?: string }

// Normaliza o peso para o intervalo 1–10 (default 1 se ausente/inválido)
function clampWeight(raw: FormDataEntryValue | null): number {
  const n = parseInt((raw as string) ?? '', 10)
  if (Number.isNaN(n)) return 1
  return Math.min(10, Math.max(1, n))
}
type CreatePhaseResult = { success: boolean; error?: string; phase?: import('@/types/database').ProjectPhase & { phase_tasks: import('@/types/database').PhaseTask[] } }

export async function createPhase(projectId: string, formData: FormData): Promise<CreatePhaseResult> {
  const { supabase } = await getActionClient()

  const { data, error } = await supabase
    .from('project_phases')
    .insert({
      project_id: projectId,
      name: formData.get('name') as string,
      expected_start: (formData.get('expected_start') as string) || null,
      expected_end: (formData.get('expected_end') as string) || null,
      weight: clampWeight(formData.get('weight')),
      order_index: Date.now(),
      progress: 0,
      status: 'not_started',
    })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true, phase: { ...(data as import('@/types/database').ProjectPhase), phase_tasks: [] } }
}

export async function updatePhaseProgress(
  phaseId: string,
  projectId: string,
  progress: number,
  actualEndDate?: string,
): Promise<Result> {
  const { supabase } = await getActionClient()

  if (progress === 100) {
    const endDate = actualEndDate ?? new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('project_phases')
      .update({ progress: 100, status: 'completed', actual_end: endDate })
      .eq('id', phaseId)
    if (error) return { success: false, error: error.message }
  } else {
    // Desmarca conclusão: recalcula a partir das tarefas reais
    await recalcPhaseProgress(phaseId)
  }

  await recalcProjectProgress(projectId)
  return { success: true }
}

export async function updatePhase(phaseId: string, projectId: string, formData: FormData): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase
    .from('project_phases')
    .update({
      name: formData.get('name') as string,
      expected_start: (formData.get('expected_start') as string) || null,
      expected_end: (formData.get('expected_end') as string) || null,
      weight: clampWeight(formData.get('weight')),
    })
    .eq('id', phaseId)
  if (error) return { success: false, error: error.message }
  // Recalcula status de atraso se expected_end mudou
  await recalcPhaseProgress(phaseId)
  // O peso pode ter mudado — recalcula o progresso geral ponderado
  await recalcProjectProgress(projectId)
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function deletePhase(phaseId: string, projectId: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('project_phases').delete().eq('id', phaseId)
  if (error) return { success: false, error: error.message }
  await recalcProjectProgress(projectId)
  return { success: true }
}
