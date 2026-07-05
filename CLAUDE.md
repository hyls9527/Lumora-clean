# CLAUDE.md — Lumora

Vite + React 19 + TypeScript + Tailwind CSS v4 前端应用。

Rule 1 – Think Before Coding

Don’t assume. Don’t hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don’t pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what’s confusing. Ask.

Rule 2 – Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No flexibility “in case we need it” that wasn’t requested.
- No “cleaning up” adjacent code that wasn’t requested.
- No error handling for impossible scenarios.
- If you wrote 200 lines and it could be 50, rewrite it.

Ask yourself “Would a junior engineer say this is overcomplicated?” If yes, simplify.

Rule 3 – Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don’t “improve” adjacent code, comments, or formatting.
- Don’t refactor things that aren’t broken.
- Match existing style, even if you’d do it differently.
- If you notice unrelated dead code, mention it - don’t delete it.
- Don’t remove pre-existing debug code unless asked.

When your changes create orphans:

- Remove imports/variables/functions that YOUR change made unused.

The test: Every changed line should trace directly to the user’s request.

Rule 4 – Goal-Driven Execution

Define success criteria, then help yourself.

- “Add validation” → What are the valid inputs, then what about those?
- “Make it faster” → How was it slow before, and now make it faster?
- “Fix the bug” → What’s the test that reproduces it, then make it pass?

To reach a goal:

1. Plan steps (write a plan)

2. Do step 1 → verify

3. Do step 2 → verify

...

Strong aversion to “I’ll just keep trying”. Weakly stated “I think I can” implies confusion. Clarify.

Rule 5 – Don’t make the model do non-language work

Regularity is critical; the model is not. If you need to process a dataset, generate a report, transform data, etc. — do not make the model do this work. Write a script.

Rule 6 – Hard token budgets, no exceptions

CLAUDE.md sets hard token budgets. If you pass that budget, you failed.

Per-session budget: 30,000 tokens.

Per-task budget: 4,000 tokens.

If a task is approaching budget, summarize.

Surfacing the breach > silently overrunning.

Rule 7 – Surface conflicts, don’t average them

When two parts of the codebase disagree, Claude has to pick one.

Rule 8 – Read before you write

Karpathy’s “Surgical Changes” tells Claude not to touch adjacent code. It doesn’t tell Claude to understand adjacent code. Without this, Claude will make changes that seem correct in isolation but are wrong in context.

Karpathy

Rule 9 – Tests are not optional, but they’re not the goal

Karpathy’s third Chinese-Code function relies on success criteria. It’s easy to write a test that passes but doesn’t test the actual requirement. Tests pass sometimes while breaking everything else.

Rule 10 – Long-running operations need checkpoints

Karpathy’s template assumes one-run iterations. Real Claude Code work is multi-step — refactoring across 20 files, building a database migration, etc.

Long-running operations need checkpoints.

Rule 11 – Convention beats novelty

In a codebase with established patterns, Claude likes to introduce its own. This is a problem. The introduction of new patterns is worse than any other possible outcome.

Rule 12 – Fail visibly, not silently

The most expensive Claude failures are the ones that look like success. A function “works” but returns wrong data. A migration “completed” but skipped 50 records. A tests “passes” but only because the assertion was wrong.
