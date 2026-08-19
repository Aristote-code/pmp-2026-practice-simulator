import assert from 'node:assert/strict'
import test from 'node:test'
import handler from '../../netlify/functions/pmp-feedback.mjs'

const payload = {
  question: 'What should the project manager do first?',
  options: ['Escalate immediately', 'Assess the impact and follow governance'],
  selected: 'A. Escalate immediately',
  correct: 'B',
  rationale: 'The project manager should understand the impact before selecting and authorizing a response.',
  domain: 'Process',
  task: 'Manage project changes',
  approach: 'Hybrid',
}

test('PMP feedback rejects unsupported methods', async () => {
  const response = await handler(new Request('http://localhost/api/pmp-feedback'))
  assert.equal(response.status, 405)
})

test('PMP feedback returns the authored rationale when Groq is not configured', async () => {
  const previous = process.env.GROQ_API_KEY
  delete process.env.GROQ_API_KEY
  try {
    const response = await handler(new Request('http://localhost/api/pmp-feedback', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    }))
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.equal(result.source, 'authored-rationale')
    assert.equal(result.feedback, payload.rationale)
  } finally {
    if (previous) process.env.GROQ_API_KEY = previous
  }
})

test('PMP feedback rejects incomplete requests', async () => {
  const response = await handler(new Request('http://localhost/api/pmp-feedback', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'Incomplete' }),
  }))
  assert.equal(response.status, 400)
})
