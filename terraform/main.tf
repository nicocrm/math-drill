terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.0"
    }
  }
}

provider "scaleway" {
  project_id = var.project_id
  region     = var.region
  zone       = "${var.region}-1"
}

variable "project_id" {
  description = "Scaleway project ID"
}

variable "region" {
  default = "fr-par"
}

variable "s3_bucket" {
  default = "math-drill-exercises"
}

variable "clerk_secret_key" {
  sensitive = true
}

variable "anthropic_api_key" {
  sensitive = true
  default   = ""
}

variable "openai_api_key" {
  sensitive = true
}

variable "clerk_publishable_key" {
  description = "Clerk publishable key (VITE_CLERK_PUBLISHABLE_KEY for frontend build)"
  default     = ""
}

variable "frontend_bucket" {
  default = "math-drill-frontend"
}

# --- IAM ---

resource "scaleway_iam_application" "functions" {
  name = "math-drill-functions"
}

resource "scaleway_iam_policy" "s3_access" {
  name           = "math-drill-s3-access"
  application_id = scaleway_iam_application.functions.id

  rule {
    project_ids          = [var.project_id]
    permission_set_names = ["ObjectStorageFullAccess"]
  }
}

resource "scaleway_iam_api_key" "functions" {
  application_id = scaleway_iam_application.functions.id
  expires_at     = "2027-01-01T00:00:00Z"
}

# --- Object Storage ---

resource "scaleway_object_bucket" "exercises" {
  name   = var.s3_bucket
  region = var.region
}

resource "scaleway_object_bucket" "frontend" {
  name   = var.frontend_bucket
  region = var.region
}

resource "scaleway_object_bucket_acl" "frontend" {
  bucket = scaleway_object_bucket.frontend.name
  region = var.region
  acl    = "public-read"
}

resource "scaleway_object_bucket_website_configuration" "frontend" {
  bucket = scaleway_object_bucket.frontend.name
  region = var.region

  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

# --- NATS ---

resource "scaleway_mnq_nats_account" "main" {
  name   = "math-drill"
  region = var.region
}

resource "scaleway_mnq_nats_credentials" "functions" {
  account_id = scaleway_mnq_nats_account.main.id
  name       = "functions"
  region     = var.region
}

# --- Serverless Functions Namespace ---

resource "scaleway_function_namespace" "main" {
  name = "math-drill"

  environment_variables = {
    STORAGE        = "s3"
    S3_BUCKET      = scaleway_object_bucket.exercises.name
    S3_ENDPOINT    = "https://s3.${var.region}.scw.cloud"
    S3_REGION      = var.region
    NATS_URL       = scaleway_mnq_nats_account.main.endpoint
    ALLOWED_ORIGIN = "https://${scaleway_object_bucket_website_configuration.frontend.website_endpoint}"
  }

  secret_environment_variables = {
    CLERK_SECRET_KEY      = var.clerk_secret_key
    ANTHROPIC_API_KEY     = var.anthropic_api_key
    OPENAI_API_KEY        = var.openai_api_key
    AWS_ACCESS_KEY_ID     = scaleway_iam_api_key.functions.access_key
    AWS_SECRET_ACCESS_KEY = scaleway_iam_api_key.functions.secret_key
    NATS_CREDS            = scaleway_mnq_nats_credentials.functions.file
  }
}

# --- Functions ---

resource "scaleway_function" "get_exercises" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "get-exercises"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
  zip_file     = "${path.module}/../dist/functions/get-exercises.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/get-exercises.zip")
  deploy       = true
}

resource "scaleway_function" "get_exercise" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "get-exercise"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
  zip_file     = "${path.module}/../dist/functions/get-exercise.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/get-exercise.zip")
  deploy       = true
}

resource "scaleway_function" "delete_exercise" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "delete-exercise"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
  zip_file     = "${path.module}/../dist/functions/delete-exercise.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/delete-exercise.zip")
  deploy       = true
}

resource "scaleway_function" "post_ingest" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "post-ingest"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 512
  timeout      = 60
  zip_file     = "${path.module}/../dist/functions/post-ingest.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/post-ingest.zip")
  deploy       = true
}

resource "scaleway_function" "get_ingest_status" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "get-ingest-status"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
  zip_file     = "${path.module}/../dist/functions/get-ingest-status.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/get-ingest-status.zip")
  deploy       = true
}

resource "scaleway_function" "ingest_worker" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "ingest-worker"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "private"
  memory_limit = 1024
  timeout      = 300 # 5 minutes for AI extraction
  zip_file     = "${path.module}/../dist/functions/ingest-worker.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/ingest-worker.zip")
  deploy       = true
}

# --- NATS Trigger ---

resource "scaleway_function_trigger" "ingest_trigger" {
  function_id = scaleway_function.ingest_worker.id
  name        = "ingest-jobs-trigger"

  nats {
    account_id = scaleway_mnq_nats_account.main.id
    subject    = "ingest.jobs"
  }
}

# --- Outputs ---

output "get_exercises_url" {
  value = scaleway_function.get_exercises.domain_name
}

output "get_exercise_url" {
  value = scaleway_function.get_exercise.domain_name
}

output "delete_exercise_url" {
  value = scaleway_function.delete_exercise.domain_name
}

output "post_ingest_url" {
  value = scaleway_function.post_ingest.domain_name
}

output "get_ingest_status_url" {
  value = scaleway_function.get_ingest_status.domain_name
}

output "nats_endpoint" {
  value = scaleway_mnq_nats_account.main.endpoint
}

output "s3_bucket" {
  value = scaleway_object_bucket.exercises.name
}

output "frontend_url" {
  description = "Frontend URL (S3 website endpoint)"
  value       = scaleway_object_bucket_website_configuration.frontend.website_endpoint
}

output "frontend_bucket" {
  value = scaleway_object_bucket.frontend.name
}

output "clerk_publishable_key" {
  value = var.clerk_publishable_key
}
