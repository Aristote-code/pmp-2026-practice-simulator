const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

const requestWindows = new Map()

function rateLimited(request) {
  const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown'
  const now = Date.now()
  const current = requestWindows.get(ip)
  if (!current || now - current.startedAt > 60_000) {
    requestWindows.set(ip, { startedAt: now, count: 1 })
    return false
  }
  current.count += 1
  return current.count > 20
}

function clean(value, limit = 5_000) {
  return typeof value === 'string' ? value.slice(0, limit) : ''
}

export default async function handler(request) {
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  if (rateLimited(request)) return new Response(JSON.stringify({ error: 'Too many feedback requests' }), { status: 429, headers: { ...headers, 'retry-after': '60' } })

  try {
    const payload = await request.json()
    const context = {
      question: clean(payload.question),
      options: Array.isArray(payload.options) ? payload.options.slice(0, 8).map((value) => clean(value, 1_500)) : [],
      selectedResponse: clean(payload.selected, 3_000),
      correctResponse: clean(payload.correct, 1_000),
      authoredRationale: clean(payload.rationale),
      domain: clean(payload.domain, 100),
      task: clean(payload.task, 300),
      deliveryApproach: clean(payload.approach, 100),
    }
    if (!context.question || !context.correctResponse || !context.authoredRationale) {
      return new Response(JSON.stringify({ error: 'Incomplete feedback request' }), { status: 400, headers })
    }

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) return new Response(JSON.stringify({ feedback: context.authoredRationale, source: 'authored-rationale' }), { status: 200, headers })

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_GRADING_MODEL || 'openai/gpt-oss-120b',
        temperature: 0.1,
        max_completion_tokens: 420,
        messages: [
          {
            role: 'system',
            content: 'You are a concise PMP practice coach. The supplied answer key and authored rationale are authoritative. Explain why the selected response is correct or incorrect, identify the decision principle, briefly contrast the most tempting distractor when relevant, and give one reusable exam-day reasoning rule. Do not change the answer key, invent PMI rules, claim official PMI affiliation, or discuss a passing score. Return plain text in two short paragraphs.',
          },
          { role: 'user', content: JSON.stringify(context) },
        ],
      }),
    })
    if (!response.ok) throw new Error(`Groq feedback failed with ${response.status}`)
    const completion = await response.json()
    const feedback = clean(completion.choices?.[0]?.message?.content, 4_000)
    return new Response(JSON.stringify({ feedback: feedback || context.authoredRationale, source: 'groq' }), { status: 200, headers })
  } catch (error) {
    console.error('PMP feedback error:', error instanceof Error ? error.message : error)
    return new Response(JSON.stringify({ error: 'Unable to prepare feedback' }), { status: 502, headers })
  }
}
