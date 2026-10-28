output "cloud_run_url" {
  description = "Public URL of the unified ClinGen Cloud Run service (Frontend + Backend APIs)."
  value       = google_cloud_run_v2_service.clingen_app.uri
}

output "cloud_run_service_account" {
  description = "Email of the dedicated Cloud Run Service Account created by Terraform."
  value       = google_service_account.cloudrun_sa.email
}

output "survey_bucket_name" {
  description = "Name of the GCS bucket created for tailored surveys."
  value       = google_storage_bucket.survey_bucket.name
}

output "artifact_registry_image" {
  description = "Full Artifact Registry container image URI deployed to Cloud Run."
  value       = local.image_uri
}
