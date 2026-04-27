# ⛽ Gas or Pass — Vehicle Research Reports

AI-powered vehicle research reports. Enter a year, make, and model — get a full breakdown of reliability, known issues, fair market value, and what real owners are saying.

---

## 🚀 Getting Started (Local Development)

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/gas-or-pass.git
cd gas-or-pass
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up your environment variables
```bash
cp .env.example .env
```
Then open `.env` and paste in your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-...
```
Get your key at: https://console.anthropic.com

### 4. Run locally
```bash
npm run dev
```
Visit: http://localhost:3000

---

## 🌐 Deploying to Render

1. Push your code to GitHub
2. Go to https://render.com and create a new **Web Service**
3. Connect your GitHub repo
4. Set the following:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. Add your environment variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
6. Click **Deploy** — you're live!

---

## 📁 Project Structure

```
gas-or-pass/
├── server.js          # Express server + Claude API integration
├── package.json       # Dependencies
├── .env.example       # Environment variable template
├── .gitignore
└── public/
    └── index.html     # Full frontend (HTML, CSS, JS)
```

---

## 🔧 Customization Guide

### Changing the brand name / colors
Open `public/index.html` and find the `:root` CSS variables at the top:
```css
:root {
  --gas: #c8f560;     /* Main accent color (green) */
  --pass: #ff4d4d;    /* Fail/pass color (red) */
  --bg: #0e0e0e;      /* Background */
  --text: #f0ede8;    /* Text color */
}
```

### Adjusting what the AI researches
Open `server.js` and find the `buildPrompt()` function. You can edit the prompt to add or remove categories, change scoring criteria, or adjust the tone.

### Adding payment / gating reports
The report endpoint is at `POST /api/report`. To add payments later:
1. Add a Stripe integration (stripe npm package)
2. Check payment status before calling `callClaudeAPI()`
3. Return a 402 error if not paid

---

## 💰 Future Pricing Setup (Placeholder)

When ready to add pricing, the structure will be:
- **Free:** 1 report
- **Single Report:** $X.XX
- **Bulk Pack (10 reports):** $XX.XX
- **Unlimited Monthly:** $XX/mo

---

## 📝 Notes

- Reports are generated fresh each time using AI + web search
- No reports are stored or cached (yet)
- The AI searches Reddit, automotive sites, and community forums
- PDF download is client-side (no server storage needed)

---

Built with Node.js, Express, and Claude AI.
