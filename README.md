# Safe pull requests

Coframe hackathon, 10 October 2026.

Agents are opening pull requests for people who cannot read the diff. We make the PR
safe for a non-technical builder to review and merge: an interactive QA environment for
client-side UI changes where every visible change is an item with an expectation, the
evidence (before, after, winner, desktop and mobile), and a verdict. Anything flagged goes
back to the agent; publishing refuses until every item is approved and every check passed.

## Thesis

Increase the volume of safely merged pull requests through guided PR review with an
integrated feedback cycle, then over time run a loop that raises the quality of the
implementations. We focus on promoting winning A/B tests, so the target implementation is
already known: the winner's own code and screenshots are the answer key. That makes
fidelity something a non-engineer can judge and a machine can score. Merges are the
scoreboard, never the training reward.

## Pitch spine (about five minutes)

| # | Beat | The line, roughly | Evidence on hand |
|---|------|-------------------|------------------|
| 1 | Surge | One billion commits in 2025; fourteen billion at this year's pace (275M/week × 52, linear; Daigle says it won't hold). Tens of billions of lines nobody read. | Kyle Daigle (GitHub COO) on X, 3 Apr 2026; two-bar chart |
| 2 | Bottleneck | The PR screen has not changed, and a merge is mostly about the reviewer: the diff alone predicts acceptance at AUC 0.61–0.68; review activity takes it to 0.94. | A real PR files tab (Shopify/dawn #3946); arXiv 2607.12057, Dey & Mockus |
| 3 | Insight | When the PR ports a winning A/B test, the target is known. A non-engineer can judge fidelity; a machine can score it. | the wholesale-page test winner vs port screenshot pair; 32,049 archived variants |
| 4 | Product | Guided review with a feedback cycle: one item per visible change, expectation first, evidence on request, verdict per item; a flag is a prompt; the agent resubmits. | Review card on crobot branch shopify-store-review; 1,091 tests green |
| 5 | Safely | Gates own technical safety and fail closed; publishing refuses (409) until every item is approved and files are unchanged. The rehearsal found the hazard: publishing moves every section id. | 8 of 8 ids moved on the test store, 9 Oct |
| 6 | Volume | 442 wins in nine months across 82 customer orgs, 30/month on Shopify. Promotion in onboarding makes merge rate a monthly scoreboard. | Jarvis counts, 10 Oct; sample-size table |
| 7 | Loop | Train on parity, score on merges. Record from PR one; lessons file at 20; prompt evolution on a few hundred synthetic ports; Coframe alone holds the label "this change moved conversion". | Records-to-capability table |
| 8 | Demo and ask | Approve one item, flag one, watch the prompt reach the agent, watch publish refuse. Ask: promotion in onboarding; the pins join. | Local render; Clearship mock as "what it becomes" |

## What the pitch does not claim

- That the agent learns from merges (one delayed bit per PR, mostly about the reviewer).
- That weights train this quarter (zero reviewed promotions recorded yet).
- That Jarvis and crobot are joined (API keys cannot create pins; the join is proposed).
- That anything went live on a fragrance retailer (test store only).

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
