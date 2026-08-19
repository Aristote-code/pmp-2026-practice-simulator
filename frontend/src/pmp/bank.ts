import type { PmpBank, PmpQuestion } from './types'

let bankPromise: Promise<PmpBank> | null = null

export function loadPmpBank(): Promise<PmpBank> {
  if (!bankPromise) {
    bankPromise = fetch('/data/pmp-question-bank.json', { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`Question bank failed to load (${response.status})`)
      return response.json() as Promise<PmpBank>
    })
  }
  return bankPromise
}

export function optionCode(option: string, index: number): string {
  const match = option.match(/^([A-Z])\.\s/)
  return match?.[1] ?? String.fromCharCode(65 + index)
}

export function optionText(option: string): string {
  return option.replace(/^[A-Z]\.\s*/, '')
}

export interface MatchRow {
  id: string
  prompt: string
}

export interface MatchChoice {
  code: string
  label: string
}

export function parseMatching(question: PmpQuestion): { rows: MatchRow[]; choices: MatchChoice[] } {
  const documentNode = new DOMParser().parseFromString(question.visual_html, 'text/html')
  const tables = Array.from(documentNode.querySelectorAll('table'))
  const rows = Array.from(tables[0]?.querySelectorAll('tbody tr') ?? []).map((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')
    return { id: cells[0] ?? '', prompt: cells[1] ?? '' }
  }).filter((row) => row.id && row.prompt)
  const choices = question.options.map((option, index) => ({
    code: optionCode(option, index),
    label: optionText(option),
  }))
  return { rows, choices }
}

export interface PullDownRow {
  id: string
  choices: string[]
}

export function parsePullDown(question: PmpQuestion): { sentence: string; rows: PullDownRow[] } {
  const documentNode = new DOMParser().parseFromString(question.visual_html, 'text/html')
  const sentence = documentNode.querySelector('.dropdown-sentence')?.textContent?.trim() ?? question.stem
  const rows = Array.from(documentNode.querySelectorAll('tbody tr')).map((row) => {
    const cells = Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')
    return { id: cells[0] ?? '', choices: (cells[1] ?? '').split('|').map((choice) => choice.trim()).filter(Boolean) }
  }).filter((row) => row.id && row.choices.length)
  return { sentence, rows }
}
