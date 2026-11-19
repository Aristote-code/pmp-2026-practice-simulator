import { useState } from 'react'
import type { DragEvent, KeyboardEvent } from 'react'
import { GripVertical, RotateCcw, X } from 'lucide-react'
import type { DragAnswer, DragChoice, DragTarget } from './dragDrop'

interface DragDropBoardProps {
  choices: DragChoice[]
  targets: DragTarget[]
  value: DragAnswer
  disabled?: boolean
  onChange: (answer: DragAnswer) => void
}

export function DragDropBoard({ choices, targets, value, disabled = false, onChange }: DragDropBoardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const assigned = new Set(Object.values(value).flat())
  const available = choices.filter((choice) => !assigned.has(choice.id))

  const remove = (choiceId: string) => {
    if (disabled) return
    onChange(Object.fromEntries(Object.entries(value).map(([targetId, ids]) => [targetId, ids.filter((id) => id !== choiceId)])))
    setSelected(choiceId)
  }

  const place = (choiceId: string, targetId: string) => {
    if (disabled) return
    const target = targets.find((item) => item.id === targetId)
    if (!target) return
    const withoutChoice = Object.fromEntries(Object.entries(value).map(([id, ids]) => [id, ids.filter((item) => item !== choiceId)]))
    const current = withoutChoice[targetId] ?? []
    if (current.length >= target.capacity) return
    onChange({ ...withoutChoice, [targetId]: [...current, choiceId] })
    setSelected(null)
  }

  const startDrag = (event: DragEvent, choiceId: string) => {
    if (disabled) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', choiceId)
    setDragging(choiceId)
    setSelected(choiceId)
  }

  const drop = (event: DragEvent, targetId: string) => {
    event.preventDefault()
    const choiceId = event.dataTransfer.getData('text/plain') || dragging
    if (choiceId) place(choiceId, targetId)
    setDragging(null)
  }

  const activateChoice = (event: KeyboardEvent, choiceId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelected((current) => current === choiceId ? null : choiceId)
    }
  }

  const activateTarget = (event: KeyboardEvent, targetId: string) => {
    if ((event.key === 'Enter' || event.key === ' ') && selected) {
      event.preventDefault()
      place(selected, targetId)
    }
  }

  const renderTile = (choice: DragChoice, placed = false) => <div
    className={`drag-tile ${selected === choice.id ? 'selected' : ''} ${dragging === choice.id ? 'dragging' : ''}`}
    draggable={!disabled}
    key={choice.id}
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-pressed={selected === choice.id}
    aria-label={`${placed ? 'Placed answer' : 'Answer choice'}: ${choice.label}`}
    onClick={() => !disabled && setSelected((current) => current === choice.id ? null : choice.id)}
    onKeyDown={(event) => activateChoice(event, choice.id)}
    onDragStart={(event) => startDrag(event, choice.id)}
    onDragEnd={() => setDragging(null)}
  >
    <GripVertical size={16} aria-hidden="true" />
    <span>{choice.label}</span>
    {placed && !disabled && <button type="button" className="drag-remove" title="Return answer to choices" aria-label={`Return ${choice.label} to choices`} onClick={(event) => { event.stopPropagation(); remove(choice.id) }}><X size={15} /></button>}
  </div>

  return <div className={`drag-board ${disabled ? 'disabled' : ''}`}>
    <div className="drag-bank" aria-label="Answer choices">
      <div className="drag-column-heading"><span>Answer choices</span><small>{available.length} remaining</small></div>
      <div className="drag-bank-tiles">
        {available.map((choice) => renderTile(choice))}
        {!available.length && <p className="drag-empty"><RotateCcw size={16} /> All choices placed</p>}
      </div>
      {!disabled && <p className="drag-help">Drag a tile, or select it and then select a target.</p>}
    </div>
    <div className="drag-target-list" aria-label="Matching targets">
      <div className="drag-target-head"><span>Drop target</span><span>Description</span></div>
      {targets.map((target) => {
        const targetChoices = (value[target.id] ?? []).map((id) => choices.find((choice) => choice.id === id)).filter((choice): choice is DragChoice => Boolean(choice))
        const full = targetChoices.length >= target.capacity
        return <div className="drag-target-row" key={target.id}>
          <div
            className={`drag-target ${selected && !full ? 'ready' : ''} ${full ? 'filled' : ''}`}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${target.prompt}. ${targetChoices.length} of ${target.capacity} answers placed`}
            onClick={() => selected && place(selected, target.id)}
            onKeyDown={(event) => activateTarget(event, target.id)}
            onDragOver={(event) => { if (!disabled && !full) { event.preventDefault(); event.dataTransfer.dropEffect = 'move' } }}
            onDrop={(event) => drop(event, target.id)}
          >
            {targetChoices.map((choice) => renderTile(choice, true))}
            {targetChoices.length < target.capacity && <span className="drop-placeholder">Drop answer here{target.capacity > 1 ? ` (${targetChoices.length}/${target.capacity})` : ''}</span>}
          </div>
          <div className="drag-prompt"><b>{target.id.replace('T', '')}</b><span>{target.prompt}</span></div>
        </div>
      })}
    </div>
  </div>
}
