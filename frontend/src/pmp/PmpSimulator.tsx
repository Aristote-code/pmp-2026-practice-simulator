import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Flag,
  Grid3X3,
  HelpCircle,
  Highlighter,
  LockKeyhole,
  Menu,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Strikethrough,
  X,
} from 'lucide-react'
import { loadPmpBank, optionCode, optionText, parseMatching, parsePullDown } from './bank'
import { PRETEST_NUMBERS, isAnswered, isCorrect, scoreExam } from './scoring'
import type {
  ExamMode,
  ExamSession,
  PmpAnswer,
  PmpBank,
  PmpCase,
  PmpForm,
  PmpQuestion,
  PointMarker,
} from './types'

const STORAGE_KEY = 'pmp-practice-session-v1'
const EXAM_SECONDS = 240 * 60
const SECTION_RANGES: Array<[number, number]> = [[0, 19], [20, 99], [100, 179]]

type LandingScreen = 'library' | 'tutorial'
type ToolModal = 'none' | 'calculator' | 'notes' | 'help' | 'navigator'
type ReviewFilter = 'all' | 'incomplete' | 'flagged'

function readSession(): ExamSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as ExamSession : null
  } catch {
    return null
  }
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remaining = safe % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${minutes}:${String(remaining).padStart(2, '0')}`
}

function answerLabel(question: PmpQuestion, answer: PmpAnswer | undefined): string {
  if (!answer) return 'No response'
  if (Array.isArray(answer)) {
    return answer.map((code) => {
      const index = code.charCodeAt(0) - 65
      return `${code}. ${question.options[index] ?? ''}`
    }).join(' / ')
  }
  if (typeof answer === 'object') return Object.entries(answer).map(([key, value]) => `${key} → ${value}`).join('; ')
  const optionIndex = answer.length === 1 ? answer.charCodeAt(0) - 65 : -1
  return optionIndex >= 0 && question.options[optionIndex]
    ? `${answer}. ${optionText(question.options[optionIndex] ?? '')}`
    : answer
}

function answerPayload(question: PmpQuestion, answer: PmpAnswer | undefined): string {
  return answerLabel(question, answer)
}

function correctResponseLabel(question: PmpQuestion): string {
  const codes = question.correct.split(',').map((value) => value.trim())
  if (codes.every((code) => /^[A-Z]$/.test(code))) {
    return codes.map((code) => {
      const option = question.options[code.charCodeAt(0) - 65]
      return option ? `${code}. ${optionText(option)}` : code
    }).join(' / ')
  }
  return question.correct
}

function Brand() {
  return <div className="pmp-brand"><span className="pmp-mark">P</span><span><strong>Project Exam Practice</strong><small>2026 simulator</small></span></div>
}

function LoadingScreen() {
  return <main className="pmp-loading"><div className="loading-ring" /><h1>Preparing the question bank</h1><p>Loading four complete 2026-aligned practice forms.</p></main>
}

function ErrorScreen({ message }: { message: string }) {
  return <main className="pmp-loading"><CircleAlert size={42} /><h1>Question bank unavailable</h1><p>{message}</p><button className="pmp-primary" onClick={() => location.reload()}>Try again</button></main>
}

function Library({ bank, saved, onStart, onResume }: {
  bank: PmpBank
  saved: ExamSession | null
  onStart: (formId: string, mode: ExamMode) => void
  onResume: () => void
}) {
  return <div className="pmp-home">
    <header className="home-header"><Brand /><div className="unofficial-badge">Independent practice · not affiliated with PMI or Pearson VUE</div></header>
    <main className="home-main">
      <section className="library-intro">
        <div><p className="pmp-eyebrow">PMP examination practice</p><h1>Choose a complete simulation</h1><p>Four original 180-question forms aligned to the July 2026 content outline, including case studies and interactive item types.</p></div>
        <div className="blueprint-facts">
          <span><strong>180</strong> questions</span><span><strong>240</strong> minutes</span><span><strong>2</strong> breaks</span><span><strong>8</strong> formats</span>
        </div>
      </section>
      {saved && saved.screen !== 'results' && <section className="resume-band">
        <div><Play size={22} /><span><strong>Practice Test {saved.formId} is in progress</strong><small>Question {saved.currentIndex + 1} of 180 · {saved.mode === 'simulation' ? 'Strict simulation' : 'Guided study'}</small></span></div>
        <button className="pmp-primary" onClick={onResume}>Resume <ArrowRight size={17} /></button>
      </section>}
      <section className="form-list" aria-label="Practice tests">
        {Object.entries(bank.forms).map(([formId, form]) => <article className="form-row" key={formId}>
          <div className="form-number">{formId}</div>
          <div className="form-copy"><h2>Practice Test {formId}</h2><p>{form.cases.length} linked case studies · {form.questions.filter((q) => q.qformat === 'Multiple-response').length} multiple-response · {form.questions.filter((q) => q.visual_html).length} exhibits</p><div className="domain-strip"><span style={{ width: '33%' }}>People 33%</span><span style={{ width: '41%' }}>Process 41%</span><span style={{ width: '26%' }}>Business 26%</span></div></div>
          <div className="form-actions">
            <button className="pmp-primary" onClick={() => onStart(formId, 'simulation')}><Clock3 size={17} /> Full simulation</button>
            <button className="pmp-secondary" onClick={() => onStart(formId, 'study')}><BookOpenCheck size={17} /> Guided study</button>
          </div>
        </article>)}
      </section>
      <section className="method-note"><CheckCircle2 size={24} /><div><strong>Scoring that stays honest</strong><p>Answers are scored exactly from the bank. AI explains your reasoning after submission; it never changes the objective score. Results are practice estimates because PMI's equating and passing standard are proprietary.</p></div></section>
    </main>
  </div>
}

function Tutorial({ mode, onBack, onBegin }: { mode: ExamMode; onBack: () => void; onBegin: () => void }) {
  return <div className="tutorial-screen">
    <header className="exam-top"><Brand /><span className="candidate-label">Candidate tutorial</span></header>
    <main className="tutorial-main">
      <p className="pmp-eyebrow">Before you begin</p><h1>Exam navigation tutorial</h1>
      <div className="tutorial-grid">
        <div><Grid3X3 size={24} /><strong>Review within each section</strong><p>Flag questions and use the navigator. Once you start a break, the previous section is permanently locked.</p></div>
        <div><Strikethrough size={24} /><strong>Eliminate choices</strong><p>Turn on Strikeout, then select an answer choice you want to cross out.</p></div>
        <div><Highlighter size={24} /><strong>Highlight text</strong><p>Select words in the question and use Highlight to mark the current screen.</p></div>
        <div><Calculator size={24} /><strong>Use exam tools</strong><p>A calculator and private notes panel are available in the toolbar.</p></div>
      </div>
      <div className="tutorial-notice"><strong>{mode === 'simulation' ? 'Strict simulation' : 'Guided study'} mode</strong><p>{mode === 'simulation' ? 'Correctness and explanations remain hidden until all sections are submitted.' : 'Use Check answer after each response to receive the rationale and AI coaching.'}</p></div>
      <div className="tutorial-actions"><button className="pmp-secondary" onClick={onBack}><ArrowLeft size={17} /> Test library</button><button className="pmp-primary" onClick={onBegin}>Begin exam <ArrowRight size={17} /></button></div>
    </main>
  </div>
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className={`tool-modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header><h2>{title}</h2><button className="icon-button" title="Close" onClick={onClose}><X size={20} /></button></header><div className="modal-body">{children}</div></section></div>
}

function CalculatorTool() {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const input = (value: string) => setDisplay((current) => current === '0' ? value : current + value)
  const operate = (next: string) => { setStored(Number(display)); setOperator(next); setDisplay('0') }
  const equals = () => {
    if (stored === null || !operator) return
    const right = Number(display)
    const result = operator === '+' ? stored + right : operator === '−' ? stored - right : operator === '×' ? stored * right : right === 0 ? 0 : stored / right
    setDisplay(String(Number(result.toFixed(8)))); setStored(null); setOperator(null)
  }
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', 'C', '+']
  return <div className="calculator"><output>{display}</output><div>{keys.map((key) => <button key={key} onClick={() => key === 'C' ? setDisplay('0') : ['÷', '×', '−', '+'].includes(key) ? operate(key) : input(key)}>{key}</button>)}<button className="equals" onClick={equals}>=</button></div></div>
}

function Navigator({ form, session, onJump, onClose }: { form: PmpForm; session: ExamSession; onJump: (index: number) => void; onClose: () => void }) {
  const [start, end] = SECTION_RANGES[session.sectionIndex] ?? [0, 179]
  return <div className="navigator"><div className="nav-legend"><span><i className="answered" /> Answered</span><span><i /> Unanswered</span><span><Flag size={13} /> Flagged</span></div><div className="question-grid">{form.questions.slice(start, end + 1).map((question, offset) => {
    const index = start + offset
    return <button key={question.number} className={`${index === session.currentIndex ? 'current' : ''} ${isAnswered(session.answers[String(question.number)]) ? 'answered' : ''}`} onClick={() => { onJump(index); onClose() }}><span>{question.number}</span>{session.flags.includes(question.number) && <Flag size={11} />}</button>
  })}</div></div>
}

function CasePanel({ caseStudy }: { caseStudy: PmpCase }) {
  const [open, setOpen] = useState(true)
  return <aside className={`case-panel ${open ? 'open' : ''}`}><button className="case-toggle" onClick={() => setOpen((value) => !value)}><span>Case study: {caseStudy.title}</span><ChevronDown size={18} /></button>{open && <div className="case-content"><p>{caseStudy.overview}</p><table><tbody>{caseStudy.facts.map(([label, value]) => <tr key={label}><th>{label}</th><td>{value}</td></tr>)}</tbody></table></div>}</aside>
}

function PointAndClick({ question, answer, marker, onAnswer, onMarker }: {
  question: PmpQuestion
  answer: PmpAnswer | undefined
  marker: PointMarker | undefined
  onAnswer: (answer: PmpAnswer) => void
  onMarker: (marker: PointMarker) => void
}) {
  const choosePoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    const svg = event.currentTarget.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const viewBox = svg.viewBox.baseVal
    const x = ((event.clientX - rect.left) / rect.width) * viewBox.width
    const y = ((event.clientY - rect.top) / rect.height) * viewBox.height
    const markerValue = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }
    const target = question.correct.toLowerCase()
    let token = ''
    if (target.includes('manage closely')) {
      token = x >= viewBox.width / 2 && y < viewBox.height / 2 ? 'Manage closely' : x < viewBox.width / 2 && y < viewBox.height / 2 ? 'Keep satisfied' : x >= viewBox.width / 2 ? 'Keep informed' : 'Monitor'
    } else {
      const circles = Array.from(svg.querySelectorAll('circle'))
      const nearestIndex = circles.reduce((best, circle, index) => {
        const dx = Number(circle.getAttribute('cx') ?? 0) - x
        const dy = Number(circle.getAttribute('cy') ?? 0) - y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance < best.distance ? { index, distance } : best
      }, { index: 0, distance: Number.POSITIVE_INFINITY }).index
      if (target.startsWith('r')) token = `R${nearestIndex + 1}`
      else if (target.startsWith('activity')) token = String.fromCharCode(65 + nearestIndex)
      else token = String(nearestIndex + 1)
    }
    onAnswer(token); onMarker(markerValue)
  }
  return <div><div className="point-instruction">Click directly on the exhibit to place your response.</div><div className="point-wrap"><div className="point-exhibit" onClick={choosePoint} dangerouslySetInnerHTML={{ __html: question.visual_html }} />{marker && <span className="point-marker" style={{ left: `${marker.x}%`, top: `${marker.y}%` }}><Check size={14} /></span>}</div><p className="selection-readout">Selected: <strong>{typeof answer === 'string' ? answer : 'None'}</strong></p></div>
}

function QuestionResponse({ question, answer, eliminated, strikeMode, marker, onAnswer, onEliminated, onMarker }: {
  question: PmpQuestion
  answer: PmpAnswer | undefined
  eliminated: string[]
  strikeMode: boolean
  marker: PointMarker | undefined
  onAnswer: (answer: PmpAnswer) => void
  onEliminated: (codes: string[]) => void
  onMarker: (marker: PointMarker) => void
}) {
  const matching = useMemo(() => question.qformat === 'Matching' || question.qformat === 'Enhanced matching' ? parseMatching(question) : null, [question])
  const pullDown = useMemo(() => question.qformat === 'Pull-down list' ? parsePullDown(question) : null, [question])
  if (matching) {
    const current = answer && !Array.isArray(answer) && typeof answer === 'object' ? answer : {}
    return <div className="matching-response">{matching.rows.map((row) => <label key={row.id}><span><b>{row.id}</b>{row.prompt}</span><select value={current[row.id] ?? ''} onChange={(event) => onAnswer({ ...current, [row.id]: event.target.value })}><option value="">Select response</option>{matching.choices.map((choice) => <option value={choice.code} key={choice.code}>{choice.code}. {choice.label}</option>)}</select></label>)}</div>
  }
  if (pullDown) {
    const current = answer && !Array.isArray(answer) && typeof answer === 'object' ? answer : {}
    return <div className="pull-down-response"><p>{pullDown.sentence}</p>{pullDown.rows.map((row) => <label key={row.id}><span>Blank {row.id}</span><select value={current[row.id] ?? ''} onChange={(event) => onAnswer({ ...current, [row.id]: event.target.value })}><option value="">Choose an answer</option>{row.choices.map((choice) => <option value={choice} key={choice}>{choice}</option>)}</select></label>)}</div>
  }
  if (question.qformat === 'Point and click') return <PointAndClick question={question} answer={answer} marker={marker} onAnswer={onAnswer} onMarker={onMarker} />
  const multiple = question.qformat === 'Multiple-response'
  const selected = multiple ? (Array.isArray(answer) ? answer : []) : typeof answer === 'string' ? [answer] : []
  const maxSelections = multiple ? question.correct.split(',').length : 1
  return <div className="choice-list" role={multiple ? 'group' : 'radiogroup'}>{question.options.map((option, index) => {
    const code = optionCode(option, index)
    const isSelected = selected.includes(code)
    const isEliminated = eliminated.includes(code)
    return <button type="button" key={code} className={`${isSelected ? 'selected' : ''} ${isEliminated ? 'eliminated' : ''}`} onClick={() => {
      if (strikeMode) { onEliminated(isEliminated ? eliminated.filter((value) => value !== code) : [...eliminated, code]); return }
      if (multiple) {
        if (isSelected) onAnswer(selected.filter((value) => value !== code))
        else if (selected.length < maxSelections) onAnswer([...selected, code])
      } else onAnswer(isSelected ? '' : code)
    }}><span className="choice-control">{multiple ? <span className="checkbox">{isSelected && <Check size={15} />}</span> : <span className="radio"><i /></span>}</span><span className="choice-code">{code}.</span><span>{optionText(option)}</span></button>
  })}</div>
}

function FeedbackPanel({ question, answer, feedback, loading, onRequest }: { question: PmpQuestion; answer: PmpAnswer | undefined; feedback?: string; loading: boolean; onRequest: () => void }) {
  const correct = isCorrect(question, answer)
  return <section className={`feedback-panel ${correct ? 'correct' : 'incorrect'}`}><header>{correct ? <CheckCircle2 size={21} /> : <CircleAlert size={21} />}<strong>{correct ? 'Correct' : 'Review this answer'}</strong><span>{question.correct}</span></header><p>{feedback || question.rationale}</p>{!feedback && <button className="ai-feedback-button" disabled={loading} onClick={onRequest}><Sparkles size={16} />{loading ? 'Preparing coaching…' : 'Ask AI coach for a deeper explanation'}</button>}</section>
}

function ExamHeader({ session, timeLeft, timerVisible, strikeMode, onTool, onFlag, onToggleTimer, onStrike, onHighlight }: {
  session: ExamSession
  timeLeft: number
  timerVisible: boolean
  strikeMode: boolean
  onTool: (tool: ToolModal) => void
  onFlag: () => void
  onToggleTimer: () => void
  onStrike: () => void
  onHighlight: () => void
}) {
  return <><header className="exam-top"><Brand /><div className="exam-title">Practice Test {session.formId}<small>{session.mode === 'simulation' ? 'Strict simulation' : 'Guided study'}</small></div><div className="timer-block"><Clock3 size={19} />{timerVisible ? <strong>{formatTime(timeLeft)}</strong> : <strong>Hidden</strong>}</div></header><nav className="exam-tools" aria-label="Exam tools"><button onClick={() => onTool('navigator')}><Menu size={17} /> Navigator</button><button onClick={onFlag}><Flag size={17} /> Flag</button><button className={strikeMode ? 'active' : ''} onClick={onStrike}><Strikethrough size={17} /> Strikeout</button><button onClick={onHighlight}><Highlighter size={17} /> Highlight</button><button onClick={() => onTool('calculator')}><Calculator size={17} /> Calculator</button><button onClick={() => onTool('notes')}><NotebookPen size={17} /> Notes</button><button onClick={() => onTool('help')}><HelpCircle size={17} /> Help</button><button onClick={onToggleTimer}>{timerVisible ? <EyeOff size={17} /> : <Eye size={17} />}{timerVisible ? 'Hide time' : 'Show time'}</button></nav></>
}

function SectionReview({ form, session, onJump, onEnd }: { form: PmpForm; session: ExamSession; onJump: (index: number) => void; onEnd: () => void }) {
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [start, end] = SECTION_RANGES[session.sectionIndex] ?? [0, 179]
  const questions = form.questions.slice(start, end + 1).filter((question) => filter === 'incomplete' ? !isAnswered(session.answers[String(question.number)]) : filter === 'flagged' ? session.flags.includes(question.number) : true)
  const unanswered = form.questions.slice(start, end + 1).filter((question) => !isAnswered(session.answers[String(question.number)])).length
  return <main className="section-review"><p className="pmp-eyebrow">Section {session.sectionIndex + 1} review</p><h1>Review your responses</h1><p>You may return to questions in this section. After ending the section, these questions will be locked.</p><div className="review-summary"><span><strong>{end - start + 1 - unanswered}</strong> answered</span><span><strong>{unanswered}</strong> incomplete</span><span><strong>{session.flags.filter((number) => number >= start + 1 && number <= end + 1).length}</strong> flagged</span></div><div className="filter-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'incomplete' ? 'active' : ''} onClick={() => setFilter('incomplete')}>Incomplete</button><button className={filter === 'flagged' ? 'active' : ''} onClick={() => setFilter('flagged')}>Flagged</button></div><div className="review-table"><div className="review-table-head"><span>Question</span><span>Status</span><span>Review</span></div>{questions.map((question) => <button key={question.number} onClick={() => onJump(question.number - 1)}><span><b>{question.number}</b>{question.qformat}</span><span>{isAnswered(session.answers[String(question.number)]) ? <><Check size={15} /> Complete</> : 'Incomplete'}</span><span>{session.flags.includes(question.number) && <Flag size={15} />} Open</span></button>)}</div><div className="end-section"><div><LockKeyhole size={21} /><span><strong>This action cannot be undone.</strong><small>The previous section cannot be reopened after you continue.</small></span></div><button className="pmp-primary" onClick={onEnd}>{session.sectionIndex === 2 ? 'Finish exam' : 'End section'} <ArrowRight size={17} /></button></div></main>
}

function BreakScreen({ number, breakLeft, onResume }: { number: number; breakLeft: number; onResume: () => void }) {
  return <main className="break-screen"><div className="break-icon"><Pause size={32} /></div><p className="pmp-eyebrow">Optional break {number} of 2</p><h1>Your exam timer is paused</h1><div className="break-clock">{formatTime(breakLeft)}</div><p>When you resume, you cannot return to the previous section. Your next section begins immediately.</p><button className="pmp-primary" onClick={onResume}><Play size={18} /> Resume exam</button></main>
}

function Results({ form, session, onReview, onLibrary, onRestart }: { form: PmpForm; session: ExamSession; onReview: () => void; onLibrary: () => void; onRestart: () => void }) {
  const result = useMemo(() => scoreExam(form, session), [form, session])
  return <div className="results-screen"><header className="home-header"><Brand /><span className="unofficial-badge">Practice estimate</span></header><main className="results-main"><p className="pmp-eyebrow">Practice Test {session.formId} complete</p><h1>Performance report</h1><section className="result-hero"><div className={`readiness-gauge ${result.performance.toLowerCase().replaceAll(' ', '-')}`}><strong>{result.percent}%</strong><span>{result.correct} of {result.total} scored items</span></div><div><span className="performance-label">{result.performance}</span><h2>{result.percent >= 70 ? 'A solid practice result with clear next steps.' : 'Use the diagnostics below to focus your next study block.'}</h2><p>Ten hidden practice pretest items were excluded to mirror the 170 scored / 10 unscored structure. This is not an official PMI pass/fail decision.</p></div></section><section className="score-section"><h2>Performance by domain</h2>{result.domains.map((item) => <ScoreBar key={item.label} item={item} />)}</section><div className="result-columns"><section className="score-section"><h2>Delivery approach</h2>{result.approaches.map((item) => <ScoreBar key={item.label} item={item} compact />)}</section><section className="score-section"><h2>Question format</h2>{result.formats.map((item) => <ScoreBar key={item.label} item={item} compact />)}</section></div><section className="result-disclaimer"><CircleAlert size={22} /><p>PMI does not publish a fixed passing percentage, and official forms are psychometrically equated. Treat this report as a readiness signal, not a score guarantee.</p></section><div className="result-actions"><button className="pmp-secondary" onClick={onLibrary}><ArrowLeft size={17} /> Test library</button><button className="pmp-secondary" onClick={onRestart}><RotateCcw size={17} /> Retake</button><button className="pmp-primary" onClick={onReview}><BookOpenCheck size={17} /> Review every answer</button></div></main></div>
}

function ScoreBar({ item, compact = false }: { item: ReturnType<typeof scoreExam>['domains'][number]; compact?: boolean }) {
  return <div className={`score-bar ${compact ? 'compact' : ''}`}><div><strong>{item.label}</strong><span>{item.correct}/{item.total} · {item.performance}</span></div><div className="bar-track"><i style={{ width: `${item.percent}%` }} /></div><b>{item.percent}%</b></div>
}

function AnswerReview({ form, session, feedback, feedbackLoading, onFeedback, onResults }: {
  form: PmpForm
  session: ExamSession
  feedback: Record<string, string>
  feedbackLoading: number | null
  onFeedback: (question: PmpQuestion) => void
  onResults: () => void
}) {
  const [current, setCurrent] = useState(0)
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'flagged'>('all')
  const visible = form.questions.filter((question) => filter === 'incorrect' ? !isCorrect(question, session.answers[String(question.number)]) : filter === 'flagged' ? session.flags.includes(question.number) : true)
  const question = visible[Math.min(current, Math.max(0, visible.length - 1))] ?? form.questions[0]
  if (!question) return null
  const answer = session.answers[String(question.number)]
  return <div className="answer-review"><header className="exam-top"><Brand /><button className="pmp-secondary" onClick={onResults}><ArrowLeft size={17} /> Performance report</button></header><div className="review-shell"><aside><h2>Answer review</h2><div className="review-filter"><button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setCurrent(0) }}>All</button><button className={filter === 'incorrect' ? 'active' : ''} onClick={() => { setFilter('incorrect'); setCurrent(0) }}>Incorrect</button><button className={filter === 'flagged' ? 'active' : ''} onClick={() => { setFilter('flagged'); setCurrent(0) }}>Flagged</button></div><div className="review-question-list">{visible.map((item, index) => <button className={`${item.number === question.number ? 'active' : ''} ${isCorrect(item, session.answers[String(item.number)]) ? 'correct' : 'incorrect'}`} key={item.number} onClick={() => setCurrent(index)}><span>{item.number}</span><small>{item.task_code}</small>{isCorrect(item, session.answers[String(item.number)]) ? <Check size={14} /> : <X size={14} />}</button>)}</div></aside><main className="review-detail"><div className="question-meta"><span>{question.domain}</span><span>{question.approach}</span><span>{question.qformat}</span><span>{PRETEST_NUMBERS.has(question.number) ? 'Practice pretest · unscored' : 'Scored item'}</span></div><h1>{question.stem}</h1>{question.visual_html && question.qformat !== 'Matching' && question.qformat !== 'Enhanced matching' && question.qformat !== 'Pull-down list' && <div className="question-visual" dangerouslySetInnerHTML={{ __html: question.visual_html }} />}<div className={`review-answer-row ${isCorrect(question, answer) ? 'correct' : ''}`}><span>Your response</span><strong>{answerLabel(question, answer)}</strong></div><div className="review-answer-row correct"><span>Correct response</span><strong>{correctResponseLabel(question)}</strong></div><section className="rationale"><h2>Why this is the best answer</h2><p>{feedback[String(question.number)] || question.rationale}</p>{!feedback[String(question.number)] && <button className="ai-feedback-button" disabled={feedbackLoading === question.number} onClick={() => onFeedback(question)}><Sparkles size={16} />{feedbackLoading === question.number ? 'Preparing coaching…' : 'Ask AI coach to analyze my choice'}</button>}</section></main></div></div>
}

export function PmpSimulator() {
  const [bank, setBank] = useState<PmpBank | null>(null)
  const [loadError, setLoadError] = useState('')
  const [landing, setLanding] = useState<LandingScreen>('library')
  const [pending, setPending] = useState<{ formId: string; mode: ExamMode } | null>(null)
  const [session, setSession] = useState<ExamSession | null>(() => readSession())
  const [now, setNow] = useState(0)
  const [timerVisible, setTimerVisible] = useState(true)
  const [strikeMode, setStrikeMode] = useState(false)
  const [tool, setTool] = useState<ToolModal>('none')
  const [notes, setNotes] = useState('')
  const [checked, setChecked] = useState<number[]>([])
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [feedbackLoading, setFeedbackLoading] = useState<number | null>(null)
  const questionAreaRef = useRef<HTMLElement>(null)
  const activeScreen = session?.screen

  useEffect(() => { void loadPmpBank().then(setBank).catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load the question bank.')) }, [])
  useEffect(() => { if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); else localStorage.removeItem(STORAGE_KEY) }, [session])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [session?.screen])
  useEffect(() => {
    if (!activeScreen || !['exam', 'section-review', 'break'].includes(activeScreen)) return
    const tick = () => {
      const tickNow = Date.now()
      setNow(tickNow)
      setSession((current) => {
        if (!current || !['exam', 'section-review', 'break'].includes(current.screen)) return current
        if (current.screen === 'break' && current.breakDeadline && current.breakDeadline <= tickNow) {
          return { ...current, screen: 'exam', deadline: tickNow + current.remainingSeconds * 1000, breakDeadline: undefined }
        }
        if (current.screen !== 'break' && current.deadline <= tickNow) {
          return { ...current, screen: 'results', completedAt: tickNow, remainingSeconds: 0 }
        }
        return current
      })
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [activeScreen])

  const form = session && bank ? bank.forms[session.formId] : null
  const question = form?.questions[session?.currentIndex ?? 0]
  const timeLeft = session ? session.screen === 'break' ? session.remainingSeconds : Math.min(EXAM_SECONDS, Math.max(0, Math.ceil((session.deadline - now) / 1000))) : EXAM_SECONDS
  const breakLeft = session?.breakDeadline ? Math.min(600, Math.max(0, Math.ceil((session.breakDeadline - now) / 1000))) : 600

  const startChoice = (formId: string, mode: ExamMode) => { setPending({ formId, mode }); setLanding('tutorial') }
  const begin = () => {
    if (!pending) return
    setSession({ formId: pending.formId, mode: pending.mode, screen: 'exam', currentIndex: 0, sectionIndex: 0, answers: {}, flags: [], eliminated: {}, pointMarkers: {}, lockedThrough: -1, deadline: Date.now() + EXAM_SECONDS * 1000, remainingSeconds: EXAM_SECONDS, startedAt: Date.now() })
    setChecked([]); setFeedback({}); setLanding('library')
  }
  const updateSession = (patch: Partial<ExamSession>) => setSession((current) => current ? { ...current, ...patch } : current)
  const setAnswer = (answer: PmpAnswer) => {
    if (!question) return
    setSession((current) => current ? { ...current, answers: { ...current.answers, [String(question.number)]: answer } } : current)
  }
  const toggleFlag = () => {
    if (!question || !session) return
    updateSession({ flags: session.flags.includes(question.number) ? session.flags.filter((number) => number !== question.number) : [...session.flags, question.number] })
  }
  const setEliminated = (codes: string[]) => {
    if (!question || !session) return
    updateSession({ eliminated: { ...session.eliminated, [String(question.number)]: codes } })
  }
  const setPointMarker = (marker: PointMarker) => {
    if (!question || !session) return
    updateSession({ pointMarkers: { ...session.pointMarkers, [String(question.number)]: marker } })
  }
  const jump = (index: number) => {
    if (!session) return
    const [start, end] = SECTION_RANGES[session.sectionIndex] ?? [0, 179]
    if (index < start || index > end || index <= session.lockedThrough) return
    updateSession({ currentIndex: index, screen: 'exam' })
    window.scrollTo({ top: 0 })
  }
  const previous = () => { if (session) jump(session.currentIndex - 1) }
  const next = () => {
    if (!session) return
    const [, end] = SECTION_RANGES[session.sectionIndex] ?? [0, 179]
    if (session.currentIndex >= end) updateSession({ screen: 'section-review' })
    else jump(session.currentIndex + 1)
  }
  const endSection = () => {
    if (!session) return
    const [, end] = SECTION_RANGES[session.sectionIndex] ?? [0, 179]
    if (session.sectionIndex === 2) { updateSession({ screen: 'results', completedAt: Date.now(), remainingSeconds: timeLeft }); return }
    updateSession({ screen: 'break', lockedThrough: end, currentIndex: end + 1, sectionIndex: session.sectionIndex + 1, remainingSeconds: timeLeft, deadline: 0, breakDeadline: Date.now() + 600_000 })
  }
  const resumeFromBreak = () => { if (session) updateSession({ screen: 'exam', deadline: Date.now() + session.remainingSeconds * 1000, breakDeadline: undefined }) }
  const requestFeedback = async (target: PmpQuestion) => {
    if (!session || feedback[String(target.number)] || feedbackLoading) return
    setFeedbackLoading(target.number)
    const answer = session.answers[String(target.number)]
    try {
      const response = await fetch('/api/pmp-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: target.stem, options: target.options, selected: answerPayload(target, answer), correct: target.correct, rationale: target.rationale, domain: target.domain, task: target.task_title, approach: target.approach }) })
      if (!response.ok) throw new Error('AI feedback unavailable')
      const data = await response.json() as { feedback?: string }
      if (data.feedback) setFeedback((current) => ({ ...current, [String(target.number)]: data.feedback ?? target.rationale }))
    } catch {
      setFeedback((current) => ({ ...current, [String(target.number)]: target.rationale }))
    } finally { setFeedbackLoading(null) }
  }
  const checkAnswer = () => {
    if (!question || !isAnswered(session?.answers[String(question.number)])) return
    setChecked((current) => current.includes(question.number) ? current : [...current, question.number])
    void requestFeedback(question)
  }
  const applyHighlight = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !questionAreaRef.current?.contains(selection.anchorNode)) return
    try { const mark = document.createElement('mark'); selection.getRangeAt(0).surroundContents(mark); selection.removeAllRanges() } catch { /* Complex selections remain unchanged. */ }
  }
  const restart = () => { if (!session) return; setPending({ formId: session.formId, mode: session.mode }); setSession(null); setLanding('tutorial') }
  const returnToLibrary = () => { setSession(null); setPending(null); setLanding('library') }

  if (loadError) return <ErrorScreen message={loadError} />
  if (!bank) return <LoadingScreen />
  if (!session) return landing === 'tutorial' && pending ? <Tutorial mode={pending.mode} onBack={() => setLanding('library')} onBegin={begin} /> : <Library bank={bank} saved={readSession()} onStart={startChoice} onResume={() => setSession(readSession())} />
  if (!form) return <ErrorScreen message="This saved practice form is no longer available." />
  if (session.screen === 'break') return <BreakScreen number={session.sectionIndex} breakLeft={breakLeft} onResume={resumeFromBreak} />
  if (session.screen === 'results') return <Results form={form} session={session} onReview={() => updateSession({ screen: 'review' })} onLibrary={returnToLibrary} onRestart={restart} />
  if (session.screen === 'review') return <AnswerReview form={form} session={session} feedback={feedback} feedbackLoading={feedbackLoading} onFeedback={(target) => void requestFeedback(target)} onResults={() => updateSession({ screen: 'results' })} />

  return <div className="exam-screen"><ExamHeader session={session} timeLeft={timeLeft} timerVisible={timerVisible} strikeMode={strikeMode} onTool={setTool} onFlag={toggleFlag} onToggleTimer={() => setTimerVisible((value) => !value)} onStrike={() => setStrikeMode((value) => !value)} onHighlight={applyHighlight} />
    {session.screen === 'section-review' ? <SectionReview form={form} session={session} onJump={jump} onEnd={endSection} /> : question && <main className="question-shell" ref={questionAreaRef}>
      <div className="question-status"><span>Question {question.number} of 180</span><span>Section {session.sectionIndex + 1} of 3</span><span>{question.qformat}</span>{session.flags.includes(question.number) && <span className="flagged"><Flag size={13} /> Flagged</span>}</div>
      {question.case_id && <CasePanel caseStudy={form.cases.find((item) => item.case_id === question.case_id) ?? form.cases[0]!} />}
      <section className="question-card"><p className="question-instruction">{question.instruction}</p><h1>{question.stem}</h1>{question.visual_html && ['Graphic-based'].includes(question.qformat) && <div className="question-visual" dangerouslySetInnerHTML={{ __html: question.visual_html }} />}<QuestionResponse question={question} answer={session.answers[String(question.number)]} eliminated={session.eliminated[String(question.number)] ?? []} strikeMode={strikeMode} marker={session.pointMarkers[String(question.number)]} onAnswer={setAnswer} onEliminated={setEliminated} onMarker={setPointMarker} />
        {session.mode === 'study' && checked.includes(question.number) && <FeedbackPanel question={question} answer={session.answers[String(question.number)]} feedback={feedback[String(question.number)]} loading={feedbackLoading === question.number} onRequest={() => void requestFeedback(question)} />}
      </section>
      <footer className="question-footer"><button className="pmp-secondary" disabled={session.currentIndex === (SECTION_RANGES[session.sectionIndex]?.[0] ?? 0)} onClick={previous}><ArrowLeft size={17} /> Previous</button><span className="progress-line"><i style={{ width: `${((session.currentIndex + 1) / 180) * 100}%` }} /></span>{session.mode === 'study' && !checked.includes(question.number) && <button className="pmp-secondary check-answer" disabled={!isAnswered(session.answers[String(question.number)])} onClick={checkAnswer}><Check size={17} /> Check answer</button>}<button className="pmp-primary" onClick={next}>{session.currentIndex === (SECTION_RANGES[session.sectionIndex]?.[1] ?? 179) ? 'Review section' : 'Next'} <ArrowRight size={17} /></button></footer>
    </main>}
    {tool === 'calculator' && <Modal title="Calculator" onClose={() => setTool('none')}><CalculatorTool /></Modal>}
    {tool === 'notes' && <Modal title="Private notes" onClose={() => setTool('none')}><textarea className="notes-area" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes are not included in your score." /></Modal>}
    {tool === 'help' && <Modal title="Exam help" onClose={() => setTool('none')}><div className="help-list"><p><b>Navigator:</b> open any unlocked question in the current section.</p><p><b>Flag:</b> mark the current question for section review.</p><p><b>Strikeout:</b> activate the tool, then click an answer to cross it out.</p><p><b>Highlight:</b> select question text, then click Highlight.</p><p><b>Breaks:</b> previous questions lock when you end a section.</p></div></Modal>}
    {tool === 'navigator' && <Modal title={`Section ${session.sectionIndex + 1} navigator`} onClose={() => setTool('none')} wide><Navigator form={form} session={session} onJump={jump} onClose={() => setTool('none')} /></Modal>}
  </div>
}
