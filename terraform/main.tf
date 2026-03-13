terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.0"
    }
  }
}

provider "scaleway" {
  region = var.region
  zone   = "${var.region}-1"
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
}

variable "openai_api_key" {
  sensitive   = true
  default     = ""
}

# --- Object Storage ---

resource "scaleway_object_bucket" "exercises" {
  name   = var.s3_bucket
  region = var.region
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
    STORAGE            = "s3"
    S3_BUCKET          = scaleway_object_bucket.exercises.name
    S3_ENDPOINT        = "https://s3.${var.region}.scw.cloud"
    S3_REGION          = var.region
    NATS_URL           = scaleway_mnq_nats_account.main.endpoint
  }

  secret_environment_variables = {
    CLERK_SECRET_KEY   = var.clerk_secret_key
    ANTHROPIC_API_KEY  = var.anthropic_api_key
    OPENAI_API_KEY     = var.openai_api_key
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
}

resource "scaleway_function" "get_exercise" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "get-exercise"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
}

resource "scaleway_function" "delete_exercise" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "delete-exercise"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
}

resource "scaleway_function" "post_ingest" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "post-ingest"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 512
  timeout      = 60
}

resource "scaleway_function" "get_ingest_status" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "get-ingest-status"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 256
  timeout      = 30
}

resource "scaleway_function" "ingest_worker" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "ingest-worker"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "private"
  memory_limit = 1024
  timeout      = 300  # 5 minutes for AI extraction
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
