import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCreateUser, type CreateUserInput } from '../users/useUsers'

interface ClientPortalPanelProps {
  client: {
    id: string
    name: string
    email: string | null
    phone: string
  }
}

export default function ClientPortalPanel({ client }: ClientPortalPanelProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // We use the existing user creation logic but tailor it for customers
  const createUser = useCreateUser()

  async function handleCreatePortal() {
    if (!client.email) {
      setError('Client must have an email address to create a portal account.')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // 1. Create the Auth user via manage-users edge function
      // We generate a temporary password or let them reset it
      const tempPassword = 'Client' + Math.random().toString(36).slice(-8) + '!'
      
      const input: CreateUserInput = {
        email: client.email,
        password: tempPassword,
        full_name: client.name,
        phone: client.phone,
        role: 'Customer',
      }

      const newUser = await createUser.mutateAsync(input)

      // 2. Link the new user to the client record
      // The trigger handle_new_auth_user created the public.users record.
      // We now update it with the client_id.
      const { error: updateError } = await supabase
        .from('users')
        .update({ client_id: client.id })
        .eq('id', newUser.id)

      if (updateError) throw updateError

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to create portal account')
    } finally {
      setIsCreating(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
        <p className="text-sm text-green-800 font-medium">Portal account created successfully!</p>
        <p className="text-xs text-green-700 mt-1">
          The client can now sign in to the mobile app using their email.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Client Portal</h3>
      <p className="text-xs text-gray-500 mb-4">
        Create a dedicated account for this client to access the mobile portal for payments, 
        tracking collections, and contacting drivers.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleCreatePortal}
        disabled={isCreating || !client.email}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
      >
        {isCreating ? 'Creating...' : 'Create Portal Account'}
      </button>
      {!client.email && (
        <p className="text-[10px] text-orange-600 mt-1.5">
          Email is required to enable the portal.
        </p>
      )}
    </div>
  )
}
