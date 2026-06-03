import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { contact_id, deal_id, company_id, content } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('notes')
      .insert({
        contact_id: contact_id || null,
        deal_id: deal_id || null,
        company_id: company_id || null,
        content: content.trim(),
        created_by: user.id,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, note: data })
  } catch (err: any) {
    console.error('[Notes API] Failed to create note:', err)
    return NextResponse.json({ error: err.message || 'Failed to create note' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, content } = body

    if (!id || !content?.trim()) {
      return NextResponse.json({ error: 'id and content are required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('notes')
      .update({ content: content.trim() })
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Notes API] Failed to update note:', err)
    return NextResponse.json({ error: err.message || 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Notes API] Failed to delete note:', err)
    return NextResponse.json({ error: err.message || 'Failed to delete note' }, { status: 500 })
  }
}
