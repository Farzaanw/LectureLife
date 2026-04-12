import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

const runAgent1 = createStep({
	id: 'run-agent-1-extraction',
	description: 'Runs Agent 1 to extract structured slide data',
	inputSchema: z.object({
		imagePath: z.string().describe('Path to slide image (png, jpg, jpeg)'),
		prompt: z.string().optional().describe('Optional override prompt for Agent 1'),
	}),
	outputSchema: z.object({
		imagePath: z.string(),
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

		const absolutePath = path.resolve(inputData.imagePath);
		const imageBuffer = fs.readFileSync(absolutePath);
		const base64Image = imageBuffer.toString('base64');

		const ext = path.extname(absolutePath).toLowerCase();
		const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

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
			imagePath: inputData.imagePath,
			agent1Output: response.text,
		};
	},
});

const runAgent2 = createStep({
	id: 'run-agent-2-enhancement',
	description: 'Passes Agent 1 output into Agent 2 to generate enhancement plan',
	inputSchema: z.object({
		imagePath: z.string(),
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
				content: `You are receiving Agent 1 extraction output. Use it as your primary input to create the slide enhancement plan.\n\nAgent 1 Output:\n${inputData.agent1Output}`,
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
		imagePath: z.string(),
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
