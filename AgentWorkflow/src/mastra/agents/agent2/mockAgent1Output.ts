import { SlideContentBatch } from '../../schemas/slideSchemas'

export const mockAgent1Output: SlideContentBatch = {
  deckTitle: 'Introduction to Marketing Strategy',
  totalSlides: 3,
  slides: [
    {
      slideIndex: 1,
      slideTitle: 'What is Marketing?',
      mainTopic: 'Marketing is the process of identifying, creating, and delivering value to customers.',
      keyConcepts: ['Value creation', 'Customer needs and wants', 'The marketing mix (4Ps)', 'Exchange process', 'Market orientation'],
      supportingDetails:
        'Marketing involves understanding what customers need, designing products or services that meet those needs, ' +
        'communicating the value proposition, and delivering it profitably. ' +
        'The 4Ps — Product, Price, Place, Promotion — provide a structured framework for marketing decisions.',
      visualElements: 'A circular diagram showing the 4Ps arranged around a central "Customer" label.',
      takeaway: 'Marketing is fundamentally about creating and communicating value to meet customer needs.',
      contentType: 'diagram',
      prerequisites: ['Basic business concepts', 'Supply and demand'],
      extractionStatus: 'success',
    },
    {
      slideIndex: 2,
      slideTitle: 'Market Segmentation',
      mainTopic: 'Dividing a broad market into distinct subgroups of consumers with common needs.',
      keyConcepts: ['Demographic segmentation', 'Psychographic segmentation', 'Behavioural segmentation', 'Geographic segmentation', 'MASDA criteria'],
      supportingDetails:
        'Effective segmentation requires segments to be Measurable, Accessible, Substantial, Differentiable, and Actionable (MASDA). ' +
        'A company cannot serve all customers equally well, so targeting attractive segments allows resource optimisation.',
      visualElements: 'A 2x2 matrix showing market segments plotted by size vs growth rate.',
      takeaway: 'Segmentation allows companies to focus on customers they can serve most profitably.',
      contentType: 'table',
      prerequisites: ['Marketing basics', 'Consumer behaviour'],
      extractionStatus: 'success',
    },
    {
      slideIndex: 3,
      slideTitle: 'Pricing Strategies',
      mainTopic: 'Approaches companies use to set the price of their products or services.',
      keyConcepts: ['Cost-plus pricing', 'Value-based pricing', 'Competitive pricing', 'Penetration pricing', 'Price skimming', 'Price elasticity'],
      supportingDetails:
        'Cost-plus pricing adds a markup to cost; value-based pricing anchors price to perceived customer value. ' +
        'Price elasticity measures how sensitive demand is to price changes. Luxury goods often have inelastic demand.',
      visualElements: 'A demand curve graph with annotations highlighting elastic and inelastic sections.',
      takeaway: 'Pricing decisions must balance cost recovery, competitive positioning, and perceived customer value.',
      contentType: 'mixed',
      prerequisites: ['Supply and demand curves', 'Cost accounting basics'],
      extractionStatus: 'success',
    },
  ],
}

export const mockBiologySlides: SlideContentBatch = {
  deckTitle: 'Cell Biology: Mitosis and Meiosis',
  totalSlides: 2,
  slides: [
    {
      slideIndex: 1,
      slideTitle: 'Mitosis Overview',
      mainTopic: 'Mitosis is the process by which a single cell divides into two genetically identical daughter cells.',
      keyConcepts: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase', 'Cytokinesis', 'Sister chromatids', 'Spindle fibres'],
      supportingDetails:
        'Mitosis produces two diploid cells (2n) with identical genetic material. ' +
        'It occurs in somatic cells for growth and repair. The process takes approximately 1–2 hours in mammalian cells.',
      visualElements: 'Step-by-step diagram of the four mitosis phases showing chromosome positions at each stage.',
      takeaway: 'Mitosis ensures every new body cell receives an exact copy of the parent cell\'s genetic information.',
      contentType: 'diagram',
      prerequisites: ['Cell structure', 'DNA and chromosomes'],
      extractionStatus: 'success',
    },
    {
      slideIndex: 2,
      slideTitle: 'Mitosis vs Meiosis',
      mainTopic: 'Comparison of mitosis (asexual cell division) and meiosis (sexual reproduction cell division).',
      keyConcepts: ['Diploid (2n) vs Haploid (n)', '2 daughter cells vs 4', 'Genetic diversity', 'Crossing over', 'Growth/repair vs gamete production'],
      supportingDetails:
        'Mitosis = 2 diploid identical daughters; Meiosis = 4 haploid genetically unique daughters. ' +
        'Meiosis introduces genetic diversity through crossing over during Prophase I.',
      visualElements: 'Side-by-side comparison table with rows: daughter cells, chromosome number, genetic outcome, purpose.',
      takeaway: 'Mitosis copies; meiosis diversifies — together they underpin individual growth and species evolution.',
      contentType: 'table',
      prerequisites: ['Mitosis', 'Genetics basics'],
      extractionStatus: 'success',
    },
  ],
}