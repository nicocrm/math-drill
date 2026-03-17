# Improve Processing Feedback UI

## Problem
When a PDF is being processed, the UI shows a subtle, easy-to-miss "Processing / Progress: 40%" text box. The drop zone remains fully visible and interactive-looking, making it unclear that work is in progress.

## Changes

### 1. Add a visual progress bar to `IngestionStatus`
In the processing state (not error/done), replace the plain "Progress: X%" text with a horizontal progress bar filled to the current percentage, plus a label.

- Use a `<div>` bar with `bg-primary` fill, animated width transition
- Show percentage text to the right of the bar

### 2. Add a spinner animation to `IngestionStatus`
Add an animated spinning icon next to the "Processing" label to signal ongoing activity.

- Use a simple CSS `animate-spin` SVG circle/loader
- Place inline before the status text

### 3. Make the status box more prominent
Upgrade the processing-state container styling:

- Use `border-primary/50 bg-primary/10` instead of neutral `border-zinc-200 bg-muted/50`
- Increase text size from `text-sm` to `text-base`
- Use `text-foreground` for the status label instead of `text-muted-foreground`

### 4. Hide/collapse the DropZone while processing
In `AdminUpload`, conditionally hide `<DropZone>` when `jobId` is set and processing is active.

- Pass `jobId` presence as a signal: when `jobId` is truthy, don't render `<DropZone>`
- Re-show it after completion or error (reset `jobId` to null in `onComplete` and on error)

### 5. Warn before navigating away during processing
Change the "Back to Home" button behavior while `jobId` is active:

- Disable the button or add a `window.confirm` prompt ("Processing in progress. Leave?")
- Visually dim the button with `opacity-50 pointer-events-none` or show a confirmation on click

## Files to modify
- `src/components/IngestionStatus.tsx` — #1, #2, #3
- `src/components/AdminUpload.tsx` — #4, #5

## Testing
- E2E test: upload a PDF, verify drop zone disappears and progress bar is visible during processing.
