'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { CpfCnpjInput } from '@/components/ui/cpf-cnpj-input'
import { PhoneInput } from '@/components/ui/phone-input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { toastAfterClose } from '@/lib/ui-feedback'
import { createEmployee, updateEmployee } from '@/app/actions/equipe'
import type { Employee, EmploymentType } from '@/types/database'

const inputCls =
  'w-full rounded-lg border border-gold/50 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-1 focus:ring-terracotta'

const labelCls = 'text-xs font-semibold uppercase tracking-wide text-brown'

interface Props {
  employee?: Employee | null            // ausente = criação
  onSave: (employee: Employee) => void
  onClose: () => void
}

export function FuncionarioModal({ employee, onSave, onClose }: Props) {
  const isEdit = !!employee
  const containerRef = useRef<HTMLDivElement>(null)
  const [type, setType] = useState<EmploymentType>(employee?.employment_type ?? 'clt')
  const [isActive, setIsActive] = useState<boolean>(employee?.is_active ?? true)
  const [nameError, setNameError] = useState(false)

  function persist(formData: FormData) {
    const action = isEdit
      ? updateEmployee(employee!.id, formData)
      : createEmployee(formData)
    action
      .then((result) => {
        if (!result.success) throw new Error(result.error)
        onSave(result.employee)
      })
      .catch((err: Error) => {
        toast.error(err.message || 'Erro ao salvar funcionário', {
          action: { label: 'Tentar novamente', onClick: () => persist(formData) },
        })
      })
  }

  function handleSubmit() {
    if (!containerRef.current) return
    const formData = new FormData()
    containerRef.current
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[name], textarea[name]')
      .forEach((el) => {
        formData.set(el.name, el.value)
      })

    const name = (formData.get('name') as string)?.trim()
    if (!name) {
      setNameError(true)
      document.getElementById('func-name')?.focus()
      return
    }

    onClose()
    toastAfterClose(isEdit ? 'Funcionário atualizado' : 'Funcionário cadastrado')
    persist(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between border-b border-gold/20 bg-white px-5 py-4">
          <h2 className="text-base font-semibold text-dark">
            {isEdit ? 'Editar funcionário' : 'Novo funcionário'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={containerRef} className="p-5 space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label htmlFor="func-name" className={labelCls}>
              Nome <span className="text-danger">*</span>
            </label>
            <input
              id="func-name"
              name="name"
              autoFocus
              defaultValue={employee?.name ?? ''}
              onChange={() => nameError && setNameError(false)}
              placeholder="Nome completo"
              className={inputCls}
            />
            {nameError && <p className="text-xs text-danger">Informe o nome do funcionário.</p>}
          </div>

          {/* CPF + Função */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>CPF</label>
              <CpfCnpjInput name="document" defaultValue={employee?.document} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Função</label>
              <input
                name="role"
                defaultValue={employee?.role ?? ''}
                placeholder="Pedreiro, Servente, Mestre…"
                className={inputCls}
              />
            </div>
          </div>

          {/* Tipo de contratação (segmented) */}
          <div className="space-y-1.5">
            <label className={labelCls}>
              Tipo de contratação <span className="text-danger">*</span>
            </label>
            <div className="flex gap-1 rounded-lg border border-gold/40 bg-cream/30 p-1">
              {(['clt', 'diarista'] as EmploymentType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    type === t ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
                  }`}
                >
                  {t === 'clt' ? 'CLT' : 'Diarista'}
                </button>
              ))}
            </div>
            <input type="hidden" name="employment_type" value={type} />
          </div>

          {/* Campos por tipo */}
          {type === 'clt' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Salário mensal</label>
                <CurrencyInput
                  name="monthly_salary"
                  defaultValue={employee?.monthly_salary}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Dias úteis/mês</label>
                <input
                  name="work_days_month"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={employee?.work_days_month ?? 22}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Fator de encargos</label>
                <input
                  name="charge_factor"
                  type="number"
                  step="0.01"
                  min={1}
                  defaultValue={employee?.charge_factor ?? 1}
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className={labelCls}>Valor da diária</label>
              <CurrencyInput
                name="daily_rate"
                defaultValue={employee?.daily_rate}
                className={inputCls}
              />
            </div>
          )}

          {/* Admissão + Telefone */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Data de admissão</label>
              <input
                name="admission_date"
                type="date"
                defaultValue={employee?.admission_date ?? ''}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Telefone</label>
              <PhoneInput name="phone" defaultValue={employee?.phone} className={inputCls} />
            </div>
          </div>

          {/* PIX */}
          <div className="space-y-1.5">
            <label className={labelCls}>Chave PIX</label>
            <input
              name="pix_key"
              defaultValue={employee?.pix_key ?? ''}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              className={inputCls}
            />
          </div>

          {/* Status ativo */}
          <div className="flex items-center justify-between rounded-lg border border-gold/30 bg-cream/20 px-3 py-2.5">
            <span className="text-sm font-medium text-dark">Funcionário ativo</span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                isActive ? 'bg-terracotta' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  isActive ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
            <input type="hidden" name="is_active" value={isActive ? 'true' : 'false'} />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={employee?.notes ?? ''}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-dark hover:bg-[#F9F7F4] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-terracotta px-5 py-2 text-sm font-medium text-white hover:bg-brown transition-colors"
            >
              {isEdit ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
