export type LeadScore = 'hot' | 'medium' | 'cold'

export interface ScoreResult {
  score: LeadScore
  reason: string
}

/**
 * Deterministic lead scoring for roofing business.
 * Pure function: takes a contact's lead_source and initial note text,
 * returns { score, reason }.
 */
export function scoreContact(leadSource: string | null, noteText: string | null): ScoreResult {
  const source = (leadSource || '').toLowerCase()

  if (source === 'insurance_claim' || source === 'storm_lead' || source === 'insurance_adjuster') {
    return { score: 'hot', reason: 'Insurance/storm lead — high close rate' }
  }
  if (source === 'calendar_booking') {
    return { score: 'hot', reason: 'Booked inspection — high intent' }
  }
  if (source === 'repeat_customer') {
    return { score: 'hot', reason: 'Repeat customer' }
  }
  if (source === 'referral') {
    return { score: 'medium', reason: 'Referral lead' }
  }
  if (['website_estimate', 'facebook_ad', 'google_ads', 'door_knock'].includes(source)) {
    return { score: 'medium', reason: 'Inbound interest — needs qualification' }
  }
  return { score: 'cold', reason: 'Unqualified lead' }
}
