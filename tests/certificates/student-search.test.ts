import { describe, expect, it } from 'vitest'
import { filterCertificateStudents } from '@/app/admin/certificates/new/student-search'

const students = [
  { id: '1', name: 'Mariam Adel', email: 'mariam@example.com', phone: '01012345678', student_code: 'RBC-1001' },
  { id: '2', name: 'Omar Hassan', email: 'omar@example.com', phone: '01198765432', student_code: 'RBC-1002' },
]

describe('certificate student search', () => {
  it('finds students by name, email, phone, or student code', () => {
    expect(filterCertificateStudents(students, 'mariam')).toEqual([students[0]])
    expect(filterCertificateStudents(students, 'omar@example')).toEqual([students[1]])
    expect(filterCertificateStudents(students, '010123')).toEqual([students[0]])
    expect(filterCertificateStudents(students, '1002')).toEqual([students[1]])
  })

  it('does not return results until the user enters a search term', () => {
    expect(filterCertificateStudents(students, '   ')).toEqual([])
  })
})
