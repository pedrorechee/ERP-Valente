'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, AlertTriangle, Clock, Check, Loader2, TrendingDown } from 'lucide-react'
import { getNotifications, markRead, markAllRead } from '@/app/actions/notifications'
import type { Notification } from '@/types/database'

const TYPE_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string }> = {
  phase_delayed:      { icon: AlertTriangle, color: 'text-red-500' },
  milestone_overdue:  { icon: AlertTriangle, color: 'text-red-500' },
  milestone_due_today:{ icon: Clock,         color: 'text-red-500' },
  milestone_due_3:    { icon: Clock,         color: 'text-red-500' },
  milestone_due_7:    { icon: Clock,         color: 'text-amber-500' },
  negative_balance:   { icon: TrendingDown,  color: 'text-amber-500' },
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return `há ${days} dia(s)`
}

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleOpen() {
    const next = !isOpen
    setIsOpen(next)
    if (next && !loaded) {
      startTransition(async () => {
        const data = await getNotifications()
        setNotifications(data)
        setLoaded(true)
      })
    }
  }

  async function handleClickNotification(n: Notification) {
    setIsOpen(false)
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
      setCount((prev) => Math.max(0, prev - 1))
      await markRead(n.id)
    }
    router.push(n.link)
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setCount(0)
    await markAllRead()
  }

  return (
    <div className="relative" ref={ref}>
      {/* Botão do sininho */}
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-dark"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-96 rounded-xl border border-gold/30 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gold/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-dark text-sm">Notificações</span>
              {count > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                  {count} não lida{count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {count > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-terracotta hover:text-brown transition-colors"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[400px] overflow-y-auto">
            {!loaded || isPending ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-terracotta" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Check className="mb-2 h-8 w-8 text-green-400" />
                <p className="text-sm font-medium text-gray-600">Tudo em dia!</p>
                <p className="text-xs text-gray-400">Nenhuma notificação no momento</p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => {
                const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.phase_delayed
                const Icon = config.icon
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotification(n)}
                    className={`flex w-full items-start gap-3 border-b border-gold/10 px-4 py-3 text-left transition-colors last:border-0 hover:bg-cream/40 ${
                      !n.read ? 'bg-[#FEF9F0]' : 'bg-white'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? 'font-medium text-dark' : 'text-gray-500'}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-terracotta" />
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {loaded && notifications.length >= 20 && (
            <div className="border-t border-gold/20 px-4 py-2.5 text-center">
              <span className="text-xs text-gray-400">Mostrando as 20 mais recentes</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
