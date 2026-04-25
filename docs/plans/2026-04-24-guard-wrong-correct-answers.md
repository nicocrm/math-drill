# Guarding against "wrong correct answer" in generated exercises

Date: 2026-04-24
Status: Draft / discussion

## Problem

Users are finding "a lot of instances" where MathDrill rejects a correct student
answer or accepts a wrong one — because the ground-truth that MathDrill stored
for the question is itself wrong.

The ground-truth (`question.answerMath` + `question.answerLatex`) is produced
in a single call to GPT-4o together with the question itself. After the LLM
returns, we validate only the **shape** of the answer (is it a valid mathjs
expression? is it `"true"`/`"false"`? etc.) — we never check that it actually
matches the prompt. `verifyExplanations` only checks the *prose explanation*
for hallucination; it treats `answerMath` as ground truth.

So a single LLM slip in the generation step gets stored verbatim and
everything downstream trusts it.

## Concrete examples in the existing data

From `exercises/3f646056-d152-4eb4-97c3-0a376d209f39.json`:

- **q3** (fractions): prompt is `7/8 + (-5/6) - 1/4`. Stored
  `answerMath = "(-5/6)+(7/8)-(1/4)"` — that's the *problem*, not the
  *answer*. mathjs evaluates it to `-5/24`. But stored
  `answerLatex = "\frac{11}{24}"`, which is the actually-correct answer.
  So `answerMath` and `answerLatex` flatly contradict each other, and a
  student entering `11/24` gets marked wrong.
- **q1** (multiple choice, "mark the positive numbers"): stored correct
  set is `{a, b, d, e}`. But `d = -(-3/4)^2 = -9/16`, which is negative,
  so `d` should not be in the correct set.

Both of these are reproducible right now, without any further ingest.

## Taxonomy of root causes

It helps to separate failure modes because they need different fixes:

1. **LLM solved the problem wrong.** Genuine reasoning error — e.g.
   arithmetic slip, sign error, miscounted which choices satisfy the
   predicate.
2. **LLM stored the wrong field.** e.g. copies the prompt expression into
   `answerMath`, or forgets to evaluate it. The value is a well-formed
   mathjs string, so type-level validation passes.
3. **`answerMath` and `answerLatex` disagree.** The two fields were
   generated independently in one pass and drifted. Whichever is wrong,
   grading and display are now inconsistent.
4. **`open`-type questions have no checkable answer at all.** `answerMath`
   is `null` by design, `answerLatex` is shown to the student, and nothing
   verifies it. This is the highest-risk bucket because there is zero
   automated signal.
5. **Grader limitation, not LLM error.** Even with a correct `answerMath`,
   `checkFraction` calls `math.fraction(s)`, which only accepts literal
   fraction strings (`"a/b"`), not expressions. Any `answerMath` stored
   as an expression (e.g. `"(-3/7)*(14/9)"` in q4 of the same file) will
   make `checkFraction` throw; we fall back to `checkExpression`, which
   compares decimals with a `1e-10` tolerance — that's OK for magnitudes
   near 1 but is not unit-aware about "give the answer as an irreducible
   fraction" type requirements. Student-facing false negatives from this
   are not strictly "wrong correct answer" bugs, but they look identical
   to the user.

Any fix should target (1)–(3) before (4), and keep (5) in mind because
it compounds perceived error rates.

## Layered defenses

No single check catches everything. Each layer below has holes; the
value is in stacking them so a bug has to slip through several.

### Layer 1 — `answerMath` ⇔ `answerLatex` numeric agreement (cheap, deterministic)

For every `numeric` / `expression` / `multiple_choice` / `true_false`
question, compute a numeric value for both `answerMath` and `answerLatex`
and require them to agree.

- `numeric` / `expression`:
  - Evaluate `answerMath` via mathjs (already done for type validation).
  - Parse `answerLatex` to mathjs via a LaTeX→mathjs conversion
    (candidates: KaTeX's parser + our own walker, or
    [`mathjs.parse` does not accept LaTeX] → use a small dedicated
    converter, or ask the LLM itself to also emit an `answerValue`
    numeric field that we assert matches `answerMath`).
  - Easier alternative: **require the LLM to return `answerValue: number`
    in addition to `answerMath` and `answerLatex`**, and check
    `abs(eval(answerMath) − answerValue) < 1e-9`. Still a self-check
    — the LLM could be consistently wrong — but it catches q3-style
    "stored the wrong field" and field-drift errors cheaply.
- `multiple_choice`: check `answerMath ⊆ choices.id`. Also, if choices
  have `latex`, evaluate each choice's expression (where possible) and
  check it matches the *pattern* the prompt implies. Full check is
  hard; the easiest win is a **self-consistency probe**: ask the LLM
  (in the verification step) to re-derive which choice ids are
  correct given only the prompt + choices, and require the result to
  match `answerMath`.
- `true_false`: rely on layer 2.

Caveat: this catches contradictions, not consensus errors. If the LLM
is confidently wrong in *both* fields, layer 1 passes. It also needs
a LaTeX-aware evaluator for `answerLatex`, which is non-trivial;
the `answerValue` trick sidesteps this.

### Layer 2 — independent solver pass (catches consensus errors)

Run a **second LLM call** whose only job is: "given the prompt
(and, for multiple choice, the choices), solve it and return the
answer in the same schema." Then assert it matches the answer from
pass 1.

- Use a different provider, or at least a different model / temperature,
  and do not show it the original answer — otherwise you're just
  asking it to rubber-stamp itself.
- For `expression` / `numeric`: compare numerically with tolerance.
- For `multiple_choice`: compare as sets of ids.
- For `true_false`: compare strings.
- For `open`: compare `answerLatex` semantically is hard; fall back
  to layer 3.

Disagreement policy:

- Discard the question from the set, OR
- Re-ask the original model with the discrepancy highlighted and
  require it to either correct or confirm with explanation, OR
- Mark the question as "ungraded" (`type: "open"`) so the student
  still sees it but is not auto-graded.

Discarding silently is the safest default: a shorter exercise set
beats a wrong one.

Caveat: this doubles the per-question LLM cost and latency, and two
LLMs can share the same blind spots (both misread a tricky French
negation, for example). It's mitigation, not proof.

### Layer 3 — symbolic/numeric re-evaluation for prompts that contain the computation

Many prompts are of the form "Compute `<expr>`" or "Simplify `<expr>`".
For those, the *prompt itself* contains a machine-checkable target.
A tractable subset:

1. Extract every `$…$` math block from the prompt.
2. For each, try to parse with mathjs. If it parses as a closed-form
   numeric expression, evaluate it.
3. If the prompt has a single top-level computable expression and the
   question is `numeric` / `expression`, assert
   `eval(prompt_expr) == eval(answerMath)` (within tolerance).

This directly catches q3 above: the prompt expression evaluates to
`11/24`, `answerMath` evaluates to `-5/24`, layer 3 rejects.

Caveats:

- Not every prompt has a clean expression (word problems, geometry
  with diagrams, questions that ask for a *form* rather than a value).
- Parsing LaTeX → mathjs is fragile; we have to decide between
  best-effort (skip questions we can't parse) and strict (fail the
  batch). Best-effort is right: if layer 3 can't parse it, it stays
  silent and layer 2 still runs.
- The `requiresSteps` / "as irreducible fraction" / "in simplest
  form" flavor of prompt means the student's *form* matters. Layer 3
  should only check numeric equality; the "form" concern is a
  separate problem.

### Layer 4 — constrain the generator so fewer bugs happen at the source

Prompt-engineering fixes to reduce rates (not a substitute for 1–3):

- Require the model to emit `answerValue` (evaluated number) alongside
  `answerMath`. Giving the model a place to state its computation
  reduces copy-paste-the-prompt failures.
- Require the model to emit, per question, a one-line `solutionSteps`
  field (or reuse the `explanation` field) that we can feed into layer
  2 as a sanity check.
- Tighten the rule: "`answerMath` must evaluate to the number that
  `answerLatex` renders. If you cannot guarantee this, use `type:
  "open"` and set `answerMath: null`." — i.e. make "open" the fallback
  rather than having the model invent a wrong graded answer.
- For `multiple_choice`, require the model to emit a per-choice
  `isCorrect` boolean in addition to the `answerMath` id list, and
  cross-check: `answerMath` must equal `{id | isCorrect}`. This
  forces the model to reason per-choice instead of cherry-picking
  a subset from memory. It directly targets the q1-style bug.

Caveat: prompt rules improve the mean failure rate but do not give a
worst-case guarantee. Users will still occasionally see bugs, just
fewer. These are strictly upgrades to the existing prompt and should
land first — they're cheap and lossless.

### Layer 5 — post-hoc reporting + fast fix path

Regardless of the above, bugs will still ship. Give users:

- A "Report this question" button on the question screen and the
  results screen that attaches the question id, exercise id, the
  student's answer, and what we said was correct. Save to S3 under
  `reports/{exerciseId}/{questionId}.json` (one file per report so
  they don't collide; or append to a daily log). No DB needed.
- An admin view that lists reports and lets the owner either delete
  the question, mark it as `open` (ungraded), or manually correct
  `answerMath` / `answerLatex`.
- A "rerun verification" action on an existing exercise, so that
  improving layers 1–3 later can retroactively clean old data
  without re-ingesting the PDF.

This is the piece that shows the user we're taking the problem
seriously even before the automated checks are watertight.

## Recommended ordering

1. **Layer 4** (prompt tightening + `answerValue` + per-choice
   `isCorrect`). Almost no new code, just a prompt and schema change,
   pure win.
2. **Layer 1** (`answerMath` ⇔ `answerLatex`/`answerValue` agreement).
   Deterministic, fast, cheap, catches the q3 class immediately.
3. **Layer 5** (report button + S3 report log + admin action).
   Independent of 1–4, can ship in parallel, gives us real-world
   data about which failure modes actually dominate so later layers
   can be targeted.
4. **Layer 2** (independent-solver verification). More expensive, so
   land it after we know from layer 5 whether it's needed.
5. **Layer 3** (prompt-expression re-evaluation). Nice-to-have; only
   worth building if layer 5 shows "computation-style" questions are
   over-represented in reports.

Also fix the grader-side issue in `checkFraction`: either accept
expression strings (parse with mathjs instead of `math.fraction`) or
require `answerMath` for `numeric` to be a literal fraction and do
the arithmetic at generation time. This is unrelated to the LLM but
eliminates a class of false-negative student verdicts that looks
identical to the user.

## Open questions for the user

1. Are the observed wrong-correct-response cases predominantly in
   graded computation questions (numeric/expression) or in
   multiple-choice/true-false? That changes the priority between
   layer 1 and layer 4's per-choice flag.
2. Cost budget: is doubling per-ingest LLM spend (layer 2) acceptable,
   or do we need to stay close to one call per PDF?
3. Is it acceptable to *silently drop* questions that fail
   verification, shortening the exercise set? Alternative is to keep
   them as ungraded `open` questions with a visible "auto-graded
   disabled — please verify manually" tag.
