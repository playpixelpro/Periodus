import { describe, expect, it } from 'vitest'
import { generateCycleReportPdf } from './pdfGenerator'

describe('generateCycleReportPdf', () => {
  it('generates a valid PDF blob from cycle data', () => {
    const blob = generateCycleReportPdf({
      report: {
        methodology: 'Cycle statistics use completed cycles.',
        patternInsights: [
          {
            id: 'luteal-cramps',
            title: 'Premenstrual cramping',
            summary: 'Cramps often occur in the luteal phase.',
            confidence: 'moderate',
            category: 'symptom',
          },
        ],
        topSymptoms: [
          { name: 'Cramps', count: 4 },
          { name: 'Headache', count: 2 },
        ],
        fertilitySignals: [
          { date: '2026-08-01', bbtCelsius: 36.6 },
          { date: '2026-08-05', opk: 'positive' },
        ],
        phaseSummaries: [],
      },
      cycles: [28, 29, 27],
      userDisplayName: 'Alex',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)
  })

  it('handles empty cycle reports gracefully', () => {
    const blob = generateCycleReportPdf({
      report: {
        methodology: 'Insufficient data.',
        patternInsights: [],
        topSymptoms: [],
        fertilitySignals: [],
        phaseSummaries: [],
      },
      cycles: [],
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)
  })
})
