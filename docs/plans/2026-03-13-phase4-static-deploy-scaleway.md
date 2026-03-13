# Phase 4: Deploy Static Frontend to Scaleway Object Storage + Edge Services

Deploys the Vite-built SPA (`dist/`) to Scaleway Object Storage, served via Scaleway Edge Services (CDN). All resources declared in Terraform.

## Context

- Frontend is a fully client-rendered Vite SPA (React Router, Clerk auth)
- Build output: `dist/` with `index.html`, `assets/`, fonts, favicon
- API URLs injected at build time via `VITE_*` env vars — `make build-frontend` already does this
- Serverless functions already deployed via Terraform (`terraform/main.tf`)

## Phase 1: Terraform — S3 Bucket for Static Assets

Separate bucket from exercises data (needs public-read, different lifecycle).

- [ ] Add `scaleway_object_bucket` resource `math-drill-frontend` (private — no public ACL)
- [ ] Output the bucket name/endpoint

**Verify:** `terraform plan` shows new bucket resource. Bucket is not publicly accessible.

## Phase 2: Terraform — Edge Services (CDN)

Scaleway Edge Services in front of Object Storage: CDN caching, optional custom domain + TLS.

- [ ] Add variable `custom_domain` (optional, default `""`)
- [ ] Add `scaleway_edge_services_pipeline` resource linked to the frontend bucket
- [ ] Add `scaleway_edge_services_backend_stage` — S3 bucket origin (Edge Services has native access to private buckets)
- [ ] Add `scaleway_edge_services_cache_stage`:
  - `assets/*` — cache 1 year (content-hashed filenames)
  - `index.html` — cache 5 min (so deploys propagate quickly)
- [ ] Conditionally add `scaleway_edge_services_dns_stage` + `scaleway_edge_services_tls_stage` when `custom_domain` is set (managed Let's Encrypt cert)
- [ ] Output CDN endpoint URL and CNAME target (if custom domain)

**Verify:** `terraform plan` shows Edge Services pipeline and stages.

## Phase 3: Makefile `deploy-frontend` Target

- [ ] Add `deploy-frontend` target that depends on `build-frontend`, then:
  1. Syncs `dist/` to frontend S3 bucket via `aws s3 sync` (Scaleway is S3-compatible):
     - `--delete` to remove stale files
     - `--cache-control "public, max-age=31536000, immutable"` for `assets/`
     - `--cache-control "public, max-age=300"` for `index.html` and other root files
     - Explicit `--content-type` for `.woff` fonts if needed
  2. Reads bucket name from `terraform output`
- [ ] Add `deploy` target that runs both `functions` and `deploy-frontend`

**Verify:** `make deploy-frontend` uploads files. Bucket website endpoint serves the app.

## Phase 4: CORS on Serverless Functions

Functions need to accept requests from the CDN origin.

- [ ] Add CDN/custom domain to serverless function namespace env vars in Terraform (`ALLOWED_ORIGINS`)
- [ ] Verify existing function handlers return CORS headers — fix if needed

**Verify:** No CORS errors in browser console.

## Phase 5: Clerk Configuration

- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY` as Terraform variable, include in `build-frontend` env vars
- [ ] Document: add CDN/custom domain to Clerk dashboard allowed origins

**Verify:** Login flow works on deployed frontend.

## Terraform Resource Summary

```hcl
# New resources in terraform/main.tf:

resource "scaleway_object_bucket" "frontend" { ... }  # private
resource "scaleway_edge_services_pipeline" "frontend" { ... }
resource "scaleway_edge_services_backend_stage" "frontend" { ... }
resource "scaleway_edge_services_cache_stage" "frontend" { ... }
resource "scaleway_edge_services_dns_stage" "frontend" { ... }      # conditional
resource "scaleway_edge_services_tls_stage" "frontend" { ... }      # conditional

output "frontend_cdn_url" { ... }
output "frontend_bucket_endpoint" { ... }
```

## Key Decisions

| Item | Decision | Rationale |
|---|---|---|
| Separate bucket | Own bucket, not mixed with exercise data | Different access pattern and lifecycle |
| Private bucket | No public ACL; only Edge Services can read | Avoids exposing raw S3 endpoint |
| SPA routing | Handled at Edge Services level (custom error page or rewrite rule) | React Router handles all routes client-side |
| Cache strategy | Hashed assets = immutable, `index.html` = short TTL | Fast deploys without stale JS/CSS |
| Upload tool | `aws s3 sync` via Makefile | S3-compatible, no extra deps |
| Custom domain | Optional Terraform variable | Deploy without domain first, add later |
| Build vs deploy | Keep `build-frontend` (build only), add `deploy-frontend` (build + upload) | Can inspect build without deploying |
