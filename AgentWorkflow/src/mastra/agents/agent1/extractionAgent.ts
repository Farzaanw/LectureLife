import { Agent } from '@mastra/core/agent'
import { anthropic } from '@ai-sdk/anthropic'

export const extractionAgent = new Agent({
  id: 'extractionAgent_1',
  name: 'Extraction Agent',
  instructions: `
    You are an expert slide content analyst. 
    When given a slide image, you will:
    1. Read ALL text visible on the slide carefully
    2. Understand diagrams, charts, or visual elements
    3. Identify the main topic and key concepts
    4. Output a detailed structured summary with these sections:
      - **Main Topic**: What is this slide about?
      - **Key Concepts**: List every important idea or term
      - **Supporting Details**: Explanations, data, or context from the slide
      - **Visual Elements**: Describe any diagrams, charts, or images
      - **Takeaway**: The core message of this slide in 1-2 sentences
    
    Be thorough — your summary will be used by another AI agent 
    to create educational content, so don't leave anything out.
  `,
  model: anthropic('claude-sonnet-4-5'),
})