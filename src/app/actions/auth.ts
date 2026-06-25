'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { GUEST_LOGIN_ENABLED } from '@/lib/guest'

export async function devLogin() {
  if (!GUEST_LOGIN_ENABLED) return
  const cookieStore = await cookies()
  cookieStore.set('dev-bypass', '1', { path: '/', httpOnly: true })
  redirect('/dashboard')
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'E-mail ou senha incorretos.' }
  }

  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password/confirm`,
  })

  if (error) {
    return { error: 'Nao foi possivel enviar o e-mail de recuperacao.' }
  }

  return { success: true }
}
