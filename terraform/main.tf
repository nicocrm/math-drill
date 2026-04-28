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

variable "extraction_provider" {
  description = "AI provider for PDF extraction: 'anthropic' or 'openai'. Must match which API key is set."
  default     = "openai"
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

  lifecycle_rule {
    id      = "expire-status"
    prefix  = "status/"
    enabled = true
    expiration {
      days = 2
    }
  }
  lifecycle_rule {
    id      = "expire-intake"
    prefix  = "intake/"
    enabled = true
    expiration {
      days = 2
    }
  }
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

# --- SQS (Messaging and Queuing) ---

resource "scaleway_mnq_sqs" "main" {
  region = var.region
}

resource "scaleway_mnq_sqs_credentials" "functions" {
  region = var.region
  permissions {
    can_manage  = true  # Required for Terraform to create queues (CreateQueue API)
    can_publish = true
    can_receive = true
  }
}

resource "scaleway_mnq_sqs_queue" "ingest_jobs" {
  region     = var.region
  name       = "ingest-jobs"
  access_key = scaleway_mnq_sqs_credentials.functions.access_key
  secret_key = scaleway_mnq_sqs_credentials.functions.secret_key
  sqs_endpoint = scaleway_mnq_sqs.main.endpoint

  message_max_age            = 86400  # 24h retention
  visibility_timeout_seconds = 300    # 5 min (matches worker timeout)
  receive_wait_time_seconds = 10     # long polling
}

# --- Serverless Functions Namespace ---

resource "scaleway_function_namespace" "main" {
  name = "math-drill"

  environment_variables = {
    STORAGE             = "s3"
    S3_BUCKET           = scaleway_object_bucket.exercises.name
    S3_ENDPOINT         = "https://s3.${var.region}.scw.cloud"
    S3_REGION           = var.region
    SQS_QUEUE_URL       = scaleway_mnq_sqs_queue.ingest_jobs.url
    SQS_ENDPOINT        = scaleway_mnq_sqs.main.endpoint
    SQS_REGION          = var.region
    ALLOWED_ORIGIN      = "https://${scaleway_object_bucket_website_configuration.frontend.website_endpoint}"
    EXTRACTION_PROVIDER = var.extraction_provider
  }

  secret_environment_variables = {
    CLERK_SECRET_KEY       = var.clerk_secret_key
    ANTHROPIC_API_KEY      = var.anthropic_api_key
    OPENAI_API_KEY         = var.openai_api_key
    AWS_ACCESS_KEY_ID      = scaleway_iam_api_key.functions.access_key
    AWS_SECRET_ACCESS_KEY  = scaleway_iam_api_key.functions.secret_key
    SQS_ACCESS_KEY_ID      = scaleway_mnq_sqs_credentials.functions.access_key
    SQS_SECRET_ACCESS_KEY  = scaleway_mnq_sqs_credentials.functions.secret_key
  }
}

# --- Functions ---

resource "scaleway_function" "api" {
  namespace_id = scaleway_function_namespace.main.id
  name         = "api"
  runtime      = "node22"
  handler      = "handler.handle"
  privacy      = "public"
  memory_limit = 512
  timeout      = 60
  zip_file     = "${path.module}/../dist/functions/api.zip"
  zip_hash     = filesha256("${path.module}/../dist/functions/api.zip")
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

# --- SQS Trigger ---

resource "scaleway_function_trigger" "ingest_trigger" {
  function_id = scaleway_function.ingest_worker.id
  name        = "ingest-jobs-trigger"

  sqs {
    queue = scaleway_mnq_sqs_queue.ingest_jobs.name
  }
}

# --- Outputs ---

output "api_url" {
  value = scaleway_function.api.domain_name
}

output "sqs_queue_url" {
  value = scaleway_mnq_sqs_queue.ingest_jobs.url
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
