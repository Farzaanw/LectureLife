import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { runExtractionAgent } from '../agents/agent1/extractionRun'
import { transformSlides } from '../agents/agent2/lessonDesignerAgent'
import {
  ProfessorConfigSchema,
  SlideContentBatchSchema,
  TransformedSlideSchema,
  TransformedSlide,
} from '../schemas/slideSchemas'

const WorkflowInputSchema = z.object({
  sessionId: z.string(),
  slideImagePaths: z.array(z.string()).min(1),
  professorConfig: ProfessorConfigSchema,
  onProgress: z
    .custom<(args: { processed: number; total: number; currentSlide: number }) => void>()
    .optional(),
})

const WorkflowOutputSchema = z.object({
  slides: z.array(TransformedSlideSchema),
  config: ProfessorConfigSchema,
  processedAt: z.string(),
  agentVersion: z.string(),
})

type WorkflowInput = z.infer<typeof WorkflowInputSchema>

const extractionStep = createStep({
  id: 'slide-extraction',
  inputSchema: WorkflowInputSchema,
  outputSchema: SlideContentBatchSchema,
  execute: async ({ inputData }) => {
    const input = inputData as WorkflowInput
    const { slideImagePaths, onProgress } = input
    const CONCURRENCY = 5

    console.log(`[Agent 1] Extracting ${slideImagePaths.length} slides…`)

    const extractedSlides: z.infer<typeof SlideContentBatchSchema>['slides'] = []

    for (let i = 0; i < slideImagePaths.length; i += CONCURRENCY) {
      const chunk = slideImagePaths.slice(i, i + CONCURRENCY)
      const chunkResults = await Promise.allSettled(
        chunk.map(async (imagePath, j) => {
          const slideIndex = i + j + 1
          const rawText = await runExtractionAgent(imagePath)
          return parseAgent1Output(rawText, slideIndex)
        }),
      )

      for (let j = 0; j < chunkResults.length; j++) {
        const slideIndex = i + j + 1
        const result = chunkResults[j]
        if (result.status === 'fulfilled') {
          extractedSlides.push(result.value)
        } else {
          console.error(`[Agent 1] Slide ${slideIndex} failed: ${result.reason}`)
          extractedSlides.push({
            slideIndex,
            slideTitle: `Slide ${slideIndex}`,
            mainTopic: '',
            keyConcepts: [],
            supportingDetails: '',
            visualElements: '',
            takeaway: '',
            contentType: 'mixed',
            prerequisites: [],
            extractionStatus: 'failed',
          })
        }
        onProgress?.({ processed: slideIndex, total: slideImagePaths.length, currentSlide: slideIndex })
      }
    }

    return {
      slides: extractedSlides,
      deckTitle: input.professorConfig.subject,
      totalSlides: slideImagePaths.length,
    }
  },
})

const transformationStep = createStep({
  id: 'slide-transformation',
  inputSchema: SlideContentBatchSchema,
  outputSchema: WorkflowOutputSchema,
  execute: async ({ inputData, getInitData }) => {
    const extractionResult = inputData as z.infer<typeof SlideContentBatchSchema>
    const initData = getInitData<WorkflowInput>()
    const professorConfig = initData.professorConfig

    const viableSlides = {
      ...extractionResult,
      slides: extractionResult.slides.filter(s => s.extractionStatus !== 'failed'),
    }
    const failedCount = extractionResult.slides.length - viableSlides.slides.length
    if (failedCount > 0) console.warn(`[Agent 2] Skipping ${failedCount} failed slides`)

    const transformedSlides = await transformSlides({
      agent1Output: viableSlides,
      config: professorConfig,
      batchSize: 5,
    })

    const failedSlides: TransformedSlide[] = extractionResult.slides
      .filter(s => s.extractionStatus === 'failed')
      .map(s => ({
        slideIndex: s.slideIndex,
        slideTitle: s.slideTitle,
        hookLine: '',
        mainContent: '',
        realWorldExample: '',
        discussionPrompt: '',
        keyTerms: [],
        mnemonicHint: null,
        bloomsLevel: 'understand' as const,
        bloomsActivities: [],
        transformationStatus: 'skipped' as const,
        warnings: ['Agent 1 extraction failed for this slide'],
      }))

    const allSlides = [...transformedSlides, ...failedSlides]
      .sort((a, b) => a.slideIndex - b.slideIndex)

    return {
      slides: allSlides,
      config: professorConfig,
      processedAt: new Date().toISOString(),
      agentVersion: '2.0.0',
    }
  },
})

export const slideTransformationWorkflow = createWorkflow({
  id: 'slide-transformation',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
})
  .then(extractionStep)
  .then(transformationStep)
  .commit()

function parseAgent1Output(
  rawText: string,
  slideIndex: number,
): z.infer<typeof SlideContentBatchSchema>['slides'][number] {
  const extract = (label: string): string => {
    const regex = new RegExp(`\\*\\*${label}\\*\\*:?([\\s\\S]*?)(?=\\*\\*[A-Z]|$)`, 'i')
    return rawText.match(regex)?.[1]?.trim() ?? ''
  }

  const keyConcepts = extract('Key Concepts')
    .split(/\n|-/)
    .map(s => s.trim())
    .filter(Boolean)

  return {
    slideIndex,
    slideTitle: extract('Main Topic').split('\n')[0] || `Slide ${slideIndex}`,
    mainTopic: extract('Main Topic') || rawText.slice(0, 200),
    keyConcepts: keyConcepts.length > 0 ? keyConcepts : ['Content extracted from slide'],
    supportingDetails: extract('Supporting Details'),
    visualElements: extract('Visual Elements'),
    takeaway: extract('Takeaway'),
    contentType: 'mixed',
    prerequisites: [],
    extractionStatus: rawText.length > 50 ? 'success' : 'partial',
  }
}