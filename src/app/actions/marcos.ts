'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'

type Result = { success: boolean; error?: string }
type MilestoneResult = Result & { milestone?: Record<string, unknown> }

export async function createMilestone(projectId: string, formData: FormData): Promise<MilestoneResult> {
  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('critical_milestones')
    .insert({
      project_id: projectId,
      description: formData.get('description') as string,
      planned_date: formData.get('planned_date') as string,
      status: 'pending',
    })
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true, milestone: data as Record<string, unknown> }
}

export async function updateMilestone(milestoneId: string, projectId: string, formData: FormData): Promise<MilestoneResult> {
  const { supabase } = await getActionClient()
  const { data, error } = await supabase
    .from('critical_milestones')
    .update({
      description: formData.get('description') as string,
      planned_date: formData.get('planned_date') as string,
    })
    .eq('id', milestoneId)
    .select()
    .single()
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true, milestone: data as Record<string, unknown> }
}

export async function completeMilestone(milestoneId: string, projectId: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase
    .from('critical_milestones')
    .update({ status: 'completed', actual_date: new Date().toISOString().split('T')[0] })
    .eq('id', milestoneId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function reopenMilestone(milestoneId: string, projectId: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase
    .from('critical_milestones')
    .update({ status: 'pending', actual_date: null })
    .eq('id', milestoneId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function deleteMilestone(milestoneId: string, projectId: string): Promise<Result> {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('critical_milestones').delete().eq('id', milestoneId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}
