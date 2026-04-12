import { mastra } from '../../index'
import * as fs from 'fs'
import * as path from 'path'

const DEFAULT_EXTRACTION_PROMPT =
  'Analyze this slide for Agent 2 handoff. Follow your required section format exactly. Prioritize factual accuracy and mark uncertainty clearly.'

export async function runExtractionAgent(imagePath: string, prompt?: string) {
  const agent = mastra.getAgentById('extractionAgent_1')

  // Read the image and convert to base64
  const absolutePath = path.resolve(imagePath)
  const imageBuffer = fs.readFileSync(absolutePath)
  const base64Image = imageBuffer.toString('base64')

  // Detect format from file extension
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'
  const userPrompt = prompt?.trim() ? prompt : DEFAULT_EXTRACTION_PROMPT

  console.log(`Processing slide: ${absolutePath}`)

  const response = await agent.generate([
    {
      role: 'user',
      content: [
        {
          type: 'image',
          image: base64Image,
          mimeType: mimeType,
        },
        {
          type: 'text',
          text: userPrompt,
        },
      ],
    },
  ])

  console.log('\n=== EXTRACTION SUMMARY ===\n')
  console.log(response.text)

  // Return the summary so Agent 2 can use it later
  return response.text
}

// Run it directly with a test image
const testImagePath = process.argv[2]
const customPrompt = process.argv.slice(3).join(' ')

if (!testImagePath) {
  console.error('Please provide an image path: npx ts-node extractionRun.ts ./test-slide.png [optional prompt]')
  process.exit(1)
}

runExtractionAgent(testImagePath, customPrompt)