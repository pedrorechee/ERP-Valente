'use server'

import { getActionClient } from '@/lib/supabase/action'
import type { Notification } from '@/types/database'

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export async function generateNotifications(userId: string): Promise<void> {
  const { supabase } = await getActionClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const in7daysStr = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0]
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const monthKey = monthStart.slice(0, 7)

  const [{ data: phases }, { data: milestones }, { data: existing }, { data: incomeData }, { data: expenseData }] = await Promise.all([
    supabase
      .from('project_phases')
      .select('id, name, expected_end, project_id, projects!inner(name, status)')
      .neq('status', 'completed')
      .not('expected_end', 'is', null)
      .lt('expected_end', todayStr),
    supabase
      .from('critical_milestones')
      .select('id, description, planned_date, project_id, projects(name)')
      .eq('status', 'pending')
      .lte('planned_date', in7daysStr),
    supabase
      .from('notifications')
      .select('type, reference_id')
      .eq('user_id', userId),
    supabase
      .from('financial_entries')
      .select('amount')
      .eq('entry_type', 'income')
      .gte('entry_date', monthStart),
    supabase
      .from('financial_entries')
      .select('amount')
      .eq('entry_type', 'expense')
      .gte('entry_date', monthStart),
  ])

  const existingSet = new Set((existing ?? []).map((n) => `${n.type}:${n.reference_id}`))
  const toInsert: Record<string, unknown>[] = []

  for (const phase of phases ?? []) {
    const project = (phase as unknown as { projects?: { name: string; status: string } }).projects
    if (!project || project.status !== 'active') continue
    const key = `phase_delayed:${phase.id}`
    if (existingSet.has(key)) continue
    toInsert.push({
      user_id: userId,
      type: 'phase_delayed',
      title: 'Fase atrasada',
      message: `Fase "${phase.name}" da obra "${project.name}" está atrasada desde ${formatDate(phase.expected_end as string)}`,
      link: `/obras/${phase.project_id}?tab=fases`,
      reference_id: phase.id,
    })
  }

  for (const m of milestones ?? []) {
    const project = (m as unknown as { projects?: { name: string } }).projects
    if (!project) continue
    const mDate = new Date((m.planned_date as string) + 'T00:00:00')
    const daysLeft = Math.ceil((mDate.getTime() - today.getTime()) / 86400000)

    let type: string
    let urgencyText: string
    if (daysLeft < 0) {
      type = 'milestone_overdue'
      urgencyText = `venceu há ${Math.abs(daysLeft)} dia(s) sem ser concluído`
    } else if (daysLeft === 0) {
      type = 'milestone_due_today'
      urgencyText = 'vence hoje'
    } else if (daysLeft <= 3) {
      type = 'milestone_due_3'
      urgencyText = `vence em ${daysLeft} dia(s)`
    } else {
      type = 'milestone_due_7'
      urgencyText = `vence em ${daysLeft} dia(s)`
    }

    const key = `${type}:${m.id}`
    if (existingSet.has(key)) continue
    toInsert.push({
      user_id: userId,
      type,
      title: 'Marco crítico',
      message: `Marco "${m.description}" ${urgencyText} — obra "${project.name}"`,
      link: `/obras/${m.project_id}?tab=marcos`,
      reference_id: m.id,
    })
  }

  const totalIncome = (incomeData ?? []).reduce((s, e) => s + (e as { amount: number }).amount, 0)
  const totalExpense = (expenseData ?? []).reduce((s, e) => s + (e as { amount: number }).amount, 0)
  const monthBalance = totalIncome - totalExpense

  if (monthBalance < 0) {
    const key = `negative_balance:${monthKey}`
    if (!existingSet.has(key)) {
      toInsert.push({
        user_id: userId,
        type: 'negative_balance',
        title: 'Resultado negativo',
        message: `Resultado do mês está negativo: ${formatCurrency(monthBalance)}`,
        link: '/financeiro',
        reference_id: monthKey,
      })
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('notifications').insert(toInsert)
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { supabase } = await getActionClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
  return count ?? 0
}

export async function getNotifications(): Promise<Notification[]> {
  const { supabase, userId } = await getActionClient()
  if (!userId) return []
  const { data } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, message, link, read, reference_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data as Notification[] | null) ?? []
}

export async function markRead(notificationId: string): Promise<void> {
  const { supabase } = await getActionClient()
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
}

export async function markAllRead(): Promise<void> {
  const { supabase, userId } = await getActionClient()
  if (!userId) return
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
}
