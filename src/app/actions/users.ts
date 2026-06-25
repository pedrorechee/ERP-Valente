'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionRole } from '@/lib/auth'
import type { Profile, UserRole } from '@/types/database'

const ROLES: UserRole[] = ['owner', 'admin', 'foreman', 'client']

type CreateResult = { success: true; profile: Profile } | { success: false; error: string }
type UpdateResult = { success: true; profile: Profile } | { success: false; error: string }

// Só owner/admin gerenciam usuários (honra dev-bypass = owner).
async function ensureManager(): Promise<{ userId: string | null; role: UserRole } | { error: string }> {
  const { userId, role } = await getSessionRole()
  if (!role || !['owner', 'admin'].includes(role)) return { error: 'Sem permissão para gerenciar usuários.' }
  return { userId, role }
}

async function countActiveOwners(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner')
    .eq('is_active', true)
  return count ?? 0
}

export async function createUser(formData: FormData): Promise<CreateResult> {
  const guard = await ensureManager()
  if ('error' in guard) return { success: false, error: guard.error }

  const full_name = (formData.get('full_name') as string)?.trim()
  const email     = (formData.get('email') as string)?.trim().toLowerCase()
  const role      = formData.get('role') as UserRole
  const phone     = (formData.get('phone') as string)?.trim() || null

  if (!full_name || !email || !role) return { success: false, error: 'Preencha nome, e-mail e perfil.' }
  if (!ROLES.includes(role)) return { success: false, error: 'Perfil inválido.' }
  if (guard.role === 'admin' && role === 'owner') return { success: false, error: 'Administrativo não pode criar um Dono.' }

  const admin = createAdminClient()

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name, role, phone },
  })
  if (authError || !created?.user) {
    if (authError?.message.includes('already registered')) return { success: false, error: 'Este e-mail já está cadastrado.' }
    return { success: false, error: `Erro ao criar usuário: ${authError?.message ?? 'desconhecido'}` }
  }

  // Garante os dados no profile (o trigger cria a linha; reforçamos os campos)
  const newId = created.user.id
  await admin.from('profiles').update({ full_name, role, phone, is_active: true }).eq('id', newId)

  const { data: profile, error: pErr } = await admin.from('profiles').select('*').eq('id', newId).single()
  if (pErr || !profile) return { success: false, error: 'Usuário criado, mas falha ao ler o perfil.' }

  revalidatePath('/configuracoes')
  return { success: true, profile: profile as Profile }
}

export async function updateUser(id: string, formData: FormData): Promise<UpdateResult> {
  const guard = await ensureManager()
  if ('error' in guard) return { success: false, error: guard.error }

  const full_name = (formData.get('full_name') as string)?.trim() || null
  const role      = formData.get('role') as UserRole
  const phone     = (formData.get('phone') as string)?.trim() || null
  const is_active = formData.get('is_active') === 'true'

  if (!role || !ROLES.includes(role)) return { success: false, error: 'Perfil inválido.' }

  const admin = createAdminClient()

  const { data: targetData } = await admin.from('profiles').select('*').eq('id', id).single()
  const target = targetData as Profile | null
  if (!target) return { success: false, error: 'Usuário não encontrado.' }

  // Administrativo não mexe em Donos (nem promove ninguém a Dono)
  if (guard.role === 'admin' && (target.role === 'owner' || role === 'owner')) {
    return { success: false, error: 'Administrativo não pode gerenciar um Dono.' }
  }

  // Não inativar a si mesmo
  if (guard.userId && guard.userId === id && !is_active) {
    return { success: false, error: 'Você não pode inativar o próprio usuário.' }
  }

  // Proteger o último owner ativo (não rebaixar nem inativar)
  if (target.role === 'owner' && target.is_active) {
    const willStopBeingActiveOwner = role !== 'owner' || !is_active
    if (willStopBeingActiveOwner && (await countActiveOwners(admin)) <= 1) {
      return { success: false, error: 'Não é possível rebaixar ou inativar o último Dono ativo.' }
    }
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ full_name, role, phone, is_active })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !updated) return { success: false, error: error?.message ?? 'Erro ao atualizar usuário.' }

  revalidatePath('/configuracoes')
  return { success: true, profile: updated as Profile }
}

export async function setUserActive(id: string, active: boolean): Promise<UpdateResult> {
  const guard = await ensureManager()
  if ('error' in guard) return { success: false, error: guard.error }

  const admin = createAdminClient()
  const { data: targetData } = await admin.from('profiles').select('*').eq('id', id).single()
  const target = targetData as Profile | null
  if (!target) return { success: false, error: 'Usuário não encontrado.' }

  if (guard.userId && guard.userId === id && !active) {
    return { success: false, error: 'Você não pode inativar o próprio usuário.' }
  }
  if (target.role === 'owner' && target.is_active && !active && (await countActiveOwners(admin)) <= 1) {
    return { success: false, error: 'Não é possível inativar o último Dono ativo.' }
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ is_active: active })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !updated) return { success: false, error: error?.message ?? 'Erro ao alterar status.' }

  revalidatePath('/configuracoes')
  return { success: true, profile: updated as Profile }
}
