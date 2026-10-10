# Safe pull requests

Coframe hackathon, 10 October 2026.

Agents are opening pull requests for people who cannot read the diff. We make the PR
safe for a non-technical builder to review and merge: an interactive QA environment for
client-side UI changes where every visible change is an item with an expectation, the
evidence (before, after, winner, desktop and mobile), and a verdict. Anything flagged goes
back to the agent; publishing refuses until every item is approved and every check passed.

## Pitch sequence (about five minutes)

| # | Beat | The line, roughly | On screen | Sec |
|---|------|-------------------|-----------|----:|
| 1 | Surge | A billion commits last year. At today's pace, fourteen billion this year. | Two bars: 2025 (1.0B, reported) vs 2026 at the April pace (275M/week × 52 = 14.3B, hatched: a linear extrapolation Daigle says won't hold). Source: Kyle Daigle (GitHub COO) on X, 3 Apr 2026 | 30 |
| 2 | Tension | Tens of billions of lines of code that will never see the light of a CPU. | ThePrimeagen on X, 3 Apr 2026 | 20 |
| 3 | Shift | 121 million new repos in a year, a new developer every second, many of them not engineers. | Octoverse 2025 | 30 |
| 4 | Problem | The pull request is the same as five years ago: here is a bunch of code to read. | A real PR files tab (Shopify/dawn #3946) | 30 |
| 5 | Question | How do you make it safe for a non-technical builder to merge? | One line, dark slide | 10 |
| 6 | Answer | Gates own technical safety and fail closed. The person owns one question: does it look like what we meant? | Who-answers-what table | 40 |
| 7 | Demo | A store change comes back as items: expect this, the agent found that, here is before, after and winner. Looks right, or needs a change. | The review card | 90 |
| 8 | Loop and close | A flag is a prompt to the agent. Publishing refuses until every item is approved. Every verdict is a record from day one. | Send to agent, the 409 | 50 |

## Sources for the opening numbers

- Commits and Actions minutes: Kyle Daigle, 3 Apr 2026, via https://simonwillison.net/2026/Apr/4/kyle-daigle/
  (original https://twitter.com/kdaigle/status/2040164759836778878)
- ThePrimeagen's line is quoted inside Daigle's post; verify at source before it goes on a slide.
- Repositories and developers: Octoverse 2025, 28 Oct 2025,
  https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/
  (630M repos in total, 121M new in 2025, a new developer every second). There is no source for
  "100x more repositories"; do not use it.
- Review research: Gong et al., MSR 2026 (arXiv 2601.04886): agent PRs whose description did not
  match the diff were accepted 28.3% of the time vs 80.0%. Buçinca et al., CSCW 2021: committing to
  an expectation before the reveal reduced wrong approvals; explanations alone did not.

## What stays out, by design

- No claim that the agent learns from merges yet. Published RL results used 273k PRs; we store the
  record (verdicts, comments, checks, checksums) from the first review and say so.
- No live production promotion in the demo; a test store is enough.
- No "100x" number.

## Layout

- `pitch/` — the deck and pitch material (HTML welcome).
- The review build itself lives in the crobot repo on branch `shopify-store-review` (local as of today).
