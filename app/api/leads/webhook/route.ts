import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { LeadSource, LifecycleStage } from '@/lib/types'
import { sendFacebookEvent } from '@/lib/facebook-conversions'
import { scoreContact } from '@/lib/lead-scoring'

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface LeadWebhookPayload {
  first_name: string
  last_name: string
  email: string
  phone?: string
  source: LeadSource
  fbclid?: string
  fb_lead_id?: string  // Facebook Lead Ads lead ID for CAPI attribution
  fbp?: string  // Facebook browser pixel ID for CAPI match quality
  client_ip_address?: string  // Client IP for CAPI (if passed from frontend)
  client_user_agent?: string  // Client UA for CAPI (if passed from frontend)
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  metadata?: Record<string, unknown>
  anonymous_id?: string  // For linking anonymous page views to the new contact
}

// Determine lifecycle stage based on lead source
function getLifecycleStageForSource(source: LeadSource): LifecycleStage {
  // All sources start as subscribers
  // They become 'lead' when they book a meeting or take a more engaged action
  return 'subscriber'
}

// Determine client type based on lead source
// These sources are typically consumer/homeowner leads
function getClientTypeForSource(source: LeadSource): 'consumer' | null {
  const consumerSources: LeadSource[] = [
    'website_estimate',
    'phone_call',
    'referral',
    'facebook_ad',
  ]
  return consumerSources.includes(source) ? 'consumer' : null
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString()

  // Verify API key
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    console.log(`[${timestamp}] Webhook rejected: Invalid API key`)
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Capture IP and User Agent from request headers
  const clientIpFromHeader = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null
  const clientUserAgentFromHeader = request.headers.get('user-agent') || null

  try {
    const payload: LeadWebhookPayload = await request.json()

    // Use IP/UA from payload if provided, otherwise use headers
    const clientIpAddress = payload.client_ip_address || clientIpFromHeader
    const clientUserAgent = payload.client_user_agent || clientUserAgentFromHeader

    // Log incoming request
    console.log(`[${timestamp}] Lead webhook received:`, {
      name: `${payload.first_name} ${payload.last_name}`,
      email: payload.email,
      source: payload.source,
      fbclid: payload.fbclid ? 'present' : 'none',
      metadata: payload.metadata ? Object.keys(payload.metadata) : 'none'
    })

    // Validate required fields
    if (!payload.first_name || !payload.last_name || !payload.email || !payload.source) {
      console.log(`[${timestamp}] Webhook rejected: Missing required fields`)
      return NextResponse.json(
        { success: false, error: 'Missing required fields: first_name, last_name, email, source' },
        { status: 400 }
      )
    }

    // Format metadata into contact notes
    const contactNotes = formatContactNotes(payload.source, payload.metadata, payload.email, payload.phone)

    // Check if contact already exists by email
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', payload.email)
      .single()

    let contactId: string

    if (existingContact) {
      // Update existing contact with Facebook data and tracking fields if provided
      contactId = existingContact.id
      const updateData: Record<string, string> = {}
      if (payload.fbclid) updateData.fbclid = payload.fbclid
      if (payload.fb_lead_id) updateData.fb_lead_id = payload.fb_lead_id
      if (payload.fbp) updateData.fbp = payload.fbp
      if (clientIpAddress) updateData.client_ip_address = clientIpAddress
      if (clientUserAgent) updateData.client_user_agent = clientUserAgent
      if (payload.anonymous_id) updateData.anonymous_id = payload.anonymous_id

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contactId)
      }
      console.log(`[${timestamp}] Using existing contact: ${contactId}`)
    } else {
      // Determine client_type based on source
      const clientType = getClientTypeForSource(payload.source)

      // Determine lifecycle stage based on source
      const lifecycleStage = getLifecycleStageForSource(payload.source)

      console.log(`[${timestamp}] Creating ${lifecycleStage} contact:`, {
        email: payload.email,
        source: payload.source,
        fbclid: !!payload.fbclid,
      })

      // Create new contact with lifecycle_stage and empty fb_events_sent
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
          phone: payload.phone || null,
          lead_source: payload.source,
          client_type: clientType,
          lifecycle_stage: lifecycleStage,
          fb_events_sent: {},  // Initialize as empty - no FB events sent for subscribers
          fbclid: payload.fbclid || null,
          fb_lead_id: payload.fb_lead_id || null,
          fbp: payload.fbp || null,
          client_ip_address: clientIpAddress || null,
          client_user_agent: clientUserAgent || null,
          anonymous_id: payload.anonymous_id || null,
          notes: contactNotes || null,
          is_primary: true,
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        console.error(`[${timestamp}] Failed to create contact:`, contactError)
        return NextResponse.json(
          { success: false, error: 'Failed to create contact' },
          { status: 500 }
        )
      }

      contactId = newContact.id
      console.log(`[${timestamp}] Created new ${lifecycleStage} contact: ${contactId}`)

      // Also create in the notes table for the Notes Section
      if (contactNotes) {
        const { error: noteError } = await supabase.from('notes').insert({
          contact_id: contactId,
          content: contactNotes,
        })
        if (noteError) {
          console.error(`[${timestamp}] Failed to create note:`, noteError)
          // Don't fail the webhook, contact was created successfully
        }
      }

      // Auto-score the new contact
      try {
        const { score, reason } = scoreContact(payload.source, contactNotes)
        await supabase
          .from('contacts')
          .update({
            lead_score: score,
            lead_score_reason: reason,
            lead_score_updated_at: new Date().toISOString(),
          })
          .eq('id', contactId)
        console.log(`[${timestamp}] Lead scored: ${score} (${reason})`)
      } catch (scoreError) {
        console.error(`[${timestamp}] Lead scoring error (non-fatal):`, scoreError)
      }

      // Log contact_created activity
      await supabase.from('activities').insert({
        contact_id: contactId,
        activity_type: 'contact_created',
        title: `Contact created: ${payload.first_name} ${payload.last_name}`,
        metadata: {
          source: payload.source,
          email: payload.email,
          phone: payload.phone || null,
        },
        anonymous_id: payload.anonymous_id || null,
      })

      // Fire initial_lead Facebook event for new contacts (only if CAPI is configured)
      if (process.env.FACEBOOK_PIXEL_ID && process.env.FACEBOOK_CONVERSIONS_API_TOKEN) {
      try {
        console.log(`[${timestamp}] Sending initial_lead event to Facebook for new contact: ${contactId}`)

        const fbResult = await sendFacebookEvent({
          eventName: 'initial_lead',
          eventId: `${contactId}-subscriber`,
          userData: {
            email: payload.email,
            phone: payload.phone || null,
            firstName: payload.first_name,
            lastName: payload.last_name,
            fbclid: payload.fbclid || null,
            fbp: payload.fbp || null,
            leadId: payload.fb_lead_id || null,
            clientIpAddress: clientIpAddress || null,
            clientUserAgent: clientUserAgent || null,
            externalId: contactId,
          },
          eventSourceUrl: 'https://moderndwellings.com',
          customData: {
            leadEventSource: payload.source,
          },
        })

        console.log(`[${timestamp}] Facebook initial_lead event result:`, fbResult)

        if (fbResult.success) {
          // Update fb_events_sent to prevent duplicate from lifecycle cascade
          await supabase
            .from('contacts')
            .update({
              fb_events_sent: { subscriber: new Date().toISOString() },
            })
            .eq('id', contactId)

          console.log(`[${timestamp}] Updated fb_events_sent for contact: ${contactId}`)
        }
      } catch (fbError) {
        console.error(`[${timestamp}] Facebook initial_lead event error (non-fatal):`, fbError)
        // Don't fail the webhook if FB event fails
      }
      } // end CAPI guard
    }

    // Link any anonymous activities to this contact
    if (payload.anonymous_id) {
      const { data: linkedActivities } = await supabase
        .from('activities')
        .update({ contact_id: contactId })
        .eq('anonymous_id', payload.anonymous_id)
        .is('contact_id', null)
        .select('id')

      const linkedCount = linkedActivities?.length || 0
      if (linkedCount > 0) {
        console.log(`[${timestamp}] Linked ${linkedCount} anonymous activities to contact: ${contactId}`)
      }
    }

    // Log form_submit activity with UTM parameters
    await supabase.from('activities').insert({
      contact_id: contactId,
      activity_type: 'form_submit',
      title: `Submitted ${formatSource(payload.source)} form`,
      metadata: {
        source: payload.source,
        form_data: payload.metadata || null,
        utm_source: payload.utm_source || null,
        utm_medium: payload.utm_medium || null,
        utm_campaign: payload.utm_campaign || null,
        utm_content: payload.utm_content || null,
        utm_term: payload.utm_term || null,
        fbclid: payload.fbclid || null,
      },
      anonymous_id: payload.anonymous_id || null,
    })

    return NextResponse.json({
      success: true,
      contact_id: contactId,
    })

  } catch (error) {
    console.error(`[${timestamp}] Webhook error:`, error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Format metadata into nicely structured notes for contact
function formatContactNotes(source: LeadSource, metadata?: Record<string, unknown>, email?: string, phone?: string): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    const lines = [`Source: ${formatSource(source)}`]
    if (email) lines.push(`Email: ${email}`)
    if (phone) lines.push(`Phone: ${phone}`)
    return lines.join('\n')
  }

  const lines: string[] = []

  // Add source
  lines.push(`Source: ${formatSource(source)}`)
  if (email) lines.push(`Email: ${email}`)
  if (phone) lines.push(`Phone: ${phone}`)

  // Handle cost calculator specific fields
  if (source === 'website_estimate') {
    // Build project summary line
    const projectParts: string[] = []
    if (metadata.bedrooms) projectParts.push(`${metadata.bedrooms}BR`)
    if (metadata.bathrooms) projectParts.push(`${metadata.bathrooms}BA`)
    if (metadata.living_sqft || metadata.living_space) projectParts.push(`${Number(metadata.living_sqft || metadata.living_space).toLocaleString()} sq ft`)
    if (projectParts.length > 0) {
      lines.push(`Project: ${projectParts.join(' • ')}`)
    }

    if (metadata.location) lines.push(`Location: ${metadata.location}`)
    if (metadata.foundation) lines.push(`Foundation: ${metadata.foundation}`)
    if (metadata.roof_pitch) lines.push(`Roof Pitch: ${metadata.roof_pitch}`)
    if (metadata.interior_finish) lines.push(`Interior Finish: ${metadata.interior_finish}`)
    if (metadata.garage_spaces || metadata.garage_bays) lines.push(`Garage Spaces: ${metadata.garage_spaces || metadata.garage_bays}`)
    if (metadata.patio_sqft || metadata.patio_space) lines.push(`Patio: ${Number(metadata.patio_sqft || metadata.patio_space).toLocaleString()} sq ft`)
    if (metadata.sustainability_score) lines.push(`Sustainability Score: ${metadata.sustainability_score}/10`)

    // Estimated build costs by tier
    const hasCosts = metadata.economy_owner_cost || metadata.economy_contractor_cost
      || metadata.standard_owner_cost || metadata.standard_contractor_cost
      || metadata.premium_owner_cost || metadata.premium_contractor_cost
    if (hasCosts) {
      lines.push('')
      lines.push('--- Estimated Build Costs ---')
      if (metadata.economy_owner_cost) lines.push(`Economy (Owner-Build): ${formatCurrency(Number(metadata.economy_owner_cost))}`)
      if (metadata.economy_contractor_cost) lines.push(`Economy (w/ Contractor): ${formatCurrency(Number(metadata.economy_contractor_cost))}`)
      if (metadata.standard_owner_cost) lines.push(`Standard (Owner-Build): ${formatCurrency(Number(metadata.standard_owner_cost))}`)
      if (metadata.standard_contractor_cost) lines.push(`Standard (w/ Contractor): ${formatCurrency(Number(metadata.standard_contractor_cost))}`)
      if (metadata.premium_owner_cost) lines.push(`Premium (Owner-Build): ${formatCurrency(Number(metadata.premium_owner_cost))}`)
      if (metadata.premium_contractor_cost) lines.push(`Premium (w/ Contractor): ${formatCurrency(Number(metadata.premium_contractor_cost))}`)
    }
  } else {
    // For other sources, include any provided metadata
    const skipKeys = ['message', 'notes', 'comments']

    for (const [key, value] of Object.entries(metadata)) {
      if (skipKeys.includes(key.toLowerCase())) continue
      if (value === null || value === undefined || value === '') continue

      const formattedKey = formatKey(key)
      const formattedValue = typeof value === 'number' && key.toLowerCase().includes('price')
        ? formatCurrency(value)
        : String(value)

      lines.push(`${formattedKey}: ${formattedValue}`)
    }
  }

  // Add message/notes at the end if present
  const message = metadata.message || metadata.notes || metadata.comments
  if (message) {
    lines.push(``)
    lines.push(`Message: ${message}`)
  }

  return lines.join('\n')
}

// Helper to format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Helper to format metadata keys for display
function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

// Helper to format source for deal title and notes
function formatSource(source: string): string {
  const sourceMap: Record<string, string> = {
    website_estimate: 'Website Estimate',
    google_ads: 'Google Ads',
    referral: 'Referral',
    facebook_ad: 'Facebook Ad',
    phone_call: 'Direct Phone Call',
    email: 'Direct Email',
    other: 'Other',
  }
  return sourceMap[source] || source
}
