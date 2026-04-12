export type InteractionMode =
  | 'QuizReact'
  | 'GameReact'
  | 'WalkthroughReact'
  | 'ExploreReact'
  | 'DiscussReact';

type CompactAgent2Output = {
  title?: string;
  enhancements?: Array<{
    type?: string;
    content?: string;
    animation?: string;
    animationOrder?: number;
  }>;
  interactivity?: unknown;
  speakerNotes?: string;
  theme?: {
    primaryColor?: string;
    fontTitle?: string;
    fontBody?: string;
  };
};

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }
  return trimmed;
}

function toCompactJson(agent2Output: string): string {
  const cleaned = stripCodeFences(agent2Output);

  try {
    const parsed = JSON.parse(cleaned) as CompactAgent2Output;
    const compactEnhancements = (parsed.enhancements || []).slice(0, 4).map((e) => ({
      type: e?.type,
      content: e?.content,
      animation: e?.animation,
      animationOrder: e?.animationOrder,
    }));

    const compact: CompactAgent2Output = {
      title: parsed.title,
      theme: parsed.theme,
      enhancements: compactEnhancements,
      interactivity: parsed.interactivity,
      speakerNotes: parsed.speakerNotes,
    };
    return JSON.stringify(compact, null, 2);
  } catch {
    return cleaned;
  }
}

export function buildArtifactPrompt(agent2Output: string, selectedMode: InteractionMode): string {
  const compactAgent2Output = toCompactJson(agent2Output);

  return `
You are an expert interactive education designer.
Build ONE interactive, mobile-friendly ${selectedMode} screen from this data.

Data:
${compactAgent2Output}

Requirements:
- Single self-contained HTML only
- Exactly one screen (no extra slides/sections)
- Click interactions + smooth CSS animations
- Preserve technical correctness
- No external deps except CDN links
- Output only final HTML
`.trim();
}
