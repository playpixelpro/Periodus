import { describe, expect, it } from 'vitest'
import { generateCycleReportPdf } from './pdfGenerator'
import type { CycleReport } from '../engine/patterns'

function mockReport(overrides: Partial<CycleReport> = {}): CycleReport {
  return {
    generatedOn: '2026-08-30',
    completedCycleCount: 3,
    averageCycleDays: 28,
    shortestCycleDays: 27,
    longestCycleDays: 29,
    averageBleedingDays: 5,
    loggedDaysLast90: 60,
    trackingCoverageLast90: 0.67,
    topSignals: [
      { name: 'Cramps', count: 4 },
      { name: 'Headache', count: 2 },
    ],
    cycleWindows: {
      six: {
        windowCycles: 6,
        sampleSize: 3,
        averageDays: 28,
        medianDays: 28,
        shortestDays: 27,
        longestDays: 29,
        rangeDays: 2,
        trendDaysPerCycle: 0,
        trendDirection: 'stable',
        methodology: 'Sample methodology',
      },
      twelve: {
        windowCycles: 12,
        sampleSize: 3,
        averageDays: 28,
        medianDays: 28,
        shortestDays: 27,
        longestDays: 29,
        rangeDays: 2,
        trendDaysPerCycle: 0,
        trendDirection: 'stable',
        methodology: 'Sample methodology',
      },
    },
    bleedingTrend: {
      episodes: [],
      sampleSize: 0,
      averageDays: 5,
      averageKnownFlowDays: 5,
      latestDays: 5,
      lengthTrendDaysPerEpisode: 0,
      direction: 'stable',
      methodology: 'Sample bleeding trend methodology',
    },
    completeness: {
      windowDays: 90,
      daysWithAnyEntry: 60,
      completeCheckInDays: 45,
      entryCoveragePercent: 67,
      completeCoveragePercent: 50,
      phaseComparisonReady: true,
      methodology: 'Sample completeness methodology',
    },
    symptomPhaseSummaries: [],
    fertilitySignals: [
      { date: '2026-08-01', cycleStart: '2026-08-01', cycleDay: 1, bbtCelsius: 36.6 },
      { date: '2026-08-05', cycleStart: '2026-08-01', cycleDay: 5, opk: 'positive' },
    ],
    patterns: [
      {
        id: 'luteal-cramps',
        kind: 'phase-association',
        signal: 'Cramps',
        title: 'Premenstrual cramping',
        summary: 'Cramps often occur in the luteal phase.',
        confidence: 'developing',
        evidence: { occurrences: 3, cyclesObserved: 3, loggedDaysCompared: 12 },
        explanation: 'Observed repeatedly in recent cycles.',
      },
    ],
    methodology: 'Cycle statistics use completed cycles.',
    ...overrides,
  }
}

describe('generateCycleReportPdf', () => {
  it('generates a valid PDF blob from cycle data', () => {
    const blob = generateCycleReportPdf({
      report: mockReport(),
      cycles: [28, 29, 27],
      userDisplayName: 'Alex',
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)
  })

  it('handles empty cycle reports gracefully', () => {
    const blob = generateCycleReportPdf({
      report: mockReport({
        completedCycleCount: 0,
        averageCycleDays: null,
        shortestCycleDays: null,
        longestCycleDays: null,
        topSignals: [],
        fertilitySignals: [],
        patterns: [],
        methodology: 'Insufficient data.',
      }),
      cycles: [],
    })

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(500)
  })
})
