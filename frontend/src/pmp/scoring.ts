import { optionCode } from './bank'
import type { ExamSession, PmpAnswer, PmpForm, PmpQuestion, StructuredAnswer } from './types'

export const PRETEST_NUMBERS = new Set([12, 30, 48, 66, 84, 102, 120, 138, 156, 174])

const normalize = (value: string) => value.trim().toLowerCase().replace(/[.;]+$/, '')

function parseMap(value: string): StructuredAnswer {
  return Object.fromEntries(value.split(';').map((part) => {
    const [key, ...rest] = part.split('->')
    return [key?.trim() ?? '', rest.join('->').trim()]
  }).filter(([key, answer]) => key && answer))
}

function pointIsCorrect(answer: string, correct: string): boolean {
  const normalized = normalize(answer)
  const target = normalize(correct)
  if (target.includes('manage closely')) return normalized === 'manage closely'
  if (target.startsWith('r')) return normalized === target.split(' ')[0]
  if (target.startsWith('point')) return normalized === target.match(/point\s+(\d+)/)?.[1]
  if (target.startsWith('activity')) {
    const accepted = Array.from(correct.matchAll(/activity\s+([a-f])/gi), (match) => match[1]?.toLowerCase())
    return accepted.includes(normalized)
  }
  return normalized === target
}

export function isAnswered(answer: PmpAnswer | undefined): boolean {
  if (typeof answer === 'string') return answer.trim().length > 0
  if (Array.isArray(answer)) return answer.length > 0
  return Boolean(answer && Object.values(answer).some(Boolean))
}

export function isCorrect(question: PmpQuestion, answer: PmpAnswer | undefined): boolean {
  if (!isAnswered(answer)) return false
  if (question.qformat === 'Multiple-response') {
    const expected = question.correct.split(',').map((value) => value.trim()).sort()
    return Array.isArray(answer) && answer.slice().sort().join('|') === expected.join('|')
  }
  if (question.qformat === 'Matching' || question.qformat === 'Enhanced matching' || question.qformat === 'Pull-down list') {
    if (!answer || typeof answer === 'string' || Array.isArray(answer)) return false
    const expected = parseMap(question.correct)
    return Object.entries(expected).every(([key, value]) => normalize(answer[key] ?? '') === normalize(value))
  }
  if (question.qformat === 'Point and click') {
    return typeof answer === 'string' && pointIsCorrect(answer, question.correct)
  }
  const expectedCode = question.correct.trim()
  if (typeof answer !== 'string') return false
  if (/^[A-Z]$/.test(expectedCode)) return answer === expectedCode
  const optionIndex = question.options.findIndex((option) => optionCode(option, 0) === answer)
  return optionIndex >= 0 && normalize(question.options[optionIndex] ?? '') === normalize(expectedCode)
}

export interface ScoreSlice {
  label: string
  correct: number
  total: number
  percent: number
  performance: 'Above Target' | 'Target' | 'Below Target' | 'Needs Improvement'
}

const performance = (percent: number): ScoreSlice['performance'] => {
  if (percent >= 80) return 'Above Target'
  if (percent >= 70) return 'Target'
  if (percent >= 55) return 'Below Target'
  return 'Needs Improvement'
}

function slice(label: string, questions: PmpQuestion[], session: ExamSession): ScoreSlice {
  const scored = questions.filter((question) => !PRETEST_NUMBERS.has(question.number))
  const correct = scored.filter((question) => isCorrect(question, session.answers[String(question.number)])).length
  const percent = scored.length ? Math.round((correct / scored.length) * 100) : 0
  return { label, correct, total: scored.length, percent, performance: performance(percent) }
}

export function scoreExam(form: PmpForm, session: ExamSession) {
  const scored = form.questions.filter((question) => !PRETEST_NUMBERS.has(question.number))
  const correct = scored.filter((question) => isCorrect(question, session.answers[String(question.number)])).length
  const percent = Math.round((correct / scored.length) * 100)
  const domains = ['People', 'Process', 'Business Environment'].map((domain) =>
    slice(domain, form.questions.filter((question) => question.domain === domain), session),
  )
  const approaches = ['Predictive', 'Agile', 'Hybrid'].map((approach) =>
    slice(approach, form.questions.filter((question) => question.approach === approach), session),
  )
  const formats = Array.from(new Set(form.questions.map((question) => question.qformat))).map((format) =>
    slice(format, form.questions.filter((question) => question.qformat === format), session),
  )
  return { correct, total: scored.length, percent, performance: performance(percent), domains, approaches, formats }
}
