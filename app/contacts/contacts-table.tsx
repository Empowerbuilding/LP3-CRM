'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { LeadSource, Company, ClientType, LifecycleStage, User } from '@/lib/types'
import { LIFECYCLE_STAGE_LABELS, LIFECYCLE_STAGE_COLORS } from '@/lib/types'
import type { ContactWithCompany } from './page'
import { ContactSlideOver } from './contact-slide-over'

const LEAD_SOURCES: LeadSource[] = [
  'website_estimate',
  'phone_call',
  'referral',
  'facebook_ad',
  'email',
  'calendar_booking',
  'other',
]

const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website_estimate: 'Website Estimate',
  google_ads: 'Google Ads',
  referral: 'Referral',
  facebook_ad: 'Facebook Ad',
  phone_call: 'Direct Phone Call',
  email: 'Direct Email',
  storm_lead: 'Storm Lead',
  other: 'Other',
  calendar_booking: 'Calendar Booking',
  door_knock: 'Door Knock',
  insurance_adjuster: 'Insurance Adjuster',
  repeat_customer: 'Repeat Customer',
  yard_sign: 'Yard Sign',
}

const CLIENT_TYPES: ClientType[] = ['consumer', 'builder', 'subcontractor', 'engineer', 'architect', 'realtor']

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
  realtor: 'Realtor',
}

const CLIENT_TYPE_COLORS: Record<ClientType, string> = {
  builder: 'bg-brand-100 text-brand-800',
  consumer: 'bg-green-100 text-green-800',
  subcontractor: 'bg-orange-100 text-orange-800',
  engineer: 'bg-purple-100 text-purple-800',
  architect: 'bg-pink-100 text-pink-800',
  realtor: 'bg-teal-100 text-teal-800',
}

const LIFECYCLE_STAGES: LifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'customer']

type LeadScore = 'hot' | 'medium' | 'cold'

const LEAD_SCORE_LABELS: Record<LeadScore, string> = {
  hot: 'Hot',
  medium: 'Medium',
  cold: 'Cold',
}

const LEAD_SCORE_STYLES: Record<LeadScore, string> = {
  hot: 'bg-red-100 text-red-700 border border-red-200',
  medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  cold: 'bg-gray-100 text-gray-600 border border-gray-200',
}

type SortField = 'name' | 'company' | 'email' | 'phone' | 'lead_source' | 'lifecycle_stage' | 'lead_score' | 'created_at' | 'updated_at' | 'role' | 'owner'
type SortDirection = 'asc' | 'desc'
type UnsubscribedFilter = 'all' | 'subscribed' | 'unsubscribed'

type ColumnKey = 'name' | 'company' | 'type' | 'email' | 'phone' | 'lead_source' | 'lead_score' | 'lifecycle_stage' | 'owner' | 'role' | 'created_at' | 'created_time' | 'updated_at' | 'unsubscribed' | 'meeting_scheduled_at'

interface ColumnConfig {
  key: ColumnKey
  label: string
  alwaysVisible?: boolean
  defaultVisible: boolean
  sortable?: boolean
  sortField?: SortField
  hideOnMobile?: boolean
  hideOnTablet?: boolean
}

const COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Name', alwaysVisible: true, defaultVisible: true, sortable: true, sortField: 'name' },
  { key: 'company', label: 'Company', defaultVisible: true, sortable: true, sortField: 'company', hideOnMobile: true },
  { key: 'type', label: 'Type', defaultVisible: true, hideOnMobile: true },
  { key: 'email', label: 'Email', defaultVisible: true, sortable: true, sortField: 'email', hideOnMobile: true, hideOnTablet: true },
  { key: 'phone', label: 'Phone', defaultVisible: true, sortable: true, sortField: 'phone', hideOnMobile: true, hideOnTablet: true },
  { key: 'lead_source', label: 'Lead Source', defaultVisible: true, sortable: true, sortField: 'lead_source', hideOnMobile: true, hideOnTablet: true },
  { key: 'lead_score', label: 'Lead Score', defaultVisible: true, sortable: true, sortField: 'lead_score', hideOnMobile: true, hideOnTablet: true },
  { key: 'lifecycle_stage', label: 'Lifecycle Stage', defaultVisible: true, sortable: true, sortField: 'lifecycle_stage', hideOnMobile: true, hideOnTablet: true },
  { key: 'owner', label: 'Owner', defaultVisible: true, sortable: true, sortField: 'owner', hideOnMobile: true, hideOnTablet: true },
  { key: 'role', label: 'Role', defaultVisible: false, sortable: true, sortField: 'role', hideOnMobile: true, hideOnTablet: true },
  { key: 'created_at', label: 'Created Date', defaultVisible: true, sortable: true, sortField: 'created_at', hideOnMobile: true, hideOnTablet: true },
  { key: 'created_time', label: 'Created Time', defaultVisible: false, hideOnMobile: true, hideOnTablet: true },
  { key: 'updated_at', label: 'Updated At', defaultVisible: false, sortable: true, sortField: 'updated_at', hideOnMobile: true, hideOnTablet: true },
  { key: 'meeting_scheduled_at', label: 'Meeting', defaultVisible: true, hideOnMobile: true, hideOnTablet: false },
  { key: 'unsubscribed', label: 'Unsubscribed', defaultVisible: false, hideOnMobile: true, hideOnTablet: true },
]

const STORAGE_KEY = 'contacts-visible-columns'
const SORT_STORAGE_KEY = 'contacts-sort'

function getDefaultVisibleColumns(): Set<ColumnKey> {
  return new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key))
}

function loadVisibleColumns(): Set<ColumnKey> {
  if (typeof window === 'undefined') return getDefaultVisibleColumns()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as ColumnKey[]
      // Always include 'name' as it's required
      const set = new Set(parsed)
      set.add('name')
      return set
    }
  } catch {
    // Ignore errors
  }
  return getDefaultVisibleColumns()
}

function saveVisibleColumns(columns: Set<ColumnKey>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(columns)))
  } catch {
    // Ignore errors
  }
}

function formatDate(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatTime(dateString?: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

type LeadScoreFilter = '' | 'hot' | 'medium' | 'cold' | 'unscored'

interface Filters {
  leadSource: LeadSource | ''
  leadScore: LeadScoreFilter
  lifecycleStage: LifecycleStage | ''
  clientType: ClientType | ''
  owner: string
  dateFrom: string
  dateTo: string
  unsubscribed: UnsubscribedFilter
}

const defaultFilters: Filters = {
  leadSource: '',
  leadScore: '',
  lifecycleStage: '',
  clientType: '',
  owner: '',
  dateFrom: '',
  dateTo: '',
  unsubscribed: 'all',
}

interface ContactsTableProps {
  initialContacts: ContactWithCompany[]
  companies: Pick<Company, 'id' | 'name' | 'type'>[]
  users: User[]
}

function getEffectiveClientType(contact: ContactWithCompany): ClientType | null {
  return contact.company_type ?? contact.client_type ?? null
}

const CONTACTS_PER_PAGE = 100

export function ContactsTable({ initialContacts, companies, users }: ContactsTableProps) {
  const router = useRouter()
  const [contacts, setContacts] = useState(initialContacts)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>(() => {
    if (typeof window === 'undefined') return 'created_at'
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.field) return parsed.field as SortField
      }
    } catch {}
    return 'created_at'
  })
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    if (typeof window === 'undefined') return 'desc'
    try {
      const stored = localStorage.getItem(SORT_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.direction) return parsed.direction as SortDirection
      }
    } catch {}
    return 'desc'
  })
  const [slideOverOpen, setSlideOverOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactWithCompany | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(getDefaultVisibleColumns)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [scoringAll, setScoringAll] = useState(false)
  const [scoreAllToast, setScoreAllToast] = useState<string | null>(null)
  const [scoringContactId, setScoringContactId] = useState<string | null>(null)
  const columnPickerRef = useRef<HTMLDivElement>(null)

  // Load visible columns from localStorage on mount
  useEffect(() => {
    setVisibleColumns(loadVisibleColumns())
  }, [])

  // Save visible columns when they change
  useEffect(() => {
    saveVisibleColumns(visibleColumns)
  }, [visibleColumns])

  // Close column picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnPickerRef.current && !columnPickerRef.current.contains(event.target as Node)) {
        setShowColumnPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, filters, sortField, sortDirection])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.leadSource) count++
    if (filters.leadScore) count++
    if (filters.lifecycleStage) count++
    if (filters.clientType) count++
    if (filters.owner) count++
    if (filters.dateFrom) count++
    if (filters.dateTo) count++
    if (filters.unsubscribed !== 'all') count++
    return count
  }, [filters])

  const filteredAndSortedContacts = useMemo(() => {
    let result = [...contacts]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((contact) => {
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase()
        const email = contact.email?.toLowerCase() ?? ''
        const company = contact.company_name?.toLowerCase() ?? ''
        return (
          fullName.includes(searchLower) ||
          email.includes(searchLower) ||
          company.includes(searchLower)
        )
      })
    }

    // Lead source filter
    if (filters.leadSource) {
      result = result.filter((contact) => contact.lead_source === filters.leadSource)
    }

    // Lead score filter
    if (filters.leadScore) {
      if (filters.leadScore === 'unscored') {
        result = result.filter((contact) => !contact.lead_score)
      } else {
        result = result.filter((contact) => contact.lead_score === filters.leadScore)
      }
    }

    // Lifecycle stage filter
    if (filters.lifecycleStage) {
      result = result.filter((contact) => contact.lifecycle_stage === filters.lifecycleStage)
    }

    // Client type filter
    if (filters.clientType) {
      result = result.filter((contact) => {
        const effectiveType = getEffectiveClientType(contact)
        return effectiveType === filters.clientType
      })
    }

    // Owner filter
    if (filters.owner) {
      if (filters.owner === 'unassigned') {
        result = result.filter((contact) => !contact.owner_id)
      } else {
        result = result.filter((contact) => contact.owner_id === filters.owner)
      }
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      result = result.filter((contact) => {
        if (!contact.created_at) return false
        return new Date(contact.created_at) >= fromDate
      })
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter((contact) => {
        if (!contact.created_at) return false
        return new Date(contact.created_at) <= toDate
      })
    }

    // Unsubscribed filter
    if (filters.unsubscribed === 'subscribed') {
      result = result.filter((contact) => !contact.unsubscribed)
    } else if (filters.unsubscribed === 'unsubscribed') {
      result = result.filter((contact) => contact.unsubscribed)
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | null = ''
      let bVal: string | null = ''

      switch (sortField) {
        case 'name':
          aVal = `${a.first_name} ${a.last_name}`
          bVal = `${b.first_name} ${b.last_name}`
          break
        case 'company':
          aVal = a.company_name
          bVal = b.company_name
          break
        case 'email':
          aVal = a.email
          bVal = b.email
          break
        case 'phone':
          aVal = a.phone
          bVal = b.phone
          break
        case 'lead_source':
          aVal = a.lead_source
          bVal = b.lead_source
          break
        case 'lead_score':
          aVal = a.lead_score
          bVal = b.lead_score
          break
        case 'lifecycle_stage':
          aVal = a.lifecycle_stage
          bVal = b.lifecycle_stage
          break
        case 'owner':
          aVal = a.owner_name
          bVal = b.owner_name
          break
        case 'role':
          aVal = a.role
          bVal = b.role
          break
        case 'created_at':
          aVal = a.created_at ?? ''
          bVal = b.created_at ?? ''
          break
        case 'updated_at':
          aVal = a.updated_at ?? ''
          bVal = b.updated_at ?? ''
          break
      }

      aVal = aVal ?? ''
      bVal = bVal ?? ''

      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal)
      }
      return bVal.localeCompare(aVal)
    })

    return result
  }, [contacts, search, filters, sortField, sortDirection])

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedContacts.length / CONTACTS_PER_PAGE)
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * CONTACTS_PER_PAGE
    return filteredAndSortedContacts.slice(startIndex, startIndex + CONTACTS_PER_PAGE)
  }, [filteredAndSortedContacts, currentPage])

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection = 'asc'
    if (sortField === field) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(newDirection)
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    // Save to localStorage
    localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({
      field: sortField === field ? field : field,
      direction: sortField === field ? newDirection : 'asc'
    }))
  }

  const handleRowClick = (contact: ContactWithCompany) => {
    router.push(`/contacts/${contact.id}`)
  }

  const handleAddNew = () => {
    setEditingContact(null)
    setSlideOverOpen(true)
  }

  const handleSave = (savedContact: ContactWithCompany) => {
    if (editingContact) {
      setContacts((prev) =>
        prev.map((c) => (c.id === savedContact.id ? savedContact : c))
      )
    } else {
      setContacts((prev) => [savedContact, ...prev])
    }
    setSlideOverOpen(false)
    setEditingContact(null)
  }

  const handleDelete = (contactId: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== contactId))
    setSlideOverOpen(false)
    setEditingContact(null)
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
  }

  const handleScoreAll = async () => {
    setScoringAll(true)
    setScoreAllToast(null)
    try {
      const response = await fetch('/api/contacts/score-all', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        if (data.scored > 0) {
          // Update local contacts with new scores
          const scoreMap = new Map(data.results.map((r: { id: string; score: string }) => [r.id, r.score]))
          setContacts((prev) =>
            prev.map((c) => {
              const newScore = scoreMap.get(c.id) as LeadScore | undefined
              if (newScore) {
                return { ...c, lead_score: newScore }
              }
              return c
            })
          )
          setScoreAllToast(`Scored ${data.scored} contact${data.scored === 1 ? '' : 's'}`)
        } else {
          setScoreAllToast('All contacts already scored')
        }
        setTimeout(() => setScoreAllToast(null), 3000)
      }
    } catch {
      setScoreAllToast('Failed to score contacts')
      setTimeout(() => setScoreAllToast(null), 5000)
    } finally {
      setScoringAll(false)
    }
  }

  const handleScoreContact = async (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation()
    setScoringContactId(contactId)
    try {
      const response = await fetch(`/api/contacts/${contactId}/score`, { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contactId ? { ...c, lead_score: data.score, lead_score_reason: data.reason } : c
          )
        )
      }
    } catch {
      // Silently fail
    } finally {
      setScoringContactId(null)
    }
  }

  const toggleColumn = (key: ColumnKey) => {
    const column = COLUMNS.find(c => c.key === key)
    if (column?.alwaysVisible) return

    setVisibleColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">↕</span>
    }
    return (
      <span className="text-gray-600 ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const isColumnVisible = (key: ColumnKey) => visibleColumns.has(key)

  const getColumnClasses = (column: ColumnConfig) => {
    const classes = ['px-4 py-3']
    if (column.hideOnMobile) classes.push('hidden sm:table-cell')
    if (column.hideOnTablet) classes.push('hidden md:table-cell')
    return classes.join(' ')
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6 pt-14 md:pt-0">
        <h1 className="text-2xl font-semibold text-gray-900">Contacts</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={handleScoreAll}
              disabled={scoringAll}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {scoringAll ? 'Scoring...' : 'Score All'}
            </button>
            {scoreAllToast && (
              <div className="absolute top-full right-0 mt-1 z-10 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-800 border border-green-200">
                {scoreAllToast}
              </div>
            )}
          </div>
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            Add Contact
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
        />
      </div>

      {/* Lead Score Quick Filter */}
      <div className="flex items-center gap-1 mb-4">
        {(['' , 'hot', 'medium', 'cold', 'unscored'] as const).map((value) => {
          const label = value === '' ? 'All' : value === 'unscored' ? 'Unscored' : LEAD_SCORE_LABELS[value]
          const isActive = filters.leadScore === value
          return (
            <button
              key={value || 'all'}
              onClick={() => setFilters({ ...filters, leadScore: value })}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Filter and Column Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Filters Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            showFilters || activeFilterCount > 0
              ? 'bg-brand-50 border-brand-200 text-brand-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-brand-600 text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear Filters Button */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
          >
            Clear All
          </button>
        )}

        {/* Column Picker */}
        <div className="relative ml-auto" ref={columnPickerRef}>
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showColumnPicker
                ? 'bg-gray-100 border-gray-300 text-gray-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Columns
          </button>

          {showColumnPicker && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              <div className="p-2">
                <p className="px-2 py-1 text-xs font-medium text-gray-500 uppercase">Toggle Columns</p>
                {COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer ${
                      column.alwaysVisible ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(column.key)}
                      onChange={() => toggleColumn(column.key)}
                      disabled={column.alwaysVisible}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-700">{column.label}</span>
                    {column.alwaysVisible && (
                      <span className="text-xs text-gray-400">(required)</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Lead Source */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lead Source</label>
              <select
                value={filters.leadSource}
                onChange={(e) => setFilters({ ...filters, leadSource: e.target.value as LeadSource | '' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">All Sources</option>
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {LEAD_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </div>

            {/* Lifecycle Stage */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lifecycle Stage</label>
              <select
                value={filters.lifecycleStage}
                onChange={(e) => setFilters({ ...filters, lifecycleStage: e.target.value as LifecycleStage | '' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">All Stages</option>
                {LIFECYCLE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {LIFECYCLE_STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={filters.clientType}
                onChange={(e) => setFilters({ ...filters, clientType: e.target.value as ClientType | '' })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">All Types</option>
                {CLIENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CLIENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
              <select
                value={filters.owner}
                onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">All Owners</option>
                <option value="unassigned">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Created From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Created To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              />
            </div>

            {/* Unsubscribed */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subscription</label>
              <select
                value={filters.unsubscribed}
                onChange={(e) => setFilters({ ...filters, unsubscribed: e.target.value as UnsubscribedFilter })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="all">All</option>
                <option value="subscribed">Subscribed Only</option>
                <option value="unsubscribed">Unsubscribed Only</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Name - always visible */}
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Name <SortIcon field="name" />
                </th>

                {/* Company */}
                {isColumnVisible('company') && (
                  <th
                    onClick={() => handleSort('company')}
                    className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Company <SortIcon field="company" />
                  </th>
                )}

                {/* Type */}
                {isColumnVisible('type') && (
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                )}

                {/* Email */}
                {isColumnVisible('email') && (
                  <th
                    onClick={() => handleSort('email')}
                    className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Email <SortIcon field="email" />
                  </th>
                )}

                {/* Phone */}
                {isColumnVisible('phone') && (
                  <th
                    onClick={() => handleSort('phone')}
                    className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Phone <SortIcon field="phone" />
                  </th>
                )}

                {/* Lead Source */}
                {isColumnVisible('lead_source') && (
                  <th
                    onClick={() => handleSort('lead_source')}
                    className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Lead Source <SortIcon field="lead_source" />
                  </th>
                )}

                {/* Lead Score */}
                {isColumnVisible('lead_score') && (
                  <th
                    onClick={() => handleSort('lead_score')}
                    className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Score <SortIcon field="lead_score" />
                  </th>
                )}

                {/* Lifecycle Stage */}
                {isColumnVisible('lifecycle_stage') && (
                  <th
                    onClick={() => handleSort('lifecycle_stage')}
                    className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Stage <SortIcon field="lifecycle_stage" />
                  </th>
                )}

                {/* Owner */}
                {isColumnVisible('owner') && (
                  <th
                    onClick={() => handleSort('owner')}
                    className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Owner <SortIcon field="owner" />
                  </th>
                )}

                {/* Role */}
                {isColumnVisible('role') && (
                  <th
                    onClick={() => handleSort('role')}
                    className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Role <SortIcon field="role" />
                  </th>
                )}

                {/* Created Date */}
                {isColumnVisible('created_at') && (
                  <th
                    onClick={() => handleSort('created_at')}
                    className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Created <SortIcon field="created_at" />
                  </th>
                )}

                {/* Created Time */}
                {isColumnVisible('created_time') && (
                  <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                )}

                {/* Updated At */}
                {isColumnVisible('updated_at') && (
                  <th
                    onClick={() => handleSort('updated_at')}
                    className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    Updated <SortIcon field="updated_at" />
                  </th>
                )}

                {/* Unsubscribed */}
                {isColumnVisible('unsubscribed') && (
                  <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unsubscribed
                  </th>
                )}

                {/* Meeting */}
                {isColumnVisible('meeting_scheduled_at') && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Meeting
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={20} className="px-4 py-8 text-center text-gray-500">
                    {contacts.length === 0
                      ? 'No contacts yet. Add your first contact to get started.'
                      : 'No contacts match your search criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => handleRowClick(contact)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    {/* Name - always visible */}
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 mr-3 flex-shrink-0">
                          {contact.first_name[0]}{contact.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {contact.first_name} {contact.last_name}
                          </p>
                          {contact.role && !isColumnVisible('role') && (
                            <p className="text-xs text-gray-500 truncate">{contact.role}</p>
                          )}
                          {/* Show company on mobile if company column hidden */}
                          <p className="text-xs text-gray-500 truncate sm:hidden">
                            {contact.company_name}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    {isColumnVisible('company') && (
                      <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-600">
                        {contact.company_name ?? '-'}
                      </td>
                    )}

                    {/* Type */}
                    {isColumnVisible('type') && (
                      <td className="hidden sm:table-cell px-4 py-3">
                        {(() => {
                          const clientType = getEffectiveClientType(contact)
                          if (!clientType) return <span className="text-sm text-gray-400">-</span>
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLIENT_TYPE_COLORS[clientType]}`}>
                              {CLIENT_TYPE_LABELS[clientType]}
                            </span>
                          )
                        })()}
                      </td>
                    )}

                    {/* Email */}
                    {isColumnVisible('email') && (
                      <td className="hidden md:table-cell px-4 py-3 text-sm text-gray-600">
                        {contact.email ?? '-'}
                      </td>
                    )}

                    {/* Phone */}
                    {isColumnVisible('phone') && (
                      <td className="hidden lg:table-cell px-4 py-3 text-sm text-gray-600">
                        {contact.phone ?? '-'}
                      </td>
                    )}

                    {/* Lead Source */}
                    {isColumnVisible('lead_source') && (
                      <td className="hidden lg:table-cell px-4 py-3">
                        {contact.lead_source ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {LEAD_SOURCE_LABELS[contact.lead_source]}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Lead Score */}
                    {isColumnVisible('lead_score') && (
                      <td className="hidden lg:table-cell px-4 py-3">
                        {contact.lead_score ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${LEAD_SCORE_STYLES[contact.lead_score as LeadScore]}`}
                            title={contact.lead_score_reason || undefined}
                          >
                            {LEAD_SCORE_LABELS[contact.lead_score as LeadScore]}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleScoreContact(e, contact.id)}
                            disabled={scoringContactId === contact.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
                          >
                            {scoringContactId === contact.id ? 'Scoring...' : 'Unscored'}
                          </button>
                        )}
                      </td>
                    )}

                    {/* Lifecycle Stage */}
                    {isColumnVisible('lifecycle_stage') && (
                      <td className="hidden xl:table-cell px-4 py-3">
                        {contact.lifecycle_stage ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${LIFECYCLE_STAGE_COLORS[contact.lifecycle_stage as LifecycleStage] || 'bg-gray-100 text-gray-800'}`}>
                            {LIFECYCLE_STAGE_LABELS[contact.lifecycle_stage as LifecycleStage] || contact.lifecycle_stage}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Owner */}
                    {isColumnVisible('owner') && (
                      <td className="hidden xl:table-cell px-4 py-3">
                        {contact.owner_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                              {contact.owner_name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="text-sm text-gray-700">{contact.owner_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    )}

                    {/* Role */}
                    {isColumnVisible('role') && (
                      <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-600">
                        {contact.role ?? '-'}
                      </td>
                    )}

                    {/* Created Date */}
                    {isColumnVisible('created_at') && (
                      <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-600">
                        {formatDateTime(contact.created_at)}
                      </td>
                    )}

                    {/* Created Time */}
                    {isColumnVisible('created_time') && (
                      <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-600">
                        {formatTime(contact.created_at)}
                      </td>
                    )}

                    {/* Updated At */}
                    {isColumnVisible('updated_at') && (
                      <td className="hidden xl:table-cell px-4 py-3 text-sm text-gray-600">
                        {formatDateTime(contact.updated_at)}
                      </td>
                    )}

                    {/* Unsubscribed */}
                    {isColumnVisible('unsubscribed') && (
                      <td className="hidden xl:table-cell px-4 py-3">
                        {contact.unsubscribed ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            No
                          </span>
                        )}
                      </td>
                    )}

                    {/* Meeting */}
                    {isColumnVisible('meeting_scheduled_at') && (
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {contact.meeting_scheduled_at
                          ? new Date(contact.meeting_scheduled_at).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              hour12: true, timeZone: 'America/Chicago'
                            }) + ' CDT'
                          : <span className="text-gray-400">—</span>}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          Showing {paginatedContacts.length > 0 ? ((currentPage - 1) * CONTACTS_PER_PAGE) + 1 : 0}–{Math.min(currentPage * CONTACTS_PER_PAGE, filteredAndSortedContacts.length)} of {filteredAndSortedContacts.length} contacts
          {filteredAndSortedContacts.length !== contacts.length && ` (filtered from ${contacts.length})`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {/* Show page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show first, last, current, and pages near current
                  if (page === 1 || page === totalPages) return true
                  if (Math.abs(page - currentPage) <= 1) return true
                  return false
                })
                .reduce((acc: (number | 'ellipsis')[], page, idx, arr) => {
                  // Add ellipsis where there are gaps
                  if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                    acc.push('ellipsis')
                  }
                  acc.push(page)
                  return acc
                }, [])
                .map((item, idx) => (
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                        currentPage === item
                          ? 'bg-brand-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item}
                    </button>
                  )
                ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        )}
      </div>

      <ContactSlideOver
        open={slideOverOpen}
        onClose={() => {
          setSlideOverOpen(false)
          setEditingContact(null)
        }}
        contact={editingContact}
        companies={companies}
        users={users}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  )
}
