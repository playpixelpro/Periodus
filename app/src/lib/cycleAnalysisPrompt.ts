/**
 * Builds structured on-device AI prompts for cycle analysis.
 *
 * Gemini Nano runs locally on the device — no data ever leaves the phone.
 * These prompts are deliberately concise (the model has a limited context
 * window of ~2 048 tokens) and privacy-neutral (no names or identifiers).
 */

import type { CycleWindowStatistics } from '../engine/stats'
import type { PersonalizedPrediction } from '../engine/predictionContext'
import type { PatternInsight } from '../engine/patterns'

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export interface CycleAnalysisInput {
  stats6: CycleWindowStatistics | null
  stats12: CycleWindowStatistics | null
  prediction: PersonalizedPrediction | null
  patterns: PatternInsight[]
  /** Primary goal: 'cycle' | 'ttc' | 'pregnancy' | 'peri' */
  goal: string
}

/**
 * Build the on-device analysis prompt from cycle data.
 * Returns a compact, factual prompt that fits within ~1 000 tokens.
 */
export function buildCycleAnalysisPrompt(input: CycleAnalysisInput): string {
  const lines: string[] = []

  lines.push(
    'You are a private health assistant running entirely on this device.',
    'Analyse the following menstrual cycle data and provide a short, plain-language summary.',
    'Be factual, supportive, and always recommend consulting a healthcare provider for medical concerns.',
    'Do not mention brand names or apps. Limit your response to 150–200 words.',
    '',
  )

  // --- Goal ---
  const goalLabel: Record<string, string> = {
    cycle: 'general cycle tracking',
    ttc: 'trying to conceive',
    pregnancy: 'pregnancy',
    peri: 'perimenopause',
  }
  lines.push(`User goal: ${goalLabel[input.goal] ?? input.goal}`)
  lines.push('')

  // --- Stats ---
  if (input.stats6 && input.stats6.sampleSize >= 2) {
    const s = input.stats6
    lines.push('Recent cycle statistics (last 6 cycles):')
    if (s.averageDays != null) lines.push(`  Average cycle length: ${s.averageDays} days`)
    if (s.medianDays != null) lines.push(`  Median: ${s.medianDays} days`)
    if (s.shortestDays != null && s.longestDays != null) {
      lines.push(`  Range: ${s.shortestDays}–${s.longestDays} days`)
    }
    if (s.trendDirection !== 'insufficient-data') {
      lines.push(`  Trend: cycles are getting ${s.trendDirection}`)
    }
  } else if (input.stats12 && input.stats12.sampleSize >= 2) {
    const s = input.stats12
    lines.push('Cycle statistics (last 12 cycles):')
    if (s.averageDays != null) lines.push(`  Average cycle length: ${s.averageDays} days`)
    if (s.trendDirection !== 'insufficient-data') {
      lines.push(`  Trend: cycles are getting ${s.trendDirection}`)
    }
  } else {
    lines.push('Cycle statistics: insufficient history (fewer than 2 completed cycles).')
  }
  lines.push('')

  // --- Prediction ---
  if (input.prediction) {
    const { prediction, eligibility, evidenceMode } = input.prediction
    if (eligibility.periodForecast && prediction.nextPeriodStart) {
      lines.push(`Next period estimate: ${prediction.nextPeriodStart} (±${prediction.uncertaintyDays} days)`)
    }
    if (eligibility.ovulationForecast && prediction.ovulationDate) {
      lines.push(`Estimated ovulation: ${prediction.ovulationDate}`)
    }
    if (eligibility.fertileWindow && prediction.fertileWindow) {
      lines.push(
        `Fertile window: ${prediction.fertileWindow.start} to ${prediction.fertileWindow.end}`,
      )
    }
    lines.push(`Prediction confidence: ${evidenceMode.replace(/-/g, ' ')}`)
  }
  lines.push('')

  // --- Patterns (top 3 only to stay within token budget) ---
  const topPatterns = input.patterns.slice(0, 3)
  if (topPatterns.length > 0) {
    lines.push('Detected patterns:')
    for (const pattern of topPatterns) {
      lines.push(`  - ${pattern.title}: ${pattern.summary} (confidence: ${pattern.confidence})`)
    }
  } else {
    lines.push('No recurring patterns detected yet (more data needed).')
  }
  lines.push('')

  lines.push(
    'Please provide:',
    '1. A brief summary of what this data suggests about this cycle.',
    '2. One or two practical observations the person might find useful.',
    '3. If anything looks irregular, mention it gently and suggest discussing with a doctor.',
  )

  return lines.join('\n')
}
