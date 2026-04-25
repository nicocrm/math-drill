# Phased spec: guard against wrong correct answers

Date: 2026-04-24
Status: Spec (not an implementation plan)
Supersedes: `2026-04-24-guard-wrong-correct-answers.md` (kept for background)

This spec defines **what** each phase must deliver and how to tell if it
worked. It deliberately does not prescribe files, signatures, or
step-by-step tasks — those will be worked out per phase at implementation
time.

The three phases are ordered so each one is independently shippable and
each one increases the amount of signal we have about the problem.

---

## Phase 1 — Layer 4: tighten the generator

### Goal

Reduce the *rate* at which the LLM produces internally contradictory
ground-truth, by giving it (a) explicit places to write intermediate
results and (b) structural constraints that force per-item reasoning.

### Scope

Changes are limited to:

- The extraction system prompt.
- The extraction response schema (what we ask the LLM to return and what
  we accept).
- The shape-validation step that runs after parsing the LLM response.

No changes to grading, UI, storage layout, or the student experience.

### Requirements

1. **`numeric` / `expression` questions** must carry a canonical
   numeric value for the correct answer, independent of `answerMath`
   and `answerLatex`. The exact field name is an implementation
   detail; the contract is: "after extraction, every graded
   numeric/expression question has a number we can compare against."

2. **`multiple_choice` questions** must carry, per choice, an explicit
   correct/incorrect flag. The `answerMath` id list must be derivable
   from those flags; they are not two independent assertions.

3. The prompt must state, in terms the model cannot round-trip away:
   - `answerMath`, `answerLatex`, and the canonical numeric value must
     all represent the *same* number.
   - If the model cannot guarantee that, the question must be emitted
     as `type: "open"` with `answerMath: null`. Demoting to open is
     always acceptable; shipping a wrong graded answer is not.

4. Shape validation (the post-parse step) must reject any response
   that violates the above contracts, with messages that identify the
   offending question id.

### Out of scope

- Evaluating `answerLatex` ourselves.
- Any second LLM call.
- Any change to how graded answers are *checked* at runtime.
- Retrofitting these fields onto existing stored exercises.

### Acceptance criteria

- On a fresh ingest of a representative PDF, all graded
  numeric/expression questions have the canonical numeric value set,
  and all multiple-choice questions have per-choice correctness flags.
- A unit-level check confirms shape validation rejects a response
  where these fields are missing, inconsistent between themselves, or
  inconsistent with `answerMath`.
- On a PDF the model historically misgenerated (e.g. the one that
  produced the q1/q3 bugs cited in the background doc), the rate of
  internally-contradictory responses falls, or questions that would
  have been wrong are emitted as `open` instead. We will not set a
  numeric target; a qualitative A/B on a handful of PDFs is enough.

### Risks and open decisions

- **Cost of demoting to open.** A PDF that used to produce 10 graded
  questions might now produce 6 graded + 4 open. If the owner expected
  a full exercise, this looks like a regression. Spec decision:
  prefer correctness over breadth — an open question is visibly
  ungraded, a wrong graded one is invisibly harmful.
- **The model may simply lie in the new fields.** This phase does not
  catch that; phase 2 does. Phase 1's value is structural (it removes
  one of the easy failure modes — field drift) not adversarial.
- **Schema change will break the fixture-based unit tests.** Update
  the fixtures as part of this phase.

---

## Phase 2 — Layer 1: cross-check the fields we now have

### Goal

Make it impossible for a question to be saved with internally
contradictory ground-truth. Phase 1 gave us the fields; phase 2 uses
them.

### Scope

A verification step between "LLM response parsed" and "exercise
persisted". It consumes the fields added in phase 1 and rejects or
rewrites questions that don't pass.

### Requirements

1. For every graded **`numeric` / `expression`** question, the cross-check
   must confirm that evaluating `answerMath` yields the canonical
   numeric value within a reasonable tolerance. The tolerance must be
   relative, not absolute, because answers range over many orders of
   magnitude.

2. For every **`multiple_choice`** question, the cross-check must
   confirm:
   - The id set derived from the per-choice correct flags equals the
     id set in `answerMath`.
   - Every id in `answerMath` refers to a choice that actually exists
     in that question.

3. For **`true_false`**, the only check is the existing shape check.
   Phase 2 adds nothing; phase 4 (layer 2) is the one that will cover
   true/false.

4. For **`open`**, phase 2 adds nothing. There is nothing to cross-check.

5. **Failure policy:** a question that fails the cross-check must not
   be persisted as graded. The default action is to demote it to
   `type: "open"` and keep it in the exercise. Dropping it entirely is
   an acceptable alternative if demotion would produce a degenerate
   question (e.g. a prompt like "Which of these are positive?" with
   no graded classification would be useless). The decision is per
   question type; the spec leaves it at "demote by default, drop if
   demotion makes the question nonsensical."

6. Every demotion or drop must be logged with enough context to
   diagnose later (exercise id, question id, reason, the conflicting
   values). This is a permanent diagnostic signal, not a debug knob.

### Out of scope

- LaTeX parsing of `answerLatex`. We rely on the phase-1 numeric field
  as the comparison anchor. If the model's `answerLatex` is wrong in
  isolation (right number, wrong display), we cannot detect it here.
- Any second LLM call.
- Any UI surface for users to see that a question was demoted.

### Acceptance criteria

- Given a synthetic LLM response where `answerMath` and the canonical
  value disagree, the affected question is not persisted as graded.
- Given a synthetic response where `multiple_choice` flags don't match
  `answerMath`, same outcome.
- On re-ingest of a PDF known to produce q3-style bugs, those
  questions are demoted to `open` rather than persisted with a wrong
  answer.
- Integration test at the extraction-pipeline boundary demonstrates
  the demotion path end-to-end.

### Risks and open decisions

- **Silent correctness loss.** Demotion is quiet by default. An
  owner might not notice that half their graded questions became
  open. Phase 3 partially addresses this (owners will get reports
  about remaining wrong answers and can retroactively see the log).
  A visible "this question was auto-demoted" marker in the admin UI
  is a reasonable follow-up but is deliberately not in phase 2's
  scope — it's UI work that is independent of the correctness fix.
- **Tolerance tuning.** Too tight: spurious demotions on irrationals
  and repeating decimals. Too loose: real errors pass. Spec says
  "relative tolerance" and leaves the actual value to implementation,
  with the guidance that common fractions, sqrt of small integers,
  and negative numbers near zero must all pass cleanly.

---

## Phase 3 — Layer 5: user reporting and owner fix path

### Goal

Bugs will still ship. Give users a pressure valve; give owners a fast
fix path; give us data about which failure modes actually dominate in
the wild. This phase is what turns "our automated checks are never
complete" into "users trust us to act when they spot something."

### Scope

Three distinct capabilities:

1. A way for a student to flag a specific question as wrong, from
   inside the session feedback UI.
2. A way for the owner of an exercise (and only the owner) to see the
   flags they've received and act on them.
3. The owner's fix actions operate on the canonical stored exercise,
   so the fix takes effect for future sessions.

### Requirements

**Reporting**

- Reporting is available from the per-question feedback panel — the
  same panel that currently shows "Correct" / "Incorrect" and the
  stored correct answer. That's where the student has evidence in
  front of them.
- A report must capture, at minimum: the exercise id, the question
  id, the student's submitted answer, the answer the system claimed
  was correct, and a timestamp. An optional free-text comment is
  allowed.
- Reporting is **not gated by authentication**. Students do not sign
  in. This implies the endpoint will be open to the internet and must
  be treated as low-trust input. Storage and display must be safe
  against garbage payloads; rate-limiting is desirable but not blocking
  for MVP — noise is tolerable for now.
- One report per click, stored as an immutable record. No edit / no
  upvote.

**Owner view**

- Reports are visible only to the owner of the exercise. Authorization
  mirrors the existing ownership rule on delete.
- The view groups reports by exercise and by question, so an owner
  can see "this question has 4 reports" at a glance.
- For each reported question, the owner must see enough to decide:
  the prompt, the current stored correct answer, and the payloads
  submitted by students who reported it.

**Owner actions**

Phase 3 delivers the minimum viable action set:

- Demote a question to `open` (ungraded).
- Delete a question entirely.
- Dismiss a report (acknowledge that the question is fine and the
  student was wrong).

Manual editing of `answerMath` / `answerLatex` is explicitly **out of
phase-3 scope**. Demote-or-delete is enough to stop harm; edit UI is
a separate follow-up whose value depends on whether owners actually
want to rescue questions vs. just remove them.

**Data lifecycle**

- Reports are retained long enough for owners to triage — spec says
  "at least 90 days"; exact TTL is an implementation/config choice.
- Dismissed and acted-on reports should remain queryable for some
  grace period so we have data for future phase prioritisation.

### Out of scope

- Email / push notifications to owners. Owners see reports when they
  visit the admin page. Notifications are a separate feature.
- Aggregate analytics across users / exercises.
- Retroactive re-verification of old exercises against phase-1/2
  rules. That's a distinct feature ("rerun verification on this
  exercise"); it becomes worth building once phase 1 and 2 are in
  place and we've changed the rules.
- Anonymous abuse prevention beyond basic input sanitisation.
- Editing the correct answer inline.

### Acceptance criteria

- A student, without signing in, can submit a report from the
  feedback UI, and that report is persisted and visible to the
  exercise's owner.
- A student cannot see anyone else's reports, nor the owner's
  dashboard.
- An owner, signed in, can see reports for their exercises, grouped
  meaningfully, and can take each of demote / delete / dismiss. The
  action persists and is reflected in subsequent session loads of
  that exercise.
- A non-owner signed-in user cannot see or act on another owner's
  reports.
- E2E coverage: at least one end-to-end path covering report →
  owner sees it → owner demotes → next session loads the demoted
  form of the question.

### Risks and open decisions

- **Report spam.** With no auth, a motivated student (or a
  bot) can flood the endpoint. Spec accepts this for MVP and
  relies on "it's a hobby-scale app." If volume materialises,
  add rate-limiting as a follow-up.
- **Staleness of sessions in progress.** Demoting a question
  doesn't affect sessions already cached client-side. Spec
  declares this acceptable — sessions are ephemeral by design.
- **What counts as "owner acted"?** We must be explicit in the
  data model whether a report is tied to a question, an exercise,
  or a specific version of the correct answer. Simplest spec:
  reports are tied to (exercise id, question id) and an owner
  action resolves all open reports for that pair. Refinement can
  come later.
- **The absence of edit.** Demote-or-delete forces owners to
  nuke borderline questions. Some owners will want to rescue
  them. We accept this cost in phase 3 because edit is a
  separate, design-heavier feature (validation on manual edits,
  UX for entering LaTeX, re-running shape validation on the edit).

---

## Sequencing notes

- **Phase 1 unblocks phase 2.** Phase 2's cross-check depends on the
  fields phase 1 adds. Don't interleave them.
- **Phase 3 is independent.** It can be developed in parallel with
  phase 1 or phase 2 and shipped on its own timeline. There is real
  value in landing phase 3 first if only to gather evidence about
  which failure modes actually show up — but the recommended order
  remains 1 → 2 → 3 because phase 1+2 cut the inflow rate, and phase
  3 is more useful once that inflow is lower (fewer reports, more
  likely to be signal).
- **Nothing here implements layers 2 or 3** from the background doc.
  Those remain on the table for after phase 3, and their priority
  should be re-evaluated using the report data phase 3 produces.

## Non-goals for this whole programme

- Perfect correctness. None of these phases eliminate the "LLM
  confidently wrong in all fields" failure mode. That is a layer 2
  job and is deliberately deferred.
- A fix for the `checkFraction` grader limitation (background doc,
  root cause 5). That is a separate bug, tracked separately.
- Retroactive cleanup of already-stored exercises. Phase 3 gives a
  manual fix path. A bulk re-verification tool is a future item.
