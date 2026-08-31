import { describe, expect, it } from 'vitest'
import {
  parseAiArticleResponse,
  getTopicsForGoal,
  pickRandomTopic,
  pickTopicForCategory,
} from './aiInsightsGenerator'

describe('aiInsightsGenerator', () => {
  it('provides topics for all supported tracking goals', () => {
    expect(getTopicsForGoal('cycle').length).toBeGreaterThan(0)
    expect(getTopicsForGoal('ttc').length).toBeGreaterThan(0)
    expect(getTopicsForGoal('pregnancy').length).toBeGreaterThan(0)
    expect(getTopicsForGoal('peri').length).toBeGreaterThan(0)
  })

  it('picks a random topic for a given goal', () => {
    const topic = pickRandomTopic('cycle')
    expect(topic.goal).toBe('cycle')
    expect(topic.topic.length).toBeGreaterThan(10)
    expect(topic.category).toBeDefined()
  })

  it('picks a topic based on specific category', () => {
    const fertilityTopic = pickTopicForCategory('Fertility', 'ttc')
    expect(fertilityTopic.category).toBe('Fertility')
    expect(fertilityTopic.topic.length).toBeGreaterThan(5)

    const periTopic = pickTopicForCategory('Perimenopause', 'peri')
    expect(periTopic.category).toBe('Perimenopause')
  })

  it('parses valid JSON response from AI assistant with references', () => {
    const raw = JSON.stringify({
      title: 'Magnesium and Sleep in the Luteal Phase',
      category: 'Cycle basics',
      minutes: 3,
      body: [
        'Progesterone has natural calming effects on GABA receptors.',
        'Supplemental magnesium glycinate is often studied for nighttime relaxation.',
      ],
      references: [
        {
          title: 'ACOG Clinical Guidance on Premenstrual Symptoms',
          url: 'https://www.acog.org/clinical',
          source: 'ACOG',
        },
      ],
    })

    const parsed = parseAiArticleResponse(raw)
    expect(parsed.title).toBe('Magnesium and Sleep in the Luteal Phase')
    expect(parsed.category).toBe('Cycle basics')
    expect(parsed.minutes).toBe(3)
    expect(parsed.body.length).toBe(2)
    expect(parsed.references.length).toBe(1)
    expect(parsed.references[0].source).toBe('ACOG')
  })

  it('handles markdown json codeblocks cleanly and provides default references if empty', () => {
    const raw = '```json\n' + JSON.stringify({
      title: 'CoQ10 and Egg Quality',
      category: 'Fertility',
      minutes: 2,
      body: ['Mitochondrial energy plays a key role.'],
    }) + '\n```'

    const parsed = parseAiArticleResponse(raw)
    expect(parsed.title).toBe('CoQ10 and Egg Quality')
    expect(parsed.category).toBe('Fertility')
    expect(parsed.body[0]).toBe('Mitochondrial energy plays a key role.')
    expect(parsed.references.length).toBeGreaterThan(0)
  })

  it('falls back gracefully on non-JSON response text with default references', () => {
    const raw = 'Understanding Cervical Fluid\n\nCervical fluid changes in response to estrogen during the follicular phase.\n\nEgg-white fluid is considered peak fertility.'
    const parsed = parseAiArticleResponse(raw, 'Fertility', 'Fertility Topic')

    expect(parsed.title).toBe('Understanding Cervical Fluid')
    expect(parsed.category).toBe('Fertility')
    expect(parsed.body.length).toBe(2)
    expect(parsed.references.length).toBeGreaterThan(0)
  })
})
