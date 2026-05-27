import type { CertificateType, CertificateStatus } from '@/types/enums'

export interface CertificateTemplate {
  id:                   string
  name:                 string
  certificate_type:     CertificateType
  description:          string | null
  background_color:     string
  accent_color:         string
  background_image_url: string | null
  logo_url:             string | null
  signatory_name:       string | null
  signatory_title:      string | null
  branch_id:            string | null
  is_active:            boolean
  created_by:           string | null
  created_at:           string
  updated_at:           string
}

export interface Certificate {
  id:               string
  certificate_code: string
  template_id:      string | null
  student_id:       string
  certificate_type: CertificateType
  title:            string
  description:      string | null
  recipient_name:   string
  semester_id:      string | null
  course_id:        string | null
  achievement_id:   string | null
  issued_at:        string
  valid_until:      string | null
  pdf_url:          string | null
  status:           CertificateStatus
  revoked_at:       string | null
  revoked_by:       string | null
  revoke_reason:    string | null
  branch_id:        string | null
  issued_by:        string | null
  created_at:       string
  updated_at:       string
}

export interface CertificateListItem {
  id:               string
  certificate_code: string
  certificate_type: CertificateType
  title:            string
  recipient_name:   string
  student_id:       string
  student_email:    string
  issued_at:        string
  status:           CertificateStatus
  semester_name:    string | null
  course_title:     string | null
  template_name:    string | null
  branch_name:      string | null
}

export interface CertificateDetail extends Certificate {
  // Joined fields
  template:         CertificateTemplate | null
  student_name:     string
  student_email:    string
  semester_name:    string | null
  course_title:     string | null
  achievement_title: string | null
}

export interface CertificateTemplateListItem {
  id:               string
  name:             string
  certificate_type: CertificateType
  description:      string | null
  is_active:        boolean
  branch_id:        string | null
  branch_name:      string | null
  created_at:       string
}

// Public verification response (no sensitive data)
export interface CertificateVerification {
  certificate_code: string
  title:            string
  recipient_name:   string
  certificate_type: CertificateType
  issued_at:        string
  valid_until:      string | null
  status:           CertificateStatus
  semester_name:    string | null
  course_title:     string | null
  issuer_name:      string | null  // signatory_name from template
}
