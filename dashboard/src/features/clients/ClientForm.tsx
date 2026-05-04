import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useCreateClient, useUpdateClient } from './useClients'
import type { ClientWithContractStatus, CreateClientInput } from './useClients'
import ContractPanel from './ContractPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FormValues {
  name: string
  phone: string
  email: string
  location_text: string
  gps_lat: string
  gps_lng: string
  service_frequency: string
  monthly_rate: string
  zone: string
}

interface FormErrors {
  name?: string
  phone?: string
  location_text?: string
  gps_lat?: string
  gps_lng?: string
  service_frequency?: string
  monthly_rate?: string
}

interface ClientFormProps {
  /** When provided, the form is in edit mode */
  client?: ClientWithContractStatus | null
  onClose: () => void
  onSuccess?: () => void
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {}

  if (!values.name.trim()) errors.name = 'Name is required'
  if (!values.phone.trim()) errors.phone = 'Phone is required'
  if (!values.location_text.trim()) errors.location_text = 'Location is required'

  if (!values.gps_lat.trim()) {
    errors.gps_lat = 'GPS latitude is required'
  } else if (isNaN(Number(values.gps_lat))) {
    errors.gps_lat = 'Must be a valid number'
  }

  if (!values.gps_lng.trim()) {
    errors.gps_lng = 'GPS longitude is required'
  } else if (isNaN(Number(values.gps_lng))) {
    errors.gps_lng = 'Must be a valid number'
  }

  if (!values.service_frequency.trim()) {
    errors.service_frequency = 'Service frequency is required'
  }

  if (!values.monthly_rate.trim()) {
    errors.monthly_rate = 'Monthly rate is required'
  } else {
    const rate = Number(values.monthly_rate)
    if (isNaN(rate) || rate <= 0) {
      errors.monthly_rate = 'Must be a positive number'
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Field component
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
// ClientForm
// ---------------------------------------------------------------------------

export default function ClientForm({ client, onClose, onSuccess }: ClientFormProps) {
  const { user } = useAuth()
  const isEdit = Boolean(client)

  const createClient = useCreateClient()
  const updateClient = useUpdateClient()

  const isPending = createClient.isPending || updateClient.isPending
  const mutationError = createClient.error || updateClient.error

  const [values, setValues] = useState<FormValues>({
    name: client?.name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    location_text: client?.location_text ?? '',
    gps_lat: client?.gps_lat != null ? String(client.gps_lat) : '',
    gps_lng: client?.gps_lng != null ? String(client.gps_lng) : '',
    service_frequency: client?.service_frequency ?? '',
    monthly_rate: client?.monthly_rate != null ? String(client.monthly_rate) : '',
    zone: client?.zone ?? '',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormValues, boolean>>>({})

  // Reset form when client prop changes
  useEffect(() => {
    setValues({
      name: client?.name ?? '',
      phone: client?.phone ?? '',
      email: client?.email ?? '',
      location_text: client?.location_text ?? '',
      gps_lat: client?.gps_lat != null ? String(client.gps_lat) : '',
      gps_lng: client?.gps_lng != null ? String(client.gps_lng) : '',
      service_frequency: client?.service_frequency ?? '',
      monthly_rate: client?.monthly_rate != null ? String(client.monthly_rate) : '',
      zone: client?.zone ?? '',
    })
    setErrors({})
    setTouched({})
  }, [client])

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (touched[field]) {
      const newErrors = validate({ ...values, [field]: value })
      setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof FormErrors] }))
    }
  }

  function handleBlur(field: keyof FormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const newErrors = validate(values)
    setErrors((prev) => ({ ...prev, [field]: newErrors[field as keyof FormErrors] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce(
      (acc, k) => ({ ...acc, [k]: true }),
      {} as Partial<Record<keyof FormValues, boolean>>
    )
    setTouched(allTouched)

    const validationErrors = validate(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) return

    const payload: CreateClientInput = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim() || undefined,
      location_text: values.location_text.trim(),
      gps_lat: Number(values.gps_lat),
      gps_lng: Number(values.gps_lng),
      service_frequency: values.service_frequency.trim(),
      monthly_rate: Number(values.monthly_rate),
      zone: values.zone.trim() || undefined,
    }

    try {
      if (isEdit && client) {
        await updateClient.mutateAsync({
          input: { ...payload, id: client.id },
          userId: user?.id ?? '',
        })
      } else {
        await createClient.mutateAsync(payload)
      }
      onSuccess?.()
      onClose()
    } catch {
      // Error is surfaced via mutationError
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {isEdit ? 'Edit client' : 'Add new client'}
      </h2>

      {/* Mutation error */}
      {mutationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {mutationError.message}
        </div>
      )}

      {/* Name */}
      <Field label="Name" required error={errors.name}>
        <input
          type="text"
          value={values.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          placeholder="e.g. Kampala Supermarket"
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-400' : 'border-gray-300'
          }`}
        />
      </Field>

      {/* Phone */}
      <Field label="Phone" required error={errors.phone}>
        <input
          type="tel"
          value={values.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          onBlur={() => handleBlur('phone')}
          placeholder="e.g. +256 700 000000"
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.phone ? 'border-red-400' : 'border-gray-300'
          }`}
        />
      </Field>

      {/* Email (optional) */}
      <Field label="Email">
        <input
          type="email"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="e.g. client@example.com (optional)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      {/* Location text */}
      <Field label="Location" required error={errors.location_text}>
        <input
          type="text"
          value={values.location_text}
          onChange={(e) => handleChange('location_text', e.target.value)}
          onBlur={() => handleBlur('location_text')}
          placeholder="e.g. Plot 12, Naalya Road, Kampala"
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.location_text ? 'border-red-400' : 'border-gray-300'
          }`}
        />
      </Field>

      {/* GPS coordinates */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="GPS Latitude" required error={errors.gps_lat}>
          <input
            type="number"
            step="any"
            value={values.gps_lat}
            onChange={(e) => handleChange('gps_lat', e.target.value)}
            onBlur={() => handleBlur('gps_lat')}
            placeholder="e.g. 0.3476"
            className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.gps_lat ? 'border-red-400' : 'border-gray-300'
            }`}
          />
        </Field>
        <Field label="GPS Longitude" required error={errors.gps_lng}>
          <input
            type="number"
            step="any"
            value={values.gps_lng}
            onChange={(e) => handleChange('gps_lng', e.target.value)}
            onBlur={() => handleBlur('gps_lng')}
            placeholder="e.g. 32.5825"
            className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.gps_lng ? 'border-red-400' : 'border-gray-300'
            }`}
          />
        </Field>
      </div>

      {/* Service frequency */}
      <Field label="Service frequency" required error={errors.service_frequency}>
        <input
          type="text"
          value={values.service_frequency}
          onChange={(e) => handleChange('service_frequency', e.target.value)}
          onBlur={() => handleBlur('service_frequency')}
          placeholder="e.g. twice per week, daily"
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.service_frequency ? 'border-red-400' : 'border-gray-300'
          }`}
        />
      </Field>

      {/* Monthly rate */}
      <Field label="Monthly rate (UGX)" required error={errors.monthly_rate}>
        <input
          type="number"
          min="1"
          step="1"
          value={values.monthly_rate}
          onChange={(e) => handleChange('monthly_rate', e.target.value)}
          onBlur={() => handleBlur('monthly_rate')}
          placeholder="e.g. 50000"
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.monthly_rate ? 'border-red-400' : 'border-gray-300'
          }`}
        />
      </Field>

      {/* Zone (optional) */}
      <Field label="Zone">
        <input
          type="text"
          value={values.zone}
          onChange={(e) => handleChange('zone', e.target.value)}
          placeholder="e.g. Naalya, Kito, Nsasa (optional)"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </Field>

      {/* Contract section — edit mode only */}
      {isEdit && client && (
        <ContractPanel clientId={client.id} />
      )}

      {/* Actions */}
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
            <svg
              className="animate-spin h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          )}
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Add client'}
        </button>
      </div>
    </form>
  )
}
