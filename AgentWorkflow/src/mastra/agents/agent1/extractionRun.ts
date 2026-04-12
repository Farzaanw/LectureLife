import { extractionAgent } from './extractionAgent'
import * as fs from 'fs'
import * as path from 'path'

export async function runExtractionAgent(imagePath: string) {
  const agent = extractionAgent

  // Read the image and convert to base64
  const absolutePath = path.resolve(imagePath)
  const imageBuffer = fs.readFileSync(absolutePath)
  const base64Image = imageBuffer.toString('base64')

  // Detect format from file extension
  const ext = path.extname(imagePath).toLowerCase()
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg'

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
          text: 'Analyze this slide and give me a detailed structured summary.',
        },
      ],
    },
  ])

  console.log('\n=== EXTRACTION SUMMARY ===\n')
  console.log(response.text)

  return response.text
}

// Only runs when called directly — not on import
if (process.argv[1] && process.argv[1].includes('extractionRun')) {
  const testImagePath = process.argv[2]
  if (!testImagePath) {
    console.error('Usage: npx tsx src/mastra/agents/agent1/extractionRun.ts ./test-slide.png')
    process.exit(1)
  }
  runExtractionAgent(testImagePath)
}