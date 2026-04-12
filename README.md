# LectureLife

> **Turn any lecture into a live, AI-powered interactive experience — in real time.**

Traditional lecture attendance is declining — research shows that students retain significantly less information from passive lecture formats compared to active learning approaches (Freeman et al., 2014)¹. Students do not engage with static slides, teachers struggle to assess understanding in real time, and lecture recordings are rarely watched (Burchfield & Sappington, 2000)². LectureLife fixes this — teachers upload a PDF, go live instantly, and an AI agent pipeline transforms every slide into quizzes, summaries, and interactive content while students follow along on any device.

---

## Features

- **Real-time slide sync** — Students join via QR code and see slides in perfect sync. No app download required.
- **Live Q&A** — Students type questions that appear as animated notifications on the teacher's screen, queued in the sidebar for verbal response.
- **AI Slide Enhancement** — A two-agent Mastra pipeline extracts key concepts and generates quizzes, walkthroughs, flip cards, and study guides on the fly.
- **Teacher Dashboard** — Upload PDF, present, and monitor student questions live.
- **Works on any device** — Accessible via public tunnel from any phone, tablet, or laptop.
- **Zero friction** — Teachers upload a PDF. No content creation overhead.

---

## Architecture

```
+------------------------------------------------------------------+
|                        TEACHER (localhost)                       |
|                                                                  |
|   +--------------+        +----------------------------------+   |
|   |  React App   |------> |   Express + Socket.io Server    |   |
|   |  (Vite :5173)|        |       (Node.js :3001)           |   |
|   +--------------+        +----------------+-----------------+   |
|          |                                 |                     |
|          | PDF Upload +                    | slide sync /        |
|          | Enhance Slide                   | live questions      |
|          v                                 |                     |
|   +------------------+                     | ngrok tunnel        |
|   |  AgentWorkflow   |                     |                     |
|   |  (Mastra :3333)  |                     v                     |
|   |                  |        +---------------------+            |
|   |  +------------+  |        | https://xxx.ngrok   |            |
|   |  |  Agent 1   |  |        +----------+----------+            |
|   |  | Extraction |  |                   |                       |
|   |  +-----+------+  |        +----------v----------+            |
|   |        |         |        |  STUDENTS            |           |
|   |        v         |        |  (any device,        |           |
|   |  +------------+  |        |   any network)       |           |
|   |  |  Agent 2   |  |        |                      |           |
|   |  | Enhancement|  |        |  - View slides live  |           |
|   |  +-----+------+  |        |  - Ask questions     |           |
|   |        v         |        |  - Take AI quizzes   |           |
|   |  UI Spec +       |        +---------------------+            |
|   |  PPTX Artifact   |                                           |
|   +------------------+                                           |
+------------------------------------------------------------------+
```

### Agent Pipeline

The pipeline is orchestrated using Mastra and runs three sequential steps:

<p align="center">
  <img src="./agent-pipeline.png" alt="Agent pipeline — run-agent-1-extraction, run-agent-2-enhancement, build-ui-spec" width="400" />
</p>

```
PDF Slide (image)
      |
      v
+---------------------------------------------+
|              Agent 1 — The Scribe           |
|         Model: claude-sonnet-4-5            |
|                                             |
|  Extracts structured Knowledge Graph:       |
|  - title, summary, objective                |
|  - tags (key technical terms)               |
|  - visualAsset (diagram description)        |
|  - rawContent (bullet points)               |
+------------------+---------------------------+
                   |  Compact JSON (SHA-256 cached)
                   v
+---------------------------------------------+
|           Agent 2 — The Designer            |
|          Model: claude-haiku-4-5            |
|                                             |
|  Generates enhancement plan:                |
|  - Theme (colors, fonts)                    |
|  - Enhancements (text boxes, shapes)        |
|  - Interactivity mode:                      |
|    QuizReact / GameReact /                  |
|    WalkthroughReact / ExploreReact /        |
|    DiscussReact                             |
+------------------+---------------------------+
                   |
                   v
     UI Spec + Artifact Prompt + PPTX Export
```

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---|---|---|
| React | 19.2.4 | UI framework |
| Vite | 8.0.4 | Build tool and dev server |
| Tailwind CSS | 3.4.19 | Utility-first styling |
| Emotion | 11.14.0 | CSS-in-JS |
| pdfjs-dist | 5.6.205 | Client-side PDF rendering |
| socket.io-client | 4.8.3 | Real-time WebSocket client |
| qrcode.react | 4.2.0 | QR code generation |

### Backend
| Package | Version | Purpose |
|---|---|---|
| Node.js | 20.19.6 | Runtime |
| Express | 4.18.2 | HTTP server |
| Socket.io | 4.7.2 | Real-time slide sync and Q&A |

### Agent Workflow
| Package | Version | Purpose |
|---|---|---|
| TypeScript | 6.0.2 | Language |
| Mastra | 1.5.0 | Agent orchestration framework |
| @ai-sdk/anthropic | 3.0.69 | Claude model integration |
| Zod | 4.3.6 | Schema validation |
| pptxgenjs | 4.0.1 | PowerPoint generation |
| @mastra/memory | 1.15.0 | Agent memory |
| @mastra/observability | 1.9.0 | Tracing and observability |
| DuckDB / LibSQL | — | Agent data persistence |
| dotenv | 16.6.1 | Environment configuration |

### Infrastructure
| Tool | Purpose |
|---|---|
| ngrok | Public tunnel for student access |
| Node.js >= 22.13 | AgentWorkflow runtime requirement |
| Railway / AWS | Deployment targets |

---

## How It Works

1. **Teacher uploads a PDF** — slides are rendered client-side using PDF.js and converted to images.
2. **Teacher clicks "Present to Class"** — slides sync to the server; a QR code with the public student link appears in the sidebar.
3. **Students scan or open the link** — they see the current slide in real time, always in sync with the teacher.
4. **Students submit questions** — typed into an input bar at the bottom of their screen; questions appear as animated notifications on the teacher's display and are queued in the sidebar for verbal response.
5. **Teacher clicks "Enhance" on any slide** — the two-agent Mastra pipeline runs: Agent 1 extracts a structured knowledge graph, Agent 2 generates an interactive component with optional PPTX export.

---

## Getting Started

### Prerequisites

- Node.js 22+ (AgentWorkflow), Node.js 20+ (server)
- ngrok account (free tier sufficient)
- Anthropic API key

### 1. Clone the repository

```bash
git clone https://github.com/your-org/lecturelife
cd lecturelife
```

### 2. Start the backend server

```bash
cd server
npm install
NGROK_URL=https://your-ngrok-url.ngrok-free.dev node index.js
```

### 3. Start the agent workflow

```bash
cd AgentWorkflow
npm install
echo "ANTHROPIC_API_KEY=your_key_here" > .env
echo "ANTHROPIC_BASE_URL=https://api.anthropic.com" >> .env
npx tsx src/api/server.ts
```

### 4. Start the teacher frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Start ngrok

```bash
ngrok http 3001
```

Restart the server with the ngrok URL printed in the terminal:

```bash
NGROK_URL=https://your-url.ngrok-free.dev node index.js
```

### 6. Access the application

| Role | URL |
|---|---|
| Teacher | http://localhost:5173 |
| Student | https://your-url.ngrok-free.dev/student |

---

## Project Structure

```
lecturelife/
├── frontend/               # React teacher application (Vite)
│   ├── src/
│   │   ├── App.jsx         # Main UI, present overlay, Q&A panel
│   │   └── components/
│   └── package.json
├── server/                 # Express and Socket.io backend
│   ├── index.js            # Server, routes, socket events
│   ├── student.html        # Student view served directly
│   └── package.json
└── AgentWorkflow/          # Mastra agent pipeline (TypeScript)
    ├── src/
    │   ├── agents/         # extractionAgent.ts (Agent 1 and 2)
    │   ├── workflows/      # extraction-workflow.ts
    │   ├── utils/          # artifactPromptConverter, uiSpecConverter
    │   └── api/            # server.ts (Mastra HTTP API)
    └── package.json
```

---

## Known Limitations and Roadmap

### Current Limitations

| Limitation | Detail |
|---|---|
| ngrok dependency | Public student access requires a running ngrok tunnel. The URL changes every session on the free tier. |
| In-memory session state | Slides and questions are stored in memory — restarting the server clears the active session. |
| Single classroom | One active presentation session at a time. Multi-room support is not yet implemented. |
| Node.js version split | AgentWorkflow requires Node.js >= 22.13 while the server runs on 20.x, requiring two separate runtimes. |
| No authentication | Anyone with the ngrok URL can access the student view. No access control is implemented. |

### Roadmap

- **Persistent deployment** — migrate from ngrok to Railway or Render for a stable public URL with persistent session storage
- **Multi-room support** — unique room codes per session so multiple teachers can present simultaneously
- **Student identity** — optional name entry so the teacher knows who submitted each question
- **Question upvoting** — students surface the most important questions collectively
- **Confusion meter** — a live signal showing the teacher what percentage of students are struggling with the current slide
- **Post-session export** — generate a PDF summary of all questions, slides covered, and AI-generated study notes
- **AI question clustering** — group semantically similar questions into a single summary to reduce teacher sidebar noise

---

## Challenges

### QR Code Encoding Localhost

The most significant time investment of the build. The QR code was encoding `http://localhost:3001/student`, which works on the teacher's machine and nowhere else. A student's phone scanning that URL looks for a server on the phone itself, finds nothing, and renders a black screen.

The fix required three changes: binding the server to `0.0.0.0` instead of `localhost`; fetching the machine's real LAN IP via a `/info` endpoint rather than hardcoding localhost in the React app; and unblocking Node.js in macOS firewall settings, which was silently dropping incoming connections from other devices on the same network. We ultimately bypassed all of this with ngrok, which tunnels the local server through a stable HTTPS URL accessible from any device on any network.

### Socket.io Requests Intercepted by ngrok

After resolving the URL issue, the student page still showed a perpetual connecting state on mobile. ngrok intercepts unrecognized HTTP clients and serves a browser warning interstitial page. Socket.io's polling transport was receiving that warning page instead of a valid server response, causing silent connection failure.

The fix was adding `extraHeaders: { 'ngrok-skip-browser-warning': 'true' }` to the socket.io client configuration, which instructs ngrok to bypass the interstitial and pass requests directly to the server.

### Slide Images Over WebSocket

The initial architecture pushed the entire slide deck — base64-encoded PNG images — through a single `upload-slides` WebSocket event. On a local network this was functional. Over ngrok on mobile, the payload was too large and timed out silently, leaving the student view empty with no error.

The solution was a clear separation of concerns: WebSocket events carry only lightweight metadata (slide count, current index), while slide images are served as standard HTTP responses at `/slide/:index`. The student page fetches each image with a standard `img` element, which is what HTTP was designed for.

### Mastra API Configuration with Custom Base URL

The AgentWorkflow uses `@ai-sdk/anthropic`, which reads `ANTHROPIC_API_KEY` from the environment but does not respect `ANTHROPIC_BASE_URL` by default. Every agent call was hitting the wrong endpoint and returning authentication errors despite a valid key being present.

The resolution was replacing the default `anthropic` import with `createAnthropic({ apiKey, baseURL })`, which explicitly passes both values at instantiation time rather than relying on environment variable auto-detection.

---

## Market Opportunity

- K-12 schools addressing declining attendance and classroom engagement
- Universities seeking interactive lecture technology
- Online learning platforms lacking real-time student interaction
- Corporate training platforms requiring intelligent content automation

---

## Team

Built at **HackUP** — April 2026



MIT
