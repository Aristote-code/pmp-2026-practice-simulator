import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { optionCode, parseMatching, parsePullDown } from './bank'
import { PRETEST_NUMBERS, isCorrect, scoreExam } from './scoring'
import type { ExamSession, PmpAnswer, PmpBank, PmpQuestion } from './types'

const bank = JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/pmp-question-bank.json'), 'utf8')) as PmpBank
const forms = Object.values(bank.forms)

function mapAnswer(value: string): Record<string, string> {
  return Object.fromEntries(value.split(';').map((part) => {
    const [key, ...answer] = part.split('->')
    return [key?.trim() ?? '', answer.join('->').trim()]
  }))
}

function correctAnswer(question: PmpQuestion): PmpAnswer {
  if (question.qformat === 'Multiple-response') return question.correct.split(',').map((value) => value.trim())
  if (question.qformat === 'Matching' || question.qformat === 'Enhanced matching' || question.qformat === 'Pull-down list') return mapAnswer(question.correct)
  if (question.qformat === 'Point and click') {
    if (question.correct.startsWith('Activity')) return question.correct.match(/Activity ([A-F])/)?.[1] ?? ''
    if (question.correct.startsWith('Point')) return question.correct.match(/Point (\d+)/)?.[1] ?? ''
    return question.correct.includes('Manage closely') ? 'Manage closely' : question.correct.split(' ')[0] ?? ''
  }
  return question.correct
}

function sessionFor(formId: string, answers: Record<string, PmpAnswer>): ExamSession {
  return { formId, mode: 'simulation', screen: 'results', currentIndex: 179, sectionIndex: 2, answers, flags: [], eliminated: {}, pointMarkers: {}, lockedThrough: 179, deadline: 0, remainingSeconds: 0, startedAt: 0 }
}

describe('PMP 2026 question bank', () => {
  it('contains four complete and correctly allocated 180-question forms', () => {
    expect(forms).toHaveLength(4)
    for (const form of forms) {
      expect(form.questions).toHaveLength(180)
      expect(form.questions.map((question) => question.number)).toEqual(Array.from({ length: 180 }, (_, index) => index + 1))
      expect(form.questions.filter((question) => question.domain === 'People')).toHaveLength(59)
      expect(form.questions.filter((question) => question.domain === 'Process')).toHaveLength(74)
      expect(form.questions.filter((question) => question.domain === 'Business Environment')).toHaveLength(47)
      expect(form.questions.filter((question) => question.approach === 'Predictive')).toHaveLength(72)
      expect(form.questions.filter((question) => question.approach === 'Agile')).toHaveLength(54)
      expect(form.questions.filter((question) => question.approach === 'Hybrid')).toHaveLength(54)
      expect(form.questions.slice(0, 20).every((question) => question.case_id)).toBe(true)
      expect(form.questions.slice(20).every((question) => !question.case_id)).toBe(true)
    }
  })

  it('contains every interaction family and 720 distinct full item signatures', () => {
    const questions = forms.flatMap((form) => form.questions)
    const signatures = questions.map((question) => JSON.stringify([question.stem, question.options, question.correct, question.visual_html]))
    expect(new Set(signatures).size).toBe(720)
    expect(new Set(questions.map((question) => question.qformat))).toEqual(new Set([
      'Case or scenario', 'Enhanced matching', 'Graphic-based', 'Matching',
      'Multiple-choice single response', 'Multiple-response', 'Point and click', 'Pull-down list',
    ]))
  })

  it('has answerable, internally consistent structured interactions', () => {
    for (const question of forms.flatMap((form) => form.questions)) {
      expect(question.stem.length).toBeGreaterThan(25)
      expect(question.rationale.length).toBeGreaterThan(30)
      if (question.qformat === 'Multiple-response') {
        for (const code of question.correct.split(',').map((value) => value.trim())) expect(question.options[code.charCodeAt(0) - 65]).toBeTruthy()
      } else if (question.qformat === 'Matching' || question.qformat === 'Enhanced matching') {
        const interaction = parseMatching(question)
        expect(interaction.rows.length).toBeGreaterThan(1)
        expect(interaction.choices.length).toBeGreaterThan(2)
      } else if (question.qformat === 'Pull-down list') {
        const interaction = parsePullDown(question)
        const expected = mapAnswer(question.correct)
        expect(interaction.rows.length).toBeGreaterThan(1)
        for (const row of interaction.rows) expect(row.choices).toContain(expected[row.id])
      } else if (question.qformat !== 'Point and click') {
        const codes = question.options.map(optionCode)
        expect(codes).toContain(question.correct)
      }
    }
  })

  it('scores a perfect response set as 170 of 170 while excluding ten pretest positions', () => {
    expect(PRETEST_NUMBERS.size).toBe(10)
    for (const [formId, form] of Object.entries(bank.forms)) {
      const answers = Object.fromEntries(form.questions.map((question) => [String(question.number), correctAnswer(question)]))
      for (const question of form.questions) expect(isCorrect(question, answers[String(question.number)])).toBe(true)
      const result = scoreExam(form, sessionFor(formId, answers))
      expect(result.correct).toBe(170)
      expect(result.total).toBe(170)
      expect(result.percent).toBe(100)
    }
  })
})
