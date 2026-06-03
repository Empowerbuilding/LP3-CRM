'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { NoteWithAuthor } from '@/lib/types'

const NOTE_MAX_HEIGHT = 80 // pixels - roughly 4 lines

interface NotesSectionProps {
  contactId?: string
  dealId?: string
  companyId?: string
  notes: NoteWithAuthor[]
  currentUserId?: string
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

interface NoteContentProps {
  note: NoteWithAuthor
  isExpanded: boolean
  onToggleExpand: () => void
  isOwner: boolean
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
}

function NoteContent({
  note,
  isExpanded,
  onToggleExpand,
  isOwner,
  isDeleting,
  onEdit,
  onDelete,
}: NoteContentProps) {
  const contentRef = useRef<HTMLParagraphElement>(null)
  const [needsExpand, setNeedsExpand] = useState(false)

  useEffect(() => {
    if (contentRef.current) {
      setNeedsExpand(contentRef.current.scrollHeight > NOTE_MAX_HEIGHT)
    }
  }, [note.content])

  return (
    <>
      <div className="relative">
        <p
          ref={contentRef}
          className={`text-sm text-gray-900 whitespace-pre-wrap overflow-hidden transition-all ${
            !isExpanded && needsExpand ? 'line-clamp-4' : ''
          }`}
          style={{
            maxHeight: !isExpanded && needsExpand ? `${NOTE_MAX_HEIGHT}px` : 'none',
          }}
        >
          {note.content}
        </p>
        {needsExpand && !isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
      </div>
      {needsExpand && (
        <button
          onClick={onToggleExpand}
          className="text-xs text-brand-600 hover:text-brand-800 font-medium mt-1"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400">
          {note.author?.name || 'Unknown'}
          {' · '}
          {formatRelativeTime(note.created_at)}
        </p>
        {isOwner && (
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Edit note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export function NotesSection({
  contactId,
  dealId,
  companyId,
  notes,
  currentUserId,
}: NotesSectionProps) {
  const supabase = createClient()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())

  const toggleExpanded = (noteId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setSaving(true)
    try {
      const { error } = await (supabase.from('notes') as any).insert({
        contact_id: contactId || null,
        deal_id: dealId || null,
        company_id: companyId || null,
        content: content.trim(),
        created_by: currentUserId || null,
      })

      if (error) throw error

      setContent('')
      setShowForm(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to create note:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (note: NoteWithAuthor) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return

    setSaving(true)
    try {
      const { error } = await (supabase.from('notes') as any)
        .update({ content: editContent.trim() })
        .eq('id', noteId)

      if (error) throw error

      setEditingId(null)
      setEditContent('')
      router.refresh()
    } catch (err) {
      console.error('Failed to update note:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    setDeletingId(noteId)
    try {
      const { error } = await (supabase.from('notes') as any)
        .delete()
        .eq('id', noteId)

      if (error) throw error

      router.refresh()
    } catch (err) {
      console.error('Failed to delete note:', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-gray-900">Notes</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <textarea
              placeholder="Write a note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setContent('')
                }}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No notes yet. Add one above.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isEditing = editingId === note.id
            // Show edit/delete for owner, or for anyone when no auth system is active
            const isOwner = !currentUserId || note.created_by === currentUserId
            const isDeleting = deletingId === note.id

            return (
              <div
                key={note.id}
                className={`p-3 rounded-lg border border-gray-200 ${isDeleting ? 'opacity-50' : ''}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm resize-none"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(note.id)}
                        disabled={saving || !editContent.trim()}
                        className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <NoteContent
                    note={note}
                    isExpanded={expandedNotes.has(note.id)}
                    onToggleExpand={() => toggleExpanded(note.id)}
                    isOwner={!!isOwner}
                    isDeleting={isDeleting}
                    onEdit={() => handleEdit(note)}
                    onDelete={() => handleDelete(note.id)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
