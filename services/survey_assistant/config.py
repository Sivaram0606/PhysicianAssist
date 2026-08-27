import sys
import os
from pathlib import Path

# Inject the monorepo root path into sys.path to allow root configuration imports
current_dir = os.path.dirname(os.path.abspath(__file__))
monorepo_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if monorepo_root not in sys.path:
    sys.path.insert(0, monorepo_root)

# Pull configuration properties from the centralized settings module
from settings import (
    GOOGLE_CLOUD_PROJECT as GCP_PROJECT_ID,
    GCP_REGION,
    STAGING_BUCKET,
    AGENT_DISPLAY_NAME,
    ASSISTANT_MODEL_NAME as MODEL_NAME,
    ASSISTANT_MODEL_LOCATION as MODEL_LOCATION,
    GCS_MCP_URL,
    GOOGLE_CLOUD_LOCATION,
    MCP_SERVER_NAME
)

class Config:
    """Central configuration management for Patient Survey Agent (Reasoning Engine)."""

    BASE_DIR: Path = Path(__file__).parent
    PROMPTS_DIR: Path = BASE_DIR / "prompts"

    # Map imported configuration constants to the Class attributes for full backward-compatibility
    GCP_PROJECT_ID = GCP_PROJECT_ID
    GCP_REGION = GCP_REGION
    STAGING_BUCKET = STAGING_BUCKET
    AGENT_DISPLAY_NAME = AGENT_DISPLAY_NAME
    MODEL_NAME = MODEL_NAME
    MODEL_LOCATION = MODEL_LOCATION
    GCS_MCP_URL = GCS_MCP_URL
    GOOGLE_CLOUD_LOCATION = GOOGLE_CLOUD_LOCATION
    MCP_SERVER_NAME = MCP_SERVER_NAME

    SURVEY_DESCRIPTION_FILE: str = "survey_assistant_description.txt"
    SURVEY_INSTRUCTION_FILE: str = "survey_assistant_instruction.md"

    @classmethod
    def get_prompt(cls, filename: str) -> str:
        file_path = cls.PROMPTS_DIR / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Prompt file not found at: {file_path}")
        return file_path.read_text(encoding="utf-8").strip()


config = Config()
