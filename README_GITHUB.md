# Finance Suite — daily auto-rebuild via GitHub

This repo builds itself every weekday morning: a GitHub Actions workflow
(`.github/workflows/daily.yml`) re-runs the discovery collector (Nasdaq
screener + analyst data, Yahoo price history, CBOE delayed options chains),
rebuilds `index.html`, commits it, and redeploys to GitHub Pages.

Free forever on a **public** repo: unlimited Actions minutes, free Pages
hosting with HTTPS. No backend, no API keys, no assistant needed after setup.

## One-time setup (about 10 minutes)

1. **Create the repo.** On github.com, new repository, name it e.g.
   `finance-suite`, set **Public** (public = unlimited free build minutes),
   don't add a README.
2. **Push this folder's contents.** On your computer:
   ```
   cd /path/to/finance-suite
   git init
   git add -A
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/finance-suite.git
   git push -u origin main
   ```
3. **Enable Pages.** In the repo: Settings → Pages → Source: **GitHub Actions**.
4. **Run it once manually.** Actions tab → "daily-rebuild" → Run workflow.
   Your site goes live at `https://YOURNAME.github.io/finance-suite/`.

After that it rebuilds itself every weekday ~7 AM Chicago time. The
"Discovery data as of …" badge in the app always shows the data date, so
stale builds are visible. If a run fails (e.g. a data source rate-limits
GitHub's servers), the previous good build stays up — the collector refuses
to overwrite with bad data.

## Never commit these

- Settings → Export JSON backups (contain your API keys and passcode hash).
- Anything in `_build/.cache-discovery/`.

## Notes

- Your personal data (watchlists, keys, passcode) lives only in your
  browser's localStorage — it is never in this repo and never uploaded.
- On the public URL, the passcode lock protects nothing for visitors (they
  get a fresh browser with no passcode set). It still locks the app on your
  own devices.
- Scheduled runs can start a few minutes late; GitHub occasionally pauses
  schedules on fully inactive repos — the daily commit itself counts as
  activity, so this stays alive on its own.
