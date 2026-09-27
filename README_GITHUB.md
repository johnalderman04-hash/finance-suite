# Finance Suite — daily auto-rebuild via GitHub Actions

This repo builds itself every weekday morning: a GitHub Actions workflow
(`.github/workflows/daily.yml`) re-runs the discovery collector (Nasdaq
screener + analyst data, Yahoo price history, CBOE delayed options chains),
**validates** the result, rebuilds `index.html`, runs headless smoke tests,
commits, and redeploys to GitHub Pages.

Free forever on a **public** repo: unlimited Actions minutes, free Pages
hosting with HTTPS. No backend, no database, no API keys, no Docker, no
assistant needed after setup.

## One-time setup (about 10 minutes)

1. **Create the repo.** On github.com → new repository, name it e.g.
   `finance-suite`, set **Public** (public = unlimited free build minutes),
   don't add a README.
2. **Push this folder.** On your computer:
   ```
   cd /path/to/finance-suite
   git remote add origin https://github.com/YOURNAME/finance-suite.git
   git branch -M main
   git push -u origin main
   ```
   (The folder is already a git repo with everything committed.)
3. **Enable Pages.** In the repo: Settings → Pages → Source: **GitHub Actions**.
4. **Run it once manually.** Actions tab → "daily-rebuild" → Run workflow.
   This first run is also the **source compatibility test**: the "Probe data
   sources" step logs whether Nasdaq, Yahoo, and CBOE are reachable from
   GitHub's servers. Your site goes live at
   `https://YOURNAME.github.io/finance-suite/`.

After that it rebuilds itself every weekday ~7:00 AM Chicago time (cron
`0 12 * * 1-5`, i.e. 12:00 UTC). The **CORE DATA** chip in the top bar always
shows the bundled data's date, so stale builds are visible. Bundled data is
labeled DAILY — never LIVE.

## Failure safety (the important part)

- **Validation gates deployment.** `validate_data.py` checks row counts,
  duplicates, impossible prices, malformed option chains, freshness metadata,
  and sudden explosions/collapses vs the previous bundle. A 10x duplicate
  explosion fails the build.
- **A failed run never replaces the live site.** If collection or validation
  fails, the workflow stops before commit/deploy — the previous good Pages
  deployment stays up. A failure report is uploaded as an artifact, and the
  build summary shows what went wrong.
- **Partial failure doesn't wipe good data.** If CBOE options fail but stocks
  are fine, the previous day's chains are kept and marked `stale` (the CORE
  DATA chip shows "options stale"). If a critical dataset fails, nothing
  deploys.
- Every run writes a concise build summary (sources OK/failed, record
  counts, validation result) to the Actions run page.

## What updates when

| Layer | Updates |
|---|---|
| Bundled data (stocks, options, seasonality) | Each weekday workflow run |
| News headlines | Every ~4 min in your browser |
| Live quotes | Every ~60 s in your browser (needs free Finnhub key, yours only) |
| Crypto, SEC filings | When you open those pages |
| What Changed | Compares each of your visits locally |

## Never commit these

- Settings → Export JSON backups (contain your API keys and passcode hash).
- Anything in `_build/.cache-discovery/` (already gitignored).

## Notes

- Your personal data (watchlists, keys, passcode) lives only in your
  browser's localStorage — it is never in this repo and never uploaded.
- On the public URL, the passcode lock protects nothing for visitors (they
  get a fresh browser with no passcode set). It still locks the app on your
  own devices.
- Scheduled runs can start a few minutes late; GitHub occasionally pauses
  schedules on fully inactive repos — the daily commit itself counts as
  activity, so this stays alive on its own.
- No GitHub Actions secrets are required. All build-time data sources are
  free and keyless. Your Finnhub key (optional, for live quotes) stays in
  your browser only.
