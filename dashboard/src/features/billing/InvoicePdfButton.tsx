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
  const isPaid = invoice.status === 'paid'
  const title = isPaid ? 'RECEIPT' : 'INVOICE'
  const paidAmount = invoice.paid_amount ?? 0
  const balance = Math.max(0, invoice.amount - paidAmount)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title} ${invoice.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #333; }
    .header { border-bottom: 2px solid #2E7D32; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; color: #2E7D32; }
    .company-details { font-size: 13px; color: #555; margin-top: 6px; line-height: 1.6; }
    .invoice-title { font-size: 24px; font-weight: bold; margin: 20px 0; color: #222; text-align: right; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin: 30px 0; }
    .detail-block { display: flex; flex-direction: column; margin-bottom: 12px; }
    .label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold; }
    .value { font-size: 14px; color: #111; margin-top: 2px; }
    .amount-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    .amount-table th { background: #f9f9f9; padding: 12px; text-align: left; border-bottom: 2px solid #eee; font-size: 12px; color: #555; text-transform: uppercase; }
    .amount-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    .summary-row td { padding: 8px 12px; text-align: right; border: none; }
    .summary-row .total-label { font-weight: bold; color: #555; }
    .summary-row .total-value { font-weight: bold; color: #111; font-size: 16px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
    .status-paid { background: #e8f5e9; color: #2E7D32; border: 1px solid #c8e6c9; }
    .status-unpaid { background: #fff8e1; color: #f57f17; border: 1px solid #ffecb3; }
    .status-overdue { background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
    .payment-instructions { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; border: 1px solid #eee; }
    .payment-instructions h3 { margin: 0 0 10px 0; font-size: 13px; color: #333; text-transform: uppercase; }
    .payment-instructions p { margin: 0; font-size: 13px; color: #666; line-height: 1.6; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 50px; text-align: center; color: #999; font-size: 11px; }
    @media print { body { margin: 20px; } .payment-instructions { background: white !important; border: 1px solid #ddd; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div class="company-name">Desheena Investments Ltd</div>
        <div class="company-details">
          Plot 45, Mawanda Road, Kampala<br />
          Tel: +256 700 123456 | +256 772 123456<br />
          Email: payments@desheena.click
        </div>
      </div>
      <div class="invoice-title">${title}</div>
    </div>
  </div>

  <div class="details-grid">
    <div>
      <div class="detail-block">
        <span class="label">Bill To</span>
        <span class="value" style="font-weight: bold; font-size: 16px;">${clientName}</span>
      </div>
      <div class="detail-block">
        <span class="label">Phone Number</span>
        <span class="value">${clientPhone}</span>
      </div>
    </div>
    <div style="text-align: right;">
      <div class="detail-block" style="align-items: flex-end;">
        <span class="label">${title} #</span>
        <span class="value" style="font-family: monospace;">${invoice.id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="detail-block" style="align-items: flex-end;">
        <span class="label">Period</span>
        <span class="value">${formatPeriod(invoice.invoice_period)}</span>
      </div>
      <div class="detail-block" style="align-items: flex-end;">
        <span class="label">Date</span>
        <span class="value">${formatDate(new Date().toISOString())}</span>
      </div>
      <div class="detail-block" style="align-items: flex-end;">
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
        <th style="width: 70%;">Service Description</th>
        <th style="text-align: right;">Amount (UGX)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 20px 12px;">
          <strong>Waste Collection Services</strong><br/>
          <span style="font-size: 12px; color: #666;">Service for the month of ${formatPeriod(invoice.invoice_period)}</span>
        </td>
        <td style="text-align: right; padding: 20px 12px; vertical-align: top;">${formatCurrency(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end;">
    <table style="width: 300px;">
      <tr class="summary-row">
        <td class="total-label">Subtotal:</td>
        <td>${formatCurrency(invoice.amount)}</td>
      </tr>
      <tr class="summary-row">
        <td class="total-label">Amount Paid:</td>
        <td style="color: #2E7D32;">(-) ${formatCurrency(paidAmount)}</td>
      </tr>
      <tr class="summary-row" style="border-top: 2px solid #eee;">
        <td class="total-label total-value">Balance Due:</td>
        <td class="total-value" style="${balance > 0 ? 'color: #c62828;' : 'color: #2E7D32;'}">${formatCurrency(balance)}</td>
      </tr>
    </table>
  </div>

  ${!isPaid ? `
  <div class="payment-instructions">
    <h3>Payment Methods</h3>
    <p><strong>Mobile Money:</strong> Pay to Merchant Code: 123456 (Desheena)<br/>
    <strong>Bank Transfer:</strong> Stanbic Bank, A/C: 9030012345678, Branch: Forest Mall</p>
    <p style="margin-top: 8px; font-style: italic;">Please use Invoice # ${invoice.id.slice(0, 8).toUpperCase()} as payment reference.</p>
  </div>
  ` : `
  <div class="payment-instructions" style="background: #e8f5e9; border-color: #c8e6c9;">
    <h3>Payment Confirmation</h3>
    <p>This document serves as a formal receipt for the payment of ${formatCurrency(paidAmount)} recorded on ${formatDate(new Date().toISOString())}. Thank you for choosing Desheena Investments Ltd.</p>
  </div>
  `}

  <div class="footer">
    <p>This is a computer-generated document. No signature required.</p>
    <p style="margin-top: 8px; font-weight: bold;">DESHEENA INVESTMENTS LTD &bull; Excellence in Waste Management</p>
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
