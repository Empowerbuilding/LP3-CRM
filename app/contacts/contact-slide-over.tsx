'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { LeadSource, Company, ClientType, LifecycleStage, User } from '@/lib/types'
import { LIFECYCLE_STAGE_LABELS } from '@/lib/types'
import type { ContactWithCompany } from './page'

interface DuplicateContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
}

const LEAD_SOURCES: LeadSource[] = [
  'website_estimate',
  'phone_call',
  'referral',
  'facebook_ad',
  'phone_call',
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
}

const CLIENT_TYPES: ClientType[] = [
  'consumer',
  'builder',
  'subcontractor',
  'engineer',
  'architect',
  'realtor',
]

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  builder: 'Builder',
  consumer: 'Consumer',
  subcontractor: 'Subcontractor',
  engineer: 'Engineer',
  architect: 'Architect',
  realtor: 'Realtor',
}

const LIFECYCLE_STAGES: LifecycleStage[] = [
  'subscriber',
  'lead',
  'mql',
  'sql',
  'customer',
]

interface ContactSlideOverProps {
  open: boolean
  onClose: () => void
  contact: ContactWithCompany | null
  companies: Pick<Company, 'id' | 'name' | 'type'>[]
  users: User[]
  onSave: (contact: ContactWithCompany) => void
  onDelete: (contactId: string) => void
}

interface FormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  company_id: string
  owner_id: string
  lead_source: LeadSource | ''
  client_type: ClientType | ''
  lifecycle_stage: LifecycleStage | ''
  is_primary: boolean
}

export function ContactSlideOver({
  open,
  onClose,
  contact,
  companies,
  users,
  onSave,
  onDelete,
}: ContactSlideOverProps) {
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    company_id: '',
    owner_id: '',
    lead_source: '',
    client_type: '',
    lifecycle_stage: '',
    is_primary: false,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailDuplicate, setEmailDuplicate] = useState<DuplicateContact | null>(null)
  const [phoneDuplicate, setPhoneDuplicate] = useState<DuplicateContact | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [checkingPhone, setCheckingPhone] = useState(false)

  // Normalize phone number for comparison (remove non-digits)
  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '')
  }

  // Check for duplicate email
  const checkEmailDuplicate = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setEmailDuplicate(null)
      return
    }

    setCheckingEmail(true)
    try {
      const { data } = await (supabase.from('contacts') as any)
        .select('id, first_name, last_name, email, phone')
        .ilike('email', email.trim())
        .limit(1)

      if (data && data.length > 0) {
        // Exclude current contact if editing
        const duplicate = data.find((c: DuplicateContact) => c.id !== contact?.id)
        setEmailDuplicate(duplicate || null)
      } else {
        setEmailDuplicate(null)
      }
    } catch (err) {
      console.error('Error checking email duplicate:', err)
    } finally {
      setCheckingEmail(false)
    }
  }, [contact?.id])

  // Check for duplicate phone
  const checkPhoneDuplicate = useCallback(async (phone: string) => {
    const normalized = normalizePhone(phone)
    if (!normalized || normalized.length < 7) {
      setPhoneDuplicate(null)
      return
    }

    setCheckingPhone(true)
    try {
      // Get contacts and filter by normalized phone
      const { data } = await (supabase.from('contacts') as any)
        .select('id, first_name, last_name, email, phone')
        .not('phone', 'is', null)

      if (data && data.length > 0) {
        // Find duplicate by comparing normalized phone numbers
        const duplicate = data.find((c: DuplicateContact) => {
          if (c.id === contact?.id) return false
          if (!c.phone) return false
          return normalizePhone(c.phone) === normalized
        })
        setPhoneDuplicate(duplicate || null)
      } else {
        setPhoneDuplicate(null)
      }
    } catch (err) {
      console.error('Error checking phone duplicate:', err)
    } finally {
      setCheckingPhone(false)
    }
  }, [contact?.id])

  // Get the selected company's type (if any)
  const selectedCompany = formData.company_id
    ? companies.find((c) => c.id === formData.company_id)
    : null

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email ?? '',
        phone: contact.phone ?? '',
        role: contact.role ?? '',
        company_id: contact.company_id ?? '',
        owner_id: contact.owner_id ?? '',
        lead_source: contact.lead_source ?? '',
        client_type: contact.client_type ?? '',
        lifecycle_stage: contact.lifecycle_stage ?? '',
        is_primary: contact.is_primary,
      })
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: '',
        company_id: '',
        owner_id: '',
        lead_source: '',
        client_type: '',
        lifecycle_stage: 'subscriber',
        is_primary: false,
      })
    }
    setError(null)
    setEmailDuplicate(null)
    setPhoneDuplicate(null)
  }, [contact, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // If linked to a company, use company's type; otherwise use the selected client_type
      const effectiveClientType = formData.company_id
        ? selectedCompany?.type ?? null
        : formData.client_type || null

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email || null,
        phone: formData.phone || null,
        role: formData.role || null,
        company_id: formData.company_id || null,
        owner_id: formData.owner_id || null,
        lead_source: formData.lead_source || null,
        client_type: effectiveClientType,
        lifecycle_stage: formData.lifecycle_stage || 'subscriber',
        is_primary: formData.is_primary,
      }

      if (contact) {
        // Update existing contact via Supabase
        const { error: updateError } = await (supabase.from('contacts') as any)
          .update(payload)
          .eq('id', contact.id)

        if (updateError) throw updateError

        onSave({
          ...contact,
          ...payload,
          company_name: selectedCompany?.name ?? null,
          company_type: selectedCompany?.type ?? null,
        } as ContactWithCompany)
      } else {
        // Create new contact via API (to trigger Facebook events)
        const response = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create contact')
        }

        onSave({
          ...result.contact,
          company_name: selectedCompany?.name ?? null,
          company_type: selectedCompany?.type ?? null,
        } as ContactWithCompany)
      }
    } catch (err) {
      console.error('Failed to save contact:', err)
      setError('Failed to save contact. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    if (!confirm('Are you sure you want to delete this contact?')) return

    setDeleting(true)
    try {
      const { error: deleteError } = await (supabase.from('contacts') as any)
        .delete()
        .eq('id', contact.id)

      if (deleteError) throw deleteError

      onDelete(contact.id)
    } catch (err) {
      console.error('Failed to delete contact:', err)
      setError('Failed to delete contact. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company
              </label>
              <select
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">No company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Show Client Type dropdown only for standalone contacts (no company) */}
            {!formData.company_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Type
                </label>
                <select
                  value={formData.client_type}
                  onChange={(e) => setFormData({ ...formData, client_type: e.target.value as ClientType | '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
                >
                  <option value="">Select type</option>
                  {CLIENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CLIENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Project Manager, Owner"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value })
                    setEmailDuplicate(null)
                  }}
                  onBlur={(e) => checkEmailDuplicate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none ${
                    emailDuplicate ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                />
                {checkingEmail && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
              </div>
              {emailDuplicate && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Duplicate found:</span>{' '}
                    <Link
                      href={`/contacts/${emailDuplicate.id}`}
                      target="_blank"
                      className="text-amber-900 underline hover:no-underline"
                    >
                      {emailDuplicate.first_name} {emailDuplicate.last_name}
                    </Link>
                    {' '}already has this email
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value })
                    setPhoneDuplicate(null)
                  }}
                  onBlur={(e) => checkPhoneDuplicate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none ${
                    phoneDuplicate ? 'border-amber-400 bg-amber-50' : 'border-gray-300'
                  }`}
                />
                {checkingPhone && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                )}
              </div>
              {phoneDuplicate && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Duplicate found:</span>{' '}
                    <Link
                      href={`/contacts/${phoneDuplicate.id}`}
                      target="_blank"
                      className="text-amber-900 underline hover:no-underline"
                    >
                      {phoneDuplicate.first_name} {phoneDuplicate.last_name}
                    </Link>
                    {' '}already has this phone
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Source
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as LeadSource | '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">Select source</option>
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {LEAD_SOURCE_LABELS[source]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <select
                value={formData.owner_id}
                onChange={(e) => setFormData({ ...formData, owner_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lifecycle Stage
              </label>
              <select
                value={formData.lifecycle_stage}
                onChange={(e) => setFormData({ ...formData, lifecycle_stage: e.target.value as LifecycleStage | '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-white"
              >
                {LIFECYCLE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {LIFECYCLE_STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={formData.is_primary}
                onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500"
              />
              <label htmlFor="is_primary" className="text-sm text-gray-700">
                Primary contact for company
              </label>
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          {contact ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : contact ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
