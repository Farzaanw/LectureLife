import 'dotenv/config';
import http from 'http';
import { mastra } from '../mastra/index.js';

const PORT = Number(process.env.PORT || 3333);
const DEFAULT_PROMPT =
  'Analyze this slide and output structured extraction that Agent 2 can directly use.';

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  // Minimal JSON response + CORS for the frontend dev server.
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  // Read and parse the raw request body as JSON.
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => chunks.push(chunk));

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

function extractImagePayload(body: Record<string, unknown>): { base64: string; mimeType: string } {
  // Accept a standard data URL from the frontend: data:<mime>;base64,<data>
  if (typeof body.imageDataUrl !== 'string') {
    throw new Error('Missing imageDataUrl');
  }

  const match = body.imageDataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match?.[1] || !match?.[2]) {
    throw new Error('Invalid imageDataUrl');
  }

  return { mimeType: match[1], base64: match[2] };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/agent1/extract') {
    try {
      const body = (await parseJsonBody(req)) as Record<string, unknown>;
      const { base64, mimeType } = extractImagePayload(body);
      const prompt = typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : DEFAULT_PROMPT;
      const interactionMode = typeof body.interactionMode === 'string'
        ? body.interactionMode
        : 'unknown';

      const agent1 = mastra.getAgent('extractionAgent_1');
      if (!agent1) {
        sendJson(res, 500, { error: 'Agent 1 not found' });
        return;
      }

      const agent2 = mastra.getAgent('extractionAgent_2');
      if (!agent2) {
        sendJson(res, 500, { error: 'Agent 2 not found' });
        return;
      }

      // Run Agent 1, then pass its output into Agent 2 (testing flow).
      const response = await agent1.generate([
        {
          role: 'user',
          content: [
            { type: 'image', image: base64, mimeType },
            { type: 'text', text: `${prompt}\nUser selected mode: ${interactionMode}.` },
          ],
        },
      ]);

      // eslint-disable-next-line no-console
      console.log('\n=== AGENT 1 EXTRACTION ===\n');
      // eslint-disable-next-line no-console
      console.log(response.text);

      const response2 = await agent2.generate([
        {
          role: 'user',
          content: `Selected interaction mode: ${interactionMode}.\n\nAgent 1 Output:\n${response.text}`,
        },
      ]);

      // eslint-disable-next-line no-console
      console.log('\n=== AGENT 2 OUTPUT ===\n');
      // eslint-disable-next-line no-console
      console.log(response2.text);

      sendJson(res, 200, { ok: true });
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      sendJson(res, 400, { error: message });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Agent API listening on http://localhost:${PORT}`);
});
