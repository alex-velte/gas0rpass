const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/report', async (req, res) => {
  const { year, make, model, trim, mileage, vin } = req.body;

  if (!vin && (!year || !make || !model)) {
    return res.status(400).json({ error: 'Please provide a VIN or a Year, Make, and Model.' });
  }

  try {
    const prompt = buildPrompt(year, make, model, trim, mileage, vin);
    const report = await callClaudeAPI(prompt);
    res.json({ report });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report. Please try again.' });
  }
});

function buildPrompt(year, make, model, trim, mileage, vin) {
  const trimInfo = trim ? ` ${trim} trim` : '';
  const mileageInfo = mileage ? ` with ${Number(mileage).toLocaleString()} miles` : '';
  const vehicleDesc = vin && (!year || !make || !model)
    ? `VIN: ${vin}`
    : `${year} ${make} ${model}${trimInfo}${mileageInfo}${vin ? ` (VIN: ${vin})` : ''}`;

  const vehicleLabel = vin && (!year || !make || !model)
    ? vin
    : `${year} ${make} ${model}${trimInfo}`;

  return `You are an expert automotive analyst — think of yourself as a knowledgeable car-enthusiast friend who gives honest, balanced advice. You have deep knowledge of reliability, common problems, ownership costs, and market values, drawing from Reddit communities (r/cars, r/MechanicAdvice, r/whatcarshouldIbuy, and model-specific subreddits), Car and Driver, Consumer Reports, and automotive forums.

A user wants a "Gas or Pass" report on: ${vehicleDesc}.
${vin && (!year || !make || !model) ? 'The user only provided a VIN. First decode the VIN to determine the year, make, model, trim, and engine, then generate the full report based on that vehicle.' : ''}

CRITICAL SCORING PHILOSOPHY:
- Be a realistic, balanced friend — not an insurance company. High mileage on a reliable brand (Toyota, Honda, Lexus, Subaru H6) does NOT mean "Pass." A well-maintained Toyota with 250k miles is often a better buy than a poorly maintained German car with 60k miles.
- Mileage must be scored IN CONTEXT of the brand/model's known reliability. Toyota/Honda/Lexus can score 70+ even at 200k+ miles if properly maintained. German luxury (BMW, Audi, Mercedes) should score lower at high mileage due to expensive maintenance.
- Verdict options: "GAS" (buy it), "HARD PASS" (avoid), "GAS/PASS" (genuinely 50/50). Only use "HARD PASS" if there are serious known expensive issues OR mileage is extreme even for that brand.
- Scoring should be generous for vehicles known to last — a 150k mile Tacoma is not a risky buy.
${trim ? `\nTRIM/ENGINE CONTEXT: The user specified "${trim}" trim. Be specific to this trim's engine and reliability profile. This matters especially for brands like Subaru (H6 vs H4), or turbocharged vs naturally aspirated variants.` : ''}
${vin ? `\nVIN PROVIDED: ${vin} — use this to confirm year/make/model/trim/engine details.` : ''}

Generate a comprehensive vehicle report in the following JSON format ONLY. No text outside the JSON.

{
  "vehicle": "${vehicleLabel}",
  "mileage": "${mileage || 'Not specified'}",
  "verdict": "GAS" or "HARD PASS" or "GAS/PASS",
  "verdictReason": "One punchy honest sentence like a friend would say",
  "overallScore": <0-100, factor in mileage context for this brand>,
  "scores": {
    "reliability": <0-100>,
    "costToOwn": <0-100>,
    "drivability": <0-100>,
    "partsAvailability": <0-100>,
    "communityRating": <0-100>
  },
  "scoreExplanations": {
    "reliability": "2-3 sentences mentioning mileage context",
    "costToOwn": "2-3 sentences including maintenance costs at this mileage",
    "drivability": "2-3 sentences",
    "partsAvailability": "2-3 sentences",
    "communityRating": "2-3 sentences with what Reddit/enthusiasts say"
  },
  "mileageBreakdown": {
    "currentMileageContext": "What does this mileage mean for THIS specific vehicle?",
    "servicesDueByNow": ["Service that should have happened by this mileage 1", "Service 2", "Service 3"],
    "upcomingServices": ["Coming up in next 10-20k miles 1", "Item 2"],
    "mileageMilestones": [
      { "mileage": "X,XXX", "event": "What happens or what service is needed" }
    ]
  },
  "summary": "3-4 sentences of real-talk advice like a knowledgeable friend",
  "knownIssues": [
    { "issue": "Issue name", "severity": "High/Medium/Low", "mileage": "When it typically occurs", "detail": "1-2 sentence explanation", "source": "Reddit/Car and Driver/etc" }
  ],
  "maintenanceAlerts": [
    { "item": "Service item", "interval": "When it's due", "estimatedCost": "$X-$Y", "detail": "Why it matters" }
  ],
  "whatPeopleAreSaying": [
    { "source": "Reddit r/[subreddit] or Car and Driver etc", "sentiment": "Positive/Negative/Mixed", "quote": "Paraphrased community wisdom", "link": "https://www.reddit.com/r/[relevant subreddit]" }
  ],
  "fairMarketRange": {
    "low": "$X,XXX",
    "mid": "$X,XXX",
    "high": "$X,XXX",
    "note": "What affects price at this mileage"
  },
  "buyingTips": ["Tip 1", "Tip 2", "Tip 3"],
  "thingsToInspect": ["Item 1", "Item 2", "Item 3"],
  "generationNotes": "What's notable about this year/generation/trim",
  "alternativesToConsider": [
    { "vehicle": "Year Make Model", "reason": "Why it might be better" }
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
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await response.json();

  const textContent = data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse report JSON from Claude response');

  return JSON.parse(jsonMatch[0]);
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Gas or Pass server running on port ${PORT}`);
});
