const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Report generation endpoint
app.post('/api/report', async (req, res) => {
  const { year, make, model, mileage } = req.body;

  if (!year || !make || !model) {
    return res.status(400).json({ error: 'Year, make, and model are required.' });
  }

  try {
    const prompt = buildPrompt(year, make, model, mileage);
    const report = await callClaudeAPI(prompt);
    res.json({ report });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Failed to generate report. Please try again.' });
  }
});

function buildPrompt(year, make, model, mileage) {
  return `You are an expert automotive analyst with deep knowledge of car reliability, common problems, ownership costs, and market values. You have access to community knowledge from Reddit (r/cars, r/MechanicAdvice, r/whatcarshouldIbuy, model-specific subreddits), Car and Driver, Consumer Reports, and automotive forums.

A user wants a "Gas or Pass" report on a ${year} ${make} ${model}${mileage ? ` with ${mileage} miles` : ''}.

Generate a comprehensive vehicle report in the following JSON format ONLY. Do not include any text outside the JSON.

{
  "vehicle": "${year} ${make} ${model}",
  "mileage": "${mileage || 'Not specified'}",
  "verdict": "GAS" or "PASS",
  "verdictReason": "One punchy sentence explaining the verdict",
  "overallScore": <number 0-100>,
  "scores": {
    "reliability": <number 0-100>,
    "costToOwn": <number 0-100>,
    "drivability": <number 0-100>,
    "partsAvailability": <number 0-100>,
    "communityRating": <number 0-100>
  },
  "scoreExplanations": {
    "reliability": "2-3 sentence explanation",
    "costToOwn": "2-3 sentence explanation",
    "drivability": "2-3 sentence explanation",
    "partsAvailability": "2-3 sentence explanation",
    "communityRating": "2-3 sentence explanation"
  },
  "summary": "3-4 sentence overall summary a friend would give you",
  "knownIssues": [
    { "issue": "Issue name", "severity": "High/Medium/Low", "mileage": "When it typically occurs", "detail": "1-2 sentence explanation", "source": "Reddit/Car and Driver/etc" }
  ],
  "maintenanceAlerts": [
    { "item": "Service item", "interval": "When it's due", "estimatedCost": "$X-$Y", "detail": "Why it matters" }
  ],
  "whatPeopleAreSaying": [
    { "source": "Reddit r/[subreddit] or Car and Driver etc", "sentiment": "Positive/Negative/Mixed", "quote": "Paraphrased community wisdom or expert opinion", "link": "https://www.reddit.com/r/[relevant subreddit] or real URL if known" }
  ],
  "fairMarketRange": {
    "low": "$X,XXX",
    "mid": "$X,XXX",
    "high": "$X,XXX",
    "note": "Brief note on what affects price"
  },
  "buyingTips": [
    "Tip 1",
    "Tip 2",
    "Tip 3"
  ],
  "thingsToInspect": [
    "Thing to check 1",
    "Thing to check 2",
    "Thing to check 3"
  ],
  "generationNotes": "What's unique or notable about this specific year/generation",
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
      model: 'claude-opus-4-5',
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

  // Extract text content from response
  const textContent = data.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Parse JSON from response
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
