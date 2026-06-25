import { Globe } from 'lucide-react'
import { Card } from '@/components/ui/card'

export default function PortalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-dark">Portal Cliente</h2>
        <p className="text-gray-400">Gestao do portal</p>
      </div>
      <Card className="flex min-h-64 items-center justify-center border-dashed border-gold">
        <div className="text-center">
          <Globe className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="font-semibold text-dark">Portal Cliente</p>
          <p className="mt-1 text-sm text-gray-400">Disponivel em fase futura</p>
        </div>
      </Card>
    </div>
  )
}
