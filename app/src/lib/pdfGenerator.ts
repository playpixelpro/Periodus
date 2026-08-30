/**
 * Built-in PDF generation for Periodus cycle & doctor reports.
 *
 * Generates structured PDF documents client-side using jsPDF and exports them
 * directly via system file sharing (Share sheet / Save to files) or direct
 * file download — without triggering the browser's print dialog.
 */

import { jsPDF } from 'jspdf'
import type { CycleReport } from '../engine/patterns'
import type { CompletedCycle, CycleWindowStatistics } from '../engine/stats'
import { formatShort, localToday } from './dates'

// ---------------------------------------------------------------------------
// File sharing / download helper
// ---------------------------------------------------------------------------

export async function shareOrDownloadPdf(filename: string, pdfBlob: Blob): Promise<void> {
  const file = new File([pdfBlob], filename, { type: 'application/pdf' })

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename.replace('.pdf', ''),
      })
      return
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    }
  }

  // Fallback: trigger direct file download
  const url = URL.createObjectURL(pdfBlob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// ---------------------------------------------------------------------------
// Cycle Report PDF Builder
// ---------------------------------------------------------------------------

export interface CycleReportPdfInput {
  report: CycleReport
  cycles: (CompletedCycle | number)[]
  stats6?: CycleWindowStatistics | null
  stats12?: CycleWindowStatistics | null
  userDisplayName?: string
}

export function generateCycleReportPdf(input: CycleReportPdfInput): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Color palette (Warm dark gold & obsidian medical styling)
  const primaryColor = [217, 168, 65]
  const textColor = [35, 30, 24]
  const mutedColor = [115, 105, 90]
  const borderColor = [225, 215, 195]
  const bgLight = [250, 247, 240]

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // --- Header ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2])
  doc.text('PERIODUS', margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
  doc.text('Private On-Device Cycle Report', margin + 36, y)

  y += 7
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
  doc.setLineWidth(0.5)
  doc.line(margin, y, margin + contentWidth, y)
  y += 6

  // Meta Info
  const todayStr = formatShort(localToday())
  doc.setFontSize(9)
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
  doc.text(`Generated: ${todayStr}  |  Self-reported on-device history`, margin, y)
  if (input.userDisplayName) {
    doc.text(`Profile: ${input.userDisplayName}`, margin + contentWidth, y, { align: 'right' })
  }
  y += 8

  // --- Section: Cycle Summary ---
  checkPageBreak(35)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text('Cycle Summary & Statistics', margin, y)
  y += 6

  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2])
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
  doc.text('Completed cycles recorded:', margin + 4, y + 6)
  doc.text('Recent average length:', margin + 4, y + 12)
  doc.text('Cycle variation / range:', margin + 4, y + 18)

  const cycleLengths = input.cycles.map((c) => (typeof c === 'number' ? c : c.length))

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text(`${cycleLengths.length} cycles`, margin + 55, y + 6)

  const avg =
    input.report.averageCycleDays ??
    input.stats6?.averageDays ??
    (cycleLengths.length > 0 ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) : null)
  doc.text(avg != null ? `${avg} days` : 'Insufficient data', margin + 55, y + 12)

  const shortest = input.report.shortestCycleDays ?? input.stats6?.shortestDays ?? (cycleLengths.length > 0 ? Math.min(...cycleLengths) : null)
  const longest = input.report.longestCycleDays ?? input.stats6?.longestDays ?? (cycleLengths.length > 0 ? Math.max(...cycleLengths) : null)
  doc.text(shortest && longest ? `${shortest} – ${longest} days` : 'Insufficient data', margin + 55, y + 18)

  y += 28

  // --- Section: Top Logged Symptoms & Events ---
  checkPageBreak(30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text('Most Frequently Logged Symptoms', margin, y)
  y += 6

  const topSignals = input.report.topSignals ?? []
  if (topSignals.length > 0) {
    topSignals.slice(0, 8).forEach((item) => {
      checkPageBreak(8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.text(`•  ${item.name}`, margin + 2, y)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
      doc.text(`${item.count} days`, margin + contentWidth - 4, y, { align: 'right' })
      y += 6
    })
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
    doc.text('No symptoms or events logged during this timeframe.', margin + 2, y)
    y += 6
  }
  y += 4

  // --- Section: Fertility & Ovulation Observations ---
  checkPageBreak(28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text('Fertility Observations', margin, y)
  y += 6

  const fertilitySignals = input.report.fertilitySignals ?? []
  const bbtCount = fertilitySignals.filter((p) => p.bbtCelsius != null).length
  const opkPositiveCount = fertilitySignals.filter((p) => p.opk === 'positive').length

  doc.setFillColor(bgLight[0], bgLight[1], bgLight[2])
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
  doc.text('Basal Body Temperature readings:', margin + 4, y + 6)
  doc.text('Positive LH / Ovulation test entries:', margin + 4, y + 12)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text(`${bbtCount} logged`, margin + 70, y + 6)
  doc.text(`${opkPositiveCount} logged`, margin + 70, y + 12)

  y += 22

  // --- Section: Pattern Insights ---
  const patterns = input.report.patterns ?? []
  if (patterns.length > 0) {
    checkPageBreak(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.text('Observed Patterns & Associations', margin, y)
    y += 6

    patterns.forEach((p) => {
      checkPageBreak(18)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(textColor[0], textColor[1], textColor[2])
      doc.text(p.title, margin + 2, y)
      y += 4.5

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
      const splitSummary = doc.splitTextToSize(p.summary, contentWidth - 4)
      doc.text(splitSummary, margin + 2, y)
      y += splitSummary.length * 4.2 + 3
    })
  }

  // --- Footer / Disclaimer ---
  checkPageBreak(25)
  y = Math.max(y + 6, pageHeight - 32)
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + contentWidth, y)
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2])
  const disclaimer =
    'Methodology: Cycle statistics use completed cycles. Symptoms and associations describe self-reported observations stored on-device and do not establish medical causation or diagnosis. Bring original details and complete history to discussions with a qualified healthcare professional.'
  const splitDisclaimer = doc.splitTextToSize(disclaimer, contentWidth)
  doc.text(splitDisclaimer, margin, y)

  return doc.output('blob')
}
