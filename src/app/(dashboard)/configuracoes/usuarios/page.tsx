import { redirect } from 'next/navigation'

// Gestão de usuários foi unificada na aba "Usuários e Permissões" de /configuracoes.
export default function UsuariosRedirect() {
  redirect('/configuracoes')
}
