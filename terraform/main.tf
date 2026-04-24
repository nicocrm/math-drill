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

# --- IAM (S3 access for the app: Coolify or other runtime) ---

resource "scaleway_iam_application" "math_drill" {
  name = "math-drill-app"
}

resource "scaleway_iam_policy" "s3_access" {
  name           = "math-drill-s3-access"
  application_id = scaleway_iam_application.math_drill.id

  rule {
    project_ids          = [var.project_id]
    permission_set_names = ["ObjectStorageFullAccess"]
  }
}

resource "scaleway_iam_api_key" "math_drill" {
  application_id = scaleway_iam_application.math_drill.id
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

output "s3_bucket" {
  value = scaleway_object_bucket.exercises.name
}

output "s3_iam_access_key" {
  value     = scaleway_iam_api_key.math_drill.access_key
  sensitive = true
}

output "s3_iam_secret_key" {
  value     = scaleway_iam_api_key.math_drill.secret_key
  sensitive = true
}

output "s3_endpoint" {
  value = "https://s3.${var.region}.scw.cloud"
}

output "s3_region" {
  value = var.region
}
