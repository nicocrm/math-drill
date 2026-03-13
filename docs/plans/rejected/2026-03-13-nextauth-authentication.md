# Add NextAuth.js Authentication

## Goal

Allow users to sign in (Google OAuth), create exercises, and manage their own exercises. Unauthenticated users can browse and play all exercises.

## Key Decisions

- **Auth library**: NextAuth.js v5 (Auth.js) — App Router native
- **Provider**: Google OAuth (expandable to others later)
- **Session strategy**: JWT (no DB needed for sessions)
- **User storage**: JSON file (`./data/users.json`) — keeps consistency with current file-based approach; migrate to DB later if needed
- **Exercise ownership**: new `createdBy` field on `ExerciseSet`
- **Access model**:
  - Public: browse exercises, play sessions, view results
  - Authenticated: upload PDFs, delete/edit own exercises

---

## Phase 1: NextAuth.js Setup

### 1.1 Install dependencies

```
npm install next-auth@beta
```

### 1.2 Auth configuration

Create `src/lib/auth.ts`:
- Configure Google provider (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` env vars)
- JWT session strategy
- Callbacks: persist `user.id` in JWT/session token
- Generate stable user ID on first sign-in, store in `./data/users.json`

Create `src/app/api/auth/[...nextauth]/route.ts`:
- Export GET/POST handlers from auth config

### 1.3 Environment variables

Add to `.env.example`:
```
AUTH_SECRET=           # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

### 1.4 Session provider

Update `src/app/layout.tsx`:
- Wrap children in `<SessionProvider>` from next-auth/react

### Verification

- Google sign-in/sign-out works
- `auth()` returns session in server components and API routes

---

## Phase 2: UI — Sign In / User Menu

### 2.1 Auth components

Create `src/components/AuthButton.tsx`:
- Signed out: "Sign in" button
- Signed in: user avatar/name + "Sign out"

### 2.2 Add to layout/header

Add `AuthButton` to `PageLayout` component header area.

### Verification

- Sign in / sign out visible on all pages
- User name displayed when signed in

---

## Phase 3: Exercise Ownership

### 3.1 Data model change

Add to `ExerciseSet` type in `src/types/exercise.ts`:
```ts
createdBy?: string;  // user ID, optional for backward compat
```

### 3.2 Stamp ownership on ingest

Update `src/app/api/ingest/route.ts`:
- Get session via `auth()`
- Require authentication (401 if not signed in)
- Set `exercise.createdBy = session.user.id` in `runIngestJob`

### 3.3 Exercise store — list filtering

Update `src/lib/exerciseStore.ts`:
- Add `listExercisesByUser(userId: string)` — filters on `createdBy`
- Add `deleteExercise(id: string)` — removes JSON file

### 3.4 API route updates

`GET /api/exercises`:
- No change — returns all exercises (public browsing)

`DELETE /api/exercises/[id]`:
- New route, requires auth
- Only owner can delete (compare `createdBy` to session user)
- Return 403 if not owner

`POST /api/ingest`:
- Require auth (401 if unauthenticated)

### Verification

- Ingested exercises have `createdBy` set
- Unauthenticated user gets 401 on ingest
- Owner can delete; non-owner gets 403
- Existing exercises (no `createdBy`) remain accessible

---

## Phase 4: Protect Admin UI

### 4.1 Middleware

Create `src/middleware.ts`:
- Match `/admin` routes
- Redirect to sign-in if unauthenticated

### 4.2 Admin page — show user's exercises

Update `/admin` page:
- Show list of current user's exercises with delete button
- Keep upload form

### 4.3 Home page

Update `/` page:
- Show all exercises (no auth required)
- If signed in, show "My Exercises" link or section

### Verification

- `/admin` redirects to sign-in when not authenticated
- Admin page shows only user's exercises
- Home page remains public

---

## Phase 5: Tests

### 5.1 Unit tests

- Mock `auth()` in API route tests
- Test ownership enforcement (ingest stamps `createdBy`, delete checks ownership)

### 5.2 E2E tests

- Test sign-in flow (mock Google provider or use Credentials provider in test env)
- Test protected route redirect
- Test exercise CRUD as authenticated user

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/lib/auth.ts` | Create — auth config |
| `src/app/api/auth/[...nextauth]/route.ts` | Create — auth route handler |
| `src/middleware.ts` | Create — route protection |
| `src/components/AuthButton.tsx` | Create — sign in/out UI |
| `src/types/exercise.ts` | Edit — add `createdBy` |
| `src/lib/exerciseStore.ts` | Edit — add `listByUser`, `deleteExercise` |
| `src/app/api/ingest/route.ts` | Edit — require auth, stamp ownership |
| `src/app/api/exercises/[id]/route.ts` | Edit — add DELETE handler |
| `src/app/layout.tsx` | Edit — add SessionProvider |
| `src/components/PageLayout.tsx` | Edit — add AuthButton |
| `src/app/admin/page.tsx` | Edit — show user exercises |
| `.env.example` | Edit — add auth env vars |
| `package.json` | Edit — add next-auth |

## Out of Scope (for later)

- Multiple OAuth providers (GitHub, Apple)
- Database migration (SQLite/Postgres)
- Sharing exercises between users
- Role-based access (admin vs student)
- Exercise visibility (public/private toggle)
