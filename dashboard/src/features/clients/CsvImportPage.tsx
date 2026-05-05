import React, { useState, useRef, useCallback, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import * as XLSX from "xlsx"
import { supabase } from "../../lib/supabase"
// ---------------------------------------------------------------------------
// Template download helper
// ---------------------------------------------------------------------------

function downloadTemplate() {
  const wb = XLSX.utils.book_new()
  const headers = [
    "name", "phone", "email", "division_office", "location_text",
    "zone", "gps_lat", "gps_lng", "service_frequency",
    "registration_fee", "monthly_rate", "contract_start_date", "notes"
  ]
  const example = [
    "MULINDWA", "0772466708", "", "DIVISION OFFICE", "KITO",
    "Kito", "", "", "monthly",
    "0", "30000", "2024-01-01", ""
  ]
  const example2 = [
    "CAPTAIN NEWMAN ALEXANDRA", "0784921801", "captain@example.com", "DIVISION OFFICE", "KITO",
    "Kito", "", "", "monthly",
    "50000", "20000", "2024-01-01", "Paid registration Jan 2024"
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example, example2])
  // Column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }))
  XLSX.utils.book_append_sheet(wb, ws, "Clients")
  XLSX.writeFile(wb, "desheena_clients_template.xlsx")
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KNOWN_ZONES = [
  "Kito","Nsasa","Naalya","Mbuya","Mbalwa","Sonde","Kimbejja",
  "Buwate","Nabusigwe","Janda","Mulawa","Najeera","Kamuli",
  "Kyaliwajala","Namugongo","Dembe","Butenga","Mutungo","Kira",
  "Kapera","Hillview","Goma","Nabwojo","Kiwatule","Bulindo",
  "Magere","Nabusugwe","Nakiyanja","Nsawo","Mbuto","Lukadde",
  "Kitikifumba","Kitto","Glenville","Kiseka","Agenda","NBS",
  "Burabira","Busibante","Najeera","Kirunda","Borehole",
]

const DAY_NAMES = new Set([
  "MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY",
])

const SKIP_PATTERNS = new Set([
  "NAME","F","CONTACT","LOCATION","AMOUNT","NO","S/N","SN",
  "CLIENT NAME","PHONE NUMBER","PHONE","ADDRESS","RATE","MONTHLY RATE",
  "DIVISION OFFICE","INDUSTRIALS","INDUSTRIAL","NEW CLIENTS",
  "ARREARS","ARREARS+E:E","START DATE","MINIMI",
])

const ZERO_TOKENS = new Set([
  "NIL","PAID","LEFT","SHIFTED","*","N/A","NA","-","","NONE",
  "FREE","WAIVED","TBD","TBC","NILL","NIIL","NOT AROUND","NEVER PAID",
  "NEVERPAID","AWAY","MISSING","BAD DEBT","BAD BEDT","USED","JUSTI",
])

const DESHEENA_SKIP_SHEETS = new Set(["Sheet1","Sheet2","KAVUMA"])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedRow {
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
  sourceSheet?: string
  _rowIndex?: number
}

// Column mapping types
type ColumnKey = keyof Omit<ParsedRow, "sourceSheet" | "_rowIndex">

interface ColumnMapping {
  [excelCol: string]: ColumnKey | null
}

interface SheetInfo {
  name: string
  rowCount: number
  selected: boolean
}

type FileFormat = "csv" | "excel" | null

interface ImportSummary {
  total: number
  imported: number
  duplicates: number
  errors: number
  errorMessages: string[]
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
  s = s.split("/")[0].trim()
  s = s.replace(/[\s\-().]/g, "")
  if (!s || s.length < 7) return null
  if (/^0[37]\d{8}$/.test(s)) s = "+256" + s.slice(1)
  return s
}

function parseAmount(raw: unknown): number {
  if (raw == null) return 0
  const s = String(raw).trim().toUpperCase().replace(/,/g, "")
  if (!s || ZERO_TOKENS.has(s)) return 0
  const n = parseFloat(s)
  return isNaN(n) || n < 0 ? 0 : n
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

// ---------------------------------------------------------------------------
// Desheena Excel parser
// ---------------------------------------------------------------------------

function parseDesheenaSheet(ws: XLSX.WorkSheet, sheetName: string, defaultStartDate: string): ParsedRow[] {
  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1, defval: null, blankrows: false,
  }) as unknown[][]

  const rows: ParsedRow[] = []
  let currentDivision: string | null = null

  for (let ri = 0; ri < raw.length; ri++) {
    const row = raw[ri]
    if (!row || row.length === 0) continue

    const col0 = row[0]
    const nameRaw = col0 == null ? "" : String(col0).trim()
    if (!nameRaw) continue

    // Track division office context
    if (nameRaw.toUpperCase() === "DIVISION OFFICE") {
      currentDivision = "DIVISION OFFICE"
      continue
    }

    // Skip section headers but capture zone context
    if (isSectionHeader(row)) {
      // Use as zone hint for subsequent rows
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

    // Amount: try col 3, 4, 5 — first non-empty numeric
    let monthly_rate = 0
    let registration_fee = 0
    for (const idx of [3, 4, 5]) {
      const v = row[idx]
      if (v != null && String(v).trim() !== "") {
        const amt = parseAmount(v)
        if (amt > 0) {
          monthly_rate = amt
          break
        }
      }
    }

    // Registration fee: look for "arrears" or initial payment in col 4/5 if col 3 was the monthly
    // In Desheena format col 4 is often "ARREARS" label or initial amount
    const col4 = row[4]
    if (col4 != null) {
      const col4str = String(col4).trim().toUpperCase()
      if (!ZERO_TOKENS.has(col4str) && !isNaN(parseFloat(col4str.replace(/,/g, "")))) {
        const fee = parseAmount(col4)
        if (fee > 0 && fee !== monthly_rate) registration_fee = fee
      }
    }

    const zone = detectZone(location_text) ?? detectZone(sheetName) ?? (currentDivision ? detectZone(currentDivision) : null)

    rows.push({
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
      sourceSheet: sheetName,
      _rowIndex: ri + 1,
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Standard CSV parser
// ---------------------------------------------------------------------------

function parseCsvText(text: string, defaultStartDate: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { rows: [], errors: ["CSV file is empty or has no data rows"] }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""))
  const required = ["name", "location_text", "monthly_rate"]
  const missing = required.filter((r) => !headers.includes(r))
  if (missing.length > 0) {
    return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] }
  }

  const rows: ParsedRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? "").trim().replace(/^"|"$/g, "") })

    const name = obj["name"]?.trim()
    if (!name) { errors.push(`Row ${i + 1}: missing name`); continue }

    const monthly_rate = parseFloat((obj["monthly_rate"] ?? "0").replace(/,/g, ""))
    if (isNaN(monthly_rate)) { errors.push(`Row ${i + 1}: invalid monthly_rate`); continue }

    const location_text = obj["location_text"]?.trim() || ""
    if (!location_text) { errors.push(`Row ${i + 1}: missing location_text`); continue }

    rows.push({
      name,
      phone: cleanPhone(obj["phone"]),
      email: obj["email"]?.trim() || null,
      division_office: obj["division_office"]?.trim() || null,
      location_text,
      zone: obj["zone"]?.trim() || detectZone(location_text) || null,
      gps_lat: parseFloat(obj["gps_lat"] ?? "0") || 0,
      gps_lng: parseFloat(obj["gps_lng"] ?? "0") || 0,
      service_frequency: obj["service_frequency"]?.trim() || "monthly",
      registration_fee: parseFloat((obj["registration_fee"] ?? "0").replace(/,/g, "")) || 0,
      monthly_rate,
      contract_start_date: obj["contract_start_date"]?.trim() || defaultStartDate,
      notes: obj["notes"]?.trim() || null,
      _rowIndex: i + 1,
    })
  }

  return { rows, errors }
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
// Supabase insert
// ---------------------------------------------------------------------------

async function insertClientRow(row: ParsedRow): Promise<void> {
  const id = crypto.randomUUID()
  const { error } = await supabase.from("clients").insert({
    id,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email,
    location_text: row.location_text,
    gps_lat: row.gps_lat,
    gps_lng: row.gps_lng,
    service_frequency: row.service_frequency,
    monthly_rate: row.monthly_rate,
    zone: row.zone,
    created_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)

  const { error: ce } = await supabase.from("contracts").insert({
    id: crypto.randomUUID(),
    client_id: id,
    status: "active",
    billing_model: "flat",
    billing_cycle: "monthly",
    monthly_rate: row.monthly_rate,
    registration_fee: row.registration_fee,
    start_date: row.contract_start_date,
    notes: row.notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  if (ce) console.warn("Contract insert failed for", row.name, ce.message)
}

// ---------------------------------------------------------------------------
// Column Mapping UI
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<ColumnKey, string> = {
  name: "Client Name *",
  phone: "Phone",
  email: "Email",
  division_office: "Division Office",
  location_text: "Location *",
  zone: "Zone",
  gps_lat: "GPS Latitude",
  gps_lng: "GPS Longitude",
  service_frequency: "Service Frequency",
  registration_fee: "Registration Fee (UGX)",
  monthly_rate: "Monthly Rate (UGX) *",
  contract_start_date: "Contract Start Date",
  notes: "Notes",
}

const ALL_FIELDS = Object.keys(FIELD_LABELS) as ColumnKey[]

interface ColumnMapperProps {
  excelHeaders: string[]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
}

function ColumnMapper({ excelHeaders, mapping, onChange }: ColumnMapperProps) {
  const usedFields = new Set(Object.values(mapping).filter(Boolean))

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Column Mapping</h3>
      <p className="text-xs text-gray-500 mb-3">
        Match your file columns to the correct fields. Required fields are marked with *.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {excelHeaders.map((col) => (
          <div key={col} className="flex items-center gap-2">
            <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded w-32 truncate shrink-0" title={col}>
              {col}
            </span>
            <span className="text-gray-400 text-xs">→</span>
            <select
              value={mapping[col] ?? ""}
              onChange={(e) => {
                const val = e.target.value as ColumnKey | ""
                onChange({ ...mapping, [col]: val || null })
              }}
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">— skip —</option>
              {ALL_FIELDS.map((f) => (
                <option
                  key={f}
                  value={f}
                  disabled={usedFields.has(f) && mapping[col] !== f}
                >
                  {FIELD_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editable Preview Table
// ---------------------------------------------------------------------------

interface PreviewTableProps {
  rows: ParsedRow[]
  onRowChange: (index: number, updated: ParsedRow) => void
  globalStartDate: string
  onGlobalStartDateChange: (d: string) => void
}

function PreviewTable({ rows, onRowChange, globalStartDate, onGlobalStartDateChange }: PreviewTableProps) {
  const preview = rows.slice(0, 15)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Preview — {rows.length.toLocaleString()} client{rows.length !== 1 ? "s" : ""} ready
          </h3>
          <span className="text-xs text-gray-500">(showing first 15, all will be imported)</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
            Default start date:
          </label>
          <input
            type="date"
            value={globalStartDate}
            onChange={(e) => {
              onGlobalStartDateChange(e.target.value)
            }}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-400">(applies to all rows)</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">#</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Division</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Location</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Zone</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Reg. Fee</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Monthly</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">Start Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {preview.map((row, i) => (
              <tr key={i} className="hover:bg-blue-50/30">
                <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => onRowChange(i, { ...row, name: e.target.value })}
                    className="w-36 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-900 bg-transparent focus:bg-white focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.phone ?? ""}
                    onChange={(e) => onRowChange(i, { ...row, phone: e.target.value || null })}
                    className="w-28 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none font-mono"
                  />
                </td>
                <td className="px-3 py-1.5 text-gray-500 max-w-[100px] truncate" title={row.division_office ?? ""}>
                  {row.division_office ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.location_text}
                    onChange={(e) => onRowChange(i, { ...row, location_text: e.target.value })}
                    className="w-28 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="text"
                    value={row.zone ?? ""}
                    onChange={(e) => onRowChange(i, { ...row, zone: e.target.value || null })}
                    className="w-20 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    value={row.registration_fee}
                    onChange={(e) => onRowChange(i, { ...row, registration_fee: parseFloat(e.target.value) || 0 })}
                    className="w-20 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-transparent focus:bg-white focus:outline-none tabular-nums"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    value={row.monthly_rate}
                    onChange={(e) => onRowChange(i, { ...row, monthly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-20 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-700 bg-transparent focus:bg-white focus:outline-none tabular-nums"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="date"
                    value={row.contract_start_date}
                    onChange={(e) => onRowChange(i, { ...row, contract_start_date: e.target.value })}
                    className="w-28 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1 py-0.5 text-xs text-gray-600 bg-transparent focus:bg-white focus:outline-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 15 && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
          …and {(rows.length - 15).toLocaleString()} more rows (all will be imported)
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

  // File state
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileFormat, setFileFormat] = useState<FileFormat>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Excel state
  const [sheets, setSheets] = useState<SheetInfo[]>([])
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null)
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [showColumnMapper, setShowColumnMapper] = useState(false)

  // Parsed rows (editable)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [skippedCount, setSkippedCount] = useState(0)
  const [parseErrors, setParseErrors] = useState<string[]>([])

  // Global start date
  const [globalStartDate, setGlobalStartDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Import state
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // Apply global start date to all rows
  useEffect(() => {
    if (parsedRows.length > 0) {
      setParsedRows((prev) =>
        prev.map((r) => ({ ...r, contract_start_date: globalStartDate }))
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalStartDate])

  // ---------------------------------------------------------------------------
  // File processing
  // ---------------------------------------------------------------------------

  const processFile = useCallback((file: File) => {
    setImportSummary(null)
    setParsedRows([])
    setSkippedCount(0)
    setParseErrors([])
    setSheets([])
    setWorkbook(null)
    setExcelHeaders([])
    setColumnMapping({})
    setShowColumnMapper(false)

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
            const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][]
            return { name, rowCount: rawRows.length, selected: !DESHEENA_SKIP_SHEETS.has(name) }
          })
          setSheets(sheetInfos)

          // Detect if this is a standard template (has our headers in row 0)
          const firstSheet = wb.Sheets[wb.SheetNames[0]]
          const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: null, blankrows: false }) as unknown[][]
          if (firstRows.length > 0) {
            const row0 = (firstRows[0] as unknown[]).map((c) => String(c ?? "").trim().toLowerCase())
            const isTemplate = row0.includes("name") && row0.includes("monthly_rate")
            if (isTemplate) {
              // Standard template — use column mapping
              setExcelHeaders(row0)
              const autoMap: ColumnMapping = {}
              row0.forEach((h) => {
                if (ALL_FIELDS.includes(h as ColumnKey)) autoMap[h] = h as ColumnKey
              })
              setColumnMapping(autoMap)
              setShowColumnMapper(true)
              parseTemplateExcel(wb, sheetInfos.filter((s) => s.selected).map((s) => s.name), autoMap, globalStartDate)
            } else {
              // Desheena native format
              parseDesheenaExcel(wb, sheetInfos.filter((s) => s.selected).map((s) => s.name), globalStartDate)
            }
          }
        } catch (err) {
          setParseErrors([`Failed to read Excel file: ${err instanceof Error ? err.message : String(err)}`])
        }
      }
      reader.readAsArrayBuffer(file)
    } else if (isCsv) {
      reader.onload = (e) => {
        const text = e.target?.result as string
        const { rows, errors } = parseCsvText(text, globalStartDate)
        setParsedRows(rows)
        setParseErrors(errors)
      }
      reader.readAsText(file)
    } else {
      setParseErrors(["Unsupported file format. Please upload .csv, .xlsx, or .xls"])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalStartDate])

  function parseDesheenaExcel(wb: XLSX.WorkBook, selectedSheets: string[], startDate: string) {
    let all: ParsedRow[] = []
    let totalRaw = 0
    for (const name of selectedSheets) {
      const ws = wb.Sheets[name]
      if (!ws) continue
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][]
      totalRaw += rawRows.length
      all = all.concat(parseDesheenaSheet(ws, name, startDate))
    }
    // Deduplicate within parsed set
    const seen = new Set<string>()
    const deduped = all.filter((r) => {
      const key = `${r.name.toLowerCase()}|${r.phone ?? ""}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setSkippedCount(totalRaw - deduped.length)
    setParsedRows(deduped)
  }

  function parseTemplateExcel(wb: XLSX.WorkBook, selectedSheets: string[], mapping: ColumnMapping, startDate: string) {
    let all: ParsedRow[] = []
    for (const name of selectedSheets) {
      const ws = wb.Sheets[name]
      if (!ws) continue
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false }) as unknown[][]
      const headers = (rawRows[0] as unknown[]).map((c) => String(c ?? "").trim().toLowerCase())
      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i] as unknown[]
        const obj: Record<string, unknown> = {}
        headers.forEach((h, idx) => { obj[h] = row[idx] })
        const mapped: Record<string, unknown> = {}
        Object.entries(mapping).forEach(([col, field]) => {
          if (field) mapped[field] = obj[col]
        })
        const name = cleanName(mapped["name"])
        if (!name) continue
        all.push({
          name,
          phone: cleanPhone(mapped["phone"]),
          email: mapped["email"] ? String(mapped["email"]).trim() : null,
          division_office: mapped["division_office"] ? String(mapped["division_office"]).trim() : null,
          location_text: mapped["location_text"] ? String(mapped["location_text"]).trim() : "",
          zone: mapped["zone"] ? String(mapped["zone"]).trim() : detectZone(String(mapped["location_text"] ?? "")),
          gps_lat: parseFloat(String(mapped["gps_lat"] ?? "0")) || 0,
          gps_lng: parseFloat(String(mapped["gps_lng"] ?? "0")) || 0,
          service_frequency: mapped["service_frequency"] ? String(mapped["service_frequency"]).trim() : "monthly",
          registration_fee: parseAmount(mapped["registration_fee"]),
          monthly_rate: parseAmount(mapped["monthly_rate"]),
          contract_start_date: mapped["contract_start_date"] ? String(mapped["contract_start_date"]).trim() : startDate,
          notes: mapped["notes"] ? String(mapped["notes"]).trim() : null,
          sourceSheet: name,
          _rowIndex: i + 1,
        })
      }
    }
    setParsedRows(all)
  }

  // ---------------------------------------------------------------------------
  // Sheet selection
  // ---------------------------------------------------------------------------

  function toggleSheet(sheetName: string) {
    setSheets((prev) => {
      const updated = prev.map((s) => s.name === sheetName ? { ...s, selected: !s.selected } : s)
      if (workbook) {
        const sel = updated.filter((s) => s.selected).map((s) => s.name)
        if (showColumnMapper) parseTemplateExcel(workbook, sel, columnMapping, globalStartDate)
        else parseDesheenaExcel(workbook, sel, globalStartDate)
      }
      return updated
    })
  }

  // ---------------------------------------------------------------------------
  // Column mapping change
  // ---------------------------------------------------------------------------

  function handleMappingChange(newMapping: ColumnMapping) {
    setColumnMapping(newMapping)
    if (workbook) {
      const sel = sheets.filter((s) => s.selected).map((s) => s.name)
      parseTemplateExcel(workbook, sel, newMapping, globalStartDate)
    }
  }

  // ---------------------------------------------------------------------------
  // Row editing
  // ---------------------------------------------------------------------------

  function handleRowChange(index: number, updated: ParsedRow) {
    setParsedRows((prev) => {
      const next = [...prev]
      next[index] = updated
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Drag and drop
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  async function runImport() {
    if (parsedRows.length === 0) return
    setImporting(true)
    setImportProgress(0)
    setImportSummary(null)

    const summary: ImportSummary = { total: parsedRows.length, imported: 0, duplicates: 0, errors: 0, errorMessages: [] }

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      try {
        // Duplicate check
        let dupQuery = supabase.from("clients").select("id", { count: "exact", head: true }).ilike("name", row.name)
        if (row.phone) dupQuery = dupQuery.eq("phone", row.phone)
        const { count } = await dupQuery
        if ((count ?? 0) > 0) {
          summary.duplicates++
        } else {
          await insertClientRow(row)
          summary.imported++
        }
      } catch (err) {
        summary.errors++
        summary.errorMessages.push(`${row.name}: ${err instanceof Error ? err.message : String(err)}`)
      }
      setImportProgress(i + 1)
    }

    setImporting(false)
    setImportSummary(summary)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const selectedSheetCount = sheets.filter((s) => s.selected).length
  const progressPct = parsedRows.length > 0 ? Math.round((importProgress / parsedRows.length) * 100) : 0

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Import Clients</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload a CSV or Excel file to bulk-import clients with contracts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download Template
          </button>
          <button
            onClick={() => navigate("/dashboard/clients")}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Format info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Supported formats</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-1">
          <div>
            <p className="font-medium text-blue-700">📊 Desheena Excel (.xlsx/.xls)</p>
            <p className="text-blue-600">Your existing spreadsheet — auto-detected. Columns: Name | Phone | Location | Amount</p>
          </div>
          <div>
            <p className="font-medium text-blue-700">📄 Standard Template (.xlsx/.csv)</p>
            <p className="text-blue-600">Download the template above. Includes: registration fee, start date, division office, notes</p>
          </div>
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/30"
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
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
          <p className="text-sm font-semibold text-red-700 mb-1">{parseErrors.length} issue{parseErrors.length !== 1 ? "s" : ""} found</p>
          <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside max-h-32 overflow-y-auto">
            {parseErrors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
            {parseErrors.length > 20 && <li>…and {parseErrors.length - 20} more</li>}
          </ul>
        </div>
      )}

      {/* Sheet selector */}
      {fileFormat === "excel" && sheets.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Sheets ({selectedSheetCount} of {sheets.length} selected)
            </h3>
            <div className="flex gap-2 text-xs">
              <button onClick={() => { setSheets((p) => { const u = p.map((s) => ({ ...s, selected: true })); if (workbook) { const sel = u.map((s) => s.name); if (showColumnMapper) parseTemplateExcel(workbook, sel, columnMapping, globalStartDate); else parseDesheenaExcel(workbook, sel, globalStartDate); } return u; }); }} className="text-blue-600 hover:underline">All</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => { setSheets((p) => p.map((s) => ({ ...s, selected: false }))); setParsedRows([]); }} className="text-gray-500 hover:underline">None</button>
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

      {/* Column mapper (template mode) */}
      {showColumnMapper && excelHeaders.length > 0 && (
        <ColumnMapper excelHeaders={excelHeaders} mapping={columnMapping} onChange={handleMappingChange} />
      )}

      {/* Skipped rows notice */}
      {skippedCount > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2.5 text-sm text-yellow-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {skippedCount.toLocaleString()} rows skipped (section headers, empty rows, duplicates within file)
        </div>
      )}

      {/* Preview + editing */}
      {parsedRows.length > 0 && !importSummary && (
        <PreviewTable
          rows={parsedRows}
          onRowChange={handleRowChange}
          globalStartDate={globalStartDate}
          onGlobalStartDateChange={setGlobalStartDate}
        />
      )}

      {/* Import button + progress */}
      {parsedRows.length > 0 && !importSummary && (
        <div className="flex flex-col gap-3">
          {importing && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Importing {importProgress} of {parsedRows.length}…</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-200" style={{ width: `${progressPct}%` }} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={runImport}
              disabled={importing}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {importing ? `Importing… (${importProgress}/${parsedRows.length})` : `Import ${parsedRows.length.toLocaleString()} client${parsedRows.length !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={() => { setParsedRows([]); setFileName(null); setFileFormat(null); setSheets([]); setWorkbook(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              disabled={importing}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Import summary */}
      {importSummary && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Import Complete</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Total processed", value: importSummary.total, color: "bg-gray-50 text-gray-900" },
              { label: "Imported", value: importSummary.imported, color: "bg-green-50 text-green-700" },
              { label: "Duplicates skipped", value: importSummary.duplicates, color: "bg-yellow-50 text-yellow-700" },
              { label: "Errors", value: importSummary.errors, color: "bg-red-50 text-red-700" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-lg p-3 text-center ${color}`}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs mt-0.5 opacity-80">{label}</p>
              </div>
            ))}
          </div>
          {importSummary.errorMessages.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-red-700 mb-1">Error details:</p>
              <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside max-h-32 overflow-y-auto">
                {importSummary.errorMessages.slice(0, 20).map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setImportSummary(null); setParsedRows([]); setFileName(null); setFileFormat(null); setSheets([]); setWorkbook(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Import another file
            </button>
            <button
              onClick={() => navigate("/dashboard/clients")}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              View clients →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
