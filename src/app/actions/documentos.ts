'use server'

import { revalidatePath } from 'next/cache'
import { getActionClient } from '@/lib/supabase/action'
import { uploadFile, deleteFile, buildPath } from '@/lib/storage'

type Result = { success: boolean; error?: string }

export async function uploadDocument(
  projectId: string,
  formData: FormData,
): Promise<Result & { document?: Record<string, unknown> }> {
  const { supabase, userId } = await getActionClient()

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { success: false, error: 'Nenhum arquivo selecionado' }

  const path = buildPath([
    'obras', projectId, 'docs', `${Date.now()}-${file.name}`,
  ])

  try {
    const storagePath = await uploadFile('obra-documentos', path, file)
    const { data, error } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        name: formData.get('name') as string,
        type: formData.get('type') as string,
        storage_path: storagePath,
        uploaded_by: userId,
      })
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    revalidatePath(`/obras/${projectId}`)
    return { success: true, document: data as Record<string, unknown> }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro no upload' }
  }
}

export async function updateDocument(
  docId: string,
  projectId: string,
  oldStoragePath: string,
  formData: FormData
): Promise<Result> {
  const { supabase } = await getActionClient()

  const updates: Record<string, string> = {
    name: formData.get('name') as string,
    type: formData.get('type') as string,
  }

  const file = formData.get('file') as File | null
  if (file && file.size > 0) {
    const path = buildPath(['obras', projectId, 'docs', `${Date.now()}-${file.name}`])
    try {
      const storagePath = await uploadFile('obra-documentos', path, file)
      await deleteFile('obra-documentos', oldStoragePath)
      updates.storage_path = storagePath
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Erro no upload' }
    }
  }

  const { error } = await supabase
    .from('project_documents')
    .update(updates)
    .eq('id', docId)
  if (error) return { success: false, error: error.message }
  revalidatePath(`/obras/${projectId}`)
  return { success: true }
}

export async function deleteDocument(
  docId: string,
  storagePath: string,
  projectId: string
): Promise<Result> {
  try {
    const { supabase } = await getActionClient()
    await deleteFile('obra-documentos', storagePath)
    const { error } = await supabase.from('project_documents').delete().eq('id', docId)
    if (error) return { success: false, error: error.message }
    revalidatePath(`/obras/${projectId}`)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao excluir' }
  }
}
