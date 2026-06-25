import { toast } from 'sonner'

/**
 * Atraso padrão (ms) entre FECHAR o modal e exibir o toast de confirmação.
 * Garante a ordem correta em todo o app: primeiro o modal some, depois o toast
 * aparece — nunca o contrário. (Padrão-ouro: modais do Financeiro.)
 */
export const TOAST_DELAY = 250

/**
 * Dispara um toast de sucesso ~250ms DEPOIS do fechamento do modal.
 * Uso: `onClose(); toastAfterClose('Salvo')` — o modal fecha na hora e o
 * toast entra logo em seguida.
 */
export function toastAfterClose(message: string): void {
  setTimeout(() => toast.success(message), TOAST_DELAY)
}
