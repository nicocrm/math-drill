# Tailwind CSS v4 Upgrade

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Upgrade Tailwind CSS from v3.4.19 to v4.x.

**Architecture:** Use the official `@tailwindcss/upgrade` migration tool to auto-migrate most changes, then manually verify the build and fix any regressions. Tailwind v4 replaces the JS/TS config with a CSS-first `@theme {}` block, replaces the PostCSS pipeline with a dedicated Vite plugin, and changes the CSS entry-point directive.

**Tech Stack:** Tailwind CSS v4, `@tailwindcss/vite`, Vite, React, TypeScript

---

## Background: What Changes in v4

- `tailwind.config.ts` → theme config moves into `src/globals.css` as `@theme {}` blocks
- `@tailwind base/components/utilities` → `@import "tailwindcss"`
- Vite integrates via `@tailwindcss/vite` plugin (not PostCSS)
- Content scanning is automatic; no more `content: [...]` array
- Custom `boxShadow` extensions become `--shadow-*` CSS variables in `@theme`
- Custom `borderRadius` overrides become `--radius-*` variables
- Custom `fontFamily` becomes `--font-*` variables
- `autoprefixer` is built-in; no longer needed separately

## Important Custom Theme Values in This Project

The config at `tailwind.config.ts` extends:
- Colors: already CSS-var-backed (trivial to migrate)
- `fontFamily.sans` → `["GeistSans", "system-ui", "sans-serif"]`
- `fontFamily.mono` → `["GeistMono", "monospace"]`
- `borderRadius.xl` → `"1rem"` (overrides Tailwind default of `0.75rem`)
- `borderRadius.2xl` → `"1.25rem"` (overrides Tailwind default of `1rem`)
- `boxShadow.card` and `boxShadow.card-hover`
- `transitionDuration.150` → `"150ms"`

Components that use custom utilities: `shadow-card`, `shadow-card-hover`, `rounded-xl`, `rounded-2xl`, `font-sans`, `font-mono` — found in ~11 files under `src/`.

---

### Task 1: Create a branch for the upgrade

**Files:** none

**Step 1: Create and check out a new branch**

```bash
git checkout -b task/tailwind-v4-upgrade
```

Expected: switched to new branch.

**Step 2: Confirm clean starting point**

```bash
git status
```

Expected: working tree clean (only the existing untracked plan files are fine).

---

### Task 2: Run the official upgrade tool

The tool will: update `package.json`, rewrite `tailwind.config.ts` → CSS `@theme`, update `globals.css` imports, add `@tailwindcss/vite`, and update `vite.config.ts`.

**Files:**
- Modify: `package.json`
- Modify: `src/globals.css`
- Modify: `vite.config.ts`
- Modify/delete: `tailwind.config.ts`

**Step 1: Run the upgrade tool (dry-run first)**

```bash
npx @tailwindcss/upgrade
```

The tool is interactive and will ask confirmation before making changes. Review the diff it proposes, then confirm.

**Step 2: Inspect the changes it made**

```bash
git diff
```

Look at every changed file. Verify:
- `vite.config.ts` now imports and uses `@tailwindcss/vite`
- `src/globals.css` now starts with `@import "tailwindcss"` (not `@tailwind` directives)
- The custom theme values (colors, fonts, shadows, border-radius) appear as a `@theme {}` block in `globals.css` OR in a separate file imported into it
- `tailwind.config.ts` is deleted or emptied

**Step 3: Verify package.json**

```bash
cat package.json | grep -E "tailwind|@tailwindcss"
```

Expected: `"tailwindcss": "^4.x.x"` and `"@tailwindcss/vite": "^4.x.x"`. No `autoprefixer` needed.

---

### Task 3: Install dependencies

**Step 1: Install**

```bash
pnpm install
```

Expected: no errors.

---

### Task 4: Verify the build

**Step 1: Run TypeScript check**

```bash
pnpm tsc --noEmit 2>&1 | head -40
```

Expected: no errors (or only pre-existing errors unrelated to Tailwind).

**Step 2: Run the Vite build**

```bash
pnpm build 2>&1 | tail -30
```

Expected: build succeeds, no Tailwind-related errors.

If you see errors like `Unknown at rule @apply` or `Unknown utility class`, proceed to Task 5.

---

### Task 5: Manual fixes (if needed)

This task covers known patterns that the upgrade tool may miss.

**5a — `@apply` with custom utilities**

In `src/globals.css` there is:
```css
@layer base {
  *:focus-visible {
    @apply outline-2 outline-offset-2 outline-primary;
  }
}
```

In v4, `outline-primary` refers to `--color-primary`. Since the project defines `--primary` (not `--color-primary`), this `@apply` may fail. If so, rewrite as plain CSS:

```css
@layer base {
  *:focus-visible {
    outline-width: 2px;
    outline-offset: 2px;
    outline-color: var(--primary);
  }
}
```

**5b — borderRadius overrides**

Tailwind v4 default `--radius-xl` is `0.75rem` and `--radius-2xl` is `1rem`. This project's config set them to `1rem` and `1.25rem` respectively. The `@theme {}` block **must** contain:

```css
@theme {
  --radius-xl: 1rem;
  --radius-2xl: 1.25rem;
}
```

If the upgrade tool didn't add these, add them manually to the `@theme` block in `src/globals.css`.

**5c — boxShadow custom utilities**

Verify `shadow-card` and `shadow-card-hover` are present in the `@theme` block:

```css
@theme {
  --shadow-card: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08);
  --shadow-card-hover: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08);
}
```

**5d — fontFamily**

Verify the `@theme` block has:

```css
@theme {
  --font-sans: "GeistSans", system-ui, sans-serif;
  --font-mono: "GeistMono", monospace;
}
```

**Step: Re-run build after each fix**

```bash
pnpm build 2>&1 | tail -20
```

Repeat until clean.

---

### Task 6: Run dev server and visual check

**Step 1: Start dev server**

```bash
pnpm dev
```

Open `http://localhost:5173` in a browser and visually verify:
- Cards look correct (shadow, border radius)
- Buttons look correct (primary colour, hover state)
- Font is GeistSans
- Focus rings appear on focusable elements
- Dark mode toggle (if any) works

**Step 2: Stop the dev server** (`Ctrl+C`)

---

### Task 7: Run tests

**Step 1:**

```bash
pnpm test 2>&1 | tail -30
```

Expected: all tests pass (Tailwind upgrade should not affect unit/logic tests).

---

### Task 8: Commit

**Step 1:**

```bash
git add -A
git commit -m "chore: upgrade Tailwind CSS v3 → v4"
```

---

## Open Questions

- The `@tailwindcss/upgrade` tool version may lag behind the latest Tailwind v4 release. If it installs v4.0.x but v4.2.x is the latest, run `pnpm add -D tailwindcss@latest @tailwindcss/vite@latest` after the migration tool finishes.
- `transitionDuration.150` in the config — v4 should handle this as `--duration-150: 150ms` but verify the class `duration-150` still works (it's a Tailwind default, so likely fine).
