export type PmpDomain = 'People' | 'Process' | 'Business Environment'
export type PmpApproach = 'Predictive' | 'Agile' | 'Hybrid'

export type PmpFormat =
  | 'Case or scenario'
  | 'Enhanced matching'
  | 'Graphic-based'
  | 'Matching'
  | 'Multiple-choice single response'
  | 'Multiple-response'
  | 'Point and click'
  | 'Pull-down list'

export interface PmpCase {
  case_id: string
  title: string
  approach: PmpApproach
  overview: string
  facts: Array<[string, string]>
}

export interface PmpQuestion {
  exam: number
  number: number
  domain: PmpDomain
  task_code: string
  task_title: string
  approach: PmpApproach
  difficulty: 'Easy' | 'Medium' | 'Difficult'
  qformat: PmpFormat
  stem: string
  options: string[]
  correct: string
  rationale: string
  visual_html: string
  case_id: string | null
  case_title: string | null
  instruction: string
  source_note: string
}

export interface PmpForm {
  cases: PmpCase[]
  questions: PmpQuestion[]
}

export interface PmpBank {
  title: string
  schema_version: string
  generated_on: string
  disclaimer: string
  blueprint: Record<string, unknown>
  forms: Record<string, PmpForm>
}

export type StructuredAnswer = Record<string, string>
export type PmpAnswer = string | string[] | StructuredAnswer

export interface PointMarker {
  x: number
  y: number
}

export type ExamMode = 'simulation' | 'study'

export interface ExamSession {
  formId: string
  mode: ExamMode
  screen: 'exam' | 'section-review' | 'break' | 'results' | 'review'
  currentIndex: number
  sectionIndex: number
  answers: Record<string, PmpAnswer>
  flags: number[]
  eliminated: Record<string, string[]>
  pointMarkers: Record<string, PointMarker>
  lockedThrough: number
  deadline: number
  breakDeadline?: number
  remainingSeconds: number
  startedAt: number
  completedAt?: number
}
