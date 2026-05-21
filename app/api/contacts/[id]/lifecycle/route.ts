import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendFacebookEvent, type FacebookEventName } from '@/lib/facebook-conversions'
import type { LifecycleStage, ClientType } from '@/lib/types'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Lifecycle stages in funnel order (lowest to highest)
const LIFECYCLE_FUNNEL_ORDER: LifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'customer']

const VALID_STAGES: LifecycleStage[] = LIFECYCLE_FUNNEL_ORDER

// Map lifecycle stages to Facebook event names
const STAGE_TO_FB_EVENT: Record<LifecycleStage, FacebookEventName> = {
  subscriber: 'initial_lead',
  lead: 'lead',
  mql: 'marketingqualifiedlead',
  sql: 'salesqualifiedlead',
  customer: 'customer',
}

// Get all stages up to and including the target stage (in funnel order)
function getStagesUpTo(targetStage: LifecycleStage): LifecycleStage[] {
  const targetIndex = LIFECYCLE_FUNNEL_ORDER.indexOf(targetStage)
  if (targetIndex === -1) return []
  return LIFECYCLE_FUNNEL_ORDER.slice(0, targetIndex + 1)
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  fbclid: string | null
  fb_lead_id: string | null
  fbp: string | null
  client_ip_address: string | null
  client_user_agent: string | null
  lifecycle_stage: LifecycleStage | null
  fb_events_sent: Record<string, string> | null
  client_type: ClientType | null
  company_id: string | null
  lead_source: string | null
}

const LEAD_SOURCE_LABELS: Record<string, string> = {
  website_estimate: 'Website Estimate',
  google_ads: 'Google Ads',
  referral: 'Referral',
  facebook_ad: 'Facebook Ad',
  phone_call: 'Direct Phone Call',
  email: 'Direct Email',
  other: 'Other',
}

// Create a deal for the contact when they become MQL
async function createDealForMQL(contact: ContactRow): Promise<{ id: string; title: string } | null> {
  const timestamp = new Date().toISOString()

  // Check if contact already has a deal
  const { data: existingDeals } = await supabaseAdmin
    .from('deals')
    .select('id')
    .eq('contact_id', contact.id)
    .limit(1)

  if (existingDeals && existingDeals.length > 0) {
    console.log(`[${timestamp}] Contact ${contact.id} already has a deal, skipping auto-creation`)
    return null
  }

  const sourceLabel = contact.lead_source
    ? LEAD_SOURCE_LABELS[contact.lead_source] || contact.lead_source
    : 'Lead'
  const dealTitle = `${contact.first_name} ${contact.last_name} - ${sourceLabel}`

  console.log(`[${timestamp}] Auto-creating deal for MQL contact ${contact.id}: ${dealTitle}`)

  const { data: newDeal, error: dealError } = await supabaseAdmin
    .from('deals')
    .insert({
      contact_id: contact.id,
      company_id: contact.company_id,
      title: dealTitle,
      stage: 'new_lead',
    })
    .select('id, title')
    .single()

  if (dealError) {
    console.error(`[${timestamp}] Failed to auto-create deal:`, dealError)
    return null
  }

  // Log deal_created activity
  await supabaseAdmin.from('activities').insert({
    contact_id: contact.id,
    deal_id: newDeal.id,
    activity_type: 'deal_created',
    title: `Deal auto-created: ${dealTitle}`,
    description: 'Deal automatically created when contact became Marketing Qualified',
    metadata: {
      auto_created: true,
      trigger: 'mql_lifecycle_stage',
    },
  })

  console.log(`[${timestamp}] Deal ${newDeal.id} created successfully for contact ${contact.id}`)
  return newDeal
}

interface UpdateLifecycleRequest {
  lifecycle_stage: LifecycleStage
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timestamp = new Date().toISOString()

  try {
    // 1. Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body: UpdateLifecycleRequest = await request.json()
    const { lifecycle_stage } = body

    if (!lifecycle_stage || !VALID_STAGES.includes(lifecycle_stage)) {
      return NextResponse.json(
        { error: `Invalid lifecycle_stage. Must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      )
    }

    const contactId = params.id

    // 3. Get current contact from database
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, phone, fbclid, fb_lead_id, fbp, client_ip_address, client_user_agent, lifecycle_stage, fb_events_sent, client_type, company_id, lead_source')
      .eq('id', contactId)
      .single<ContactRow>()

    if (contactError || !contact) {
      console.error(`[${timestamp}] Contact not found:`, contactError)
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    console.log(`[${timestamp}] Updating lifecycle for contact ${contactId}: ${contact.lifecycle_stage} → ${lifecycle_stage}`)

    // 4. Prepare updates
    const updates: Record<string, unknown> = {
      lifecycle_stage,
    }

    // 5. Cascade Facebook events - fire all events up to the target stage that haven't been sent
    const stagesToFire = getStagesUpTo(lifecycle_stage)
    const fbEventsSent = contact.fb_events_sent || {}
    const eventsSentThisRequest: { stage: LifecycleStage; eventName: FacebookEventName }[] = []
    const updatedFbEventsSent = { ...fbEventsSent }

    console.log(`[${timestamp}] Cascading FB events for contact ${contactId}:`, {
      targetStage: lifecycle_stage,
      stagesToCheck: stagesToFire,
      alreadySent: Object.keys(fbEventsSent),
    })

    // Loop through stages in order and fire any missing events
    for (const stage of stagesToFire) {
      const fbEventName = STAGE_TO_FB_EVENT[stage]
      const eventAlreadySent = !!fbEventsSent[stage]

      if (eventAlreadySent) {
        console.log(`[${timestamp}] ${fbEventName} (${stage}) already sent, skipping`)
        continue
      }

      console.log(`[${timestamp}] Sending ${fbEventName} event (${stage}) to Facebook for contact:`, contactId)

      try {
        const fbResult = await sendFacebookEvent({
          eventName: fbEventName,
          eventId: `${contact.id}-${stage}`,
          userData: {
            email: contact.email,
            phone: contact.phone,
            firstName: contact.first_name,
            lastName: contact.last_name,
            fbclid: contact.fbclid,
            fbp: contact.fbp,
            leadId: contact.fb_lead_id,
            clientIpAddress: contact.client_ip_address,
            clientUserAgent: contact.client_user_agent,
            externalId: contact.id,
          },
          eventSourceUrl: 'https://moderndwellings.com',
          customData: {
            leadEventSource: 'crm_lifecycle_update',
          },
        })

        console.log(`[${timestamp}] Facebook ${fbEventName} (${stage}) event result:`, fbResult)

        if (fbResult.success) {
          eventsSentThisRequest.push({ stage, eventName: fbEventName })
          updatedFbEventsSent[stage] = new Date().toISOString()
        }
      } catch (fbError) {
        console.error(`[${timestamp}] Facebook ${fbEventName} event error (non-fatal):`, fbError)
        // Continue with other events even if one fails
      }
    }

    // Update fb_events_sent if any events were fired
    if (eventsSentThisRequest.length > 0) {
      updates.fb_events_sent = updatedFbEventsSent
    }

    console.log(`[${timestamp}] FB events sent this request:`, eventsSentThisRequest.map(e => e.eventName))

    // 6. Update the contact in database
    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updates)
      .eq('id', contactId)

    if (updateError) {
      console.error(`[${timestamp}] Failed to update contact:`, updateError)
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Contact ${contactId} updated successfully`)

    // 7. Log lifecycle stage change activity
    const previousStage = contact.lifecycle_stage
    if (previousStage !== lifecycle_stage) {
      await supabaseAdmin.from('activities').insert({
        contact_id: contactId,
        activity_type: 'lifecycle_stage_changed',
        title: `Lifecycle: ${previousStage || 'none'} → ${lifecycle_stage}`,
        metadata: {
          from_stage: previousStage,
          to_stage: lifecycle_stage,
        },
      })
    }

    // 8. Auto-create deal if moving to MQL
    let createdDeal: { id: string; title: string } | null = null
    if (lifecycle_stage === 'mql') {
      createdDeal = await createDealForMQL(contact)
    }

    // 9. Return success response with info about all events sent
    const eventNames = eventsSentThisRequest.map(e => e.eventName)
    const eventCount = eventsSentThisRequest.length

    let message = 'Status updated'
    if (eventCount > 0) {
      message = `Status updated & sent ${eventCount} event${eventCount > 1 ? 's' : ''} to Facebook (${eventNames.join(', ')})`
    }
    if (createdDeal) {
      message += ` | Deal created: ${createdDeal.title}`
    }

    return NextResponse.json({
      success: true,
      lifecycle_stage,
      fb_events_sent_count: eventCount,
      fb_events_sent: eventNames,
      fb_events_details: eventsSentThisRequest,
      deal_created: createdDeal,
      message,
    })
  } catch (error) {
    console.error(`[${timestamp}] Lifecycle update error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
