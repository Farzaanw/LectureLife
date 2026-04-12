import { z } from 'zod'

export const SlideContentSchema = z.object({
  slideIndex: z.number().int().min(1),
  slideTitle: z.string(),
  mainTopic: z.string(),
  keyConcepts: z.array(z.string()).min(1),
  supportingDetails: z.string(),
  visualElements: z.string(),
  takeaway: z.string(),
  contentType: z.enum(['text-heavy', 'diagram', 'table', 'equation', 'image', 'mixed', 'title', 'summary']),
  prerequisites: z.array(z.string()).default([]),
  extractionStatus: z.enum(['success', 'partial', 'failed']).default('success'),
})
export type SlideContent = z.infer<typeof SlideContentSchema>

export const SlideContentBatchSchema = z.object({
  slides: z.array(SlideContentSchema),
  deckTitle: z.string().optional(),
  totalSlides: z.number().int(),
})
export type SlideContentBatch = z.infer<typeof SlideContentBatchSchema>

export const BloomLevelSchema = z.enum([
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
])
export type BloomLevel = z.infer<typeof BloomLevelSchema>

export const ToneSchema = z.enum([
  'formal', 'conversational', 'socratic', 'narrative', 'energetic',
])
export type Tone = z.infer<typeof ToneSchema>

export const GradeLevelSchema = z.enum([
  'high-school', 'undergraduate', 'advanced', 'postgraduate', 'professional',
])
export type GradeLevel = z.infer<typeof GradeLevelSchema>

export const ProfessorConfigSchema = z.object({
  subject: z.string(),
  tone: ToneSchema.default('conversational'),
  gradeLevel: GradeLevelSchema.default('undergraduate'),
  targetBloomsLevel: BloomLevelSchema.default('understand'),
  includeRealWorldExamples: z.boolean().default(true),
  includeMnemonics: z.boolean().default(false),
  language: z.string().default('English'),
})
export type ProfessorConfig = z.infer<typeof ProfessorConfigSchema>

export const TransformedSlideSchema = z.object({
  slideIndex: z.number().int().min(1),
  slideTitle: z.string(),
  hookLine: z.string().max(160),
  mainContent: z.string(),
  realWorldExample: z.string(),
  discussionPrompt: z.string(),
  keyTerms: z.array(z.object({
    term: z.string(),
    definition: z.string().max(120),
  })),
  mnemonicHint: z.string().nullable(),
  bloomsLevel: BloomLevelSchema,
  bloomsActivities: z.array(z.string()).min(1).max(3),
  transformationStatus: z.enum(['success', 'partial', 'skipped']).default('success'),
  warnings: z.array(z.string()).default([]),
})
export type TransformedSlide = z.infer<typeof TransformedSlideSchema>

export const TransformedSlideBatchSchema = z.object({
  slides: z.array(TransformedSlideSchema),
  config: ProfessorConfigSchema,
  processedAt: z.string(),
  agentVersion: z.string().default('2.0.0'),
})
export type TransformedSlideBatch = z.infer<typeof TransformedSlideBatchSchema>