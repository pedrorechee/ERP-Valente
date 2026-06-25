import { Globe } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default async function PortalClientePage({
  params,
}: {
  params: Promise<{ obraId: string }>
}) {
  const { obraId } = await params

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark">
            <span className="text-base font-black text-gold">V</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-dark">Portal do Cliente</h1>
            <p className="text-sm text-gray-400">Construtora Valente</p>
          </div>
        </div>

        <Card className="flex min-h-64 items-center justify-center border-dashed border-gold">
          <div className="text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-gray-400" />
            <p className="font-semibold text-dark">Acompanhamento da sua obra</p>
            <p className="mt-1 text-sm text-gray-400">
              Obra ID: {obraId} · Disponivel na Fase 5
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
