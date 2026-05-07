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
  const [year, month] = period.split('-')
  if (!year || !month) return period
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-UG', { year: 'numeric', month: 'long' })
}
