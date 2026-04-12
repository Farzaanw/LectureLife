export type InteractionMode =
  | 'QuizReact'
  | 'GameReact'
  | 'WalkthroughReact'
  | 'ExploreReact'
  | 'DiscussReact';

type Agent2Theme = {
  primaryColor?: string;
  fontTitle?: string;
  fontBody?: string;
};

type Agent2Enhancement = {
  type?: string;
  content?: string;
  animation?: string;
  animationOrder?: number;
};

type Agent2Interactivity = {
  type?: string;
  items?: unknown[];
};

type Agent2Output = {
  title?: string;
  theme?: Agent2Theme;
  enhancements?: Agent2Enhancement[];
  interactivity?: Agent2Interactivity;
  speakerNotes?: string;
};

type UiSpecElement = {
  type: string;
  content: string;
  animation?: string;
  order?: number;
};

export type SlideUiSpec = {
  version: '1.0';
  mode: InteractionMode;
  title: string;
  theme: {
    primaryColor: string;
    fontTitle: string;
    fontBody: string;
  };
  elements: UiSpecElement[];
  interaction: {
    type: string;
    items: unknown[];
  };
  speakerNotes: string;
};

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }
  return trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
}

function parseAgent2Json(agent2Output: string): Agent2Output {
  const cleaned = stripCodeFences(agent2Output);
  return JSON.parse(cleaned) as Agent2Output;
}

export function buildUiSpecFromAgent2(agent2Output: string, mode: InteractionMode): SlideUiSpec {
  const parsed = parseAgent2Json(agent2Output);

  const title = parsed.title || 'Interactive Slide';
  const theme = {
    primaryColor: parsed.theme?.primaryColor || '#1a73e8',
    fontTitle: parsed.theme?.fontTitle || 'Inter',
    fontBody: parsed.theme?.fontBody || 'Inter',
  };

  const elements: UiSpecElement[] = (parsed.enhancements || []).slice(0, 8).map((enhancement) => ({
    type: enhancement.type || 'ADD_TEXT_BOX',
    content: enhancement.content || '',
    animation: enhancement.animation,
    order: enhancement.animationOrder,
  }));

  return {
    version: '1.0',
    mode,
    title,
    theme,
    elements,
    interaction: {
      type: parsed.interactivity?.type || mode,
      items: parsed.interactivity?.items || [],
    },
    speakerNotes: parsed.speakerNotes || '',
  };
}
