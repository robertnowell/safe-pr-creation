# How you make a pull request safe to review

Worked example throughout: a fragrance retailer's wholesale-page test, promoted to its test store on 9 Oct 2026.

## 1. Goal, in plain English, under ten words

> Put the winning wholesale page into the live theme.

Written from the experiment, not from the diff. It is the first line of the review.

## 2. Architecture, before and after

`architecture-before-after.svg`. Before: the shopper loads the live theme, the theme loads
Coframe's script, and the script paints the winner over the page on every visit. After: the
winner's code and screenshots are the answer key; the agent ports it into an unpublished
theme copy; guided review and gates sit between the copy and the live theme; on publish the
winner lives in `sections/*.liquid` and the script is off for that test.

## 3. Risks: what breaks if this goes wrong

| Risk | Seen | Gate that catches it |
|---|---|---|
| Publishing a copied theme renumbers every section id; running Coframe tests that target those ids go dark | the test store, 9 Oct: 8 of 8 page types changed | Collision check before publish: no running test pins a numbered id |
| The "after" screenshot shows Coframe's served variation, not the port (the script runs on the preview too) | the promotion rehearsal | Capture with `cf_disable=true`; the check fails closed if not reported |
| Cart or checkout stops loading | QA scope: never submit an order | Cart and checkout pages load; nothing ordered |
| The agent touches files outside the task | Scope rule in CROBOT.md | Only this task's files pushed; per-file checksums |
| Someone edits the live theme between review and publish | Drift warning exists today | Checksums bound to the review; a push after approval asks again |

## 4. QA checklist: what to check by hand

| Check | Who | Evidence shown |
|---|---|---|
| Only the intended files changed | Gate | File list vs task plan |
| The theme still parses and lints | Gate | Theme Check result |
| No new console errors on changed pages | Gate | Console count, preview vs live |
| A shopper can add to cart and reach checkout | Gate | Cart 200, checkout 200, no order |
| The live theme is still the one that was copied | Gate | Checksum lock |
| Each feature matches the winner, desktop and phone | Person | Before, after, winner per viewport |
| Pages the task did not touch look the same | Person | Home, a product, a collection: preview vs live |
| Links and the form go where they should | Person + gate | Link list with status codes; form action |

A gate that did not run shows as "not checked", in amber, and blocks publishing. Nothing
missing can look like a pass.

## 5. The reviewer: one feature at a time

A feature is a separate piece of UI to review: a menu, a page, a section.

- Top: segmented control, Mobile / Desktop.
- Below: Before and After side by side, as screenshot, video, or the live page.
- Each feature states the expectation and the agent's finding first, then the evidence.
- Click anywhere and leave a comment; the comment tracks to a line of code in the PR and
  carries the feature and viewport.
- Add as many comments as needed, then submit the review:
  - **Submit as comments** (recorded on the PR), or
  - **Submit and ask the agent to fix** (the comments go to the agent as one prompt; it
    fixes, re-captures and resubmits; features that did not change keep their approval).
- Publish stays locked until every feature is approved and every check passes.

`comment-loop.svg` draws the cycle.

## 6. Why: the loop it feeds

All of this exists to increase the number of PRs that can be safely merged, because each
merged, reviewed port is the record a learning loop needs, and promoting winning tests is the
case where the target is known.

| Step | What happens | Signal | Scale needed |
|---|---|---|---|
| 1 Record | Every promotion stores brief, diff, gates, evidence, each verdict and comment | Structured trace | From PR one |
| 2 Parity score | The port is scored against the winner's code and screenshots per feature, per viewport, script off | Fast, exact, minutes | Any |
| 3 Lessons | Reviewer comments curated into a short lessons file the agent reads | Human-written rules | ~20 records |
| 4 Prompt evolution | Synthetic ports from the 32,049 archived variants, scored by parity, tune the skill text | Parity | A few hundred scored tries |
| 5 Reward model | Per-item verdicts train a judge that reranks candidate ports and picks what a person sees | Verdicts, ~5 per PR | ~1,000 verdicts |
| 6 Scoreboard | Merge rate per month and per customer reports whether 1–5 helped | Merged or not, held out, never a reward | 200 PRs to know it to ±13 pts |

Volume today: 442 wins concluded in nine months across 82 customer orgs, 30 a month on
Shopify (Jarvis, 10 Oct 2026). Train on parity, score on merges, calibrate on verdicts.
