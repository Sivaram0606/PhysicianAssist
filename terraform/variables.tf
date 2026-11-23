variable "project_id" {
  description = "The GCP Project ID where resources will be deployed."
  type        = string
  default     = "agentic-physicianassist-2257"
}

variable "region" {
  description = "The GCP region for Cloud Run, Artifact Registry, and GCS."
  type        = string
  default     = "us-central1"
}

variable "location" {
  description = "The Vertex AI / GenAI SDK location (e.g., global)."
  type        = string
  default     = "global"
}

variable "service_name" {
  description = "The name of the unified Cloud Run service (serving both UI and Backend)."
  type        = string
  default     = "clingen-app"
}

variable "service_account_id" {
  description = "The account ID for the dedicated Cloud Run service account."
  type        = string
  default     = "agentic-physicianassist-sa"
}

variable "artifact_repo_name" {
  description = "The Artifact Registry Docker repository name."
  type        = string
  default     = "agentic-physicianassist"
}

variable "survey_bucket_name" {
  description = "Name of the GCS bucket for storing deployed surveys. Defaults to <project_id>-agentic-physicianassist-surveys if empty."
  type        = string
  default     = ""
}

variable "mcp_server_name" {
  description = "The Agent Registry MCP Server ID for Google Cloud Storage."
  type        = string
  default     = "agentregistry-00000000-0000-0000-8c4c-b4550d010e13"
}

variable "agent_id" {
  description = "The Vertex AI Search / Agent ID used for dynamic links."
  type        = string
  default     = "12430422255594194860"
}

variable "image_tag" {
  description = "Docker image tag to build and deploy."
  type        = string
  default     = "latest"
}
