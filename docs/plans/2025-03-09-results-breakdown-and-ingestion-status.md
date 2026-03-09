# Results Per-Section Breakdown & IngestionStatus "N exercises" Plan

**Parent**: [2025-03-09-mathdrill-remainder-implementation.md](./2025-03-09-mathdrill-remainder-implementation.md)  
**Date**: 2025-03-09  
**Status**: Draft

---

## Item 1: Per-Section Breakdown on Results Page

### Current State

- Results page shows: ScoreBoard (total score, correct count), per-question review
- Exercise has `sections: { id, label, maxPoints }[]` and each question has `section: string` (label)
- Session answers have `questionId`, `pointsAwarded`; we resolve question via `exercise.questions`

### Desired State

Between ScoreBoard and per-question review, add a **section breakdown** card:

- For each section in `exercise.sections`:
  - Sum `pointsAwarded` for answers whose question belongs to that section
  - Display: `{section.label}: {earned}/{maxPoints} pts`
- Sections with 0 earned and 0 max (edge case) can be omitted or shown as "0/0"

### Implementation

**File**: `src/app/results/[sessionId]/page.tsx`

1. **Compute section breakdown** (after we have `exercise` and `session`):

   ```ts
   type SectionBreakdown = { label: string; earned: number; maxPoints: number };
   const sectionBreakdowns: SectionBreakdown[] = exercise.sections.map((sec) => {
     const questionsInSection = exercise.questions.filter(
       (q) => q.section === sec.label
     );
     const maxPoints = sec.maxPoints;
     const earned = session.answers
       .filter((a) => questionsInSection.some((q) => q.id === a.questionId))
       .reduce((s, a) => s + a.pointsAwarded, 0);
     return { label: sec.label, earned, maxPoints };
   });
   ```

2. **Render** between ScoreBoard and per-question review:

   - Card with heading "By section"
   - List or grid of `{label}: {earned}/{maxPoints} pts` with subtle styling (e.g. muted text, compact layout)

3. **Edge cases**:
   - If `exercise.sections` is empty, skip the breakdown block
   - If a question's `section` doesn't match any `sec.label`, it won't be counted in any section — acceptable for MVP (data integrity is ingestion's responsibility)

### Success Criteria

- [ ] `npm run build` passes
- [ ] Manual: Results page with multi-section exercise shows breakdown
- [ ] E2E: results.spec.ts still passes (mock has one section; breakdown should show "Section 1: 8/10 pts" or similar)

### Effort

**Small** — ~30–45 min. Single file, straightforward aggregation and UI.

---

## Item 2: IngestionStatus "N exercises extracted"

### Current State

- On `status === "done"`, IngestionStatus shows "Done!" and "Start exercise →"
- Plan specified: "On done: show 'N exercises extracted', link to `/session/<exerciseId>`"
- Job state has `exerciseId` but not `questionCount` (or `exerciseCount` — here N = number of questions)

### Clarification

"N exercises" in the original plan likely means **number of questions** in the extracted exercise set (e.g. "12 exercises extracted"). Alternative: "1 exercise set with 12 questions" — slightly more precise but wordier. We'll use **question count** as "N exercises" for consistency with typical usage ("12 math exercises").

### Implementation

#### Option A: Add `questionCount` to job state (recommended)

**File**: `src/lib/ingestJobs.ts`

- Extend `JobState`: add `questionCount?: number`
- No API changes needed — ingest status already returns arbitrary JSON; add `questionCount` when present

**File**: `src/app/api/ingest/route.ts`

- In `runIngestJob`, when calling `updateProgress(jobId, "done", { exerciseId, status: "done" })`, add `questionCount: exercise.questions.length`

**File**: `src/app/api/ingest/status/route.ts`

- Include `questionCount` in JSON response when present (already passes through job fields)

**File**: `src/components/IngestionStatus.tsx`

- Extend `StatusData`: add `questionCount?: number`
- In done state: if `questionCount` present, show e.g. "12 exercises extracted." above the link; else keep current "Done!" (backward compatible)


### Success Criteria

- [ ] `npm run build` passes
- [ ] Manual: Upload PDF → on completion, see "N exercises extracted" (N = actual count)
- [ ] E2E: admin.spec.ts still passes

### Effort

**Small** — ~20–30 min. A few lines in 4 files.

