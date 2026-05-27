import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { sendFacebookEvent, type FacebookEventName } from '@/lib/facebook-conversions'
import type { LifecycleStage, LeadSource, ClientType } from '@/lib/types'

// Service role client for bypassing RLS
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Lifecycle stages in funnel order (lowest to highest)
const LIFECYCLE_FUNNEL_ORDER: LifecycleStage[] = ['subscriber', 'lead', 'mql', 'sql', 'customer']

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

interface CreateContactRequest {
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  role?: string | null
  company_id?: string | null
  lead_source?: LeadSource | null
  client_type?: ClientType | null
  lifecycle_stage?: LifecycleStage | null
  is_primary?: boolean
}

export async function POST(request: NextRequest) {
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

    // 2. Parse request body
    const body: CreateContactRequest = await request.json()

    // 3. Validate required fields
    if (!body.first_name || !body.last_name) {
      return NextResponse.json(
        { error: 'Missing required fields: first_name, last_name' },
        { status: 400 }
      )
    }

    const lifecycleStage = body.lifecycle_stage || 'subscriber'

    console.log(`[${timestamp}] Creating contact: ${body.first_name} ${body.last_name} with lifecycle_stage: ${lifecycleStage}`)

    // 4. Create the contact
    const { data: contact, error: insertError } = await supabaseAdmin
      .from('contacts')
      .insert({
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email || null,
        phone: body.phone || null,
        role: body.role || null,
        company_id: body.company_id || null,
        lead_source: body.lead_source || null,
        client_type: body.client_type || null,
        lifecycle_stage: lifecycleStage,
        is_primary: body.is_primary ?? false,
        fb_events_sent: {}, // Initialize as empty
      })
      .select('*')
      .single()

    if (insertError || !contact) {
      console.error(`[${timestamp}] Failed to create contact:`, insertError)
      return NextResponse.json(
        { error: 'Failed to create contact' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] Created contact: ${contact.id}`)

    // 5. Fire cascading Facebook events for the lifecycle stage
    const stagesToFire = getStagesUpTo(lifecycleStage)
    const eventsSentThisRequest: { stage: LifecycleStage; eventName: FacebookEventName }[] = []
    const fbEventsSent: Record<string, string> = {}

    console.log(`[${timestamp}] Firing FB events for new contact ${contact.id}:`, {
      lifecycleStage,
      stagesToFire,
    })

    for (const stage of stagesToFire) {
      const fbEventName = STAGE_TO_FB_EVENT[stage]

      console.log(`[${timestamp}] Sending ${fbEventName} event (${stage}) to Facebook for new contact:`, contact.id)

      try {
        const fbResult = await sendFacebookEvent({
          eventName: fbEventName,
          eventId: `${contact.id}-${stage}`,
          userData: {
            email: contact.email,
            phone: contact.phone,
            firstName: contact.first_name,
            lastName: contact.last_name,
            externalId: contact.id,
          },
          eventSourceUrl: 'https://lp3rc.com',
          customData: {
            leadEventSource: 'crm_manual_creation',
          },
        })

        console.log(`[${timestamp}] Facebook ${fbEventName} (${stage}) event result:`, fbResult)

        if (fbResult.success) {
          eventsSentThisRequest.push({ stage, eventName: fbEventName })
          fbEventsSent[stage] = new Date().toISOString()
        }
      } catch (fbError) {
        console.error(`[${timestamp}] Facebook ${fbEventName} event error (non-fatal):`, fbError)
        // Continue with other events even if one fails
      }
    }

    // 6. Update fb_events_sent if any events were fired
    if (eventsSentThisRequest.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('contacts')
        .update({ fb_events_sent: fbEventsSent })
        .eq('id', contact.id)

      if (updateError) {
        console.error(`[${timestamp}] Failed to update fb_events_sent:`, updateError)
      } else {
        console.log(`[${timestamp}] Updated fb_events_sent for contact ${contact.id}`)
      }
    }

    console.log(`[${timestamp}] FB events sent for new contact:`, eventsSentThisRequest.map(e => e.eventName))

    // 7. Return success response
    const eventNames = eventsSentThisRequest.map(e => e.eventName)
    const eventCount = eventsSentThisRequest.length

    return NextResponse.json({
      success: true,
      contact: {
        ...contact,
        fb_events_sent: fbEventsSent,
      },
      fb_events_sent_count: eventCount,
      fb_events_sent: eventNames,
      message: eventCount > 0
        ? `Contact created & sent ${eventCount} event${eventCount > 1 ? 's' : ''} to Facebook (${eventNames.join(', ')})`
        : 'Contact created',
    })
  } catch (error) {
    console.error(`[${timestamp}] Contact creation error:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/contacts - Read contacts via webhook API key (for agent access)
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  const validKey = process.env.WEBHOOK_API_KEY

  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const stage = searchParams.get('stage')
  const source = searchParams.get('source')
  const days = searchParams.get('days') // e.g. ?days=7 for last 7 days

  let query = supabaseAdmin
    .from('contacts')
    .select('id, first_name, last_name, email, phone, lead_source, lifecycle_stage, created_at, notes')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (stage) query = query.eq('lifecycle_stage', stage)
  if (source) query = query.eq('lead_source', source)
  if (days) {
    const since = new Date()
    since.setDate(since.getDate() - parseInt(days))
    query = query.gte('created_at', since.toISOString())
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ contacts: data, total: count, offset, limit })
}
