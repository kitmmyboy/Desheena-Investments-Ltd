import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CsvRow {
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

interface ValidationError {
  row: number
  field: string
  message: string
}

interface ImportResult {
  totalRows: number
  imported: number
  validationSkipped: number
  duplicateSkipped: number
  validationErrors: { row: number; errors: ValidationError[] }[]
  duplicateRows: number[]
}

// ---------------------------------------------------------------------------
// CSV parsing — handles quoted fields
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const headers = parseCsvLine(nonEmpty[0]).map((h) => h.toLowerCase().trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCsvLine(nonEmpty[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof CsvRow)[] = [
  'name',
  'location_text',
  'service_frequency',
  'monthly_rate',
]

const MIN_RATE = 3_000
const MAX_RATE = 750_000

function validateRow(row: Record<string, string>, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = []

  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || row[field].trim() === '') {
      errors.push({ row: rowIndex, field, message: `"${field}" is required` })
    }
  }

  if (row['monthly_rate'] && row['monthly_rate'].trim() !== '') {
    const rate = Number(row['monthly_rate'])
    if (isNaN(rate)) {
      errors.push({ row: rowIndex, field: 'monthly_rate', message: '"monthly_rate" must be a number' })
    } else if (rate < MIN_RATE || rate > MAX_RATE) {
      errors.push({
        row: rowIndex,
        field: 'monthly_rate',
        message: `"monthly_rate" must be between ${MIN_RATE.toLocaleString()} and ${MAX_RATE.toLocaleString()} UGX`,
      })
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

function generateUUID(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// Preview table
// ---------------------------------------------------------------------------

const PREVIEW_COLUMNS = [
  'name', 'phone', 'email', 'location_text', 'gps_lat', 'gps_lng',
  'service_frequency', 'monthly_rate', 'zone',
]

function PreviewTable({ rows }: { rows: Record<string, string>[] }) {
  const preview = rows.slice(0, 5)
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-xs divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
              #
            </th>
            {PREVIEW_COLUMNS.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {preview.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-500">{i + 1}</td>
              {PREVIEW_COLUMNS.map((col) => (
                <td
                  key={col}
                  className="px-3 py-2 text-gray-700 max-w-[140px] truncate"
                  title={row[col] ?? ''}
                >
                  {row[col] ?? <span className="text-gray-300 italic">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 5 && (
        <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-200">
          Showing first 5 of {rows.length} rows
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Import summary
// ---------------------------------------------------------------------------

function ImportSummary({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      {/* Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total rows" value={result.totalRows} color="gray" />
        <SummaryCard label="Imported" value={result.imported} color="green" />
        <SummaryCard label="Validation errors" value={result.validationSkipped} color="yellow" />
        <SummaryCard label="Duplicates skipped" value={result.duplicateSkipped} color="blue" />
      </div>

      {/* Validation error details */}
      {result.validationErrors.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Validation error details</h4>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-yellow-200 bg-yellow-50 divide-y divide-yellow-100">
            {result.validationErrors.map(({ row, errors }) => (
              <div key={row} className="px-3 py-2">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Row {row}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {errors.map((e, i) => (
                    <li key={i} className="text-xs text-yellow-700">
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Duplicate rows */}
      {result.duplicateRows.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Duplicate rows skipped</h4>
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            Rows {result.duplicateRows.join(', ')} were skipped because a client with the same name
            and phone number already exists.
          </p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'gray' | 'green' | 'yellow' | 'blue'
}) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CsvImportPage
// ---------------------------------------------------------------------------

export default function CsvImportPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // File selection
  // -------------------------------------------------------------------------

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParsedRows([])
    setParseError(null)
    setImportResult(null)
    setImportError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      try {
        const { rows } = parseCsv(text)
        if (rows.length === 0) {
          setParseError('The CSV file appears to be empty or has no data rows.')
          return
        }
        setParsedRows(rows)
      } catch {
        setParseError('Failed to parse the CSV file. Please check the file format.')
      }
    }
    reader.onerror = () => {
      setParseError('Failed to read the file.')
    }
    reader.readAsText(file)
  }

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  async function handleImport() {
    if (parsedRows.length === 0) return

    setImporting(true)
    setImportError(null)
    setImportResult(null)
    setProgress({ current: 0, total: parsedRows.length })

    const result: ImportResult = {
      totalRows: parsedRows.length,
      imported: 0,
      validationSkipped: 0,
      duplicateSkipped: 0,
      validationErrors: [],
      duplicateRows: [],
    }

    const today = new Date().toISOString().split('T')[0]

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      const rowNumber = i + 1

      setProgress({ current: i + 1, total: parsedRows.length })

      // 1. Validate
      const errors = validateRow(row, rowNumber)
      if (errors.length > 0) {
        result.validationSkipped++
        result.validationErrors.push({ row: rowNumber, errors })
        continue
      }

      // 2. Duplicate check
      const name = row['name'].trim()
      const phone = (row['phone'] ?? '').trim()

      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('name', name)
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        result.duplicateSkipped++
        result.duplicateRows.push(rowNumber)
        continue
      }

      // 3. Insert client
      const clientId = generateUUID()
      const { error: clientError } = await supabase.from('clients').insert({
        id: clientId,
        name,
        phone: phone || null,
        email: row['email']?.trim() || null,
        location_text: row['location_text'].trim(),
        gps_lat: row['gps_lat'] ? Number(row['gps_lat']) : null,
        gps_lng: row['gps_lng'] ? Number(row['gps_lng']) : null,
        service_frequency: row['service_frequency'].trim(),
        monthly_rate: Number(row['monthly_rate']),
        zone: row['zone']?.trim() || null,
        created_at: new Date().toISOString(),
      })

      if (clientError) {
        result.validationSkipped++
        result.validationErrors.push({
          row: rowNumber,
          errors: [{ row: rowNumber, field: 'insert', message: clientError.message }],
        })
        continue
      }

      // 4. Create active contract
      const { error: contractError } = await supabase.from('contracts').insert({
        id: generateUUID(),
        client_id: clientId,
        status: 'active',
        monthly_rate: Number(row['monthly_rate']),
        billing_cycle: 'monthly',
        start_date: today,
        billing_model: 'flat',
      })

      if (contractError) {
        // Client was inserted but contract failed — still count as imported
        // but note the contract error in validation errors
        result.validationErrors.push({
          row: rowNumber,
          errors: [
            {
              row: rowNumber,
              field: 'contract',
              message: `Client imported but contract creation failed: ${contractError.message}`,
            },
          ],
        })
      }

      result.imported++
    }

    setImporting(false)
    setProgress(null)
    setImportResult(result)
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  function handleReset() {
    setFileName(null)
    setParsedRows([])
    setParseError(null)
    setImportResult(null)
    setImportError(null)
    setProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Import Clients from CSV</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Bulk-import clients and their contracts from a CSV file
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/clients')}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 focus:outline-none focus:underline"
        >
          ← Back to clients
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <p className="font-semibold mb-1">Expected CSV columns</p>
        <p className="font-mono text-xs text-blue-700">
          name, phone, email, location_text, gps_lat, gps_lng, service_frequency, monthly_rate, zone
        </p>
        <p className="mt-2 text-xs">
          Required: <span className="font-medium">name, location_text, service_frequency, monthly_rate</span>.
          Monthly rate must be between 3,000 and 750,000 UGX.
        </p>
      </div>

      {/* File upload */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <label className="block text-sm font-medium text-gray-700" htmlFor="csv-file-input">
          Select CSV file
        </label>
        <div className="flex items-center gap-3">
          <input
            id="csv-file-input"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={importing}
            className="block text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none disabled:opacity-50"
            aria-label="Upload CSV file"
          />
          {fileName && (
            <span className="text-sm text-gray-500 truncate max-w-xs" title={fileName}>
              {fileName}
            </span>
          )}
        </div>

        {parseError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            {parseError}
          </div>
        )}
      </div>

      {/* Preview */}
      {parsedRows.length > 0 && !importResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Preview — first 5 rows ({parsedRows.length} total)
            </h3>
          </div>
          <PreviewTable rows={parsedRows} />

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Import {parsedRows.length.toLocaleString()} rows
            </button>
            <button
              onClick={handleReset}
              disabled={importing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {importing && progress && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Importing row {progress.current} of {progress.total}…
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-200"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Import progress: ${progressPct}%`}
            />
          </div>
          <p className="text-xs text-gray-500">{progressPct}% complete</p>
        </div>
      )}

      {/* Import error */}
      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Import failed: {importError}
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Import complete</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
              >
                Import another file
              </button>
              <button
                onClick={() => navigate('/dashboard/clients')}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                View clients
              </button>
            </div>
          </div>
          <ImportSummary result={importResult} />
        </div>
      )}
    </div>
  )
}
