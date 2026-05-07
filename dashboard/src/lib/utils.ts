export function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatPeriod(period: string | null): string {
  if (!period) return '—'
  // Handles both "YYYY-MM" and "YYYY-MM-DD" formats
  const parts = period.split('-')
  const year = parts[0]
  const month = parts[1]
  if (!year || !month) return period
  const date = new Date(Number(year), Number(month) - 1, 1)
  if (isNaN(date.getTime())) return period
  return date.toLocaleDateString('en-UG', { year: 'numeric', month: 'long' })
}
