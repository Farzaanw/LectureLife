import 'dotenv/config'
import { transformSlides } from './lessonDesignerAgent'
import { mockAgent1Output, mockBiologySlides } from './mockAgent1Output'
import { ProfessorConfig, TransformedSlideBatchSchema } from '../../schemas/slideSchemas'

const testConfigs: Array<{ label: string; config: ProfessorConfig; data: typeof mockAgent1Output }> = [
  {
    label: 'Marketing / Undergraduate / Conversational / Apply',
    config: {
      subject: 'Marketing',
      tone: 'conversational',
      gradeLevel: 'undergraduate',
      targetBloomsLevel: 'apply',
      includeRealWorldExamples: true,
      includeMnemonics: false,
      language: 'English',
    },
    data: mockAgent1Output,
  },
  {
    label: 'Biology / High School / Formal / Remember + Mnemonics',
    config: {
      subject: 'Cell Biology',
      tone: 'formal',
      gradeLevel: 'high-school',
      targetBloomsLevel: 'remember',
      includeRealWorldExamples: true,
      includeMnemonics: true,
      language: 'English',
    },
    data: mockBiologySlides,
  },
  {
    label: 'Marketing / Postgraduate / Socratic / Evaluate',
    config: {
      subject: 'Strategic Marketing',
      tone: 'socratic',
      gradeLevel: 'postgraduate',
      targetBloomsLevel: 'evaluate',
      includeRealWorldExamples: true,
      includeMnemonics: false,
      language: 'English',
    },
    data: { ...mockAgent1Output, slides: mockAgent1Output.slides.slice(0, 2) },
  },
]

async function runTest(index: number) {
  const test = testConfigs[index]
  if (!test) {
    console.error(`No test at index ${index}. Valid: 0–${testConfigs.length - 1}`)
    process.exit(1)
  }

  console.log('\n' + '═'.repeat(60))
  console.log(`🧪 ${test.label}`)
  console.log('═'.repeat(60) + '\n')

  const start = Date.now()

  const transformedSlides = await transformSlides({
    agent1Output: test.data,
    config: test.config,
    batchSize: 3,
  })

  const output = {
    slides: transformedSlides,
    config: test.config,
    processedAt: new Date().toISOString(),
    agentVersion: '2.0.0',
  }

  const validated = TransformedSlideBatchSchema.parse(output)

  console.log(`\n📊 Results:`)
  console.log(`  Slides:    ${validated.slides.length}`)
  console.log(`  Success:   ${validated.slides.filter(s => s.transformationStatus === 'success').length}`)
  console.log(`  Partial:   ${validated.slides.filter(s => s.transformationStatus === 'partial').length}`)
  console.log(`  Skipped:   ${validated.slides.filter(s => s.transformationStatus === 'skipped').length}`)
  console.log(`  Time:      ${((Date.now() - start) / 1000).toFixed(1)}s`)

  const s = validated.slides[0]
  if (s) {
    console.log(`\n📝 Slide 1 preview:`)
    console.log(`  Hook:      ${s.hookLine}`)
    console.log(`  Bloom's:   ${s.bloomsLevel}`)
    console.log(`  Terms:     ${s.keyTerms.map(k => k.term).join(', ')}`)
    console.log(`  Prompt:    "${s.discussionPrompt}"`)
    console.log(`  Example:   ${s.realWorldExample}`)
    if (s.mnemonicHint) console.log(`  Mnemonic:  ${s.mnemonicHint}`)
    if (s.warnings.length > 0) console.log(`  Warnings:  ${s.warnings.join(', ')}`)
  }

  console.log('\n✅ Schema validation passed')
  console.log(JSON.stringify(validated, null, 2))
}

const i = parseInt(process.argv[2] ?? '0', 10)
runTest(i).catch(err => { console.error('❌', err); process.exit(1) })