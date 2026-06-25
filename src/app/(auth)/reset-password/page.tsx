'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resetPassword } from '@/app/actions/auth'
import { toast } from 'sonner'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-terracotta hover:bg-brown text-white"
    >
      {pending ? 'Enviando...' : 'Enviar link de recuperacao'}
    </Button>
  )
}

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false)

  async function handleSubmit(formData: FormData) {
    const result = await resetPassword(formData)
    if (result?.error) {
      toast.error(result.error)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-gold bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark">
            <span className="text-base font-black text-gold">V</span>
          </div>
          <h1 className="text-lg font-bold text-dark">Recuperar senha</h1>
        </div>

        {sent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-400">
              E-mail enviado! Verifique sua caixa de entrada e clique no link para definir uma nova senha.
            </p>
            <Link
              href="/login"
              className="text-sm text-terracotta hover:text-brown underline-offset-4 hover:underline"
            >
              Voltar ao login
            </Link>
          </div>
        ) : (
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
            <SubmitButton />
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-dark underline-offset-4 hover:underline"
              >
                Voltar ao login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
