'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Pencil, Power, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'
import { createUser, updateUser, setUserActive } from '@/app/actions/users'
import { ROLE_LABELS, ROLE_DESCRIPTION, areasForRole } from '@/lib/permissions'
import type { Profile, UserRole } from '@/types/database'

const INPUT =
  'w-full rounded-lg border border-[#E6C07B] bg-white px-3 py-2 text-sm text-dark focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

const ROLE_BADGE: Record<UserRole, string> = {
  owner:   'bg-brown/10 text-brown',
  admin:   'bg-terracotta/10 text-terracotta',
  foreman: 'bg-gold/20 text-brown',
  client:  'bg-gray-100 text-gray-500',
}

const ALL_ROLES: UserRole[] = ['owner', 'admin', 'foreman', 'client']

interface Props {
  profiles:      Profile[]
  currentUserId: string | null
  currentRole:   UserRole
}

export function UsuariosTab({ profiles, currentUserId, currentRole }: Props) {
  const [list, setList] = useState<Profile[]>(profiles)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setList(profiles) }, [profiles])

  // Admin não cria/edita Dono; perfis disponíveis no select dependem disso
  const roleOptions = currentRole === 'owner' ? ALL_ROLES : ALL_ROLES.filter((r) => r !== 'owner')
  const activeOwners = list.filter((p) => p.role === 'owner' && p.is_active).length

  function canManage(p: Profile): boolean {
    if (currentRole === 'admin' && p.role === 'owner') return false
    return true
  }
  function isSelf(p: Profile): boolean {
    return !!currentUserId && currentUserId === p.id
  }
  function isLastOwner(p: Profile): boolean {
    return p.role === 'owner' && p.is_active && activeOwners <= 1
  }

  function openCreate() {
    setEditTarget(null)
    setModalOpen(true)
  }
  function openEdit(p: Profile) {
    setEditTarget(p)
    setModalOpen(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaving(true)

    if (editTarget) {
      const id = editTarget.id
      updateUser(id, formData)
        .then((res) => {
          if (!res.success) throw new Error(res.error)
          setList((prev) => prev.map((p) => (p.id === id ? res.profile : p)))
          setModalOpen(false)
          toastAfterClose('Usuário atualizado')
        })
        .catch((err: Error) => toast.error(err.message || 'Erro ao atualizar usuário.'))
        .finally(() => setSaving(false))
    } else {
      createUser(formData)
        .then((res) => {
          if (!res.success) throw new Error(res.error)
          setList((prev) => [res.profile, ...prev])
          setModalOpen(false)
          toastAfterClose('Usuário criado! Ele define a senha pelo e-mail de acesso.')
        })
        .catch((err: Error) => toast.error(err.message || 'Erro ao criar usuário.'))
        .finally(() => setSaving(false))
    }
  }

  function toggleActive(p: Profile) {
    const next = !p.is_active
    const original = p
    setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)))
    toastAfterClose(next ? 'Usuário ativado' : 'Usuário inativado')
    setUserActive(p.id, next)
      .then((res) => {
        if (!res.success) throw new Error(res.error)
        setList((prev) => prev.map((x) => (x.id === p.id ? res.profile : x)))
      })
      .catch((err: Error) => {
        setList((prev) => prev.map((x) => (x.id === p.id ? original : x)))
        toast.error(err.message || 'Erro ao alterar status.')
      })
  }

  return (
    <div className="space-y-6">
      {/* Lista */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{list.length} usuário{list.length !== 1 ? 's' : ''}</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gold/20 bg-cream/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">E-mail</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Perfil</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {list.map((p) => {
                const manageable = canManage(p)
                const blockInactivate = isSelf(p) || isLastOwner(p)
                return (
                  <tr key={p.id} className="hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-dark">{p.full_name || '—'}</span>
                      {isSelf(p) && <span className="ml-2 text-xs text-gray-400">(você)</span>}
                      <p className="text-xs text-gray-400 sm:hidden">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.email}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[p.role]}`}>
                        {ROLE_LABELS[p.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          disabled={!manageable}
                          className="rounded p-1 text-gray-400 transition-colors hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-30"
                          title={manageable ? 'Editar' : 'Sem permissão'}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(p)}
                          disabled={!manageable || (p.is_active && blockInactivate)}
                          className="rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                          style={{ color: p.is_active ? '#8B3A3A' : '#4A7C59' }}
                          title={
                            p.is_active
                              ? (blockInactivate ? 'Não pode inativar (você / último Dono)' : 'Inativar')
                              : 'Ativar'
                          }
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quadro de permissões por perfil (lido do mapa central) */}
      <div className="rounded-xl border border-gold/30 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-terracotta" />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#8A5A3B' }}>
            O que cada perfil acessa
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <div key={r} className="rounded-lg p-3" style={{ backgroundColor: '#F9F7F4' }}>
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[r]}`}>
                  {ROLE_LABELS[r]}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">{ROLE_DESCRIPTION[r]}</p>
              <p className="mt-1 text-xs text-gray-400">
                <span className="font-medium text-brown">Áreas:</span> {r === 'client' ? 'Portal do Cliente' : areasForRole(r).join(' · ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal criar/editar */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gold/30 bg-white px-6 py-4">
              <h2 className="font-semibold text-dark">{editTarget ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded p-1 text-gray-400 hover:text-dark transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="space-y-1.5">
                <label className={LABEL}>Nome completo *</label>
                <input name="full_name" required defaultValue={editTarget?.full_name ?? ''} className={INPUT} />
              </div>

              <div className="space-y-1.5">
                <label className={LABEL}>E-mail *</label>
                {editTarget ? (
                  <input value={editTarget.email} disabled className={`${INPUT} bg-[#F9F7F4] text-gray-500`} />
                ) : (
                  <input name="email" type="email" required placeholder="usuario@email.com" className={INPUT} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={LABEL}>Perfil *</label>
                  <select name="role" required defaultValue={editTarget?.role ?? 'foreman'} className={INPUT}>
                    {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL}>Telefone</label>
                  <input
                    name="phone"
                    defaultValue={editTarget?.phone ?? ''}
                    inputMode="numeric"
                    onInput={(e) => { e.currentTarget.value = e.currentTarget.value.replace(/[^\d()\-\s+]/g, '') }}
                    className={INPUT}
                  />
                </div>
              </div>

              {editTarget && (
                <label className="flex items-center gap-2 text-sm text-dark">
                  <input
                    type="checkbox"
                    name="is_active"
                    value="true"
                    defaultChecked={editTarget.is_active}
                    disabled={isSelf(editTarget) || isLastOwner(editTarget)}
                    className="h-4 w-4 rounded border-gold/50 accent-[#C68B59] disabled:opacity-40"
                  />
                  Usuário ativo
                  {(isSelf(editTarget) || isLastOwner(editTarget)) && (
                    <span className="text-xs text-gray-400">(não pode inativar você / último Dono)</span>
                  )}
                </label>
              )}

              {!editTarget && (
                <p className="text-xs text-gray-400">
                  O usuário recebe um e-mail para definir a senha de acesso.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-lg border border-gold/50 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-[#F9F7F4]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-medium text-white transition-colors hover:bg-brown disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : editTarget ? 'Salvar' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
