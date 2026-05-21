'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Contact, LeadSource } from '@/lib/types'

const LEAD_SOURCE_LABELS: Record<string, string> = {
  website_estimate: 'Website Estimate',
  google_ads: 'Google Ads',
  referral: 'Referral',
  facebook_ad: 'Facebook Ad',
  phone_call: 'Direct Phone Call',
  email: 'Direct Email',
  storm_lead: 'Storm Lead',
  other: 'Other',
}

interface CreateDealModalProps {
  contact: Contact
  isOpen: boolean
  onClose: () => void
}

export function CreateDealModal({ contact, isOpen, onClose }: CreateDealModalProps) {
  const router = useRouter()
  const [value, setValue] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdDeal, setCreatedDeal] = useState<{ id: string; title: string } | null>(null)

  const sourceLabel = contact.lead_source
    ? LEAD_SOURCE_LABELS[contact.lead_source] || contact.lead_source
    : 'Lead'
  const dealTitle = `${contact.first_name} ${contact.last_name} - ${sourceLabel}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreating(true)

    try {
      // Create the deal
      const { data: newDeal, error: dealError } = await (supabase
        .from('deals') as any)
        .insert({
          contact_id: contact.id,
          company_id: contact.company_id,
          title: dealTitle,
          value: value ? parseFloat(value) : null,
          stage: 'new_lead',
        })
        .select('id, title')
        .single()

      if (dealError) throw dealError

      // Log deal_created activity
      await (supabase.from('activities') as any).insert({
        contact_id: contact.id,
        deal_id: newDeal.id,
        activity_type: 'deal_created',
        title: `Deal created: ${dealTitle}`,
        metadata: {
          value: value ? parseFloat(value) : null,
        },
      })

      setCreatedDeal(newDeal)
      router.refresh()
    } catch (err) {
      console.error('Failed to create deal:', err)
      setError('Failed to create deal. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setCreatedDeal(null)
    setValue('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {createdDeal ? 'Deal Created' : 'Add to Pipeline'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {createdDeal ? (
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Deal Created Successfully</h3>
                <p className="text-sm text-gray-600 mb-6">{createdDeal.title}</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Close
                  </button>
                  <Link
                    href={`/deals/${createdDeal.id}`}
                    className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    View Deal
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    {error}
                  </div>
                )}

                {/* Deal Title Preview */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Deal Title</p>
                  <p className="text-sm font-medium text-gray-900">{dealTitle}</p>
                </div>

                {/* Deal Value */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deal Value <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">You can set or update this later</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {creating ? 'Creating...' : 'Create Deal'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
