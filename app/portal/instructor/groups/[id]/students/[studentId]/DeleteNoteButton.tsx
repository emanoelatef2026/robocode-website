'use client'

import { deleteStudentNote } from '@/modules/instructor-portal/actions'
import { useRouter } from 'next/navigation'

interface Props {
  noteId:    string
  studentId: string
  groupId:   string
}

export default function DeleteNoteButton({ noteId, studentId, groupId }: Props) {
  const router = useRouter()

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return
    const fd = new FormData()
    fd.append('note_id',    noteId)
    fd.append('student_id', studentId)
    fd.append('group_id',   groupId)
    await deleteStudentNote(fd)
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-xs text-red-400 hover:text-red-600 transition"
    >
      Delete
    </button>
  )
}
