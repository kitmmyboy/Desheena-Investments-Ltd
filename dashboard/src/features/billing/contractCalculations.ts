/**
 * Pure computation functions for billing contract defaulter calculations.
 * All functions are side-effect free and depend only on their arguments.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthBreakdown {
  month: string          // YYYY-MM
  paid_amount: number
  monthly_rate: number
  status: 'paid' | 'partial' | 'unpaid'
  amount_owed: number
}

// ---------------------------------------------------------------------------
// computeContractMonths
// ---------------------------------------------------------------------------

/**
 * Returns an array of YYYY-MM strings from start_date to min(end_date, current month).
 *
 * Example: Jan 2025 to Mar 2025 → ['2025-01', '2025-02', '2025-03']
 */
export function computeContractMonths(
  startDate: string,
  endDate: string | null
): string[] {
  // Parse start as year/month (treat as first of month in UTC to avoid timezone shifts)
  const [startYear, startMonth] = startDate.split('-').map(Number)

  // Determine the upper bound: min(end_date, current month)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-based

  let endYear: number
  let endMonth: number

  if (endDate) {
    const [ey, em] = endDate.split('-').map(Number)
    // Use the earlier of end_date and current month
    if (ey < currentYear || (ey === currentYear && em <= currentMonth)) {
      endYear = ey
      endMonth = em
    } else {
      endYear = currentYear
      endMonth = currentMonth
    }
  } else {
    endYear = currentYear
    endMonth = currentMonth
  }

  const months: string[] = []
  let year = startYear
  let month = startMonth

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const mm = String(month).padStart(2, '0')
    months.push(`${year}-${mm}`)

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return months
}

// ---------------------------------------------------------------------------
// computeExpectedTotal
// ---------------------------------------------------------------------------

/**
 * Returns months.length * monthlyRate.
 */
export function computeExpectedTotal(months: string[], monthlyRate: number): number {
  return months.length * monthlyRate
}

// ---------------------------------------------------------------------------
// computeOutstandingBalance
// ---------------------------------------------------------------------------

/**
 * Returns expectedTotal - amountPaid.
 */
export function computeOutstandingBalance(expectedTotal: number, amountPaid: number): number {
  return expectedTotal - amountPaid
}

// ---------------------------------------------------------------------------
// computeMonthBreakdown
// ---------------------------------------------------------------------------

/**
 * For each month in the months array, finds the matching invoice by invoice_period
 * and determines the payment status.
 *
 * - paid_amount >= monthly_rate → status: 'paid', amount_owed: 0
 * - 0 < paid_amount < monthly_rate → status: 'partial', amount_owed: monthly_rate - paid_amount
 * - no invoice or paid_amount === 0 → status: 'unpaid', amount_owed: monthly_rate
 */
export function computeMonthBreakdown(
  months: string[],
  monthlyRate: number,
  invoices: Array<{ invoice_period: string | null; paid_amount: number }>
): MonthBreakdown[] {
  return months.map((month) => {
    const invoice = invoices.find((inv) => inv.invoice_period === month)
    const paidAmount = invoice?.paid_amount ?? 0

    let status: 'paid' | 'partial' | 'unpaid'
    let amountOwed: number

    if (paidAmount >= monthlyRate) {
      status = 'paid'
      amountOwed = 0
    } else if (paidAmount > 0) {
      status = 'partial'
      amountOwed = monthlyRate - paidAmount
    } else {
      status = 'unpaid'
      amountOwed = monthlyRate
    }

    return {
      month,
      paid_amount: paidAmount,
      monthly_rate: monthlyRate,
      status,
      amount_owed: amountOwed,
    }
  })
}

// ---------------------------------------------------------------------------
// computeEffectiveStatus
// ---------------------------------------------------------------------------

/**
 * Derives the effective display status for a contract.
 *
 * - If end_date is non-null AND end_date < today → 'ended'
 * - Otherwise → stored status value
 */
export function computeEffectiveStatus(
  status: string,
  endDate: string | null,
  today: Date
): 'active' | 'suspended' | 'terminated' | 'ended' {
  if (endDate !== null) {
    // Compare date strings: end_date is YYYY-MM-DD or YYYY-MM
    // Normalise today to YYYY-MM-DD for comparison
    const todayStr = today.toISOString().split('T')[0]
    if (endDate < todayStr) {
      return 'ended'
    }
  }
  return status as 'active' | 'suspended' | 'terminated'
}

// ---------------------------------------------------------------------------
// computeDurationMonths
// ---------------------------------------------------------------------------

/**
 * Computes the number of calendar months a contract spans (inclusive).
 *
 * end = end_date ?? first day of current month
 * months = (end.year - start.year) * 12 + (end.month - start.month) + 1
 *
 * Always returns at least 1.
 */
export function computeDurationMonths(
  startDate: string,
  endDate: string | null
): number {
  const [startYear, startMonth] = startDate.split('-').map(Number)

  let endYear: number
  let endMonth: number

  if (endDate) {
    const [ey, em] = endDate.split('-').map(Number)
    endYear = ey
    endMonth = em
  } else {
    const now = new Date()
    endYear = now.getFullYear()
    endMonth = now.getMonth() + 1 // 1-based
  }

  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1
  return Math.max(1, months)
}
