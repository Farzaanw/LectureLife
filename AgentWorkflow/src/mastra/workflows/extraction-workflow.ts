import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

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
	const presentationId = extractPresentationId(slideshowUrl);
	const pageId = await getFirstSlidePageId(presentationId);
	const exportUrl = `https://docs.google.com/presentation/d/${presentationId}/export/png?pageid=${pageId}`;

	const response = await fetch(exportUrl);
	if (!response.ok) {
		throw new Error(`Unable to export slide image (${response.status})`);
	}

	const imageBytes = await response.arrayBuffer();
	return Buffer.from(imageBytes).toString('base64');
}

const runAgent1 = createStep({
	id: 'run-agent-1-extraction',
	description: 'Runs Agent 1 to extract structured slide data',
	inputSchema: z.object({
		slideshowUrl: z.string().url().describe('Google Slides URL'),
		prompt: z.string().optional().describe('Optional override prompt for Agent 1'),
	}),
	outputSchema: z.object({
		slideshowUrl: z.string(),
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

		return {
			slideshowUrl: inputData.slideshowUrl,
			agent1Output: response.text,
		};
	},
});

const runAgent2 = createStep({
	id: 'run-agent-2-enhancement',
	description: 'Passes Agent 1 output into Agent 2 to generate enhancement plan',
	inputSchema: z.object({
		slideshowUrl: z.string(),
		agent1Output: z.string(),
	}),
	outputSchema: z.object({
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

		const response = await agent2.generate([
			{
				role: 'user',
				content: `You are receiving Agent 1 extraction output. Use it as your primary input for agent 2.\n\nAgent 1 Output:\n${inputData.agent1Output}`,
			},
		]);

		return {
			agent1Output: inputData.agent1Output,
			agent2Output: response.text,
		};
	},
});

const extractionWorkflow = createWorkflow({
	id: 'extraction-workflow',
	inputSchema: z.object({
		slideshowUrl: z.string().url(),
		prompt: z.string().optional(),
	}),
	outputSchema: z.object({
		agent1Output: z.string(),
		agent2Output: z.string(),
	}),
})
	.then(runAgent1)
	.then(runAgent2);

extractionWorkflow.commit();

export { extractionWorkflow };
