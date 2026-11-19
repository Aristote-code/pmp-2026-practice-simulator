export interface DragChoice {
  id: string
  label: string
}

export interface DragTarget {
  id: string
  prompt: string
  capacity: number
}

export type DragAnswer = Record<string, string[]>

export interface DragDropDrill {
  id: number
  title: string
  instruction: string
  choices: DragChoice[]
  targets: DragTarget[]
  correct: DragAnswer
  rationale: string
  source: string
  source_pages: [number, number]
}

export interface DragDropPack {
  title: string
  schema_version: string
  disclaimer: string
  questions: DragDropDrill[]
}

let packPromise: Promise<DragDropPack> | null = null

export function loadDragDropPack(): Promise<DragDropPack> {
  if (!packPromise) {
    packPromise = fetch('/data/pmp-drag-drop-drills.json', { cache: 'force-cache' }).then(async (response) => {
      if (!response.ok) throw new Error(`Drag-and-drop pack failed to load (${response.status})`)
      return response.json() as Promise<DragDropPack>
    })
  }
  return packPromise
}

export function isDragAnswerComplete(question: DragDropDrill, answer: DragAnswer): boolean {
  return question.targets.every((target) => (answer[target.id] ?? []).length === target.capacity)
}

export function isDragAnswerCorrect(question: DragDropDrill, answer: DragAnswer): boolean {
  return question.targets.every((target) => {
    const expected = [...(question.correct[target.id] ?? [])].sort()
    const actual = [...(answer[target.id] ?? [])].sort()
    return expected.length === actual.length && expected.every((choice, index) => choice === actual[index])
  })
}

export function describeDragAnswer(question: DragDropDrill, answer: DragAnswer): string {
  const labels = Object.fromEntries(question.choices.map((choice) => [choice.id, choice.label]))
  return question.targets.map((target) => {
    const placed = (answer[target.id] ?? []).map((choiceId) => labels[choiceId] ?? choiceId)
    return `${target.prompt}: ${placed.join(', ') || 'No response'}`
  }).join('; ')
}
