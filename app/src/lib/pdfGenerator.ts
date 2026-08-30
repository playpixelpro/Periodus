/**
 * Built-in PDF generation for Periodus cycle & doctor reports.
 *
 * Generates structured, beautifully formatted clinical PDF documents client-side
 * using jsPDF and exports them directly via system file sharing (Share sheet / Save to files)
 * or direct file download — without triggering the browser's print dialog.
 */

import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { jsPDF } from 'jspdf'
import type { CycleReport } from '../engine/patterns'
import type { CompletedCycle, CycleWindowStatistics } from '../engine/stats'
import { addDays } from '../engine/cycle'
import { formatShort, localToday } from './dates'

// ---------------------------------------------------------------------------
// File sharing / download helper
// ---------------------------------------------------------------------------

export async function shareOrDownloadPdf(filename: string, pdfBlob: Blob): Promise<void> {
  // 1. Native Capacitor (Android & iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string
          const base64 = res.split(',')[1] ?? res
          resolve(base64)
        }
        reader.onerror = reject
      })
      reader.readAsDataURL(pdfBlob)
      const base64Data = await base64Promise

      const fileResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      })

      await Share.share({
        title: filename,
        url: fileResult.uri,
        dialogTitle: 'Save or Share PDF Report',
      })
      return
    } catch (e) {
      console.warn('Native PDF share failed, falling back:', e)
    }
  }

  // 2. Desktop / Modern Browser File System Access API (Save As dialog)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: unknown) => Promise<{
          createWritable: () => Promise<{
            write: (data: unknown) => Promise<void>
            close: () => Promise<void>
          }>
        }>
      }).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'PDF Document (*.pdf)',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(pdfBlob)
      await writable.close()
      return
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }

  // 3. Web Share API fallback
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

  // 4. Fallback: trigger direct file download
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
// Vector Logo Renderer (Draws Periodus Moonseed / Crescent badge)
// ---------------------------------------------------------------------------

function drawPeriodusLogo(doc: jsPDF, x: number, y: number, size = 18) {
  const radius = size / 2
  const cx = x + radius
  const cy = y + radius

  // Outer dark obsidian badge background
  doc.setFillColor(25, 21, 14) // #19150E
  doc.roundedRect(x, y, size, size, 3.5, 3.5, 'F')

  // Luxury Gold Outline
  doc.setDrawColor(217, 168, 65) // #D9A841
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, size, size, 3.5, 3.5, 'S')

  // Golden Crescent Outer Body
  doc.setFillColor(255, 225, 163) // #FFE1A3
  doc.circle(cx - size * 0.05, cy, size * 0.28, 'F')

  // Inner cutout to sculpt the crescent
  doc.setFillColor(25, 21, 14) // matches background
  doc.circle(cx + size * 0.1, cy - size * 0.04, size * 0.24, 'F')

  // Golden Moonseed Starlet
  doc.setFillColor(255, 225, 163)
  doc.circle(cx + size * 0.16, cy + size * 0.14, size * 0.08, 'F')
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
  dateRangeLabel?: string
}

export function generateCycleReportPdf(input: CycleReportPdfInput): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Design Tokens (Obsidian Dark Gold & Clinical Precision)
  const goldPrimary = [196, 148, 52] // #C49434
  const goldLight = [245, 230, 195] // #F5E6C3
  const textDark = [30, 26, 20] // #1E1A14
  const textMuted = [110, 100, 85] // #6E6455
  const borderLight = [228, 220, 205] // #E4DCCD
  const cardBg = [252, 250, 245] // #FCFAF5
  const cardBorder = [235, 225, 210] // #EBE1D2

  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin - 15) {
      drawFooter()
      doc.addPage()
      y = margin + 4
      drawHeaderContinuation()
    }
  }

  function drawFooter() {
    const footerY = pageHeight - 14
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2])
    doc.setLineWidth(0.3)
    doc.line(margin, footerY - 3, margin + contentWidth, footerY - 3)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
    doc.text(
      'Confidential Personal Health Record · Generated on-device by Periodus · Not a medical diagnosis',
      margin,
      footerY + 1,
    )
    doc.text(
      `Page ${doc.getNumberOfPages()}`,
      margin + contentWidth,
      footerY + 1,
      { align: 'right' },
    )
  }

  function drawHeaderContinuation() {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
    doc.text('PERIODUS CLINICAL REPORT (CONTINUED)', margin, y)
    y += 6
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2])
    doc.setLineWidth(0.3)
    doc.line(margin, y, margin + contentWidth, y)
    y += 6
  }

  // ==========================================
  // 1. TOP HEADER & LOGO
  // ==========================================
  const logoSize = 18
  const logoX = margin + contentWidth - logoSize
  const logoY = y

  // Draw Logo in Upper Right
  drawPeriodusLogo(doc, logoX, logoY, logoSize)

  // Top Left Brand & Document Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
  doc.text('PERIODUS', margin, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text('CLINICAL & CYCLE HEALTH SUMMARY', margin, y + 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
  doc.text('Private On-Device Health Telemetry · Client-Reported Data', margin, y + 17)

  y += 24

  // Gold Horizontal Decorative Divider
  doc.setDrawColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
  doc.setLineWidth(0.6)
  doc.line(margin, y, margin + contentWidth, y)
  y += 6

  // Meta Details Bar
  const todayStr = formatShort(localToday())
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])

  const metaLeft = `Generated: ${todayStr}${input.dateRangeLabel ? `  ·  Span: ${input.dateRangeLabel}` : ''}`
  doc.text(metaLeft, margin, y)

  if (input.userDisplayName) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text(`Patient Profile: ${input.userDisplayName}`, margin + contentWidth, y, { align: 'right' })
  }
  y += 8

  // ==========================================
  // 2. EXECUTIVE CYCLE STATISTICS (3 CARDS)
  // ==========================================
  checkPageBreak(38)

  const cycleLengths = input.cycles.map((c) => (typeof c === 'number' ? c : c.length))
  const avgDays =
    input.report.averageCycleDays ??
    input.stats6?.averageDays ??
    (cycleLengths.length > 0 ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) : null)

  const shortest =
    input.report.shortestCycleDays ??
    input.stats6?.shortestDays ??
    (cycleLengths.length > 0 ? Math.min(...cycleLengths) : null)

  const longest =
    input.report.longestCycleDays ??
    input.stats6?.longestDays ??
    (cycleLengths.length > 0 ? Math.max(...cycleLengths) : null)

  const avgBleed = input.report.averageBleedingDays ?? input.report.bleedingTrend?.averageDays ?? 5

  const cardWidth = (contentWidth - 6) / 3
  const cardHeight = 24

  // Card 1: Average Cycle Length
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'F')
  doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
  doc.setLineWidth(0.3)
  doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
  doc.text('AVERAGE CYCLE LENGTH', margin + 4, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text(avgDays ? `${avgDays} days` : 'N/A', margin + 4, y + 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
  doc.text(
    shortest && longest ? `Range: ${shortest}–${longest} days` : 'Baseline estimation',
    margin + 4,
    y + 20,
  )

  // Card 2: Recorded History
  const card2X = margin + cardWidth + 3
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
  doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, 'F')
  doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
  doc.text('COMPLETED CYCLES', card2X + 4, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text(`${cycleLengths.length} logged`, card2X + 4, y + 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
  const variation = shortest && longest ? Math.abs(longest - shortest) : 0
  doc.text(
    variation <= 3 ? 'Steadily regular rhythm' : variation <= 7 ? 'Moderate cycle variation' : 'Higher variation window',
    card2X + 4,
    y + 20,
  )

  // Card 3: Typical Period Duration
  const card3X = margin + (cardWidth + 3) * 2
  doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
  doc.roundedRect(card3X, y, cardWidth, cardHeight, 2, 2, 'F')
  doc.roundedRect(card3X, y, cardWidth, cardHeight, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
  doc.text('PERIOD BLEEDING DURATION', card3X + 4, y + 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text(avgBleed ? `${avgBleed} days` : '5 days', card3X + 4, y + 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
  doc.text('Mean self-reported flow', card3X + 4, y + 20)

  y += cardHeight + 8

  // ==========================================
  // 3. RECENT CYCLES BREAKDOWN TABLE
  // ==========================================
  if (input.cycles.length > 0) {
    checkPageBreak(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text('Recent Cycle Log History', margin, y)
    y += 5

    // Table Header
    doc.setFillColor(goldLight[0], goldLight[1], goldLight[2])
    doc.rect(margin, y, contentWidth, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text('CYCLE #', margin + 3, y + 4.2)
    doc.text('START DATE', margin + 28, y + 4.2)
    doc.text('END DATE', margin + 68, y + 4.2)
    doc.text('LENGTH', margin + 110, y + 4.2)
    doc.text('STATUS', margin + contentWidth - 4, y + 4.2, { align: 'right' })
    y += 6

    const recentCompleted = input.cycles.slice(-6).reverse()
    recentCompleted.forEach((cycle, idx) => {
      checkPageBreak(7)
      const isAlt = idx % 2 === 1
      if (isAlt) {
        doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
        doc.rect(margin, y, contentWidth, 5.5, 'F')
      }

      const cycleNum = input.cycles.length - idx
      const len = typeof cycle === 'number' ? cycle : cycle.length
      const start = typeof cycle === 'number' ? '—' : formatShort(cycle.start)
      const end = typeof cycle === 'number' ? '—' : formatShort(addDays(cycle.start, cycle.length))

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(textDark[0], textDark[1], textDark[2])
      doc.text(`#${cycleNum}`, margin + 3, y + 4)

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
      doc.text(start, margin + 28, y + 4)
      doc.text(end, margin + 68, y + 4)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(textDark[0], textDark[1], textDark[2])
      doc.text(`${len} days`, margin + 110, y + 4)

      const diff = avgDays ? len - avgDays : 0
      const diffLabel = diff === 0 ? 'Exact average' : diff > 0 ? `+${diff}d vs avg` : `${diff}d vs avg`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
      doc.text(diffLabel, margin + contentWidth - 4, y + 4, { align: 'right' })

      y += 5.5
    })
    y += 5
  }

  // ==========================================
  // 4. TOP SYMPTOMS & DAILY SIGNALS (2-COLUMN GRID)
  // ==========================================
  const topSignals = input.report.topSignals ?? []
  if (topSignals.length > 0) {
    checkPageBreak(35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text('Most Frequently Logged Symptoms & Events', margin, y)
    y += 5

    const colWidth = (contentWidth - 6) / 2
    const items = topSignals.slice(0, 8)
    const rowCount = Math.ceil(items.length / 2)

    for (let r = 0; r < rowCount; r++) {
      checkPageBreak(8)
      for (let c = 0; c < 2; c++) {
        const itemIdx = r * 2 + c
        if (itemIdx >= items.length) continue
        const item = items[itemIdx]
        const itemX = margin + c * (colWidth + 6)

        doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
        doc.roundedRect(itemX, y, colWidth, 6.5, 1.5, 1.5, 'F')
        doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
        doc.setLineWidth(0.2)
        doc.roundedRect(itemX, y, colWidth, 6.5, 1.5, 1.5, 'S')

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(textDark[0], textDark[1], textDark[2])
        doc.text(`• ${item.name}`, itemX + 3, y + 4.3)

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
        doc.text(`${item.count} days`, itemX + colWidth - 3, y + 4.3, { align: 'right' })
      }
      y += 8
    }
    y += 3
  }

  // ==========================================
  // 5. FERTILITY & OVULATION OBSERVATIONS
  // ==========================================
  const fertilitySignals = input.report.fertilitySignals ?? []
  const bbtCount = fertilitySignals.filter((p) => p.bbtCelsius != null).length
  const opkPositiveCount = fertilitySignals.filter((p) => p.opk === 'positive').length

  if (bbtCount > 0 || opkPositiveCount > 0) {
    checkPageBreak(26)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text('Ovulation & Biomarker Observations', margin, y)
    y += 5

    doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F')
    doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2])
    doc.text('Basal Body Temperature (BBT) readings:', margin + 4, y + 5.5)
    doc.text('Positive LH / Ovulation Surge Tests:', margin + 4, y + 10.5)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text(`${bbtCount} logged entries`, margin + 80, y + 5.5)
    doc.text(`${opkPositiveCount} positive surge days`, margin + 80, y + 10.5)

    y += 18
  }

  // ==========================================
  // 6. OBSERVED PATTERNS & CLINICAL ASSOCIATIONS
  // ==========================================
  const patterns = input.report.patterns ?? []
  if (patterns.length > 0) {
    checkPageBreak(28)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(textDark[0], textDark[1], textDark[2])
    doc.text('Detected Patterns & Phase Associations', margin, y)
    y += 5

    patterns.slice(0, 4).forEach((p) => {
      checkPageBreak(20)
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2])
      doc.setDrawColor(cardBorder[0], cardBorder[1], cardBorder[2])
      doc.setLineWidth(0.3)

      const splitSummary = doc.splitTextToSize(p.summary, contentWidth - 10)
      const boxHeight = 12 + splitSummary.length * 4

      doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'F')
      doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'S')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(goldPrimary[0], goldPrimary[1], goldPrimary[2])
      doc.text(`✦  ${p.title}`, margin + 4, y + 5.5)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(textDark[0], textDark[1], textDark[2])
      doc.text(splitSummary, margin + 4, y + 10.5)

      y += boxHeight + 4
    })
  }

  // ==========================================
  // 7. CLINICIAN CONSULTATION NOTES AREA
  // ==========================================
  checkPageBreak(28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(textDark[0], textDark[1], textDark[2])
  doc.text('Healthcare Provider Consultation Notes', margin, y)
  y += 4

  doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2])
  doc.setLineWidth(0.25)
  for (let l = 0; l < 4; l++) {
    doc.line(margin, y + 5 + l * 5.5, margin + contentWidth, y + 5 + l * 5.5)
  }
  y += 28

  // Draw Final Page Footer
  drawFooter()

  return doc.output('blob')
}
