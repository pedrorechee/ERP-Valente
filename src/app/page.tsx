import { redirect } from 'next/navigation'

// Redireciona / para /dashboard (evita conflito com route group)
export default function RootPage() {
  redirect('/dashboard')
}
