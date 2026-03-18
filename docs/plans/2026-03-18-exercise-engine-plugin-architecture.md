# Exercise Engine + Subject Plugin Architecture

## Goal

Split the project into a **generic exercise engine** (handles sessions, storage, ingestion orchestration, UI shell) and **subject plugins** (math first, then geometry, languages, etc.).

## High-Level Components

### 1. Exercise Engine Core (`@exercise-engine/core`)

The generic skeleton. Knows nothing about math, LaTeX, or any specific subject.

**Data model:**
- `ExerciseSet` — stays mostly as-is, but rename math-specific fields:
  - `answerMath` → `answer` (generic `string | string[] | null`)
  - `answerLatex` → `answerDisplay` (optional rich display string)
  - `choices[].latex` → `choices[].display`
- `QuestionType` — split into **base types** (`multiple_choice`, `true_false`, `open`) owned by engine, and **plugin-registered types** (e.g. `numeric`, `expression`, `fraction`, `conjugation`, `translation`)
- `Session`, `SessionAnswer` — unchanged, already generic

**Responsibilities:**
- Exercise CRUD + storage interfaces (`ExerciseStorage`, `FileStorage`)
- Job status tracking
- Session lifecycle (start, record answer, complete)
- Ingestion orchestration (receive PDF → call plugin extractor → validate → save)
- Plugin registry: register subject plugins at startup

### 2. Subject Plugin Interface (`SubjectPlugin`)

```ts
interface SubjectPlugin {
  id: string;                        // e.g. "math", "french"
  displayName: string;               // e.g. "Mathematics"
  questionTypes: QuestionTypeDescriptor[];  // types this plugin handles
  
  // Extraction
  getExtractionPrompt(): string;     // LLM system prompt for this subject
  getResponseSchema(): ZodSchema;    // structured output schema
  validateExtraction(raw: ExerciseSet): ExerciseSet;  // post-LLM validation
  
  // Answer checking
  checkAnswer(question: Question, studentAnswer: string | string[]): boolean;
  
  // UI (React components)
  renderInput(props: InputRenderProps): ReactNode;     // answer input widget
  renderDisplay(props: DisplayRenderProps): ReactNode; // rich content display (LaTeX, images, etc.)
}
```

### 3. Math Plugin (`@exercise-engine/plugin-math`)

Extracts current math-specific code into a plugin:

- **Question types:** `numeric`, `expression` (base types `multiple_choice`, `true_false`, `open` come from engine)
- **Extraction prompt:** current `SYSTEM_PROMPT` from `prompts.ts`
- **Validation:** `validateAnswerMath` — mathjs numeric evaluation
- **Answer checking:** `checkFraction`, `checkExpression` from `mathValidation.ts`
- **UI components:** `FractionInput`, `MathDisplay`, `PromptDisplay` (KaTeX rendering)
- **Dependencies:** `mathjs`, `katex`

### 4. Frontend Shell (`@exercise-engine/ui`)

Generic UI that delegates to plugins:

- **Pages:** Home, Session, Results, Admin — stay as-is structurally
- **ExercisePlayer:** uses plugin registry to pick the right `renderInput` / `renderDisplay` per question type
- **QuestionRenderer:** becomes a dispatcher — looks up question type → calls plugin's render functions
- **Admin/Upload:** generic, since ingestion is already subject-agnostic in structure (PDF in → exercises out)

### 5. Backend / Functions

- **Ingest worker:** calls `plugin.getExtractionPrompt()` + `plugin.getResponseSchema()` instead of hardcoded math prompt. Needs to know which plugin to use — either from upload metadata (`subject: "math"`) or auto-detected.
- **API endpoints:** unchanged — already generic CRUD
- **Storage:** unchanged — already generic interfaces

## Package Structure (target)

```
packages/
  core/              → @exercise-engine/core   (generic types, storage, job status)
  plugin-math/       → @exercise-engine/plugin-math  (math validation, KaTeX, prompts)
  plugin-french/     → (future)
src/                 → frontend shell (imports plugins)
functions/           → backend (imports core + plugins)
```

## Key Design Decisions to Make

1. **Plugin discovery:** Static imports at build time (simpler) vs. dynamic registry (more flexible)?  Leaning static — we control the build.

2. **Subject detection on upload:** User picks subject from dropdown? Or LLM auto-detects from PDF? Former is simpler and more reliable.

3. **Base vs plugin question types:** `multiple_choice`, `true_false`, `open` are universal — engine owns them and their answer checking. Plugin only adds subject-specific types + can override display rendering.

4. **Display rendering:** Engine provides a default text renderer. Plugins can wrap/replace it (math plugin adds KaTeX, future image plugin adds `<img>` support).

5. **Prompt composition:** Engine provides a generic preamble (JSON schema, output format). Plugin provides subject-specific instructions. Compose them.

## Open Questions

- Should the `explanation` field support plugin-specific rendering too? (Currently uses `PromptDisplay` which has KaTeX — that's math-specific.)
- How to handle plugins that need both custom input AND custom display? (e.g. geometry with diagram rendering + angle input widget)
- Monorepo stays as-is with workspaces, or move to a more formal plugin loading mechanism?
- Do we rename the project/repo from "math-drill" to something generic?
