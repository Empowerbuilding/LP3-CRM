'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { updateDealStage } from '@/lib/supabase'
import {
  type PipelineStage,
  type DealType,
  type User,
  STAGE_LABELS,
  PIPELINE_STAGES,
  isDealInPipeline,
} from '@/lib/types'
import type { DealWithCompany } from './page'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const STAGE_DOT_COLORS: Record<PipelineStage, string> = {
  new_lead: 'bg-brand-500',
  inspection_scheduled: 'bg-cyan-500',
  inspection_complete: 'bg-indigo-500',
  estimate_sent: 'bg-violet-500',
  approved: 'bg-yellow-500',
  contract_signed: 'bg-purple-500',
  job_in_progress: 'bg-orange-500',
  completed: 'bg-green-500',
  lost: 'bg-red-500',
}

const DEAL_TYPE_COLORS: Record<DealType, string> = {
  new_construction: 'border-l-brand-500',
  remodel: 'border-l-indigo-500',
  addition: 'border-l-orange-500',
}

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  new_construction: 'New Construction',
  remodel: 'Remodel',
  addition: 'Addition',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface PipelineBoardProps {
  initialDeals: DealWithCompany[]
  users: User[]
}

export function PipelineBoard({ initialDeals, users }: PipelineBoardProps) {
  const [deals, setDeals] = useState<DealWithCompany[]>(initialDeals)
  const [ownerFilter, setOwnerFilter] = useState<string>('all') // 'all' | owner_id
  const [updating, setUpdating] = useState<string | null>(null)

  const stages = PIPELINE_STAGES

  // Filter deals by owner and group by stage
  const { filteredDeals, dealsByStage, totalPipelineValue } = useMemo(() => {
    let filtered = deals

    // Apply owner filter
    if (ownerFilter !== 'all') {
      filtered = filtered.filter((deal) => deal.owner_id === ownerFilter)
    }

    const byStage = stages.reduce(
      (acc, stage) => {
        acc[stage] = filtered.filter((deal) => deal.stage === stage)
        return acc
      },
      {} as Record<PipelineStage, DealWithCompany[]>
    )

    // Pipeline value = deals in active pipeline stages (not won, not lost)
    const totalValue = filtered
      .filter((d) => isDealInPipeline(d.stage))
      .reduce((sum, d) => sum + (d.value || 0), 0)

    return { filteredDeals: filtered, dealsByStage: byStage, totalPipelineValue: totalValue }
  }, [deals, ownerFilter, stages])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const newStage = destination.droppableId as PipelineStage
    const dealId = draggableId

    // Optimistic update
    setDeals((prev) =>
      prev.map((deal) =>
        deal.id === dealId ? { ...deal, stage: newStage } : deal
      )
    )

    setUpdating(dealId)

    try {
      const { error } = await updateDealStage(dealId, newStage)

      if (error) {
        // Revert on error
        setDeals((prev) =>
          prev.map((deal) =>
            deal.id === dealId
              ? { ...deal, stage: source.droppableId as PipelineStage }
              : deal
          )
        )
        console.error('Failed to update deal:', error)
      }
    } catch (err) {
      // Revert on error
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === dealId
            ? { ...deal, stage: source.droppableId as PipelineStage }
            : deal
        )
      )
      console.error('Failed to update deal:', err)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="pt-14 md:pt-0">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Owner Filter */}
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
          >
            <option value="all">All Owners</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{filteredDeals.length}</span> deals
          <span className="mx-2">•</span>
          <span className="font-medium text-gray-900">{formatCurrency(totalPipelineValue)}</span> pipeline
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = dealsByStage[stage] || []
            const totalValue = stageDeals.reduce(
              (sum, deal) => sum + (deal.value || 0),
              0
            )

            return (
              <div
                key={stage}
                className="flex-shrink-0 w-64 bg-gray-100 rounded-lg"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${STAGE_DOT_COLORS[stage]}`} />
                    <h2 className="font-medium text-gray-900">
                      {STAGE_LABELS[stage]}
                    </h2>
                    <span className="ml-auto text-sm text-gray-500">
                      {stageDeals.length}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {formatCurrency(totalValue)}
                  </p>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={stage}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-2 min-h-[calc(100vh-280px)] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-gray-200' : ''
                      }`}
                    >
                      {stageDeals.map((deal, index) => (
                        <Draggable
                          key={deal.id}
                          draggableId={deal.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-2 p-3 bg-white rounded-lg shadow-sm border-l-4 ${
                                deal.deal_type
                                  ? DEAL_TYPE_COLORS[deal.deal_type]
                                  : 'border-l-gray-300'
                              } ${
                                snapshot.isDragging
                                  ? 'shadow-lg ring-2 ring-brand-400'
                                  : ''
                              } ${updating === deal.id ? 'opacity-50' : ''}`}
                            >
                              <Link
                                href={`/deals/${deal.id}`}
                                className="font-medium text-gray-900 text-sm mb-1 line-clamp-2 hover:text-brand-600 block"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {deal.title}
                              </Link>
                              {deal.company_name && (
                                <p className="text-xs text-gray-500 mb-2">
                                  {deal.company_name}
                                </p>
                              )}
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-900">
                                  {deal.value ? formatCurrency(deal.value) : '-'}
                                </span>
                                {deal.expected_close_date && (
                                  <span className="text-gray-500">
                                    {formatDate(deal.expected_close_date)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                {deal.deal_type && (
                                  <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {DEAL_TYPE_LABELS[deal.deal_type]}
                                  </span>
                                )}
                                {deal.owner_name && (
                                  <div
                                    className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-medium ml-auto"
                                    title={deal.owner_name}
                                  >
                                    {getInitials(deal.owner_name)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Deal Types:</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(DEAL_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className={`w-3 h-3 rounded border-l-4 ${
                  DEAL_TYPE_COLORS[type as DealType]
                } bg-white`}
              />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
