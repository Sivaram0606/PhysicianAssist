locals {
  bucket_name = var.survey_bucket_name != "" ? var.survey_bucket_name : "${var.project_id}-agentic-physicianassist-surveys"
  image_uri   = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.agentic_physicianassist_repo.repository_id}/${var.service_name}:${var.image_tag}"

  # Hash key source files so `terraform apply` automatically rebuilds the image when code changes
  source_hash = sha256(join("", [
    filesha256("${path.module}/../Dockerfile"),
    filesha256("${path.module}/../main.py"),
    filesha256("${path.module}/../settings.py"),
    filesha256("${path.module}/../requirements.txt"),
    filesha256("${path.module}/../services/clingen_synth/server.py"),
    filesha256("${path.module}/../services/survey_tailor/server.py"),
    filesha256("${path.module}/../services/survey_tailor/agents.py"),
    filesha256("${path.module}/../services/survey_assistant/agent.py"),
    filesha256("${path.module}/../frontend/package.json"),
    filesha256("${path.module}/../frontend/App.tsx"),
  ]))

  required_apis = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "aiplatform.googleapis.com",
    "discoveryengine.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "agentregistry.googleapis.com",
  ])

  cloudrun_sa_roles = toset([
    "roles/aiplatform.user",
    "roles/discoveryengine.admin",
    "roles/storage.admin",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/artifactregistry.writer",
    "roles/logging.logWriter",
  ])
}

# 1. Enable Required GCP APIs (kept enabled on destroy so pre-existing project state is preserved)
resource "google_project_service" "apis" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# 2. Dedicated Service Account for Cloud Run & Cloud Build
resource "google_service_account" "cloudrun_sa" {
  project      = var.project_id
  account_id   = var.service_account_id
  display_name = "Agentic-PhysicianAssist Unified Cloud Run Service Account"
  description  = "Dedicated service account for the Agentic-PhysicianAssist Cloud Run service (created and destroyed by Terraform)."

  depends_on = [google_project_service.apis]
}

# 3. Grant IAM Roles to the Dedicated Cloud Run Service Account
resource "google_project_iam_member" "cloudrun_sa_roles" {
  for_each = local.cloudrun_sa_roles
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# 4. GCS Bucket for Tailored Surveys (force_destroy = true ensures clean removal on `terraform destroy`)
resource "google_storage_bucket" "survey_bucket" {
  name                        = local.bucket_name
  project                     = var.project_id
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "survey_bucket_sa" {
  bucket = google_storage_bucket.survey_bucket.name
  role   = "roles/storage.admin"
  member = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# 5. Artifact Registry Docker Repository (cleanly deleted with all images on `terraform destroy`)
resource "google_artifact_registry_repository" "agentic_physicianassist_repo" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_name
  description   = "Docker repository for unified Agentic-PhysicianAssist application (Frontend + Backend)"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# 6. Build & Push Unified Docker Image via Cloud Build
resource "terraform_data" "docker_build_push" {
  triggers_replace = [
    local.source_hash,
    local.image_uri,
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/.."
    command     = "gcloud builds submit . --config=terraform/cloudbuild-image.yaml --substitutions=_IMAGE_URI=${local.image_uri} --service-account=projects/${var.project_id}/serviceAccounts/${google_service_account.cloudrun_sa.email} --gcs-source-staging-dir=gs://${google_storage_bucket.survey_bucket.name}/_cloudbuild/source --project=${var.project_id}"
  }

  depends_on = [
    google_artifact_registry_repository.agentic_physicianassist_repo,
    google_storage_bucket.survey_bucket,
    google_storage_bucket_iam_member.survey_bucket_sa,
    google_project_iam_member.cloudrun_sa_roles,
  ]
}

# 7. Single Unified Cloud Run v2 Service (serves both React UI and FastAPI Backend)
resource "google_cloud_run_v2_service" "agentic_physicianassist_app" {
  name                = var.service_name
  location            = var.region
  project             = var.project_id
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.cloudrun_sa.email
    timeout         = "600s"

    containers {
      image = local.image_uri

      ports {
        container_port = 8000
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "AGENTIC_PHYSICIANASSIST_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.location
      }
      env {
        name  = "AGENTIC_PHYSICIANASSIST_LOCATION"
        value = var.location
      }
      env {
        name  = "SURVEY_BUCKET_NAME"
        value = google_storage_bucket.survey_bucket.name
      }
      env {
        name  = "SERVICE_ACCOUNT"
        value = google_service_account.cloudrun_sa.email
      }
      env {
        name  = "MCP_SERVER_NAME"
        value = var.mcp_server_name
      }
      env {
        name  = "AGENT_ID"
        value = var.agent_id
      }
    }
  }

  depends_on = [
    terraform_data.docker_build_push,
    google_project_iam_member.cloudrun_sa_roles,
    google_storage_bucket.survey_bucket,
  ]
}
