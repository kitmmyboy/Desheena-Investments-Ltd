import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = 'Admin' | 'Operations_Manager' | 'Driver' | 'Finance' | 'Customer'

export interface SystemUser {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface CreateUserInput {
  email: string
  password: string
  full_name?: string
  phone?: string
  role: UserRole
}

export interface UpdateUserInput {
  id: string
  email?: string
  full_name?: string
  phone?: string
  role?: UserRole
  password?: string
}

// ---------------------------------------------------------------------------
// Helper: call manage-users Edge Function
// ---------------------------------------------------------------------------

async function callManageUsers(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`
  const url = queryParams
    ? `${baseUrl}?${new URLSearchParams(queryParams).toString()}`
    : baseUrl

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }

  return res
}

// ---------------------------------------------------------------------------
// useUsers — list all users
// ---------------------------------------------------------------------------

export function useUsers() {
  return useQuery<SystemUser[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await callManageUsers('GET')
      const json = await res.json()
      return json.users as SystemUser[]
    },
  })
}

// ---------------------------------------------------------------------------
// useCreateUser
// ---------------------------------------------------------------------------

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const res = await callManageUsers('POST', input)
      const json = await res.json()
      return json.user as SystemUser
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useUpdateUser
// ---------------------------------------------------------------------------

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const res = await callManageUsers('PUT', input)
      const json = await res.json()
      return json.user as SystemUser
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// ---------------------------------------------------------------------------
// useDeleteUser
// ---------------------------------------------------------------------------

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await callManageUsers('DELETE', undefined, { id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
