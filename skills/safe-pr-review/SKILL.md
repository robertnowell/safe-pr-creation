---
name: safe-pr-review
description: Turn any pull request that changes a web UI into a review a non-technical owner can judge: a plain-English goal, an architecture before/after, the risks, a QA checklist with machine gates that fail closed, and an interactive per-feature reviewer (mobile/desktop, before/after screenshot, video and live page, click-anywhere comments mapped to code lines, submit as comments or ask the agent to fix). Use when asked to "make this PR safe to review", "build the review for PR #N", or after an agent opens a UI pull request.
---

# Safe PR review

The reviewer is not reading the diff. They are answering one question per feature: does it look and behave like what we meant? Everything technical is a gate that fails closed. Write the goal first, in their words.

## Inputs

- A PR (`owner/repo#N`) whose head and base can each be rendered as static pages, or served locally (`before/` and `after/` directories; each page is a file path relative to the directory, with a mobile and a desktop page when the site freezes a layout per viewport).
- The experiment or brief the PR implements, if any: this is where the goal and each feature's expectation come from, never from the diff.

## Steps

1. **Resolve the PR.** `gh pr view N --json title,author,baseRefName,headRefName,url,files`. Check out base and head into two directories. For a static site that is the tree itself; for an app, build each and export the changed routes as static HTML (Playwright `freeze.js` in this skill captures a rendered page with its runtime CSS inlined).
2. **Write `review.json`** (schema below). Rules:
   - `goal.text` under ten words, plain English, from the brief ("Put the winning wholesale page into the live theme.").
   - `architecture`: one Graphviz dot drawn with `hq-diagram` (or a hand-written SVG) showing only the systems the PR touches, before and after; plus two sentences.
   - `risks`: what breaks if this goes wrong, each with where it was seen (or why it is likely) and the gate that catches it. Prefer things that already went wrong once.
   - `checks`: the QA checklist. Machine gates come from `gates.json` (step 4); a gate that did not run is `not_run`, shown amber, and it blocks. Person checks are `not_run` until the reviewer approves.
   - `features`: one per separate piece of UI the PR changes (a menu, a page section, a card). Each needs `beforeSelector`, `afterSelector`, `expect` (what the reviewer should see, from the brief) and `found` (what the agent saw when it checked, honest).
3. **Capture evidence.** `node capture.mjs features.json evidence/` (features.json is generated from `review.json`'s features plus the before/after dirs). It writes, per feature and viewport, before/after screenshots and element crops, 4-second before/after videos, and `boxes.json`: the on-screen rectangles of changed elements with `file:line` from `data-src` attributes or a grep of the changed files.
4. **Run the gates.** `node gates.js before/ after/ repo/ base head gates.json`: file scope, console errors on changed pages (after vs before), pixel diff of the untouched region, and a shape check of the new UI. Add project-specific gates (theme check, cart/checkout, lighthouse) as the project needs; every gate reports pass, fail or not_run.
5. **Build the page.** `node build-review.mjs review.json evidence/manifest.json review/pr-N/`. It copies the before and after trees and the evidence beside a single `index.html` with everything inlined, so the live-page tab works from a file or any static host.
6. **Open it and look** at every feature at both widths before handing it over. Then commit `review/pr-N/` on the base branch (not the PR branch) and link it from the PR description.

## What the reviewer can do

- Switch mobile/desktop; switch screenshot/video/live page; the two panes stay side by side.
- Click anywhere on the after pane: a pin and a comment box appear, pre-filled with the changed element under the cursor and its source line.
- Add as many comments as needed, then **Looks right**, **Submit as comments** (review markdown + the `gh pr review` command), or **Submit and ask the agent to fix** (adds the literal prompt for the agent: feature, viewport, comment, source line).
- The merge stays locked until every feature is approved and every check passed.

## review.json

```json
{
  "pr": { "key": "owner-repo-1", "repo": "owner/repo", "number": 1, "title": "…", "author": "…", "url": "…", "base": "main" },
  "goal": { "text": "Under ten words.", "why": "One sentence on where the goal comes from." },
  "architecture": { "svg": "<svg…>", "before": "…", "after": "…" },
  "risks": [ { "risk": "…", "seen": "…", "gate": "…" } ],
  "checks": [ { "check": "…", "who": "Gate|Person", "evidence": "…", "state": "pass|fail|not_run", "detail": "…" } ],
  "features": [ { "id": "slug", "title": "…", "page": "index.html", "expect": "…", "found": "…" } ],
  "why": { "headline": "…", "text": "…" },
  "footer": "…"
}
```

## Files in this skill

`SKILL.md` · `template.html` (the page) · `build-review.mjs` · `capture.mjs` · `gates.js` · `freeze.js` (render a live page to a static file with its runtime CSS) · `example/` (PR #1 of robertnowell/safe-pr-creation: the Novig scoreboard).
