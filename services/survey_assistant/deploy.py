import sys
import os
import argparse
import vertexai
from vertexai.agent_engines import AdkApp

# Inject the monorepo root path into sys.path to allow root configuration imports
current_dir = os.path.dirname(os.path.abspath(__file__))
monorepo_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if monorepo_root not in sys.path:
    sys.path.insert(0, monorepo_root)

from app_config.settings import SERVICE_ACCOUNT
from agent import root_agent
from config import config


def deploy(project_id: str, location: str, staging_bucket: str, display_name: str):
    """Deploys the root ADK agent to Vertex AI Agent Engine using AdkApp."""
    print(f"Initializing Vertex AI SDK (Project: {project_id}, Region: {location}, Bucket: {staging_bucket})...")
    
    # 💡 Provide staging_bucket here:
    vertexai.init(
        project=project_id,
        location=location,
        staging_bucket=staging_bucket,
    )

    print(f"Wrapping '{root_agent.name}' in AdkApp...")
    app = AdkApp(agent=root_agent)

    print("Deploying to Vertex AI Agent Engine...")
    remote_app = vertexai.agent_engines.create(
        agent_engine=app,
        display_name=display_name,
        requirements=[
            "google-adk",
            "google-genai",
            "google-cloud-aiplatform",
            "google-adk[extensions]",
            "google-adk[agent-identity]",
            "google-adk[a2a]",
            "mcp"
        ],
        extra_packages=["prompts", "config.py","agent.py"],
        service_account=SERVICE_ACCOUNT
    )

    print("\n Deployment Completed Successfully!")
    print(f"Resource Name: {remote_app.resource_name}")
    return remote_app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy agent.py to Vertex AI Agent Engine")
    parser.add_argument("--project", default=config.GCP_PROJECT_ID, help="GCP Project ID")
    parser.add_argument("--region", default=config.GCP_REGION, help="Target region (default: us-central1)")
    parser.add_argument("--staging-bucket", default=config.STAGING_BUCKET, help="GCS Bucket for staging agent artifacts")
    parser.add_argument("--display-name", default=config.AGENT_DISPLAY_NAME, help="Deployment display name")

    args = parser.parse_args()
    deploy(
        project_id=args.project,
        location=args.region,
        staging_bucket=args.staging_bucket,
        display_name=args.display_name,
    )
