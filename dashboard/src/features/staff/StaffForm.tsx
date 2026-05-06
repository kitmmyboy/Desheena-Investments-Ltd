import { useState } from "react"
import { useCreateStaff, useUpdateStaff } from "./useStaff"
import type { StaffMember, StaffRole, EmploymentType, StaffStatus, CreateStaffInput } from "./useStaff"
import { supabase } from "../../lib/supabase"

interface StaffFormProps {
  staff: StaffMember | null
  onClose: () => void
}

export default function StaffForm({ staff, onClose }: StaffFormProps) {
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const isEdit = !!staff

  const [fullName, setFullName] = useState(staff?.full_name ?? "")
  const [phone, setPhone] = useState(staff?.phone ?? "")
  const [email, setEmail] = useState(staff?.email ?? "")
  const [password, setPassword] = useState("")
  const [nationalId, setNationalId] = useState(staff?.national_id ?? "")
  const [role, setRole] = useState<StaffRole>(staff?.role ?? "Driver")
  const [employmentType, setEmploymentType] = useState<EmploymentType>(staff?.employment_type ?? "full-time")
  const [status, setStatus] = useState<StaffStatus>(staff?.status ?? "active")
  const [zone, setZone] = useState(staff?.zone ?? "")
  const [hireDate, setHireDate] = useState(staff?.hire_date ?? "")
  const [licenseNumber, setLicenseNumber] = useState(staff?.driver_details?.license_number ?? "")
  const [licenseExpiry, setLicenseExpiry] = useState(staff?.driver_details?.license_expiry ?? "")
  const [assignedTruck, setAssignedTruck] = useState(staff?.driver_details?.assigned_truck ?? "")
  const [deviceId, setDeviceId] = useState(staff?.driver_details?.device_id ?? "")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!fullName.trim()) errs.full_name = "Full name is required"
    if (!role) errs.role = "Role is required"
    if (!isEdit && role === "Driver") {
      if (!email.trim()) errs.email = "Email is required for driver app login"
      if (!password || password.length < 8) errs.password = "Password must be at least 8 characters"
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setCreateError(null)
    setCreating(true)
    try {
      let linkedUserId = staff?.user_id ?? undefined
      if (!isEdit && role === "Driver" && email && password) {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error("Not authenticated")
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({ email: email.trim(), password, full_name: fullName.trim(), phone: phone || undefined, role: "Driver" }),
          }
        )
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? "Failed to create user account")
        linkedUserId = json.user?.id
      }
      const input: CreateStaffInput = {
        full_name: fullName.trim(),
        phone: phone || undefined,
        email: email || undefined,
        national_id: nationalId || undefined,
        role,
        employment_type: employmentType,
        status,
        zone: zone || undefined,
        hire_date: hireDate || undefined,
        user_id: linkedUserId,
      }
      if (role === "Driver") {
        input.driver_details = {
          license_number: licenseNumber || undefined,
          license_expiry: licenseExpiry || undefined,
          assigned_truck: assignedTruck || undefined,
          device_id: deviceId || undefined,
        }
      }
      if (isEdit) { await updateStaff.mutateAsync({ id: staff.id, ...input }) }
      else { await createStaff.mutateAsync(input) }
      onClose()
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to save staff member")
    } finally {
      setCreating(false)
    }
  }

  const isPending = creating || createStaff.isPending || updateStaff.isPending
  const mutationError = createError || (createStaff.error as Error | null)?.message || (updateStaff.error as Error | null)?.message
  const baseInput = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  const errorInput = "w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">{isEdit ? "Edit Staff Member" : "Add Staff Member"}</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 focus:outline-none" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
        </button>
      </div>

      {mutationError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{mutationError}</div>}

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personal Information</h4>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Full Name <span className="text-red-500">*</span></label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={errors.full_name ? errorInput : baseInput} placeholder="John Doe" />
          {errors.full_name && <p className="text-xs text-red-600 mt-0.5">{errors.full_name}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={baseInput} placeholder="+256 700 000000" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email {!isEdit && role === "Driver" && <span className="text-red-500">*</span>}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? errorInput : baseInput} placeholder="driver@example.com" />
            {errors.email && <p className="text-xs text-red-600 mt-0.5">{errors.email}</p>}
          </div>
        </div>
        {!isEdit && role === "Driver" && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">App Password <span className="text-red-500">*</span></label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={errors.password ? errorInput : baseInput} placeholder="Min. 8 characters" autoComplete="new-password" />
            {errors.password && <p className="text-xs text-red-600 mt-0.5">{errors.password}</p>}
            <p className="text-xs text-gray-500 mt-0.5">A Supabase auth account will be created so the driver can log into the mobile app.</p>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">National ID</label>
          <input type="text" value={nationalId} onChange={(e) => setNationalId(e.target.value)} className={baseInput} placeholder="CM12345678ABCD" />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Job Information</h4>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Role <span className="text-red-500">*</span></label>
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={errors.role ? errorInput : baseInput}>
            <option value="Driver">Driver</option>
            <option value="Admin">Admin</option>
            <option value="Finance">Finance</option>
            <option value="Operations_Manager">Operations Manager</option>
            <option value="Support">Support</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Employment Type</label>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)} className={baseInput}>
              <option value="full-time">Full-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as StaffStatus)} className={baseInput}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Zone</label>
            <input type="text" value={zone} onChange={(e) => setZone(e.target.value)} className={baseInput} placeholder="e.g. Naalya" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Hire Date</label>
            <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={baseInput} />
          </div>
        </div>
      </div>

      {role === "Driver" && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Driver Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">License Number</label>
              <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={baseInput} placeholder="DL123456" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">License Expiry</label>
              <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className={baseInput} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Assigned Truck</label>
              <input type="text" value={assignedTruck} onChange={(e) => setAssignedTruck(e.target.value)} className={baseInput} placeholder="UAA 123B" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Device ID</label>
              <input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className={baseInput} placeholder="device-uuid" />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose} disabled={isPending} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">Cancel</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isPending && <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>}
          {isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Staff Member"}
        </button>
      </div>
    </form>
  )
}