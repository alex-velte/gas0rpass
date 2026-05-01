const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── REPORT ENDPOINT ───────────────────────────────────────────────────────────
app.post('/api/report', async (req, res) => {
  const { year, make, model, trim, engine, mileage, vin } = req.body;

  if (!vin && (!year || !make || !model)) {
    return res.status(400).json({ error: 'Please provide a VIN, or select at least Year, Make, and Model.' });
  }

  try {
    const prompt = buildPrompt(year, make, model, trim, engine, mileage, vin);
    const report = await callClaudeAPI(prompt);
    res.json({ report });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'We couldn\'t generate your report. Please try again.' });
  }
});

function buildPrompt(year, make, model, trim, engine, mileage, vin) {
  const trimInfo    = trim   ? ` ${trim} trim` : '';
  const engineInfo  = engine ? ` (${engine})` : '';
  const mileageInfo = mileage ? ` with ${Number(mileage).toLocaleString()} miles` : '';

  const vehicleDesc = vin && (!year || !make || !model)
    ? `VIN: ${vin}`
    : `${year} ${make} ${model}${trimInfo}${engineInfo}${mileageInfo}${vin ? ` (VIN: ${vin})` : ''}`;

  const vehicleLabel = vin && (!year || !make || !model)
    ? vin
    : `${year} ${make} ${model}${trimInfo}${engineInfo}`;

  return `You are Drive Counselor — a calm, deeply knowledgeable automotive advisor. You speak like a trusted friend who happens to know everything about cars. You are honest even when the news isn't good. You do not alarm — you inform. You help buyers feel grounded and confident, not panicked.

You have encyclopedic knowledge of every major vehicle sold in the US, drawn from: Reddit communities (r/cars, r/MechanicAdvice, r/whatcarshouldIbuy, model-specific subreddits), Car and Driver, Consumer Reports, Edmunds, NHTSA recall data, TSB records, and owner forums. Use this knowledge directly and confidently.

A buyer is asking for your assessment of: ${vehicleDesc}.
${vin && (!year || !make || !model) ? 'The buyer provided a VIN. Decode it to determine the year, make, model, trim, and engine, then generate the full assessment.' : ''}

SCORING PHILOSOPHY:
- Score in context of the brand's known reliability. A Toyota at 200k miles is not the same risk as a BMW at 200k miles. Be fair and specific.
- Mileage matters but never in isolation. Factor in brand reputation, known failure points, and what's likely been serviced.
- Score breakdown: 90–100 = Excellent, 75–89 = Good Buy, 60–74 = Proceed Carefully, 45–59 = Risky Buy, 0–44 = Walk Away.
- Match the verdict label exactly to the score range. Never use "Gas", "Pass", or similar language.
- Write the summary the way a good counselor would speak — calm, direct, specific, empowering.
${trim ? `\nTRIM NOTE: User selected "${trim}" trim. Be specific to this trim's known characteristics.` : ''}${engine ? `\nENGINE NOTE: User selected "${engine}". All analysis must be specific to this exact engine — reliability, known failure patterns, and costs differ significantly between engine variants (e.g. Subaru H4 vs H6).` : ''}
${vin ? `\nVIN: ${vin} — use to confirm vehicle details.` : ''}

Respond ONLY with the JSON object below. No markdown, no explanation, no preamble. Raw JSON only.

{
  "vehicle": "${vehicleLabel}",
  "mileage": "${mileage || 'Not specified'}",
  "verdict": "Excellent" or "Good Buy" or "Proceed Carefully" or "Risky Buy" or "Walk Away",
  "verdictReason": "One calm, direct sentence — the honest bottom line on this vehicle",
  "overallScore": <number 0-100>,
  "scores": {
    "reliability": <0-100>,
    "costToOwn": <0-100>,
    "drivability": <0-100>,
    "partsAvailability": <0-100>,
    "communityRating": <0-100>
  },
  "scoreExplanations": {
    "reliability": "2-3 sentences. Reference mileage context for this specific brand.",
    "costToOwn": "2-3 sentences. Include what maintenance looks like at this mileage.",
    "drivability": "2-3 sentences.",
    "partsAvailability": "2-3 sentences.",
    "communityRating": "2-3 sentences. What do owners and enthusiasts actually say?"
  },
  "mileageBreakdown": {
    "currentMileageContext": "What does this mileage mean for THIS specific vehicle — put it in plain English.",
    "servicesDueByNow": ["Service that should have been done by this mileage", "Service 2", "Service 3"],
    "upcomingServices": ["What's coming in the next 10-20k miles", "Item 2"],
    "mileageMilestones": [
      { "mileage": "XX,XXX", "event": "What typically happens or what service is needed at this point" }
    ]
  },
  "summary": "3-4 sentences. Written like a trusted advisor speaking directly to the buyer. Calm, honest, specific. If there are concerns, name them clearly and tell the buyer what to do about them.",
  "knownIssues": [
    { "issue": "Issue name", "severity": "High/Medium/Low", "mileage": "When it typically occurs", "detail": "1-2 sentence explanation", "source": "Where this is documented" }
  ],
  "maintenanceAlerts": {
    "diy": [
      { "item": "Service item", "interval": "When it's due", "partsCost": "$X–$Y", "detail": "What to do and why — for someone doing it themselves" }
    ],
    "shop": [
      { "item": "Service item", "interval": "When it's due", "totalCost": "$X–$Y", "detail": "What a shop will do and roughly what to expect to pay for labor + parts" }
    ]
  },
  "whatPeopleAreSaying": [
    { "source": "Reddit r/[subreddit] or Car and Driver etc", "sentiment": "Positive/Negative/Mixed", "quote": "Paraphrased owner wisdom — specific, not generic", "link": "https://www.reddit.com/r/[relevant subreddit]" }
  ],
  "fairMarketRange": {
    "low": "$X,XXX",
    "mid": "$X,XXX",
    "high": "$X,XXX",
    "note": "One sentence on what drives price variation at this mileage"
  },
  "buyingTips": ["Specific tip 1", "Specific tip 2", "Specific tip 3"],
  "thingsToInspect": ["What to look for 1", "What to look for 2", "What to look for 3"],
  "generationNotes": "What's notable about this specific year and generation. Any major changes, recalls, or known generational issues.",
  "alternativesToConsider": [
    { "vehicle": "Year Make Model", "reason": "Why it might serve the buyer better" }
  ]
}`;
}

async function callClaudeAPI(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error: ${err}`);
  }

  const data = await response.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse report from response');
  return JSON.parse(match[0]);
}

// ── ENGINE LOOKUP ─────────────────────────────────────────────────────────────
app.post('/api/engines', async (req, res) => {
  const { year, make, model, trim } = req.body;
  if (!make || !model || !trim) return res.json({ engines: [] });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const prompt = `List the available engine options for a ${year || ''} ${make} ${model} in the ${trim} trim.
Return ONLY a JSON array of engine strings. No markdown, no explanation, nothing else.
Format each as: "2.5L 4-Cyl (203 hp)" or "3.5L V6 (301 hp)" or "3.6L H6 (256 hp — most reliable)"
If there is only one engine, return a single-item array.
Be specific to the year provided — options changed across model years.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
    });

    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    res.json({ engines: match ? JSON.parse(match[0]) : [] });
  } catch (err) {
    console.error('Engine lookup error:', err);
    res.json({ engines: [] });
  }
});

// ── CONTACT / SUPPORT ─────────────────────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { type, email, name, phone, vehicle, situation, message, issue, budget, timeline } = req.body;
  const isSupport = type === 'support';
  const label = isSupport ? 'SUPPORT ISSUE' : 'CONSULTATION REQUEST';

  // Always log to console as backup
  console.log(`\n=== ${label} ===`);
  console.log('From:', name || '', email, phone ? '| Phone: ' + phone : '');
  if (vehicle)   console.log('Vehicle:', vehicle);
  if (situation) console.log('Situation:', situation);
  if (budget)    console.log('Budget:', budget);
  if (timeline)  console.log('Timeline:', timeline);
  if (issue)     console.log('Issue type:', issue);
  console.log('Message:', message);
  console.log('================\n');

  // Send email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const subject = isSupport
        ? `[Support] ${issue || 'Issue reported'} — ${vehicle || 'unknown vehicle'}`
        : `[Consultation] ${name || 'New request'} — ${vehicle || 'vehicle TBD'}`;

      const bodyLines = isSupport ? [
        `<b>From:</b> ${email}`,
        `<b>Vehicle searched:</b> ${vehicle || 'Not specified'}`,
        `<b>Issue type:</b> ${issue || 'Not specified'}`,
        `<b>Details:</b><br>${(message || '').replace(/\n/g, '<br>')}`,
      ] : [
        `<b>Name:</b> ${name || 'Not provided'}`,
        `<b>Email:</b> ${email}`,
        `<b>Phone:</b> ${phone || 'Not provided'}`,
        `<b>Vehicle they're considering:</b> ${vehicle || 'Not specified'}`,
        `<b>Situation:</b> ${situation || 'Not specified'}`,
        `<b>Budget:</b> ${budget || 'Not specified'}`,
        `<b>Timeline:</b> ${timeline || 'Not specified'}`,
        `<b>Message:</b><br>${(message || '').replace(/\n/g, '<br>')}`,
      ];

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: 'Drive Counselor <onboarding@resend.dev>',
          to: ['drivecounselor@gmail.com'],
          reply_to: email,
          subject,
          html: `<div style="font-family:sans-serif;max-width:600px;padding:24px">
            <h2 style="color:#2C2416;margin-bottom:20px">${label}</h2>
            ${bodyLines.map(l => `<p style="margin:8px 0;color:#333">${l}</p>`).join('')}
            <hr style="margin-top:32px;border:none;border-top:1px solid #eee"/>
            <p style="color:#999;font-size:12px;margin-top:12px">Sent via Drive Counselor · drivecounselor.com</p>
          </div>`
        })
      });
      console.log('Email sent via Resend');
    } catch (emailErr) {
      console.error('Resend email failed:', emailErr.message);
      // Still return success — form submission logged to console
    }
  } else {
    console.warn('RESEND_API_KEY not set — email not sent, logged to console only');
  }

  res.json({ success: true });
});

// ── CATCH-ALL ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Drive Counselor running on port ${PORT}`);
});
