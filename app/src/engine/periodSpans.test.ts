import { describe, expect, it } from 'vitest'
import { calculatePeriodSpans, type DailyLog } from '../db/schema'

describe('calculatePeriodSpans', () => {
  it('projects menstruation days based on user typical length when no periodEnd is set', () => {
    const logs: DailyLog[] = [
      { date: '2026-09-01', flow: 'medium' },
    ]
    const spans = calculatePeriodSpans(logs, 5)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      isConfirmedEnd: false,
      dates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    })
  })

  it('locks span to explicit periodEnd when period concluded early', () => {
    const logs: DailyLog[] = [
      { date: '2026-09-01', flow: 'heavy' },
      { date: '2026-09-02', flow: 'medium' },
      { date: '2026-09-03', flow: 'light', periodEnd: true },
    ]
    const spans = calculatePeriodSpans(logs, 5)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      isConfirmedEnd: true,
      dates: ['2026-09-01', '2026-09-02', '2026-09-03'],
    })
  })

  it('extends span to explicit periodEnd when period lasts longer than typical length', () => {
    const logs: DailyLog[] = [
      { date: '2026-09-01', flow: 'medium' },
      { date: '2026-09-07', flow: 'light', periodEnd: true },
    ]
    const spans = calculatePeriodSpans(logs, 5)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      isConfirmedEnd: true,
      dates: [
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05',
        '2026-09-06',
        '2026-09-07',
      ],
    })
  })

  it('handles multiple cycles and associates ends with the appropriate cycle start', () => {
    const logs: DailyLog[] = [
      // Cycle 1: Aug 1 - Aug 4
      { date: '2026-08-01', flow: 'heavy' },
      { date: '2026-08-04', flow: 'light', periodEnd: true },
      // Cycle 2: Aug 30 - Ongoing (user length 4)
      { date: '2026-08-30', flow: 'medium' },
    ]
    const spans = calculatePeriodSpans(logs, 4)
    expect(spans).toHaveLength(2)
    expect(spans[0]).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-04',
      isConfirmedEnd: true,
      dates: ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'],
    })
    expect(spans[1]).toEqual({
      startDate: '2026-08-30',
      endDate: '2026-09-02',
      isConfirmedEnd: false,
      dates: ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'],
    })
  })

  it('respects explicit periodStart flag even without flow', () => {
    const logs: DailyLog[] = [
      { date: '2026-09-10', periodStart: true },
    ]
    const spans = calculatePeriodSpans(logs, 3)
    expect(spans).toHaveLength(1)
    expect(spans[0].startDate).toBe('2026-09-10')
    expect(spans[0].endDate).toBe('2026-09-12')
    expect(spans[0].dates).toEqual(['2026-09-10', '2026-09-11', '2026-09-12'])
  })
})
