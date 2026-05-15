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
  const { year, make, model, trim, engine, transmission, mileage, vin } = req.body;

  if (!vin && (!year || !make || !model)) {
    return res.status(400).json({ error: 'Please provide a VIN, or select at least Year, Make, and Model.' });
  }

  try {
    const prompt = buildPrompt(year, make, model, trim, engine, transmission, mileage, vin);
    const [report, marketPricing] = await Promise.all([
  callClaudeAPI(prompt),
  fetchMarketPricing(year, make, model, trim, mileage)
]);

if (marketPricing) {
  report.fairMarketRange = marketPricing;
}
    res.json({ report });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'We couldn\'t generate your report. Please try again.' });
  }
});

function buildPrompt(year, make, model, trim, engine, transmission, mileage, vin) {
  const trimInfo    = trim   ? ` ${trim} trim` : '';
  const engineInfo  = engine ? ` (${engine})` : '';
  const transInfo = transmission ? ` ${transmission}` : '';
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
- Fair market pricing must be calibrated precisely to mileage. Use real-world private party values, not dealer retail. A 2013 Honda CR-V with 214k miles is worth $5,000–$8,000 in good condition — not $15,000. Mileage is the single biggest price factor after condition. Every 50k miles above average (15k/year) should reduce value significantly. Average mileage for a 10-year-old car is 150k. Anything above that is high mileage and must be priced accordingly. Use KBB private party and Carmax auction-style values as your reference point, not dealer asking prices.
- Maintenance alerts: every item must appear in BOTH the DIY and Shop columns. Same items, same order. DIY = parts cost only. Shop = labor + parts total.
${trim ? `\nTRIM NOTE: User selected "${trim}" trim. Be specific to this trim's known characteristics.` : ''}${engine ? `\nENGINE NOTE: User selected "${engine}". All analysis must be specific to this exact engine — reliability, known failure patterns, and costs differ significantly between engine variants (e.g. Subaru H4 vs H6).` : ''}
${transmission ? `\nTRANSMISSION: "${transmission}" — factor into reliability and known issues.` : ''}
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
      { "item": "Service item", "interval": "When it's due", "partsCost": "$X–$Y", "detail": "How to do it yourself — parts only, no labor" }
    ],
    "shop": [
      { "item": "Same service item as above", "interval": "Same interval", "totalCost": "$X–$Y", "detail": "What a shop charges for the same job — labor + parts" }
    ]
  },
  "whatPeopleAreSaying": [
    { "source": "Reddit r/[subreddit] or Car and Driver etc", "sentiment": "Positive/Negative/Mixed", "quote": "Paraphrased owner wisdom — specific, not generic", "link": "https://www.reddit.com/r/[relevant subreddit]" }
  ],
"fairMarketRange": {
    "low": "$X,XXX",
    "mid": "$X,XXX",
    "high": "$X,XXX",
    "note": "State explicitly: 'Estimated private party value for a well-maintained example at [X] miles. At this mileage, expect prices toward the lower end of the market.' Adjust ranges to reflect actual mileage impact — high mileage vehicles should show ranges 40-60% below low-mileage examples of the same vehicle.",
    "conditionAssumption": "Well-maintained for mileage"
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

  const report = JSON.parse(match[0]);

  // Normalize maintenanceAlerts — ensure it always has diy/shop structure
  const ma = report.maintenanceAlerts;
  if (Array.isArray(ma)) {
    // Old format — split into shop items only, diy empty
    report.maintenanceAlerts = { diy: [], shop: ma };
  } else if (!ma || typeof ma !== 'object') {
    report.maintenanceAlerts = { diy: [], shop: [] };
  } else {
    report.maintenanceAlerts = {
      diy:  Array.isArray(ma.diy)  ? ma.diy  : [],
      shop: Array.isArray(ma.shop) ? ma.shop : []
    };
  }

  return report;
}
async function fetchMarketPricing(year, make, model, trim, mileage) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mileageNote = mileage ? ` with ${Number(mileage).toLocaleString()} miles` : '';
  
  const prompt = `Search for current used car listings and return real market pricing for a ${year} ${make} ${model} ${trim || ''}${mileageNote}.

Search CarGurus, AutoTrader, Facebook Marketplace, and Cars.com for actual current listings of this specific vehicle at similar mileage (within 20k miles).

Return ONLY this JSON object, nothing else:
{
  "low": "$X,XXX",
  "mid": "$X,XXX", 
  "high": "$X,XXX",
  "note": "Based on current listings on CarGurus, AutoTrader, and Cars.com. Private party value for a well-maintained example at this mileage.",
  "conditionAssumption": "Well-maintained for mileage"
}

Rules:
- Use PRIVATE PARTY values, not dealer retail
- Mileage must heavily influence the price — high mileage vehicles are worth significantly less
- Base ranges on ACTUAL current listings you find, not general knowledge
- If mileage is above 150k, prices should reflect that reality
- A 2013 Honda CR-V with 214k miles should be $4,000–$7,500 range, not $15,000`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
  const match = text.match(/\{[\s\S]*?\}/);
  return match ? JSON.parse(match[0]) : null;
}

app.post('/api/transmissions', async (req, res) => {
  const { year, make, model, trim } = req.body;
  if (!make || !model) return res.json({ transmissions: [] });
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const prompt = `For a ${year || ''} ${make} ${model} ${trim || ''}, what transmission options were available?
Return ONLY a JSON array. If only automatic was offered, return ["Automatic"]. Only include manual if it was actually available for this specific year/trim.
Examples: ["Automatic"] or ["6-speed Manual", "6-speed Automatic"] or ["CVT"] or ["6-speed Manual", "CVT"]
No markdown, no explanation, nothing else.`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '[]';
    const match = text.match(/\[[\s\S]*?\]/);
    const transmissions = match ? JSON.parse(match[0]) : [];
    res.json({ transmissions: transmissions.length > 1 ? transmissions : [] });
  } catch (err) {
    res.json({ transmissions: [] });
  }
});

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
