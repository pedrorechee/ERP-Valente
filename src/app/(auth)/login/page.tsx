'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signIn, devLogin } from '@/app/actions/auth'
import { GUEST_LOGIN_ENABLED } from '@/lib/guest'
import { toast } from 'sonner'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-terracotta hover:bg-brown text-white"
    >
      {pending ? 'Entrando...' : 'Entrar'}
    </Button>
  )
}

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setError(null)
    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      toast.error(result.error)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-gold bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark">
            <span className="text-base font-black text-gold">V</span>
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-dark">Valente ERP</h1>
            <p className="text-sm text-gray-400">Construtora Valente</p>
          </div>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-brown text-xs font-semibold uppercase tracking-wide">
              E-mail
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              className="border-gold focus-visible:ring-terracotta"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-brown text-xs font-semibold uppercase tracking-wide">
              Senha
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              className="border-gold focus-visible:ring-terracotta"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <SubmitButton />
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/reset-password"
            className="text-sm text-terracotta hover:text-brown underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>

        {GUEST_LOGIN_ENABLED && (
          <div className="mt-4 border-t border-dashed border-gold/40 pt-4">
            <form action={devLogin}>
              <button
                type="submit"
                className="w-full rounded-md border border-dashed border-gold/60 py-2 text-xs text-gray-400 transition-colors hover:border-gold hover:text-brown"
              >
                Entrar sem login
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
