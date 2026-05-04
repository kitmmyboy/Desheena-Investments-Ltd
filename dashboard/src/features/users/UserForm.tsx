import React, { useEffect, useState } from 'react'
import { useCreateUser, useUpdateUser } from './useUsers'
import type { SystemUser, UserRole, CreateUserInput, UpdateUserInput } from './useUsers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormValues {
  email: string
  full_name: string
  phone: string
  role: UserRole
  password: string
  confirmPassword: string
}

interface FormErrors {
  email?: string
  full_name?: string
  role?: string
  password?: string
  confirmPassword?: string
}

interface UserFormProps {
  user?: SystemUser | null
  onClose: () => void
}

const ROLES: UserRole[] = ['Admin', 'Operations_Manager', 'Driver', 'Finance', 'Customer']

const ROLE_LABELS: Record<UserRole, string> = {
  Admin: 'Admin',
  Operations_Manager: 'Operations Manager',
  Driver: 'Driver',
  Finance: 'Finance',
  Customer: 'Customer',
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(values: FormValues, isEdit: boolean): FormErrors {
  const errors: FormErrors = {}

  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address'
  }

  if (!values.role) errors.role = 'Role is required'

  if (!isEdit) {
    if (!values.password) {
      errors.password = 'Password is required'
    } else if (values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }
    if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
  } else if (values.password) {
    if (values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }
    if (values.password !== values.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserForm
// ---------------------------------------------------------------------------

export default function UserForm({ user, onClose }: UserFormProps) {
  const isEdit = Boolean(user)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const isPending = createUser.isPending || updateUser.isPending
  const mutationError = createUser.error || updateUser.error

  const [values, setValues] = useState<FormValues>({
    email: user?.email ?? '',
    full_name: user?.full_name ?? '',
    phone: user?.phone ?? '',
    role: user?.role ?? 'Driver',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({})

  useEffect(() => {
    setValues({
      email: user?.email ?? '',
      full_name: user?.full_name ?? '',
      phone: user?.phone ?? '',
      role: user?.role ?? 'Driver',
      password: '',
      confirmPassword: '',
    })
    setErrors({})
    setTouched({})
  }, [user])

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (touched[field]) {
      const newErrors = validate({ ...values, [field]: value }, isEdit)
      setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof FormErrors] }))
    }
  }

  function handleBlur(field: keyof FormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors(validate(values, isEdit))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const allTouched = Object.keys(values).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {} as Partial<Record<keyof FormValues, boolean>>
    )
    setTouched(allTouched)
    const validationErrors = validate(values, isEdit)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    try {
      if (isEdit && user) {
        const input: UpdateUserInput = {
          id: user.id,
          email: values.email.trim(),
          full_name: values.full_name.trim() || undefined,
          phone: values.phone.trim() || undefined,
          role: values.role,
        }
        if (values.password) input.password = values.password
        await updateUser.mutateAsync(input)
      } else {
        const input: CreateUserInput = {
          email: values.email.trim(),
          password: values.password,
          full_name: values.full_name.trim() || undefined,
          phone: values.phone.trim() || undefined,
          role: values.role,
        }
        await createUser.mutateAsync(input)
      }
      onClose()
    } catch {
      // surfaced via mutationError
    }
  }

  const inputClass = (field: keyof FormErrors) =>
    `border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[field] ? 'border-red-400' : 'border-gray-300'
    }`

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {isEdit ? 'Edit user' : 'Add new user'}
      </h2>

      {mutationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {mutationError.message}
        </div>
      )}

      <Field label="Email" required error={errors.email}>
        <input
          type="email"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="user@example.com"
          className={inputClass('email')}
          disabled={isEdit}
        />
        {isEdit && (
          <p className="text-xs text-gray-400">Email cannot be changed after account creation.</p>
        )}
      </Field>

      <Field label="Full name" error={errors.full_name}>
        <input
          type="text"
          value={values.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          onBlur={() => handleBlur('full_name')}
          placeholder="e.g. John Doe"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Phone">
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="e.g. +256 700 000000"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      <Field label="Role" required error={errors.role}>
        <select
          value={values.role}
          onChange={(e) => handleChange('role', e.target.value as UserRole)}
          onBlur={() => handleBlur('role')}
          className={inputClass('role')}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-3">
          {isEdit ? 'Leave password blank to keep the current password.' : 'Set a temporary password for this user.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label={isEdit ? 'New password' : 'Password'} required={!isEdit} error={errors.password}>
            <input
              type="password"
              value={values.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              placeholder="Min. 8 characters"
              className={inputClass('password')}
            />
          </Field>
          <Field label="Confirm password" required={!isEdit && !!values.password} error={errors.confirmPassword}>
            <input
              type="password"
              value={values.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              placeholder="Repeat password"
              className={inputClass('confirmPassword')}
            />
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onClose}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          {isPending && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
        </button>
      </div>
    </form>
  )
}
