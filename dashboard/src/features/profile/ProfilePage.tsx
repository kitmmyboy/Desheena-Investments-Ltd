import React, { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileData {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: string
  created_at: string
}

interface ProfileFormValues {
  full_name: string
  phone: string
}

interface PasswordFormValues {
  new_password: string
  confirm_password: string
}

// ---------------------------------------------------------------------------
// Fetch own profile from public.users
// ---------------------------------------------------------------------------

async function fetchProfile(userId: string): Promise<ProfileData> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, role, created_at')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)
  return data as ProfileData
}

// ---------------------------------------------------------------------------
// Call update-profile Edge Function
// ---------------------------------------------------------------------------

async function callUpdateProfile(payload: {
  full_name?: string
  phone?: string
  new_password?: string
}): Promise<ProfileData> {
  const { data, error } = await supabase.functions.invoke('update-profile', {
    method: 'PUT',
    body: payload,
  })
  if (error) throw new Error(error.message ?? 'Update failed')
  return data.user as ProfileData
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProfilePage
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
  })

  // Profile form
  const [profileValues, setProfileValues] = useState<ProfileFormValues>({
    full_name: '',
    phone: '',
  })
  const [profileSuccess, setProfileSuccess] = useState(false)

  useEffect(() => {
    if (profile) {
      setProfileValues({
        full_name: profile.full_name ?? '',
        phone: profile.phone ?? '',
      })
    }
  }, [profile])

  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      callUpdateProfile({
        full_name: values.full_name.trim() || undefined,
        phone: values.phone.trim() || undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile', user?.id], updated)
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    },
  })

  // Password form
  const [passwordValues, setPasswordValues] = useState<PasswordFormValues>({
    new_password: '',
    confirm_password: '',
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const updatePasswordMutation = useMutation({
    mutationFn: (newPassword: string) => callUpdateProfile({ new_password: newPassword }),
    onSuccess: () => {
      setPasswordValues({ new_password: '', confirm_password: '' })
      setPasswordSuccess(true)
      setTimeout(() => setPasswordSuccess(false), 3000)
    },
  })

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateProfileMutation.mutate(profileValues)
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')

    if (passwordValues.new_password.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (passwordValues.new_password !== passwordValues.confirm_password) {
      setPasswordError('Passwords do not match')
      return
    }

    updatePasswordMutation.mutate(passwordValues.new_password)
  }

  const ROLE_LABELS: Record<string, string> = {
    Admin: 'Admin',
    Operations_Manager: 'Operations Manager',
    Driver: 'Driver',
    Finance: 'Finance',
    Customer: 'Customer',
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading profile…
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">My Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your personal information and password</p>
      </div>

      {/* Account info card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-white text-xl font-bold select-none">
            {(profile?.full_name ?? profile?.email ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{profile?.full_name || profile?.email}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          Account created {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
        </div>
      </div>

      {/* Edit profile form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Personal information</h3>
        <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400">Email cannot be changed here. Contact an Admin.</p>
          </Field>

          <Field label="Full name">
            <input
              type="text"
              value={profileValues.full_name}
              onChange={(e) => setProfileValues((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Your full name"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={profileValues.phone}
              onChange={(e) => setProfileValues((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+256 700 000000"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          {updateProfileMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {updateProfileMutation.error.message}
            </div>
          )}
          {profileSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Profile updated successfully.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {updateProfileMutation.isPending && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {updateProfileMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Change password</h3>
        <p className="text-sm text-gray-500 mb-4">Choose a strong password of at least 8 characters.</p>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <Field label="New password" error={passwordError && passwordValues.new_password ? passwordError : undefined}>
            <input
              type="password"
              value={passwordValues.new_password}
              onChange={(e) => setPasswordValues((p) => ({ ...p, new_password: e.target.value }))}
              placeholder="Min. 8 characters"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          <Field label="Confirm new password" error={passwordError && passwordValues.confirm_password ? passwordError : undefined}>
            <input
              type="password"
              value={passwordValues.confirm_password}
              onChange={(e) => setPasswordValues((p) => ({ ...p, confirm_password: e.target.value }))}
              placeholder="Repeat new password"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </Field>

          {passwordError && !passwordValues.new_password && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{passwordError}</div>
          )}
          {updatePasswordMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {updatePasswordMutation.error.message}
            </div>
          )}
          {passwordSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
              Password changed successfully.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updatePasswordMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {updatePasswordMutation.isPending && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {updatePasswordMutation.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
