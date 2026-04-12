import { Agent } from '@mastra/core/agent'
import { anthropic } from '@ai-sdk/anthropic'
import Anthropic from '@anthropic-ai/sdk'
import {
  ProfessorConfig,
  ProfessorConfigSchema,
  SlideContentBatch,
  TransformedSlide,
  TransformedSlideSchema,
  BloomLevel,
} from '../../schemas/slideSchemas'

const BLOOMS_VERB_MAP: Record<BloomLevel, string[]> = {
  remember:   ['define', 'list', 'recall', 'identify', 'name', 'recognise'],
  understand: ['explain', 'summarise', 'paraphrase', 'classify', 'describe', 'interpret'],
  apply:      ['use', 'demonstrate', 'solve', 'calculate', 'implement', 'execute'],
  analyze:    ['compare', 'differentiate', 'examine', 'break down', 'infer', 'deconstruct'],
  evaluate:   ['judge', 'critique', 'justify', 'argue', 'assess', 'defend'],
  create:     ['design', 'construct', 'formulate', 'propose', 'develop', 'synthesise'],
}

const BLOOMS_DESCRIPTION: Record<BloomLevel, string> = {
  remember:   'Students should be able to recall and recognise key facts and terms.',
  understand: 'Students should be able to explain the concept in their own words and give examples.',
  apply:      'Students should be able to use the concept to solve problems in familiar and new contexts.',
  analyze:    'Students should be able to break down the concept, identify relationships, and draw inferences.',
  evaluate:   'Students should be able to make and defend judgements about the concept using evidence.',
  create:     'Students should be able to combine ideas to produce something new or propose original solutions.',
}

const GRADE_LEVEL_GUIDANCE: Record<string, string> = {
  'high-school':   'Use simple language, avoid jargon without explanation, relate everything to everyday teen life.',
  'undergraduate': 'University-level language. Introduce technical terms with definitions. Balance theory with practical examples.',
  'advanced':      'Assume solid subject-matter knowledge. Focus on nuance, edge cases, and critical thinking.',
  'postgraduate':  'Research-level depth. Reference methodologies and scholarly frameworks where relevant.',
  'professional':  'Practitioner-focused. Prioritise ROI, real-world applicability, and decision-making frameworks.',
}

const TONE_GUIDANCE: Record<string, string> = {
  formal:          'Write in a precise, academic register. Avoid contractions and colloquialisms.',
  conversational:  'Write as if talking directly to a student. Use "you", contractions, and friendly phrasing.',
  socratic:        'Frame explanations as guided questions that lead the student to discover the answer.',
  narrative:       'Structure content as a story or journey. Use characters, scenarios, and plot-like progression.',
  energetic:       'Write with high energy and enthusiasm. Use exclamation where natural. Keep sentences punchy.',
}

export function buildSystemPrompt(config: ProfessorConfig): string {
  const bloomVerbs = BLOOMS_VERB_MAP[config.targetBloomsLevel].join(', ')
  const bloomDesc = BLOOMS_DESCRIPTION[config.targetBloomsLevel]
  const gradeGuidance = GRADE_LEVEL_GUIDANCE[config.gradeLevel]
  const toneGuidance = TONE_GUIDANCE[config.tone]

  return `
You are an expert instructional designer and pedagogical AI working on LectureLife,
a live-lecture enhancement platform. Your role is Agent 2 — the Lesson Designer.

────────────────────────────────────────────
PROFESSOR CONFIGURATION (apply to ALL slides)
────────────────────────────────────────────
Subject: ${config.subject}
Target audience: ${config.gradeLevel}
Tone: ${config.tone}
Target Bloom's level: ${config.targetBloomsLevel.toUpperCase()}
Include real-world examples: ${config.includeRealWorldExamples ? 'YES' : 'NO'}
Include mnemonics: ${config.includeMnemonics ? 'YES' : 'NO'}
Output language: ${config.language}

────────────────────────────────────────────
TONE INSTRUCTIONS
────────────────────────────────────────────
${toneGuidance}

────────────────────────────────────────────
GRADE LEVEL INSTRUCTIONS
────────────────────────────────────────────
${gradeGuidance}

────────────────────────────────────────────
BLOOM'S TAXONOMY TARGET: ${config.targetBloomsLevel.toUpperCase()}
────────────────────────────────────────────
Goal: ${bloomDesc}
Use these action verbs in discussion prompts and activities: ${bloomVerbs}.

────────────────────────────────────────────
YOUR TASK (per slide)
────────────────────────────────────────────
You will receive a JSON array of slides extracted by Agent 1.
For EACH slide produce a transformed version with these fields:

1. hookLine (<=160 chars) — one punchy sentence to grab student attention
2. mainContent (Markdown, 80-250 words) — core explanation, bold key terms, bullets for lists
3. realWorldExample (2-4 sentences) — concrete scenario illustrating the concept
4. discussionPrompt — one open-ended question at the ${config.targetBloomsLevel} Bloom's level
5. keyTerms — 2-6 objects: { term, definition (<=120 chars) }
6. mnemonicHint — memory aid if includeMnemonics is YES, otherwise null
7. bloomsLevel — always "${config.targetBloomsLevel}"
8. bloomsActivities — 1-3 suggested activities at the ${config.targetBloomsLevel} level
9. transformationStatus — "success", "partial", or "skipped"
10. warnings — empty array if no issues

────────────────────────────────────────────
ABSOLUTE RULES
────────────────────────────────────────────
NEVER fabricate facts, statistics, names, or quotes not in the source slide.
NEVER add external knowledge beyond reasonable definitional context.
NEVER reproduce original slide text verbatim — always rewrite and reframe.
NEVER output anything other than valid JSON — no markdown fences, no explanation.
If a slide has insufficient content, set transformationStatus to "partial" or "skipped".

────────────────────────────────────────────
OUTPUT FORMAT — respond ONLY with this JSON
────────────────────────────────────────────
{
  "slides": [
    {
      "slideIndex": <number>,
      "slideTitle": "<original title>",
      "hookLine": "<string>",
      "mainContent": "<markdown string>",
      "realWorldExample": "<string>",
      "discussionPrompt": "<string>",
      "keyTerms": [{ "term": "<string>", "definition": "<string>" }],
      "mnemonicHint": "<string | null>",
      "bloomsLevel": "${config.targetBloomsLevel}",
      "bloomsActivities": ["<string>"],
      "transformationStatus": "success",
      "warnings": []
    }
  ],
  "config": <echo back the professor config object>,
  "processedAt": "<ISO 8601 timestamp>",
  "agentVersion": "2.0.0"
}
`.trim()
}

// ── Anthropic client with prompt caching + retry logic ────────────────────────
const anthropicClient = new Anthropic()

const RETRY_DELAYS_MS = [2000, 4000, 8000]

async function callWithCaching(systemPrompt: string, userContent: string): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await anthropicClient.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userContent }],
      })

      const block = response.content[0]
      if (block.type !== 'text') throw new Error('Unexpected response type from Claude API')

      // Validate parseable JSON before returning
      JSON.parse(block.text)
      return block.text

    } catch (err) {
      lastError = err as Error
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length

      if (!isLastAttempt) {
        const delay = RETRY_DELAYS_MS[attempt]
        console.warn(`  ⚠️  API call failed (attempt ${attempt + 1}), retrying in ${delay / 1000}s… ${lastError.message}`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw new Error(`Claude API failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastError?.message}`)
}

export interface TransformOptions {
  agent1Output: SlideContentBatch
  config: ProfessorConfig
  batchSize?: number
}

export async function transformSlides(options: TransformOptions): Promise<TransformedSlide[]> {
  const { agent1Output, config, batchSize = 5 } = options
  const validConfig = ProfessorConfigSchema.parse(config)
  const systemPrompt = buildSystemPrompt(validConfig)
  const allSlides = agent1Output.slides
  const results: TransformedSlide[] = []

  console.log(
    `🎓 Agent 2 transforming ${allSlides.length} slides ` +
    `[tone: ${config.tone}, level: ${config.gradeLevel}, blooms: ${config.targetBloomsLevel}]`,
  )

  for (let i = 0; i < allSlides.length; i += batchSize) {
    const batch = allSlides.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(allSlides.length / batchSize)
    console.log(`  ↳ Batch ${batchNum}/${totalBatches} (slides ${i + 1}–${i + batch.length})`)

    const userContent =
      `Here is the extracted slide content from Agent 1 for slides ${i + 1}–${i + batch.length}:\n\n` +
      JSON.stringify(batch, null, 2) +
      `\n\nPlease transform all ${batch.length} slides now.`

    try {
      const rawText = await callWithCaching(systemPrompt, userContent)
      const parsed = JSON.parse(rawText)

      for (const rawSlide of parsed.slides) {
        try {
          results.push(TransformedSlideSchema.parse(rawSlide))
        } catch {
          console.warn(`  ⚠️  Slide ${rawSlide?.slideIndex} failed validation, retrying…`)
          results.push(await retrySingleSlide(systemPrompt, rawSlide?.slideIndex, batch))
        }
      }
    } catch (err) {
      console.error(`  ❌ Batch ${batchNum} failed: ${(err as Error).message}`)
      for (const slide of batch) {
        results.push(createFailedSlide(slide.slideIndex, slide.slideTitle, String(err)))
      }
    }
  }

  console.log(`✅ Agent 2 complete — ${results.length}/${allSlides.length} slides transformed`)
  return results
}

async function retrySingleSlide(
  systemPrompt: string,
  slideIndex: number,
  sourceBatch: SlideContentBatch['slides'],
): Promise<TransformedSlide> {
  const sourceSlide = sourceBatch.find(s => s.slideIndex === slideIndex)
  if (!sourceSlide) return createFailedSlide(slideIndex, 'Unknown', 'Source slide not found')

  try {
    const userContent =
      `Retry: transform only this single slide:\n\n${JSON.stringify(sourceSlide, null, 2)}\n\n` +
      `Return a JSON object with a "slides" array containing exactly one slide.`
    const rawText = await callWithCaching(systemPrompt, userContent)
    const parsed = JSON.parse(rawText)
    return TransformedSlideSchema.parse(parsed.slides[0])
  } catch (err) {
    return createFailedSlide(slideIndex, sourceSlide.slideTitle, String(err))
  }
}

function createFailedSlide(slideIndex: number, slideTitle: string, reason: string): TransformedSlide {
  return {
    slideIndex,
    slideTitle,
    hookLine: '',
    mainContent: '',
    realWorldExample: '',
    discussionPrompt: '',
    keyTerms: [],
    mnemonicHint: null,
    bloomsLevel: 'understand',
    bloomsActivities: [],
    transformationStatus: 'skipped',
    warnings: [`Transformation failed: ${reason}`],
  }
}

// Mastra Studio agent — for interactive testing
export const lessonDesignerAgent = new Agent({
  id: 'lessonDesignerAgent_2',
  name: 'Lesson Designer Agent',
  instructions: buildSystemPrompt({
    subject: 'General',
    tone: 'conversational',
    gradeLevel: 'undergraduate',
    targetBloomsLevel: 'understand',
    includeRealWorldExamples: true,
    includeMnemonics: false,
    language: 'English',
  }),
  model: anthropic('claude-haiku-4-5-20251001'),
})