export interface SessionUser {
  id: string
  email: string
  createdAt: string
}

export interface LoginInput {
  email: string
  redirectTo?: string
}
