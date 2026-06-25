'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Props {
  message: string
  type?: 'success' | 'error'
}

export function ToastOnMount({ message, type = 'success' }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (type === 'success') toast.success(message)
    else toast.error(message)

    // Remove ?success from the URL — this unmounts this component before
    // React Strict Mode's second effect pass, preventing a double toast.
    const url = new URL(window.location.href)
    url.searchParams.delete('success')
    router.replace(url.pathname + url.search, { scroll: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
