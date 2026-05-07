import React, { useState, useRef, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import * as XLSX from "xlsx"
import { supabase } from "../../lib/supabase"

// ---------------------------------------------------------------------------
// Template download
// ---------------------------------------------------------------------------

function downloadTemplate() {
  const wb = XLSX.utils.book_new()

  // ── Build month columns for 2023–2026 ──────────────────────────────────
  const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"]
  const YEARS = [2023, 2024, 2025, 2026]
  const paymentCols: string[] = []
  for (const y of YEARS) {
    for (const m of MONTHS) {
      paymentCols.push(`${y}_${m}`)
    }
  }

  // ── Fixed columns (zone removed) ───────────────────────────────────────
  const fixedHeaders = [
    "name",
    "phone",
    "email",
    "division_office",
    "location_text",
    "gps_lat",
    "gps_lng",
    "service_frequency",
    "registration_fee",
    "monthly_rate",
    "contract_start_date",
    "notes",
  ]
  const allHeaders = [...fixedHeaders, ...paymentCols]

  // ── Row 2: human-readable labels ────────────────────────────────────────
  const labelRow = [
    "Client Name (required)",
    "Phone Number",
    "Email Address",
    "Division / Office",
    "Location / Address",
    "GPS Latitude",
    "GPS Longitude",
    "Service Frequency",
    "Registration Fee (UGX)",
    "Monthly Rate (UGX)",
    "Contract Start Date (YYYY-MM-DD)",
    "Notes",
    ...paymentCols.map((c) => {
      const [y, m] = c.split("_")
      return `${m.charAt(0).toUpperCase() + m.slice(1)} ${y}`
    }),
  ]

  // ── Row 3: instructions ─────────────────────────────────────────────────
  const instrRow = [
    "Required. Full name of client. All other columns are optional.",
    "e.g. 0772466708 — must start with 0",
    "Optional",
    "e.g. DIVISION OFFICE, KITO, NSASA",
    "Street/area address",
    "Optional decimal e.g. 0.3476",
    "Optional decimal e.g. 32.5825",
    "Leave as: monthly",
    "One-time joining fee in UGX (0 if none)",
    "Monthly charge in UGX",
    "Format: 2023-01-01",
    "Any extra notes",
    ...paymentCols.map(() => "Amount paid (e.g. 30000), PAID, NIL, or leave blank"),
  ]

  // ── Example rows ────────────────────────────────────────────────────────
  const ex1: (string | number)[] = [
    "MULINDWA", "0772466708", "", "DIVISION OFFICE", "KITO",
    "", "", "monthly", 0, 30000, "2023-01-01", "",
    30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,
    30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,30000,
    30000,30000,30000,30000,30000,30000,"NIL","NIL","NIL","NIL","NIL","NIL",
    "","","","","","","","","","","","",
  ]

  const ex2: (string | number)[] = [
    "CAPTAIN NEWMAN ALEXANDRA", "0784921801", "captain@example.com", "DIVISION OFFICE", "KITO",
    "", "", "monthly", 50000, 20000, "2023-01-01", "Paid registration Jan 2023",
    20000,20000,20000,20000,20000,20000,20000,20000,20000,20000,20000,20000,
    20000,20000,20000,20000,20000,20000,20000,20000,20000,10000,"NIL","NIL",
    20000,20000,20000,20000,20000,"","","","","","","",
    "","","","","","","","","","","","",
  ]

  const ex3: (string | number)[] = [
    "GABRIEL ANISA", "0773663839", "", "DIVISION OFFICE", "KITO",
    "", "", "monthly", 0, 20000, "2023-01-01", "",
    "PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID",
    "PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID","PAID",
    "PAID","PAID","PAID","PAID","","","","","","","","",
    "","","","","","","","","","","","",
  ]

  // ── Build worksheet ─────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet([
    allHeaders,
    labelRow,
    instrRow,
    ex1,
    ex2,
    ex3,
  ])

  // ── Column widths (zone column removed) ────────────────────────────────
  const fixedWidths = [28, 18, 24, 20, 28, 12, 12, 16, 22, 18, 28, 24]
  const paymentWidths = paymentCols.map(() => 10)
  ws["!cols"] = [...fixedWidths, ...paymentWidths].map((w) => ({ wch: w }))
  ws["!freeze"] = { xSplit: 1, ySplit: 1, topLeftCell: "B2", activePane: "bottomRight" }

  XLSX.utils.book_append_sheet(wb, ws, "Clients")

  // ── Instructions sheet ──────────────────────────────────────────────────
  const instrData = [
    ["DESHEENA INVESTMENTS LTD — CLIENT IMPORT TEMPLATE"],
    [""],
    ["HOW TO USE THIS TEMPLATE"],
    [""],
    ["1. Fill in the 'Clients' sheet. Do NOT change the column headers in Row 1."],
    ["2. Row 2 (labels) and Row 3 (instructions) are for reference only — the system skips them."],
    ["3. Delete the 3 example rows (rows 4, 5, 6) before filling in your real data."],
    [""],
    ["REQUIRED COLUMNS"],
    ["name", "Full name of the client. This is the ONLY required field."],
    [""],
    ["OPTIONAL COLUMNS"],
    ["phone", "Phone number. Must start with 0 (e.g. 0772466708). If you enter 772466708 the system adds the 0 automatically."],
    ["email", "Email address"],
    ["division_office", "The division or office (e.g. DIVISION OFFICE, KITO, NSASA)"],
    ["location_text", "Street address or area"],
    ["registration_fee", "One-time joining/registration fee in UGX. Use 0 if none."],
    ["monthly_rate", "Monthly charge in UGX"],
    ["contract_start_date", "Format: YYYY-MM-DD (e.g. 2023-01-01)"],
    ["notes", "Any extra notes"],
    [""],
    ["PAYMENT HISTORY COLUMNS (2023_jan through 2026_dec)"],
    ["", "These columns record what the client paid each month."],
    [""],
    ["Accepted values:"],
    ["", "30000", "→ Client paid 30,000 UGX that month"],
    ["", "10000", "→ Partial payment"],
    ["", "PAID", "→ Paid in full (uses monthly_rate as the amount)"],
    ["", "NIL", "→ Did NOT pay that month (creates overdue invoice)"],
    ["", "blank", "→ Client not yet active that month (nothing created)"],
    [""],
    ["WHAT GETS CREATED IN THE SYSTEM"],
    ["", "1 client record"],
    ["", "1 contract record"],
    ["", "1 invoice per month in the payment history"],
    ["", "1 payment record per paid month"],
    ["", "Unpaid months → overdue invoices visible in Billing"],
    [""],
    ["TIPS"],
    ["", "• Only name is required — all other fields are optional."],
    ["", "• Phone numbers are auto-corrected to start with 0."],
    ["", "• Zone is auto-detected from the location text."],
    ["", "• Duplicates (same name + phone) are automatically skipped."],
    ["", "• After import, go to Billing to see outstanding balances."],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrData)
  wsInstr["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instructions")

  XLSX.writeFile(wb, "desheena_import_template.xlsx")
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_ZONES = [
  "Kito","Nsasa","Naalya","Mbuya","Mbalwa","Sonde","Kimbejja",
  "Buwate","Nabusigwe","Janda","Mulawa","Najeera","Kamuli",
  "Kyaliwajala","Namugongo","Dembe","Butenga","Mutungo","Kira",
  "Kapera","Hillview","Goma","Nabwojo","Kiwatule","Bulindo",
  "Magere","Nakiyanja","Nsawo","Mbuto","Lukadde","Kitikifumba",
  "Kitto","Glenville","Kiseka","Agenda","NBS","Burabira",
  "Busibante","Kirunda","Borehole","Najeera",
]

const DAY_NAMES = new Set([
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY",
])

const SKIP_PATTERNS = new Set([
  "NAME","F","CONTACT","LOCATION","AMOUNT","NO","S/N","SN",
  "CLIENT NAME","PHONE NUMBER","PHONE","ADDRESS","RATE","MONTHLY RATE",
  "DIVISION OFFICE","INDUSTRIALS","INDUSTRIAL","NEW CLIENTS",
  "ARREARS","ARREARS+E:E","START DATE","MINIMI","DESHEENA",
  "DESHEENA 2023","DESHEENA 2024","DESHEENA 2025","DESHEENA 2026",
  "MOTHER COPY","KAVUMA","SHEET1",
])

const ZERO_TOKENS = new Set([
  "NIL","PAID","LEFT","SHIFTED","*","N/A","NA","-","","NONE",
  "FREE","WAIVED","TBD","TBC","NILL","NIIL","NOT AROUND","NEVER PAID",
  "NEVERPAID","AWAY","MISSING","BAD DEBT","BAD BEDT","USED","JUSTI",
  "NOTSEEN","NOT SEEN","PARTLY","PART","BAL","BALANCE",
])

const DESHEENA_SKIP_SHEETS = new Set(["Sheet1","Sheet2","KAVUMA","DEBTORS 2025"])

// Month name to number
const MONTH_MAP: Record<string, number> = {
  jan:1,feb:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,
  jul:7,july:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12,
}

// Desheena Excel column layout for payment history
// Sheets have years across columns starting around col 5
// MOTHER COPY / SUZAN 23: 2023 data starts col 5 (JAN) through col 16 (DEC), then 2024 col 18+
// DESHEENA 24: col 7 = JAN 2024 through col 18 = DEC 2024
// We detect year from sheet name and map columns accordingly


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentMonth {
  year: number
  month: number
  amount_paid: number
  status: "paid" | "partial" | "unpaid" | "na"
}

export interface ParsedClient {
  name: string
  phone: string | null
  email: string | null
  division_office: string | null
  location_text: string
  zone: string | null
  gps_lat: number
  gps_lng: number
  service_frequency: string
  registration_fee: number
  monthly_rate: number
  contract_start_date: string
  notes: string | null
  payment_history: PaymentMonth[]
  sourceSheet?: string
}

interface SheetInfo {
  name: string
  rowCount: number
  selected: boolean
}

type FileFormat = "csv" | "excel" | null

interface ImportResult {
  imported: number
  duplicates: number
  errors: number
  invoices_created: number
  payments_created: number
  error_messages: string[]
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function cleanName(raw: unknown): string {
  if (raw == null) return ""
  return String(raw).trim()
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[^a-zA-Z0-9\s.,'"()\-/]+$/, "")
    .trim()
}

function cleanPhone(raw: unknown): string | null {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null
  // Take first number if multiple separated by /
  s = s.split("/")[0].trim()
  // Remove spaces, dashes, parentheses, dots
  s = s.replace(/[\s\-().]/g, "")
  if (!s || s.length < 7) return null
  // Strip +256 or 256 country code prefix → normalize to local 0XXXXXXXXX
  if (s.startsWith("+256")) s = "0" + s.slice(4)
  else if (s.startsWith("256") && s.length === 12) s = "0" + s.slice(3)
  // If number doesn't start with 0, add it
  if (!s.startsWith("0")) s = "0" + s
  return s
}

function parseAmount(raw: unknown): number {
  if (raw == null) return 0
  const s = String(raw).trim().toUpperCase().replace(/,/g, "")
  if (!s || ZERO_TOKENS.has(s)) return 0
  // Handle partial payments like "20K", "10K"
  if (/^\d+K$/i.test(s)) return parseInt(s) * 1000
  const n = parseFloat(s)
  return isNaN(n) || n < 0 ? 0 : n
}

// Convert Excel serial date number (e.g. 44928) to YYYY-MM-DD string
// Excel epoch: Jan 1 1900 = 1 (with the 1900 leap year bug: serial 60 = Feb 29 1900 which didn't exist)
function excelSerialToDate(serial: number): string {
  // Adjust for Excel's 1900 leap year bug (serial 60 is phantom Feb 29 1900)
  const adjusted = serial > 59 ? serial - 1 : serial
  const msPerDay = 86400000
  const excelEpoch = new Date(1900, 0, 1).getTime() // Jan 1 1900
  const date = new Date(excelEpoch + (adjusted - 1) * msPerDay)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// Parse a date value that might be a string "2023-01-01", an Excel serial number, or garbage
function parseDate(raw: unknown, fallback: string): string {
  if (raw == null || String(raw).trim() === "") return fallback
  const s = String(raw).trim()
  // Already a valid date string
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Excel serial number
  const n = parseFloat(s)
  if (!isNaN(n) && n > 1000 && n < 100000) return excelSerialToDate(Math.round(n))
  // Try parsing as a date string
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]
  return fallback
}

function detectZone(text: string): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const z of KNOWN_ZONES) {
    if (lower.includes(z.toLowerCase())) return z
  }
  return null
}

function isSectionHeader(row: unknown[]): boolean {
  const col0 = String(row[0] ?? "").trim()
  if (!col0) return false
  if (DAY_NAMES.has(col0.toUpperCase())) return true
  if (SKIP_PATTERNS.has(col0.toUpperCase())) return true
  const isAllUpper = col0 === col0.toUpperCase() && /[A-Z]/.test(col0)
  const hasDigits = /\d/.test(col0)
  const isShort = col0.length < 50
  const col1 = String(row[1] ?? "").trim()
  const hasPhone = /\d{7,}/.test(col1)
  if (isAllUpper && !hasDigits && isShort && !hasPhone) return true
  return false
}

// Detect which year a sheet covers based on its name
function detectSheetYear(sheetName: string): number | null {
  const m = sheetName.match(/20(\d{2})/)
  if (m) return 2000 + parseInt(m[1])
  if (sheetName.toUpperCase().includes("MOTHER") || sheetName.toUpperCase().includes("SUZAN 23")) return 2023
  if (sheetName.toUpperCase().includes("24")) return 2024
  if (sheetName.toUpperCase().includes("25")) return 2025
  if (sheetName.toUpperCase().includes("26")) return 2026
  return null
}

// Parse payment columns from a Desheena row
// The Desheena format has month columns starting around col 5
// Each column = one month payment (amount or PAID/NIL/*)
function parsePaymentColumns(
  row: unknown[],
  sheetYear: number | null,
  monthlyRate: number
): PaymentMonth[] {
  if (!sheetYear) return []

  const payments: PaymentMonth[] = []
  // Payment columns start at index 5 (after: name, phone, location, amount, arrears)
  // 12 months per year
  const startCol = 5
  const months = 12

  for (let m = 0; m < months; m++) {
    const colIdx = startCol + m
    const raw = row[colIdx]
    const monthNum = m + 1

    if (raw == null || String(raw).trim() === "") {
      // Empty = not recorded, treat as NA for early months, unpaid for recent
      const monthDate = new Date(sheetYear, m, 1)
      const isOld = monthDate < new Date(2022, 0, 1)
      payments.push({ year: sheetYear, month: monthNum, amount_paid: 0, status: isOld ? "na" : "unpaid" })
      continue
    }

    const rawStr = String(raw).trim().toUpperCase()

    if (rawStr === "PAID" || rawStr === "P") {
      payments.push({ year: sheetYear, month: monthNum, amount_paid: monthlyRate, status: "paid" })
      continue
    }

    if (ZERO_TOKENS.has(rawStr) || rawStr === "*") {
      payments.push({ year: sheetYear, month: monthNum, amount_paid: 0, status: "na" })
      continue
    }

    const amt = parseAmount(raw)
    if (amt > 0) {
      // If amount matches monthly rate = fully paid, else partial
      const status = amt >= monthlyRate * 0.9 ? "paid" : "partial"
      payments.push({ year: sheetYear, month: monthNum, amount_paid: amt, status })
    } else {
      payments.push({ year: sheetYear, month: monthNum, amount_paid: 0, status: "unpaid" })
    }
  }

  return payments
}

// ---------------------------------------------------------------------------
// Desheena Excel parser — extracts clients + payment history
// ---------------------------------------------------------------------------

function parseDesheenaSheet(ws: XLSX.WorkSheet, sheetName: string, defaultStartDate: string): ParsedClient[] {
  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: null, blankrows: false,
  }) as unknown[][]

  const sheetYear = detectSheetYear(sheetName)
  const clients: ParsedClient[] = []
  let currentDivision: string | null = null

  for (let ri = 0; ri < raw.length; ri++) {
    const row = raw[ri]
    if (!row || row.length === 0) continue

    const col0 = row[0]
    const nameRaw = col0 == null ? "" : String(col0).trim()
    if (!nameRaw) continue

    if (nameRaw.toUpperCase() === "DIVISION OFFICE") {
      currentDivision = "DIVISION OFFICE"
      continue
    }

    if (isSectionHeader(row)) {
      const potentialZone = detectZone(nameRaw)
      if (potentialZone) currentDivision = nameRaw
      continue
    }

    if (/^[^a-zA-Z0-9]+$/.test(nameRaw)) continue

    const name = cleanName(nameRaw)
    if (!name || name.length < 2) continue

    const phone = cleanPhone(row[1])
    const locationRaw = row[2] == null ? "" : String(row[2]).trim()
    const location_text = locationRaw || sheetName

    // Monthly rate: col 3
    let monthly_rate = 0
    for (const idx of [3, 4, 5]) {
      const v = row[idx]
      if (v != null && String(v).trim() !== "") {
        const amt = parseAmount(v)
        if (amt > 0) { monthly_rate = amt; break }
      }
    }

    // Registration fee: col 4 if it differs from monthly rate
    let registration_fee = 0
    const col4 = row[4]
    if (col4 != null) {
      const col4str = String(col4).trim().toUpperCase()
      if (!ZERO_TOKENS.has(col4str)) {
        const fee = parseAmount(col4)
        if (fee > 0 && fee !== monthly_rate) registration_fee = fee
      }
    }

    const zone = detectZone(location_text) ?? detectZone(sheetName) ?? (currentDivision ? detectZone(currentDivision) : null)

    // Parse payment history from this sheet
    const payment_history = parsePaymentColumns(row, sheetYear, monthly_rate)

    clients.push({
      name,
      phone,
      email: null,
      division_office: currentDivision,
      location_text,
      zone,
      gps_lat: 0,
      gps_lng: 0,
      service_frequency: "monthly",
      registration_fee,
      monthly_rate,
      contract_start_date: defaultStartDate,
      notes: null,
      payment_history,
      sourceSheet: sheetName,
    })
  }

  return clients
}

// ---------------------------------------------------------------------------
// Standard template parser (CSV or template Excel)
// ---------------------------------------------------------------------------

function parseTemplateRow(obj: Record<string, string>, defaultStartDate: string): ParsedClient | null {
  const name = obj["name"]?.trim()
  if (!name) return null

  const monthly_rate = parseFloat((obj["monthly_rate"] ?? "0").replace(/,/g, "")) || 0
  const location_text = obj["location_text"]?.trim() || ""

  // Parse payment history from columns like 2023_jan, 2024_feb, etc.
  const payment_history: PaymentMonth[] = []
  for (const [key, val] of Object.entries(obj)) {
    const m = key.match(/^(\d{4})_([a-z]+)$/i)
    if (!m) continue
    const year = parseInt(m[1])
    const monthNum = MONTH_MAP[m[2].toLowerCase()]
    if (!monthNum) continue
    const rawStr = String(val ?? "").trim().toUpperCase()
    if (!rawStr || rawStr === "NA" || rawStr === "N/A" || rawStr === "*") {
      // Blank = not active that month (na), not an unpaid debt
      payment_history.push({ year, month: monthNum, amount_paid: 0, status: "na" })
    } else if (rawStr === "PAID" || rawStr === "P") {
      payment_history.push({ year, month: monthNum, amount_paid: monthly_rate, status: "paid" })
    } else if (rawStr === "NIL" || rawStr === "NILL" || rawStr === "0") {
      // NIL explicitly means they were active but didn't pay
      payment_history.push({ year, month: monthNum, amount_paid: 0, status: "unpaid" })
    } else {
      const amt = parseAmount(val)
      if (amt > 0) {
        payment_history.push({ year, month: monthNum, amount_paid: amt, status: amt >= monthly_rate * 0.9 ? "paid" : "partial" })
      } else {
        payment_history.push({ year, month: monthNum, amount_paid: 0, status: "unpaid" })
      }
    }
  }

  return {
    name,
    phone: cleanPhone(obj["phone"]),
    email: obj["email"]?.trim() || null,
    division_office: obj["division_office"]?.trim() || null,
    location_text,
    zone: detectZone(location_text) || null,
    gps_lat: parseFloat(obj["gps_lat"] ?? "0") || 0,
    gps_lng: parseFloat(obj["gps_lng"] ?? "0") || 0,
    service_frequency: obj["service_frequency"]?.trim() || "monthly",
    registration_fee: parseFloat((obj["registration_fee"] ?? "0").replace(/,/g, "")) || 0,
    monthly_rate,
    contract_start_date: parseDate(obj["contract_start_date"], defaultStartDate),
    notes: obj["notes"]?.trim() || null,
    payment_history,
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === "," && !inQuotes) { result.push(current); current = "" }
    else { current += ch }
  }
  result.push(current)
  return result
}


// ---------------------------------------------------------------------------
// Call batch-import-clients Edge Function
// ---------------------------------------------------------------------------

async function runBatchImport(clients: ParsedClient[]): Promise<ImportResult> {
  const { data, error } = await supabase.functions.invoke('batch-import-clients', {
    method: 'POST',
    body: { clients },
  })
  if (error) throw new Error(error.message ?? 'Import failed')
  return data as ImportResult
}

// ---------------------------------------------------------------------------
// Preview Table (editable)
// ---------------------------------------------------------------------------

interface PreviewTableProps {
  clients: ParsedClient[]
  onClientChange: (i: number, c: ParsedClient) => void
  globalStartDate: string
  onGlobalStartDateChange: (d: string) => void
}

function PreviewTable({ clients, onClientChange, globalStartDate, onGlobalStartDateChange }: PreviewTableProps) {
  const preview = clients.slice(0, 15)
  const totalPaidMonths = clients.reduce((s, c) => s + c.payment_history.filter((p) => p.status === "paid" || p.status === "partial").length, 0)
  const totalUnpaidMonths = clients.reduce((s, c) => s + c.payment_history.filter((p) => p.status === "unpaid").length, 0)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900">
            {clients.length.toLocaleString()} client{clients.length !== 1 ? "s" : ""} ready
          </h3>
          {totalPaidMonths > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {totalPaidMonths.toLocaleString()} paid months
            </span>
          )}
          {totalUnpaidMonths > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {totalUnpaidMonths.toLocaleString()} unpaid months
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Default start date:</label>
          <input
            type="date"
            value={globalStartDate}
            onChange={(e) => onGlobalStartDateChange(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              {["#","Name","Phone","Division","Location","Reg. Fee","Monthly","Start Date","History"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {preview.map((c, i) => {
              const paid = c.payment_history.filter((p) => p.status === "paid" || p.status === "partial").length
              const unpaid = c.payment_history.filter((p) => p.status === "unpaid").length
              return (
                <tr key={i} className="hover:bg-blue-50/20">
                  <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={c.name} onChange={(e) => onClientChange(i, { ...c, name: e.target.value })}
                      className="w-36 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-900 bg-transparent focus:bg-white focus:outline-none" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={c.phone ?? ""} onChange={(e) => onClientChange(i, { ...c, phone: e.target.value || null })}
                      className="w-28 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none font-mono" />
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 max-w-[90px] truncate">{c.division_office ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <input type="text" value={c.location_text} onChange={(e) => onClientChange(i, { ...c, location_text: e.target.value })}
                      className="w-24 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={c.registration_fee} onChange={(e) => onClientChange(i, { ...c, registration_fee: parseFloat(e.target.value) || 0 })}
                      className="w-20 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-transparent focus:bg-white focus:outline-none tabular-nums" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={c.monthly_rate} onChange={(e) => onClientChange(i, { ...c, monthly_rate: parseFloat(e.target.value) || 0 })}
                      className="w-20 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-transparent focus:bg-white focus:outline-none tabular-nums" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="date" value={c.contract_start_date} onChange={(e) => onClientChange(i, { ...c, contract_start_date: e.target.value })}
                      className="w-28 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none" />
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    {c.payment_history.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {paid > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">{paid}✓</span>}
                        {unpaid > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">{unpaid}✗</span>}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {clients.length > 15 && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
          …and {(clients.length - 15).toLocaleString()} more (all will be imported)
        </div>
      )}
    </div>
  )
}


// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CsvImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [fileFormat, setFileFormat] = useState<FileFormat>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sheets, setSheets] = useState<SheetInfo[]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [clients, setClients] = useState<ParsedClient[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [globalStartDate, setGlobalStartDate] = useState(new Date().toISOString().split("T")[0])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Apply global start date to all clients
  useEffect(() => {
    if (clients.length > 0) {
      setClients((prev) => prev.map((c) => ({ ...c, contract_start_date: globalStartDate })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalStartDate])

  // ---------------------------------------------------------------------------
  // File processing
  // ---------------------------------------------------------------------------

  const processFile = useCallback((file: File) => {
    setImportResult(null)
    setClients([])
    setSkippedCount(0)
    setParseErrors([])
    setSheets([])
    setWorkbook(null)

    const ext = file.name.split(".").pop()?.toLowerCase()
    const isExcel = ext === "xlsx" || ext === "xls" || file.type.includes("spreadsheet")
    const isCsv = ext === "csv" || file.type === "text/csv"

    setFileName(file.name)
    setFileFormat(isExcel ? "excel" : isCsv ? "csv" : null)

    const reader = new FileReader()

    if (isExcel) {
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "array" })
          setWorkbook(wb)
          const sheetInfos: SheetInfo[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name]
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][]
            return { name, rowCount: rows.length, selected: !DESHEENA_SKIP_SHEETS.has(name) }
          })
          setSheets(sheetInfos)
          parseExcel(wb, sheetInfos.filter((s) => s.selected).map((s) => s.name), globalStartDate)
        } catch (err) {
          setParseErrors([`Failed to read Excel: ${err instanceof Error ? err.message : String(err)}`])
        }
      }
      reader.readAsArrayBuffer(file)
    } else if (isCsv) {
      reader.onload = (e) => {
        const text = e.target?.result as string
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) { setParseErrors(["CSV is empty"]); return }
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""))
        const parsed: ParsedClient[] = []
        const errs: string[] = []
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i])
          const obj: Record<string, string> = {}
          headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? "").trim().replace(/^"|"$/g, "") })
          const c = parseTemplateRow(obj, globalStartDate)
          if (c) parsed.push(c)
          else if (obj["name"]) errs.push(`Row ${i + 1}: skipped`)
        }
        setClients(parsed)
        setParseErrors(errs)
      }
      reader.readAsText(file)
    } else {
      setParseErrors(["Unsupported format. Use .csv, .xlsx, or .xls"])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalStartDate])

  function parseExcel(wb: XLSX.WorkBook, selectedSheets: string[], startDate: string) {
    let all: ParsedClient[] = []
    let totalRaw = 0

    for (const name of selectedSheets) {
      const ws = wb.Sheets[name]
      if (!ws) continue
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][]
      totalRaw += rows.length

      // Check if this is a template sheet (has our headers)
      const row0 = (rows[0] as unknown[] ?? []).map((c) => String(c ?? "").trim().toLowerCase())
      const isTemplate = row0.includes("name")

      if (isTemplate) {
        // Row 0 = machine headers, Row 1 = human labels (skip), Row 2 = instructions (skip)
        // Data starts at row 3 (index 3)
        const dataStartRow = (() => {
          // Detect if rows 1 and 2 are label/instruction rows (non-data)
          // A data row has a non-empty name that isn't a label like "Client Name *"
          for (let i = 1; i < Math.min(4, rows.length); i++) {
            const firstCell = String((rows[i] as unknown[])[0] ?? "").trim()
            // If first cell looks like a real client name (not a label), start here
            if (firstCell && !firstCell.includes("*") && !firstCell.toLowerCase().includes("required") && !firstCell.toLowerCase().includes("name")) {
              return i
            }
          }
          return 1
        })()

        for (let i = dataStartRow; i < rows.length; i++) {
          const obj: Record<string, string> = {}
          row0.forEach((h, idx) => { obj[h] = String((rows[i] as unknown[])[idx] ?? "").trim() })
          // Skip rows that look like label/instruction rows
          const nameVal = obj["name"] ?? ""
          if (!nameVal || nameVal.includes("*") || nameVal.toLowerCase().includes("required") || nameVal.toLowerCase().includes("client name")) continue
          const c = parseTemplateRow(obj, startDate)
          if (c) all.push({ ...c, sourceSheet: name })
        }
      } else {
        all = all.concat(parseDesheenaSheet(ws, name, startDate))
      }
    }

    // Deduplicate within parsed set
    const seen = new Set<string>()
    const deduped = all.filter((c) => {
      const key = `${c.name.toLowerCase()}|${c.phone ?? ""}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    setSkippedCount(totalRaw - deduped.length)
    setClients(deduped)
  }

  function toggleSheet(name: string) {
    setSheets((prev) => {
      const updated = prev.map((s) => s.name === name ? { ...s, selected: !s.selected } : s)
      if (workbook) parseExcel(workbook, updated.filter((s) => s.selected).map((s) => s.name), globalStartDate)
      return updated
    })
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragging(false), [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  async function handleImport() {
    if (clients.length === 0) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await runBatchImport(clients)
      setImportResult(result)
    } catch (err) {
      setImportResult({
        imported: 0, duplicates: 0, errors: clients.length,
        invoices_created: 0, payments_created: 0,
        error_messages: [err instanceof Error ? err.message : String(err)],
      })
    }
    setImporting(false)
  }

  function reset() {
    setClients([]); setFileName(null); setFileFormat(null)
    setSheets([]); setWorkbook(null); setImportResult(null)
    setParseErrors([]); setSkippedCount(0)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const selectedSheetCount = sheets.filter((s) => s.selected).length
  const totalPaymentMonths = clients.reduce((s, c) => s + c.payment_history.length, 0)
  const totalPaid = clients.reduce((s, c) => s + c.payment_history.filter((p) => p.status === "paid" || p.status === "partial").length, 0)
  const totalUnpaid = clients.reduce((s, c) => s + c.payment_history.filter((p) => p.status === "unpaid").length, 0)

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Import Clients</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Migrate clients, contracts, and full payment history in one upload
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download Template
          </button>
          <button onClick={() => navigate("/dashboard/clients")}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            ← Back
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">What gets imported</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mt-1">
          <div className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">✓</span><span><strong>Clients</strong> — name, phone, location, zone</span></div>
          <div className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">✓</span><span><strong>Contracts</strong> — monthly rate, registration fee, start date</span></div>
          <div className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">✓</span><span><strong>Payment history</strong> — invoices + payments per month (2023–2025)</span></div>
        </div>
        <p className="text-xs mt-2 text-blue-600">
          Supports your existing Desheena Excel file (auto-detected) or the downloadable template.
          Import is done server-side in batches — fast even for 1,000+ clients.
        </p>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30"}`}
        role="button" tabIndex={0} aria-label="Upload file"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
      >
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
        <div className="flex flex-col items-center gap-3">
          <svg className="h-10 w-10 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {fileName ? (
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-sm font-medium text-gray-900">{fileName}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${fileFormat === "excel" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                {fileFormat === "excel" ? "Excel" : "CSV"}
              </span>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Drag and drop, or click to browse</p>
              <p className="text-xs text-gray-500">Accepts .csv, .xlsx, .xls</p>
            </>
          )}
        </div>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">{parseErrors.length} issue{parseErrors.length !== 1 ? "s" : ""}</p>
          <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside max-h-32 overflow-y-auto">
            {parseErrors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Sheet selector */}
      {fileFormat === "excel" && sheets.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Sheets ({selectedSheetCount}/{sheets.length})</h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => { setSheets((p) => { const u = p.map((s) => ({ ...s, selected: true })); if (workbook) parseExcel(workbook, u.map((s) => s.name), globalStartDate); return u; }); }} className="text-blue-600 hover:underline">All</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => { setSheets((p) => p.map((s) => ({ ...s, selected: false }))); setClients([]); }} className="text-gray-500 hover:underline">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sheets.map((s) => (
              <label key={s.name} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${s.selected ? "border-blue-500 bg-blue-50 text-blue-800" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}>
                <input type="checkbox" checked={s.selected} onChange={() => toggleSheet(s.name)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="font-medium">{s.name}</span>
                <span className="opacity-60">({s.rowCount})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Skipped notice */}
      {skippedCount > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 text-sm text-yellow-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {skippedCount.toLocaleString()} rows skipped (section headers, empty rows, intra-file duplicates)
        </div>
      )}

      {/* Payment history summary */}
      {clients.length > 0 && totalPaymentMonths > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900">{totalPaymentMonths.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total invoice months</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-green-700">{totalPaid.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-0.5">Paid months</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-red-700">{totalUnpaid.toLocaleString()}</p>
            <p className="text-xs text-red-600 mt-0.5">Unpaid / overdue months</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {clients.length > 0 && !importResult && (
        <PreviewTable
          clients={clients}
          onClientChange={(i, c) => setClients((prev) => { const n = [...prev]; n[i] = c; return n; })}
          globalStartDate={globalStartDate}
          onGlobalStartDateChange={setGlobalStartDate}
        />
      )}

      {/* Import button */}
      {clients.length > 0 && !importResult && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2"
          >
            {importing && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {importing
              ? "Importing… (server-side batch)"
              : `Import ${clients.length.toLocaleString()} client${clients.length !== 1 ? "s" : ""}${totalPaymentMonths > 0 ? ` + ${totalPaymentMonths.toLocaleString()} invoice months` : ""}`}
          </button>
          <button onClick={reset} disabled={importing}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Clear
          </button>
        </div>
      )}

      {/* Result */}
      {importResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Import Complete</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Clients imported", value: importResult.imported, color: "bg-green-50 text-green-700" },
              { label: "Duplicates skipped", value: importResult.duplicates, color: "bg-yellow-50 text-yellow-700" },
              { label: "Errors", value: importResult.errors, color: "bg-red-50 text-red-700" },
              { label: "Invoices created", value: importResult.invoices_created, color: "bg-blue-50 text-blue-700" },
              { label: "Payments recorded", value: importResult.payments_created, color: "bg-purple-50 text-purple-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                <p className="text-xs mt-0.5 opacity-80">{label}</p>
              </div>
            ))}
          </div>
          {importResult.error_messages.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-red-700 mb-1">Errors:</p>
              <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside max-h-32 overflow-y-auto">
                {importResult.error_messages.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Import another file
            </button>
            <button onClick={() => navigate("/dashboard/clients")} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
              View clients →
            </button>
            <button onClick={() => navigate("/dashboard/billing")} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors">
              View billing →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
