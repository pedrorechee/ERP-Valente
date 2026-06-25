'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { FileText, Plus, Download, Trash2, Upload, Pencil, X, Check, AlertTriangle } from 'lucide-react'
import type { ProjectDocument } from '@/types/database'
import { DOCUMENT_TYPE_OPTIONS } from '@/types/database'
import { formatDate } from '@/lib/format'
import { uploadDocument, updateDocument, deleteDocument } from '@/app/actions/documentos'
import { toast } from 'sonner'
import { toastAfterClose } from '@/lib/ui-feedback'

interface DocumentWithUrl extends ProjectDocument {
  signedUrl?: string
}

interface Props {
  projectId: string
  documents: DocumentWithUrl[]
}

const INPUT = 'w-full rounded-lg border border-gold/50 px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'
const LABEL = 'text-xs font-semibold uppercase tracking-wide text-brown'

const STANDARD_TYPES = [
  'Contrato', 'Alvará', 'Nota Fiscal', 'Medição', 'ART/RRT',
  'Projeto', 'Orçamento', 'Laudo', 'Foto', 'Outro',
]

const CUSTOM_SENTINEL = '__custom__'

function DocTypeSelector({ usedTypes }: { usedTypes: string[] }) {
  const [custom, setCustom] = useState(false)
  const [selectVal, setSelectVal] = useState('')

  const usedFiltered = usedTypes.filter(Boolean)
  const standardFiltered = STANDARD_TYPES.filter(t => !usedFiltered.includes(t))

  if (custom) {
    return (
      <div className="flex gap-2">
        <input
          name="type"
          required
          autoFocus
          placeholder="Digite o tipo do documento..."
          className={INPUT}
        />
        <button
          type="button"
          onClick={() => setCustom(false)}
          className="flex shrink-0 items-center justify-center rounded-lg border border-gold/50 px-2.5 text-gray-400 hover:text-dark hover:bg-cream transition-colors"
          title="Voltar às opções"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <select
      name="type"
      required
      value={selectVal}
      onChange={(e) => {
        if (e.target.value === CUSTOM_SENTINEL) {
          setCustom(true)
          setSelectVal('')
        } else {
          setSelectVal(e.target.value)
        }
      }}
      className={INPUT}
    >
      <option value="">Selecionar tipo...</option>
      {usedFiltered.length > 0 && (
        <optgroup label="Já utilizados nesta obra">
          {usedFiltered.map(t => <option key={t} value={t}>{t}</option>)}
        </optgroup>
      )}
      <optgroup label="Tipos padrão">
        {standardFiltered.map(t => <option key={t} value={t}>{t}</option>)}
      </optgroup>
      <option value={CUSTOM_SENTINEL}>+ Digitar tipo personalizado</option>
    </select>
  )
}

export function Documentos({ projectId, documents }: Props) {
  const [localDocs,     setLocalDocs]     = useState(documents)
  const [showAdd,       setShowAdd]       = useState(false)
  const [editing,       setEditing]       = useState<DocumentWithUrl | null>(null)
  const [deleteTarget,  setDeleteTarget]  = useState<DocumentWithUrl | null>(null)

  // Mantém a lista local em sincronia quando o servidor revalida os dados
  // (é assim que a URL assinada de um documento novo chega após o upload)
  useEffect(() => { setLocalDocs(documents) }, [documents])

  const usedTypes = useMemo(
    () => Array.from(new Set(localDocs.map(d => d.type).filter(Boolean))).sort() as string[],
    [localDocs]
  )

  function confirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    const index = localDocs.findIndex((d) => d.id === target.id)

    // Remoção otimista com rollback se a exclusão falhar
    setLocalDocs((prev) => prev.filter((d) => d.id !== target.id))
    toastAfterClose('Documento excluído')

    const run = () =>
      deleteDocument(target.id, target.storage_path, projectId)
        .then((result) => {
          if (!result.success) throw new Error(result.error)
        })
        .catch(() => {
          setLocalDocs((prev) => {
            const next = [...prev]
            next.splice(Math.min(index, next.length), 0, target)
            return next
          })
          toast.error('Erro ao excluir documento', {
            action: {
              label: 'Tentar novamente',
              onClick: () => {
                setLocalDocs((prev) => prev.filter((d) => d.id !== target.id))
                run()
              },
            },
          })
        })
    run()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-dark">Documentos da Obra</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
        >
          <Plus className="h-4 w-4" />
          Adicionar Documento
        </button>
      </div>

      {/* Lista */}
      {localDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gold/40 py-12 text-center">
          <FileText className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-400">
            Nenhum documento cadastrado. ART, alvará, projetos e laudos ficam aqui.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gold/20 bg-cream/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Data</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {localDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onEdit={setEditing}
                  onDelete={setDeleteTarget}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal — Adicionar */}
      {showAdd && (
        <AddDocumentModal
          projectId={projectId}
          usedTypes={usedTypes}
          onClose={() => setShowAdd(false)}
          onOptimistic={(doc) => setLocalDocs((prev) => [...prev, doc])}
          onSettled={(tempId, saved) =>
            setLocalDocs((prev) =>
              saved
                ? prev.map((d) => (d.id === tempId ? saved : d))
                : prev.filter((d) => d.id !== tempId)
            )
          }
        />
      )}

      {/* Modal — Editar */}
      {editing && (
        <EditDocumentModal
          key={editing.id}
          doc={editing}
          projectId={projectId}
          onClose={() => setEditing(null)}
          onPatched={(updated) =>
            setLocalDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
          }
        />
      )}

      {/* Modal — Excluir */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="mb-1 font-semibold text-dark">Excluir documento</h3>
            <p className="mb-5 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-dark">
              {deleteTarget.name}
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                Excluir
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Linha da tabela (memoizada) ─────────────────────────────── */

const DocumentRow = memo(function DocumentRow({
  doc,
  onEdit,
  onDelete,
}: {
  doc: DocumentWithUrl
  onEdit: (doc: DocumentWithUrl) => void
  onDelete: (doc: DocumentWithUrl) => void
}) {
  return (
    <tr className="hover:bg-cream/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-terracotta shrink-0" />
          <span className="font-medium text-dark">{doc.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-500">{doc.type}</td>
      <td className="px-4 py-3 text-gray-400">{formatDate(doc.created_at.split('T')[0])}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={() => onEdit(doc)}
            className="rounded p-1.5 text-brown hover:text-terracotta transition-colors"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {doc.signedUrl && (
            <a
              href={doc.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-gray-400 hover:text-terracotta transition-colors"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </a>
          )}
          <button
            onClick={() => onDelete(doc)}
            className="rounded p-1.5 text-brown hover:text-[#8B3A3A] transition-colors"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
})

/* ─── Modal — Adicionar Documento ────────────────────────────── */

function AddDocumentModal({
  projectId,
  usedTypes,
  onClose,
  onOptimistic,
  onSettled,
}: {
  projectId:    string
  usedTypes:    string[]
  onClose:      () => void
  onOptimistic: (doc: DocumentWithUrl) => void
  onSettled:    (tempId: string, saved: DocumentWithUrl | null) => void
}) {
  function handleSubmit(formData: FormData) {
    const file = formData.get('file') as File
    if (!file || file.size === 0) {
      toast.error('Nenhum arquivo selecionado')
      return
    }

    // Otimista: o documento entra na lista e o modal fecha na hora;
    // o upload roda em background e o botão de download aparece quando conclui.
    const tempId = `temp-${Date.now()}`
    const optimistic: DocumentWithUrl = {
      id: tempId,
      project_id: projectId,
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      storage_path: '',
      uploaded_by: null,
      created_at: new Date().toISOString(),
    }

    onOptimistic(optimistic)
    onClose()
    toastAfterClose('Documento enviado com sucesso')

    const persist = () =>
      uploadDocument(projectId, formData)
        .then((result) => {
          if (!result.success || !result.document) throw new Error(result.error)
          onSettled(tempId, result.document as unknown as DocumentWithUrl)
        })
        .catch((err: Error) => {
          onSettled(tempId, null)
          toast.error(err.message || 'Erro ao enviar documento', {
            action: {
              label: 'Tentar novamente',
              onClick: () => { onOptimistic(optimistic); persist() },
            },
          })
        })
    persist()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <h3 className="font-semibold text-dark">Adicionar Documento</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Nome do Documento *</label>
            <input
              name="name"
              required
              placeholder="Ex: ART — João Silva CREA 12345"
              className={INPUT}
            />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Tipo *</label>
            <DocTypeSelector usedTypes={usedTypes} />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Arquivo *</label>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-terracotta/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta hover:file:bg-terracotta/20"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Enviar Documento
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Modal — Editar Documento ───────────────────────────────── */

function EditDocumentModal({
  doc,
  projectId,
  onClose,
  onPatched,
}: {
  doc:       DocumentWithUrl
  projectId: string
  onClose:   () => void
  onPatched: (updated: DocumentWithUrl) => void
}) {
  function handleSubmit(formData: FormData) {
    // Otimista: nome/tipo refletem na lista e o modal fecha na hora;
    // a troca de arquivo (se houver) roda em background.
    const optimistic: DocumentWithUrl = {
      ...doc,
      name: formData.get('name') as string,
      type: formData.get('type') as string,
    }

    onPatched(optimistic)
    onClose()
    toastAfterClose('Documento atualizado')

    const persist = () =>
      updateDocument(doc.id, projectId, doc.storage_path, formData)
        .then((result) => {
          if (!result.success) throw new Error(result.error)
        })
        .catch((err: Error) => {
          onPatched(doc)
          toast.error(err.message || 'Erro ao atualizar documento', {
            action: {
              label: 'Tentar novamente',
              onClick: () => { onPatched(optimistic); persist() },
            },
          })
        })
    persist()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
          <h3 className="font-semibold text-dark">Editar Documento</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-dark transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className={LABEL}>Nome do Documento *</label>
            <input
              name="name"
              required
              defaultValue={doc.name}
              className={INPUT}
            />
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Tipo *</label>
            <select name="type" required defaultValue={doc.type} className={INPUT}>
              <option value="">Selecionar tipo...</option>
              {DOCUMENT_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className={LABEL}>Substituir arquivo</label>

            {doc.storage_path && (
              <div className="rounded-lg border border-gold/50 bg-[#F9F7F4] px-3 py-2.5 flex items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-terracotta" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 leading-none mb-0.5">Arquivo atual:</p>
                  <p className="text-sm font-medium text-dark truncate">
                    {doc.storage_path.split('/').pop()}
                  </p>
                </div>
                {doc.signedUrl && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-terracotta hover:text-brown transition-colors"
                  >
                    Visualizar
                  </a>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400">
              {doc.storage_path
                ? 'Substituir por outro arquivo (opcional)'
                : 'Deixe em branco para manter o arquivo atual.'}
            </p>
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="w-full rounded-lg border border-gold/50 px-3 py-2 text-sm text-gray-500 file:mr-3 file:rounded file:border-0 file:bg-terracotta/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-terracotta hover:file:bg-terracotta/20"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown disabled:opacity-60 transition-colors"
            >
              <Check className="h-4 w-4" />
              Salvar Alterações
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gold/50 px-4 py-2 text-sm font-medium text-dark hover:bg-cream transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
