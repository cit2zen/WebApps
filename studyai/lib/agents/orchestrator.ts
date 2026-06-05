import type { StructuredResponse } from '../types'
import { runExplainer }        from './explainer'
import { runFormulaExtractor } from './formula-extractor'
import { runChartGenerator }   from './chart-generator'
import { runTermExtractor }    from './term-extractor'
import { runSrsClassifier }    from './srs-classifier'

export async function orchestrate(
  question: string,
  context?: string
): Promise<StructuredResponse> {
  // Round 1: 설명 에이전트 (나머지 에이전트들의 입력이 됨)
  const explanation = await runExplainer(question, context)

  const explanationText = `${explanation.intuitive}\n\n${explanation.detailed}`

  // Round 2: 4개 추출 에이전트 병렬 실행
  const [formulas, charts, terms, srs] = await Promise.all([
    runFormulaExtractor(question, explanationText),
    runChartGenerator(question, explanationText),
    runTermExtractor(question, explanationText),
    runSrsClassifier(question, explanation.intuitive),
  ])

  return {
    intuitive: explanation.intuitive,
    detailed:  explanation.detailed,
    formulas,
    charts,
    terms,
    srs,
  }
}
