import { extractionAgent } from './agents/agent1/extractionAgent'
import { lessonDesignerAgent } from './agents/agent2/lessonDesignerAgent'
import { slideTransformationWorkflow } from './workflows/slideTransformationWorkflow'
import { weatherWorkflow } from './workflows/weather-workflow'
import { Mastra } from '@mastra/core/mastra'
import { PinoLogger } from '@mastra/loggers'
import { LibSQLStore } from '@mastra/libsql'
import { DuckDBStore } from '@mastra/duckdb'
import { MastraCompositeStore } from '@mastra/core/storage'
import { Observability, DefaultExporter, CloudExporter, SensitiveDataFilter } from '@mastra/observability'
import { weatherAgent } from './agents/weather-agent'
import { toolCallAppropriatenessScorer, completenessScorer, translationScorer } from './scorers/weather-scorer'

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    slideTransformationWorkflow,
  },
  agents: {
    weatherAgent,
    extractionAgent,
    lessonDesignerAgent,
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new LibSQLStore({
      id: 'mastra-storage',
      url: 'file:./mastra.db',
    }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter(), new CloudExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
})