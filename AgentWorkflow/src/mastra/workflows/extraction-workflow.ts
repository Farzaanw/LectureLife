import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { buildArtifactPrompt } from '../utils/artifactPromptConverter.js';
import { buildUiSpecFromAgent2 } from '../utils/uiSpecConverter.js';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const interactionModeSchema = z.enum([
  'QuizReact',
  'GameReact',
  'WalkthroughReact',
  'ExploreReact',
  'DiscussReact',
]);

const CACHE_DIR = path.resolve(process.cwd(), '.cache', 'extraction-workflow');
const AGENT1_PROMPT_VERSION = 'v1';
const AGENT2_PROMPT_VERSION = 'v1';

type CachedRecord = {
  value: string;
  ts: number;
};

function ensureCacheDir(): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function readCache(key: string): string | null {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CachedRecord;
    return typeof parsed.value === 'string' ? parsed.value : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: string): void {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key}.json`);
    const record: CachedRecord = { value, ts: Date.now() };
    fs.writeFileSync(filePath, JSON.stringify(record), 'utf8');
  } catch {
    // Ignore cache write failures to avoid breaking workflow.
  }
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
}

function compactAgent1Output(agent1Output: string): string {
  try {
    const parsed = JSON.parse(stripCodeFences(agent1Output)) as {
      title?: string;
      summary?: string;
      objective?: string;
      tags?: string[];
      visualAsset?: string;
      rawContent?: string[];
    };

    const compact = {
      title: parsed.title || '',
      summary: parsed.summary || '',
      objective: parsed.objective || '',
      tags: (parsed.tags || []).slice(0, 8),
      visualAsset: parsed.visualAsset || '',
      rawContent: (parsed.rawContent || []).slice(0, 8),
    };

    return JSON.stringify(compact, null, 2);
  } catch {
    return agent1Output;
  }
}

function extractPresentationId(slideshowUrl: string): string {
  const match = slideshowUrl.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
  if (!match?.[1]) {
    throw new Error('Invalid Google Slides URL. Expected format: https://docs.google.com/presentation/d/<id>/...');
  }
  return match[1];
}

async function getFirstSlidePageId(presentationId: string): Promise<string> {
  const htmlUrl = `https://docs.google.com/presentation/d/${presentationId}/htmlpresent`;
  const response = await fetch(htmlUrl);
  if (!response.ok) {
    throw new Error(`Unable to access slideshow HTML view (${response.status})`);
  }

  const html = await response.text();
  const pageIdMatch = html.match(/pageid=([a-zA-Z0-9_-]+)/i);
  if (!pageIdMatch?.[1]) {
    throw new Error('Could not detect first slide page ID. Ensure the slideshow is shared as viewable.');
  }

  return pageIdMatch[1];
}

async function fetchSlideAsBase64(slideshowUrl: string): Promise<string> {
  const imageCacheKey = `img-${hashText(slideshowUrl)}`;
  const cachedImage = readCache(imageCacheKey);
  if (cachedImage) {
    return cachedImage;
  }

  const presentationId = extractPresentationId(slideshowUrl);
  const pageId = await getFirstSlidePageId(presentationId);
  const exportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/png?pageid=${pageId}`;

  const response = await fetch(exportUrl);
  if (!response.ok) {
    throw new Error(`Unable to export slide image (${response.status})`);
  }

  const imageBytes = await response.arrayBuffer();
  const base64 = Buffer.from(imageBytes).toString('base64');
  writeCache(imageCacheKey, base64);
  return base64;
}

const runAgent1 = createStep({
  id: 'run-agent-1-extraction',
  description: 'Runs Agent 1 to extract structured slide data',
  inputSchema: z.object({
    slideshowUrl: z.string().url().describe('Google Slides URL'),
    interactionMode: interactionModeSchema.describe('Interactive format selected by the user'),
    prompt: z.string().optional().describe('Optional override prompt for Agent 1'),
  }),
  outputSchema: z.object({
    slideshowUrl: z.string(),
    interactionMode: interactionModeSchema,
    agent1Output: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent1 = mastra?.getAgent('extractionAgent_1');
    if (!agent1) {
      throw new Error('Agent 1 not found');
    }

    const base64Image = await fetchSlideAsBase64(inputData.slideshowUrl);
    const mimeType: 'image/png' = 'image/png';

    const defaultPrompt =
      'Analyze this slide and output structured extraction that Agent 2 can directly use.';
    const prompt = inputData.prompt?.trim() ? inputData.prompt : defaultPrompt;

    const agent1CacheKey = `a1-${hashText(`${inputData.slideshowUrl}|${prompt}|${AGENT1_PROMPT_VERSION}`)}`;
    const cachedAgent1 = readCache(agent1CacheKey);
    if (cachedAgent1) {
      return {
        slideshowUrl: inputData.slideshowUrl,
        interactionMode: inputData.interactionMode,
        agent1Output: cachedAgent1,
      };
    }

    const response = await agent1.generate([
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: base64Image,
            mimeType,
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ]);

    writeCache(agent1CacheKey, response.text);

    return {
      slideshowUrl: inputData.slideshowUrl,
      interactionMode: inputData.interactionMode,
      agent1Output: response.text,
    };
  },
});

const runAgent2 = createStep({
  id: 'run-agent-2-enhancement',
  description: 'Passes Agent 1 output into Agent 2 to generate enhancement plan',
  inputSchema: z.object({
    slideshowUrl: z.string(),
    interactionMode: interactionModeSchema,
    agent1Output: z.string(),
  }),
  outputSchema: z.object({
    slideshowUrl: z.string(),
    interactionMode: interactionModeSchema,
    agent1Output: z.string(),
    agent2Output: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent2 = mastra?.getAgent('extractionAgent_2');
    if (!agent2) {
      throw new Error('Agent 2 not found');
    }

    const compactAgent1 = compactAgent1Output(inputData.agent1Output);
    const agent2CacheKey = `a2-${hashText(`${compactAgent1}|${inputData.interactionMode}|${AGENT2_PROMPT_VERSION}`)}`;
    const cachedAgent2 = readCache(agent2CacheKey);
    if (cachedAgent2) {
      return {
        slideshowUrl: inputData.slideshowUrl,
        interactionMode: inputData.interactionMode,
        agent1Output: inputData.agent1Output,
        agent2Output: cachedAgent2,
      };
    }

    const response = await agent2.generate([
      {
        role: 'user',
        content: `You are receiving compact Agent 1 extraction output. Use it as your primary input for agent 2.\n\nSelected interaction mode (hard requirement): ${inputData.interactionMode}.\nDesign the output specifically for this mode and avoid other formats.\n\nAgent 1 Output (Compact JSON):\n${compactAgent1}`,
      },
    ]);

    writeCache(agent2CacheKey, response.text);

    return {
      slideshowUrl: inputData.slideshowUrl,
      interactionMode: inputData.interactionMode,
      agent1Output: inputData.agent1Output,
      agent2Output: response.text,
    };
  },
});

const buildUiSpec = createStep({
  id: 'build-ui-spec',
  description: 'Builds frontend-friendly UI spec from Agent 2 output',
  inputSchema: z.object({
    slideshowUrl: z.string(),
    interactionMode: interactionModeSchema,
    agent1Output: z.string(),
    agent2Output: z.string(),
  }),
  outputSchema: z.object({
    interactionMode: interactionModeSchema,
    agent1Output: z.string(),
    agent2Output: z.string(),
    artifactPrompt: z.string(),
    uiSpec: z.unknown(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const artifactPrompt = buildArtifactPrompt(inputData.agent2Output, inputData.interactionMode);
    const uiSpec = buildUiSpecFromAgent2(inputData.agent2Output, inputData.interactionMode);

    return {
      interactionMode: inputData.interactionMode,
      agent1Output: inputData.agent1Output,
      agent2Output: inputData.agent2Output,
      artifactPrompt,
      uiSpec,
    };
  },
});

const extractionWorkflow = createWorkflow({
  id: 'extraction-workflow',
  inputSchema: z.object({
    slideshowUrl: z.string().url(),
    interactionMode: interactionModeSchema,
    prompt: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionMode: interactionModeSchema,
    agent1Output: z.string(),
    agent2Output: z.string(),
    artifactPrompt: z.string(),
    uiSpec: z.unknown(),
  }),
})
  .then(runAgent1)
  .then(runAgent2)
  .then(buildUiSpec);

extractionWorkflow.commit();

export { extractionWorkflow };
