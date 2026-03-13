# Add Clerk Authentication

## Goal

Allow users to sign in (Google OAuth via Clerk), create exercises, and manage their own exercises. Unauthenticated users can browse and play all exercises.

## Key Decisions

- **Auth service**: Clerk (hosted) — prebuilt UI, zero auth backend code
- **Provider**: Google OAuth (configured in Clerk dashboard)
- **Session strategy**: Clerk-managed (JWT cookie, verified server-side via `auth()`)
- **User storage**: Clerk handles user profiles — no local user store needed
- **Exercise ownership**: new `createdBy` field on `ExerciseSet`, set to Clerk `userId`
- **Access model**:
  - Public: browse exercises, play sessions, view results
  - Authenticated: upload PDFs, delete own exercises

---

## Phase 1: Clerk Setup

### 1.1 Install dependencies

```
npm install @clerk/nextjs
```

### 1.2 Environment variables

Add to `.env.example`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

### 1.3 Clerk provider

Update `src/app/layout.tsx`:
- Wrap children in `<ClerkProvider>`

### 1.4 Middleware

Create `src/middleware.ts`:
- Use `clerkMiddleware()` from `@clerk/nextjs/server`
- Protect `/admin` routes — redirect unauthenticated to Clerk sign-in
- Leave all other routes public

### 1.5 Clerk dashboard config

- Create Clerk application at clerk.com
- Enable Google OAuth provider
- Configure redirect URLs

### Verification

- Sign in via Google works
- `auth()` returns `userId` in API routes and server components
- `/admin` redirects to Clerk sign-in when not authenticated

---

## Phase 2: UI — Sign In / User Menu

### 2.1 Add Clerk components to header

Update `src/components/PageLayout.tsx`:
- Add `<SignedIn>` / `<SignedOut>` blocks
- Signed out: `<SignInButton>`
- Signed in: `<UserButton>` (avatar + dropdown with sign-out)

No custom auth components needed — Clerk provides these out of the box.

### Verification

- Sign in / sign out visible on all pages
- User avatar dropdown when signed in

---

## Phase 3: Exercise Ownership

### 3.1 Data model change

Add to `ExerciseSet` type in `src/types/exercise.ts`:
```ts
createdBy?: string;  // Clerk userId, optional for backward compat
```

### 3.2 Stamp ownership on ingest

Update `src/app/api/ingest/route.ts`:
- Get `userId` via `auth()` from `@clerk/nextjs/server`
- Require authentication (401 if not signed in)
- Pass `userId` to `runIngestJob`, set `exercise.createdBy = userId`

### 3.3 Exercise store additions

Update `src/lib/exerciseStore.ts`:
- Add `listExercisesByUser(userId: string)` — filters on `createdBy`
- Add `deleteExercise(id: string)` — removes JSON file

### 3.4 API route updates

`GET /api/exercises`:
- No change — returns all exercises (public browsing)

`DELETE /api/exercises/[id]`:
- New route, requires auth
- Only owner can delete (compare `createdBy` to `userId`)
- Return 403 if not owner

`POST /api/ingest`:
- Require auth (401 if unauthenticated)

### Verification

- Ingested exercises have `createdBy` set
- Unauthenticated user gets 401 on ingest
- Owner can delete; non-owner gets 403
- Existing exercises (no `createdBy`) remain accessible

---

## Phase 4: Admin Page Updates

### 4.1 Admin page — show user's exercises

Update `/admin` page:
- Fetch current user's exercises (new `GET /api/exercises?mine=1` param, or separate endpoint)
- Show list with delete button per exercise
- Keep upload form

### 4.2 Home page

Update `/` page:
- All exercises remain visible (no auth required)
- If signed in, optionally highlight user's own exercises

### Verification

- Admin page shows only user's exercises with delete
- Home page remains fully public

---

## Phase 5: Tests

### 5.1 Unit tests

- Mock `auth()` from `@clerk/nextjs/server` in API route tests
- Test ownership enforcement (ingest stamps `createdBy`, delete checks ownership)

### 5.2 E2E tests

- Use Clerk's testing tokens (`CLERK_TESTING_TOKEN`) for E2E
- Test protected route redirect
- Test exercise CRUD as authenticated user

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/middleware.ts` | Create — Clerk middleware, route protection |
| `src/types/exercise.ts` | Edit — add `createdBy` |
| `src/lib/exerciseStore.ts` | Edit — add `listByUser`, `deleteExercise` |
| `src/app/api/ingest/route.ts` | Edit — require auth, stamp ownership |
| `src/app/api/exercises/[id]/route.ts` | Edit — add DELETE handler |
| `src/app/layout.tsx` | Edit — wrap in `<ClerkProvider>` |
| `src/components/PageLayout.tsx` | Edit — add `<SignInButton>` / `<UserButton>` |
| `src/app/admin/page.tsx` | Edit — show user exercises with delete |
| `.env.example` | Edit — add Clerk env vars |
| `package.json` | Edit — add `@clerk/nextjs` |

## Comparison to NextAuth.js Approach

| | Clerk | NextAuth.js |
|---|---|---|
| Auth UI code | None (prebuilt components) | Build sign-in page + AuthButton |
| Auth config code | Middleware only | auth.ts + API route + callbacks |
| Files to create | 1 (`middleware.ts`) | 3 (auth.ts, route, middleware) |
| User storage | Managed by Clerk | Local JSON or DB |
| Cost | Free tier (10k MAU) | Free |
| Vendor dependency | Yes | No |
| User management dashboard | Yes (clerk.com) | Build your own |

## Out of Scope (for later)

- Additional OAuth providers (GitHub, Apple)
- Organization/team support (Clerk has this built-in)
- Sharing exercises between users
- Role-based access (admin vs student)
- Exercise visibility (public/private toggle)
