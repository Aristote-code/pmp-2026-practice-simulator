import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, Grid3X3, RotateCcw, Sparkles } from 'lucide-react'
import { DragDropBoard } from './DragDropBoard'
import {
  describeDragAnswer,
  isDragAnswerComplete,
  isDragAnswerCorrect,
  loadDragDropPack,
} from './dragDrop'
import type { DragAnswer, DragDropPack } from './dragDrop'

const STORAGE_KEY = 'pmp-drag-drop-lab-v1'

interface LabState {
  current: number
  answers: Record<string, DragAnswer>
  submitted: number[]
  feedback: Record<string, string>
}

const EMPTY_STATE: LabState = { current: 0, answers: {}, submitted: [], feedback: {} }

function readState(): LabState {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value ? { ...EMPTY_STATE, ...JSON.parse(value) as LabState } : EMPTY_STATE
  } catch {
    return EMPTY_STATE
  }
}

export function DragDropLab({ onBack }: { onBack: () => void }) {
  const [pack, setPack] = useState<DragDropPack | null>(null)
  const [error, setError] = useState('')
  const [state, setState] = useState<LabState>(readState)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => { void loadDragDropPack().then(setPack).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load the drill pack.')) }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) }, [state])

  const question = pack?.questions[state.current]
  const answer = question ? state.answers[String(question.id)] ?? {} : {}
  const submitted = question ? state.submitted.includes(question.id) : false
  const correct = question ? isDragAnswerCorrect(question, answer) : false
  const completed = useMemo(() => pack ? pack.questions.filter((item) => state.submitted.includes(item.id)).length : 0, [pack, state.submitted])
  const correctCount = useMemo(() => pack ? pack.questions.filter((item) => state.submitted.includes(item.id) && isDragAnswerCorrect(item, state.answers[String(item.id)] ?? {})).length : 0, [pack, state.answers, state.submitted])

  if (error) return <main className="pmp-loading"><CircleAlert size={42} /><h1>Drag-and-drop pack unavailable</h1><p>{error}</p><button className="pmp-secondary" onClick={onBack}><ArrowLeft size={17} /> Practice library</button></main>
  if (!pack || !question) return <main className="pmp-loading"><div className="loading-ring" /><h1>Preparing drag-and-drop drills</h1><p>Validating 110 interactive questions.</p></main>

  const setAnswer = (next: DragAnswer) => setState((current) => ({ ...current, answers: { ...current.answers, [String(question.id)]: next } }))
  const go = (index: number) => {
    setState((current) => ({ ...current, current: Math.max(0, Math.min(pack.questions.length - 1, index)) }))
    setNavigatorOpen(false)
    window.scrollTo({ top: 0 })
  }
  const requestFeedback = async () => {
    if (state.feedback[String(question.id)] || feedbackLoading) return
    setFeedbackLoading(true)
    try {
      const response = await fetch('/api/pmp-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `${question.title}. ${question.targets.map((target) => target.prompt).join(' | ')}`,
          options: question.choices.map((choice) => choice.label),
          selected: describeDragAnswer(question, answer),
          correct: describeDragAnswer(question, question.correct),
          rationale: question.rationale,
          domain: 'PMP drag-and-drop knowledge',
          task: question.title,
          approach: 'Mixed',
        }),
      })
      if (!response.ok) throw new Error('AI feedback unavailable')
      const data = await response.json() as { feedback?: string }
      setState((current) => ({ ...current, feedback: { ...current.feedback, [String(question.id)]: data.feedback || question.rationale } }))
    } catch {
      setState((current) => ({ ...current, feedback: { ...current.feedback, [String(question.id)]: question.rationale } }))
    } finally {
      setFeedbackLoading(false)
    }
  }
  const submit = () => {
    if (!isDragAnswerComplete(question, answer)) return
    setState((current) => ({ ...current, submitted: current.submitted.includes(question.id) ? current.submitted : [...current.submitted, question.id] }))
    void requestFeedback()
  }
  const reset = () => setState((current) => ({
    ...current,
    answers: { ...current.answers, [String(question.id)]: {} },
    submitted: current.submitted.filter((id) => id !== question.id),
    feedback: Object.fromEntries(Object.entries(current.feedback).filter(([id]) => id !== String(question.id))),
  }))

  return <div className="drag-lab-screen">
    <header className="exam-top"><button className="pmp-secondary" onClick={onBack}><ArrowLeft size={17} /> Library</button><div className="exam-title">Drag &amp; Drop Lab<small>Question {question.id} of {pack.questions.length}</small></div><div className="lab-score"><strong>{correctCount}/{completed || 0}</strong><small>correct</small></div></header>
    <nav className="exam-tools"><button onClick={() => setNavigatorOpen((value) => !value)}><Grid3X3 size={17} /> Navigator</button><button onClick={reset}><RotateCcw size={17} /> Reset question</button></nav>
    {navigatorOpen && <section className="lab-navigator"><div className="question-grid">{pack.questions.map((item, index) => <button key={item.id} className={`${index === state.current ? 'current' : ''} ${state.submitted.includes(item.id) ? 'answered' : ''}`} onClick={() => go(index)}>{item.id}</button>)}</div></section>}
    <main className="drag-lab-main">
      <div className="question-status"><span>Question {question.id} of {pack.questions.length}</span><span>Knowledge matching</span><span>{question.targets.some((target) => target.capacity > 1) ? 'Classification' : 'Matching'}</span></div>
      <section className="question-card">
        <p className="question-instruction">{question.instruction}</p>
        <h1>{question.title}</h1>
        <DragDropBoard choices={question.choices} targets={question.targets} value={answer} disabled={submitted} onChange={setAnswer} />
        {submitted && <section className={`feedback-panel ${correct ? 'correct' : 'incorrect'}`} aria-live="polite"><header>{correct ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}<strong>{correct ? 'Correct' : 'Incorrect'}</strong><span>Answer submitted</span></header><div className="feedback-explanation"><h2>{correct ? 'Why the placement works' : 'Review the correct placement'}</h2><p>{state.feedback[String(question.id)] || question.rationale}</p></div>{feedbackLoading && <div className="ai-feedback-status"><Sparkles size={16} /> AI coach is preparing a personalized explanation...</div>}<p className="source-note">{question.source} Source pages {question.source_pages.join('-')}.</p></section>}
      </section>
    </main>
    <footer className="question-footer"><button className="pmp-secondary" disabled={state.current === 0} onClick={() => go(state.current - 1)}><ArrowLeft size={17} /> Previous</button><span className="progress-line"><i style={{ width: `${((state.current + 1) / pack.questions.length) * 100}%` }} /></span>{!submitted && <button className="pmp-primary check-answer" disabled={!isDragAnswerComplete(question, answer)} onClick={submit}><Check size={17} /> Submit answer</button>}<button className="pmp-primary" disabled={state.current === pack.questions.length - 1} onClick={() => go(state.current + 1)}>Next <ArrowRight size={17} /></button></footer>
  </div>
}
