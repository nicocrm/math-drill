# Phase 4: Deploy Static Frontend to Scaleway Object Storage

Deploys the Vite-built SPA (`dist/`) to Scaleway Object Storage with S3 website hosting. All resources declared in Terraform.

## Context

- Frontend is a fully client-rendered Vite SPA (React Router, Clerk auth)
- Build output: `dist/` with `index.html`, `assets/`, fonts, favicon
- API URLs injected at build time via `VITE_*` env vars — `make build-frontend` already does this
- Serverless functions already deployed via Terraform (`terraform/main.tf`)

## Phase 1: Terraform — S3 Bucket with Website Hosting

Separate bucket from exercises data (needs public-read, different lifecycle).

- [x] Add `scaleway_object_bucket` resource `math-drill-frontend` with `public-read` ACL
- [x] Add `scaleway_object_bucket_website_configuration` with `index.html` as index and error doc (SPA fallback)
- [x] Output the bucket name and website endpoint

**Verify:** `terraform plan` shows bucket and website configuration resources.

## Phase 2: Makefile `deploy-frontend` Target

- [x] Add `deploy-frontend` target that depends on `build-frontend`, then:
  1. Syncs `dist/` to frontend S3 bucket via `aws s3 sync` (Scaleway is S3-compatible):
     - `--delete` to remove stale files
     - `--cache-control "public, max-age=31536000, immutable"` for `assets/`
     - `--cache-control "public, max-age=300"` for `index.html` and other root files
  2. Reads bucket name from `terraform output`
- [x] Add `deploy` target that runs both `functions` and `deploy-frontend`

**Verify:** `make deploy-frontend` uploads files. Bucket website endpoint serves the app.

## Phase 3: CORS on Serverless Functions

Functions need to accept requests from the bucket website origin.

- [x] Add bucket website endpoint to serverless function namespace env vars in Terraform (`ALLOWED_ORIGIN`)
- [x] Add CORS headers to all function handlers (preflight + response headers via `handleCorsPreflightMaybe` + `corsHeaders` in `scaleway.ts`)

**Verify:** No CORS errors in browser console.

## Phase 4: Clerk Configuration

- [x] Add `VITE_CLERK_PUBLISHABLE_KEY` as Terraform variable (`clerk_publishable_key`), include in `build-frontend` env vars
- [ ] Document: add bucket website URL to Clerk dashboard allowed origins

**Verify:** Login flow works on deployed frontend.

## Terraform Resource Summary

```hcl
resource "scaleway_object_bucket" "frontend" { ... }                          # public-read
resource "scaleway_object_bucket_website_configuration" "frontend" { ... }    # index + error doc

output "frontend_url" { ... }
output "frontend_bucket" { ... }
```

## Key Decisions

| Item | Decision | Rationale |
|---|---|---|
| Separate bucket | Own bucket, not mixed with exercise data | Different access pattern and lifecycle |
| Public bucket | `public-read` ACL with S3 website hosting | Simplest approach, no CDN needed for low-traffic app |
| SPA routing | `error_document` set to `index.html` | All routes fall back to SPA entry point |
| Cache strategy | Hashed assets = immutable, `index.html` = short TTL | Fast deploys without stale JS/CSS |
| Upload tool | `aws s3 sync` via Makefile | S3-compatible, no extra deps |
| No CDN | Dropped Edge Services | Unnecessary complexity for low-traffic app; can add later if needed |
| Build vs deploy | Keep `build-frontend` (build only), add `deploy-frontend` (build + upload) | Can inspect build without deploying |
