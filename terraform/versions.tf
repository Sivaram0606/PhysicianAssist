terraform {
  required_version = ">= 1.5.0"

  # Shared remote state & automatic state locking (.tflock) in Google Cloud Storage
  backend "gcs" {
    bucket = "agentic-physicianassist-2257-tfstate"
    prefix = "clingen/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

