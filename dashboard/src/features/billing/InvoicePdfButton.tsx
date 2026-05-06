import type { Invoice } from './useInvoices'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPeriod(period: string | null): string {
  if (!period) return '—'
  const [year, month] = period.split('-')
  if (!year || !month) return period
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-UG', { year: 'numeric', month: 'long' })
}

function getStatusLabel(status: Invoice['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getStatusClass(status: Invoice['status']): string {
  switch (status) {
    case 'paid':
      return 'status-paid'
    case 'overdue':
      return 'status-overdue'
    default:
      return 'status-unpaid'
  }
}

// ---------------------------------------------------------------------------
// Invoice HTML generation
// ---------------------------------------------------------------------------

function generateInvoiceHtml(invoice: Invoice): string {
  const clientName = invoice.clients?.name ?? 'Unknown Client'
  const clientPhone = invoice.clients?.phone ?? '—'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoice.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #333; }
    .header { border-bottom: 2px solid #2E7D32; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #2E7D32; }
    .company-details { font-size: 13px; color: #555; margin-top: 6px; line-height: 1.6; }
    .invoice-title { font-size: 20px; font-weight: bold; margin: 20px 0; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .detail-block { display: flex; flex-direction: column; }
    .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    .value { font-size: 14px; font-weight: 500; margin-top: 4px; }
    .amount-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    .amount-table th { background: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; font-size: 13px; }
    .amount-table td { padding: 10px; border: 1px solid #ddd; font-size: 14px; }
    .total-row td { font-weight: bold; background: #f9f9f9; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-paid { background: #e8f5e9; color: #2E7D32; }
    .status-unpaid { background: #fff8e1; color: #f57f17; }
    .status-overdue { background: #ffebee; color: #c62828; }
    .payment-instructions { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .payment-instructions h3 { margin: 0 0 10px 0; font-size: 14px; color: #333; }
    .payment-instructions p { margin: 0; font-size: 13px; color: #555; line-height: 1.6; }
    .footer { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">Desheena Investments Ltd</div>
    <div class="company-details">
      Kampala, Uganda<br />
      Tel: +256 700 000000<br />
      Email: info@desheena.co.ug
    </div>
  </div>

  <div class="invoice-title">INVOICE</div>

  <div class="details-grid">
    <div>
      <div class="detail-block" style="margin-bottom: 16px;">
        <span class="label">Bill To</span>
        <span class="value">${clientName}</span>
      </div>
      <div class="detail-block" style="margin-bottom: 16px;">
        <span class="label">Phone</span>
        <span class="value">${clientPhone}</span>
      </div>
    </div>
    <div>
      <div class="detail-block" style="margin-bottom: 16px;">
        <span class="label">Invoice Number</span>
        <span class="value" style="font-size: 12px; word-break: break-all;">${invoice.id}</span>
      </div>
      <div class="detail-block" style="margin-bottom: 16px;">
        <span class="label">Invoice Period</span>
        <span class="value">${formatPeriod(invoice.invoice_period)}</span>
      </div>
      <div class="detail-block" style="margin-bottom: 16px;">
        <span class="label">Due Date</span>
        <span class="value">${formatDate(invoice.due_date)}</span>
      </div>
      <div class="detail-block">
        <span class="label">Status</span>
        <span class="value">
          <span class="status-badge ${getStatusClass(invoice.status)}">${getStatusLabel(invoice.status)}</span>
        </span>
      </div>
    </div>
  </div>

  <table class="amount-table">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Waste collection services — ${formatPeriod(invoice.invoice_period)}</td>
        <td style="text-align: right;">${formatCurrency(invoice.amount)}</td>
      </tr>
      <tr class="total-row">
        <td>Total</td>
        <td style="text-align: right;">${formatCurrency(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="payment-instructions">
    <h3>Payment Instructions</h3>
    <p>Pay via Pesapal or bank transfer. Reference: ${invoice.id}</p>
  </div>

  <div class="footer">
    <p>Thank you for your business</p>
    <p style="margin-top: 8px;">Desheena Investments Ltd &mdash; Kampala, Uganda</p>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// printInvoice — opens a new window and triggers the print dialog
// ---------------------------------------------------------------------------

export function printInvoice(invoice: Invoice): void {
  const html = generateInvoiceHtml(invoice)
  const win = window.open('', '_blank')
  if (!win) {
    // Popup was blocked — inform the user
    alert('Please allow pop-ups for this site to download the invoice PDF.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.print()
}

// ---------------------------------------------------------------------------
// InvoicePdfButton component
// ---------------------------------------------------------------------------

interface InvoicePdfButtonProps {
  invoice: Invoice
}

export default function InvoicePdfButton({ invoice }: InvoicePdfButtonProps) {
  return (
    <button
      type="button"
      onClick={() => printInvoice(invoice)}
      title="Download PDF"
      aria-label={`Download PDF for invoice ${invoice.id}`}
      className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
    >
      {/* Printer / PDF icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v1a1 1 0 001 1h8a1 1 0 001-1v-1h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H6v2h8v-2h-1a1 1 0 01-1-1v-1H8v1a1 1 0 01-1 1zm7-5a1 1 0 110 2 1 1 0 010-2z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}
