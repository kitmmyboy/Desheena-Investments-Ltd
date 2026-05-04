/**
 * Converts an array of row arrays to a CSV string and triggers a browser download.
 *
 * @param filename  The suggested filename for the download (e.g. "report.csv")
 * @param rows      2-D array where the first row is the header row
 */
export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]): void {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '')
          // Escape cells that contain commas, double-quotes, or newlines
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        })
        .join(',')
    )
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
