# CLAUDE.md — Lumora

Vite + React 19 + TypeScript + Tailwind CSS v4。

**Rule 0 – Read ARCHITECTURE.md First**: Before reading ANY source file, read `ARCHITECTURE.md`. It has the full code map, data model, IPC contracts, and test structure. Only read source code when the architecture doc doesn't answer your question. Never read files speculatively — search first (`search_files`), then read only the exact file you need.

**Rule 1 – Think First**: State assumptions. If uncertain, ask. Surface tradeoffs; don't pick silently.

**Rule 2 – Simplicity**: Minimum code. No speculative features, no "in case" flexibility, no error handling for impossible scenarios. 200 lines → 50 if possible.

**Rule 3 – Surgical Changes**: Touch only what's needed. Don't improve adjacent code. Match existing style. Remove only orphans YOUR change created. Every line traces to the user's request.

**Rule 4 – Goal-Driven**: Define success criteria first. Plan → do → verify, step by step. No "I'll just keep trying."

**Rule 5 – Script, Not Model**: For data processing, report generation, transforms — write a script. Don't make the model do it.

**Rule 6 – Token Budgets**: Per-session: 30K tokens. Per-task: 4K tokens. Surface breach > silently overrun.

**Rule 7 – Conflicts**: When two parts disagree, pick one explicitly. Don't average.

**Rule 8 – Read Before Write**: Understand adjacent code before changing it. Correct in isolation ≠ correct in context.

**Rule 9 – Tests**: Required but not the goal. A passing test that doesn't test the real requirement is worse than no test.

**Rule 10 – Checkpoints**: Long-running operations (multi-file refactors, migrations) need checkpoints.

**Rule 11 – Convention Over Novelty**: Match existing patterns. Introducing new patterns is the worst outcome.

**Rule 12 – Fail Visibly**: The most expensive failures look like success. A function that "works" but returns wrong data. A migration that "completed" but skipped records.
