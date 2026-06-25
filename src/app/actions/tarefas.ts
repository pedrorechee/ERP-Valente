'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { recalcProjectProgress } from './obras'

type Result = { success: boolean; error?: string }
type CreateTaskResult = { success: boolean; error?: string; task?: import('@/types/database').PhaseTask }

export async function recalcPhaseProgress(phaseId: string): Promise<void> {
  const { supabase } = await getActionClient()

  const [{ count: totalCount }, { count: doneCount }, { data: phaseData }] = await Promise.all([
    supabase.from('phase_tasks').select('id', { count: 'exact', head: true }).eq('phase_id', phaseId),
    supabase.from('phase_tasks').select('id', { count: 'exact', head: true }).eq('phase_id', phaseId).eq('completed', true),
    supabase.from('project_phases').select('expected_end').eq('id', phaseId).single(),
  ])

  const total = totalCount ?? 0
  const done = doneCount ?? 0
  const expectedEnd = phaseData?.expected_end ?? null

  const progress = total === 0 ? 0 : Math.round((done / total) * 100)

  let status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  if (total === 0) {
    status = 'not_started'
  } else if (done === total) {
    status = 'completed'
  } else {
    const today = new Date().toISOString().split('T')[0]
    status = expectedEnd != null && expectedEnd < today ? 'delayed' : 'in_progress'
  }

  await supabase
    .from('project_phases')
    .update({
      progress,
      status,
      actual_end: status === 'completed' ? new Date().toISOString().split('T')[0] : null,
    })
    .eq('id', phaseId)
}

export async function createTask(
  phaseId: string,
  projectId: string,
  formData: FormData
): Promise<CreateTaskResult> {
  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('phase_tasks')
    .insert({
      phase_id: phaseId,
      description: formData.get('description') as string,
      responsible: (formData.get('responsible') as string) || null,
      due_date: (formData.get('due_date') as string) || null,
      completed: false,
    })
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  await recalcPhaseProgress(phaseId)
  await recalcProjectProgress(projectId)
  revalidatePath(`/obras/${projectId}`)
  return { success: true, task: data as import('@/types/database').PhaseTask }
}

export async function toggleTask(
  taskId: string,
  projectId: string,
  completed: boolean
): Promise<Result> {
  const { supabase } = await getActionClient()

  // Busca do phase_id e update são independentes — rodam em paralelo
  const [{ data: taskData }, { error }] = await Promise.all([
    supabase.from('phase_tasks').select('phase_id').eq('id', taskId).single(),
    supabase
      .from('phase_tasks')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', taskId),
  ])

  if (error) return { success: false, error: error.message }

  if (taskData?.phase_id) await recalcPhaseProgress(taskData.phase_id)
  await recalcProjectProgress(projectId)
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function updateTask(
  taskId: string,
  projectId: string,
  formData: FormData
): Promise<CreateTaskResult> {
  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('phase_tasks')
    .update({
      description: formData.get('description') as string,
      responsible: (formData.get('responsible') as string) || null,
      due_date: (formData.get('due_date') as string) || null,
    })
    .eq('id', taskId)
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true, task: data as import('@/types/database').PhaseTask }
}

export async function completeLastTask(
  taskId: string,
  phaseId: string,
  projectId: string,
  actualEndDate: string,
): Promise<Result> {
  const { supabase } = await getActionClient()

  const [{ error: taskError }, { error: phaseError }] = await Promise.all([
    supabase
      .from('phase_tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', taskId),
    supabase
      .from('project_phases')
      .update({ progress: 100, status: 'completed', actual_end: actualEndDate })
      .eq('id', phaseId),
  ])

  if (taskError) return { success: false, error: taskError.message }
  if (phaseError) return { success: false, error: phaseError.message }

  await recalcProjectProgress(projectId)
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function deleteTask(taskId: string, projectId: string): Promise<Result> {
  const { supabase } = await getActionClient()

  const { data: taskData } = await supabase
    .from('phase_tasks')
    .select('phase_id')
    .eq('id', taskId)
    .single()

  const { error } = await supabase.from('phase_tasks').delete().eq('id', taskId)
  if (error) return { success: false, error: error.message }

  if (taskData?.phase_id) await recalcPhaseProgress(taskData.phase_id)
  await recalcProjectProgress(projectId)
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}
