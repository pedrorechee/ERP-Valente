'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { uploadFile, deleteFile, buildPath } from '@/lib/storage'
import type { WeatherType } from '@/types/database'

export async function createDiaryEntry(projectId: string, formData: FormData) {
  const entryDateCreate = formData.get('entry_date') as string
  const todayCreate = new Date().toISOString().slice(0, 10)
  if (entryDateCreate > todayCreate) {
    return { success: false, error: 'A data do registro não pode ser futura.' }
  }

  const { supabase, userId } = await getActionClient()

  const { data: entry, error } = await supabase
    .from('project_diary')
    .insert({
      project_id: projectId,
      entry_date: formData.get('entry_date') as string,
      weather: (formData.get('weather') as WeatherType) || null,
      work_done: formData.get('work_done') as string,
      team_present: (formData.get('team_present') as string) || null,
      occurrences: (formData.get('occurrences') as string) || null,
      created_by: userId,
    })
    .select()
    .single()

  if (error || !entry) return { success: false, error: error?.message || 'Erro ao salvar entrada' }

  const diaryId = (entry as { id: string }).id
  const files = (formData.getAll('photos') as File[]).filter((f) => f && f.size > 0)

  if (files.length > 0) {
    const entryDate = formData.get('entry_date') as string
    const phaseId = (formData.get('phase_id') as string) || null
    // Uploads em paralelo + insert em lote (antes era 1 upload + 1 insert por foto)
    const storagePaths = await Promise.all(
      files.map((file, i) =>
        uploadFile('obra-fotos', buildPath([
          'obras', projectId, 'diario', entryDate, `${Date.now()}-${i}-${file.name}`,
        ]), file)
      )
    )
    await supabase.from('diary_photos').insert(
      storagePaths.map((storage_path) => ({
        diary_id: diaryId,
        phase_id: phaseId,
        storage_path,
        caption: null,
      }))
    )
  }

  revalidatePath(`/obras/${projectId}`)
  return { success: true, entry: entry as Record<string, unknown> }
}

export async function updateDiaryEntry(
  entryId: string,
  projectId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const entryDate = formData.get('entry_date') as string
  const todayUpdate = new Date().toISOString().slice(0, 10)
  if (entryDate > todayUpdate) {
    return { success: false, error: 'A data do registro não pode ser futura.' }
  }

  const { supabase } = await getActionClient()

  const { error } = await supabase
    .from('project_diary')
    .update({
      entry_date: entryDate,
      weather: (formData.get('weather') as WeatherType) || null,
      work_done: formData.get('work_done') as string,
      team_present: (formData.get('team_present') as string) || null,
      occurrences: (formData.get('occurrences') as string) || null,
    })
    .eq('id', entryId)

  if (error) return { success: false, error: error.message }

  const files = (formData.getAll('photos') as File[]).filter((f) => f && f.size > 0)
  if (files.length > 0) {
    const phaseId = (formData.get('phase_id') as string) || null
    const storagePaths = await Promise.all(
      files.map((file, i) =>
        uploadFile('obra-fotos', buildPath([
          'obras', projectId, 'diario', entryDate, `${Date.now()}-${i}-${file.name}`,
        ]), file)
      )
    )
    await supabase.from('diary_photos').insert(
      storagePaths.map((storage_path) => ({
        diary_id: entryId,
        phase_id: phaseId,
        storage_path,
        caption: null,
      }))
    )
  }

  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function deleteDiaryPhoto(photoId: string, projectId: string) {
  const { supabase } = await getActionClient()

  const { data: photo } = await supabase
    .from('diary_photos')
    .select('storage_path')
    .eq('id', photoId)
    .single()

  if (photo?.storage_path) {
    try { await deleteFile('obra-fotos', photo.storage_path) } catch { /* ignora se já removido */ }
  }

  const { error } = await supabase.from('diary_photos').delete().eq('id', photoId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function deleteDiaryEntry(entryId: string, projectId: string) {
  const { supabase } = await getActionClient()
  const { error } = await supabase.from('project_diary').delete().eq('id', entryId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}
