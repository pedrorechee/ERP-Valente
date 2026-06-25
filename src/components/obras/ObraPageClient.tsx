'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Layers, BookOpen,
  FileText, Flag, DollarSign, CalendarRange, History, Scale, Users,
} from 'lucide-react'
import type {
  Project, ProjectPhase, PhaseTask, DiaryEntry, DiaryPhoto,
  ProjectDocument, CriticalMilestone, FinancialEntry, Client,
} from '@/types/database'
import { PROJECT_TYPE_LABELS } from '@/types/database'
import { formatDate, isOverdue, formatProjectAddress } from '@/lib/format'
import { StatusButton } from '@/components/obras/StatusButton'
import { ObraKPIs } from '@/components/obras/ObraKPIs'
import { LinhaDoTempo } from '@/components/obras/LinhaDoTempo'
import { VisaoGeral } from '@/components/obras/tabs/VisaoGeral'
import { FasesETarefas } from '@/components/obras/tabs/FasesETarefas'
import { Cronograma } from '@/components/obras/tabs/Cronograma'
import { DiarioDeObra } from '@/components/obras/tabs/DiarioDeObra'
import { Documentos } from '@/components/obras/tabs/Documentos'
import { MarcosCriticos } from '@/components/obras/tabs/MarcosCriticos'
import { FinanceiroObra } from '@/components/obras/tabs/FinanceiroObra'
import { EquipeObra, type TeamMemberRow, type EmployeeMini } from '@/components/obras/tabs/EquipeObra'
import { OrcadoRealizado, type OrcadoRealizadoRow } from '@/components/orcamentos/OrcadoRealizado'

const TABS = [
  { key: 'visao-geral', label: 'Visão Geral',    icon: LayoutDashboard },
  { key: 'fases',       label: 'Fases e Tarefas', icon: Layers },
  { key: 'diario',      label: 'Diário',          icon: BookOpen },
  { key: 'documentos',  label: 'Documentos',      icon: FileText },
  { key: 'marcos',      label: 'Marcos',          icon: Flag },
  { key: 'financeiro',  label: 'Financeiro',      icon: DollarSign },
  { key: 'equipe',      label: 'Equipe',          icon: Users },
  { key: 'orcado',      label: 'Orçado x Realizado', icon: Scale },
  { key: 'cronograma',  label: 'Cronograma',      icon: CalendarRange },
  { key: 'linha-tempo', label: 'Linha do Tempo',  icon: History },
] as const

type TabKey = typeof TABS[number]['key']

type DiaryEntryFull = DiaryEntry & { diary_photos: (DiaryPhoto & { signedUrl?: string })[] }
type DocumentWithUrl = ProjectDocument & { signedUrl?: string }

interface Props {
  project:          Project & { clients: Pick<Client, 'id' | 'name'> | null }
  phases:           (ProjectPhase & { phase_tasks: PhaseTask[] })[]
  diaryEntries:     DiaryEntryFull[]
  documents:        DocumentWithUrl[]
  milestones:       CriticalMilestone[]
  financialEntries: FinancialEntry[]
  totalGasto:       number
  totalPago:        number
  orcadoRealizadoRows: OrcadoRealizadoRow[]
  plannedDirectCost: number
  budgetId:         string | null
  budgetIsDraft?:   boolean
  team:             TeamMemberRow[]
  costByEmployee:   Record<string, { cost: number; days: number }>
  activeEmployees:  EmployeeMini[]
  teamSummary:      { cost: number; launched: number; days: number }
  canManageTeam:    boolean
  presentToday:     string
  initialTab:       string
}

export function ObraPageClient({
  project,
  phases,
  diaryEntries,
  documents,
  milestones,
  financialEntries,
  totalGasto,
  totalPago,
  orcadoRealizadoRows,
  plannedDirectCost,
  budgetId,
  budgetIsDraft = false,
  team,
  costByEmployee,
  activeEmployees,
  teamSummary,
  canManageTeam,
  presentToday,
  initialTab,
}: Props) {
  const validTab = TABS.some(t => t.key === initialTab) ? initialTab as TabKey : 'visao-geral'
  const [activeTab, setActiveTab] = useState<TabKey>(validTab)

  const overdue  = project.status === 'active' && isOverdue(project.expected_end_date)

  return (
    <div className="space-y-5">

      {/* Header da obra */}
      <div className="rounded-xl border border-gold/40 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-dark">{project.name}</h1>
              <StatusButton projectId={project.id} currentStatus={project.status} overallProgress={project.overall_progress} />
              {overdue && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                  Prazo vencido
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">{formatProjectAddress(project)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
              <span>{PROJECT_TYPE_LABELS[project.type]}</span>
              {project.area_m2 && <span>{project.area_m2} m²</span>}
              {project.technical_responsible && <span>{project.technical_responsible}</span>}
              <span>Prazo: {formatDate(project.expected_end_date)}</span>
              {project.clients && (
                <Link
                  href={`/clientes/${project.clients.id}`}
                  className="hover:text-terracotta transition-colors underline underline-offset-2"
                >
                  Cliente: {project.clients.name}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/obras/${project.id}/editar`}
              className="rounded-lg border border-gold/50 px-3 py-1.5 text-sm font-medium text-dark hover:bg-cream transition-colors"
            >
              Editar
            </Link>
          </div>
        </div>

        {/* Progresso geral */}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Progresso geral</span>
            <span className="font-semibold text-dark">{project.overall_progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-terracotta transition-all"
              style={{ width: `${project.overall_progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* KPIs da obra */}
      <ObraKPIs project={project} phases={phases} totalPago={totalPago} />

      {/* Warning: sem cliente */}
      {!project.client_id && project.status === 'active' && (
        <div className="flex items-center justify-between rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800">Esta obra não tem cliente vinculado.</p>
          <Link
            href={`/obras/${project.id}/editar`}
            className="text-sm font-medium text-yellow-700 underline hover:text-yellow-900"
          >
            Adicionar cliente →
          </Link>
        </div>
      )}

      {/* Tab Nav */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 rounded-xl border border-gold/30 bg-cream/30 p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'bg-white text-dark shadow-sm'
                  : 'text-gray-500 hover:text-dark hover:bg-white/60'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da aba — key força re-montagem + animação */}
      <div key={activeTab} className="tab-fade-in">
        {activeTab === 'visao-geral' && (
          <VisaoGeral
            project={project}
            phases={phases}
            totalGasto={totalGasto}
            plannedDirectCost={plannedDirectCost}
            realizedWithPhase={orcadoRealizadoRows
              .filter((r) => r.id !== '__sem_etapa__')
              .reduce((s, r) => s + r.realizado, 0)}
          />
        )}
        {activeTab === 'fases' && (
          <FasesETarefas projectId={project.id} phases={phases} />
        )}
        {activeTab === 'cronograma' && (
          <Cronograma phases={phases} milestones={milestones} overallProgress={project.overall_progress} />
        )}
        {activeTab === 'linha-tempo' && (
          <LinhaDoTempo
            phases={phases}
            milestones={milestones}
            diaryEntries={diaryEntries}
            financialEntries={financialEntries}
          />
        )}
        {activeTab === 'diario' && (
          <DiarioDeObra projectId={project.id} projectName={project.name} entries={diaryEntries} presentToday={presentToday} />
        )}
        {activeTab === 'documentos' && (
          <Documentos projectId={project.id} documents={documents} />
        )}
        {activeTab === 'marcos' && (
          <MarcosCriticos projectId={project.id} milestones={milestones} />
        )}
        {activeTab === 'financeiro' && (
          <FinanceiroObra projectId={project.id} entries={financialEntries} />
        )}
        {activeTab === 'equipe' && (
          <EquipeObra
            projectId={project.id}
            team={team}
            costByEmployee={costByEmployee}
            activeEmployees={activeEmployees}
            summary={teamSummary}
            canManage={canManageTeam}
          />
        )}
        {activeTab === 'orcado' && (
          <OrcadoRealizado
            rows={orcadoRealizadoRows}
            emptyMessage="Nenhum orçamento aprovado e nenhuma despesa por etapa nesta obra ainda."
            budgetId={budgetId}
            budgetIsDraft={budgetIsDraft}
          />
        )}
      </div>
    </div>
  )
}
