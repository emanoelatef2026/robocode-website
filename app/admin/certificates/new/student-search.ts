export interface CertificateStudentOption {
  id: string
  name: string
  email: string
  phone: string | null
  student_code: string | null
}

export function filterCertificateStudents(
  students: CertificateStudentOption[],
  query: string,
  limit = 20
): CertificateStudentOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return []

  return students
    .filter((student) => [student.name, student.email, student.phone, student.student_code]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)))
    .slice(0, limit)
}

export function certificateStudentLabel(student: CertificateStudentOption): string {
  return student.student_code ? `${student.name} (${student.student_code})` : student.name
}
