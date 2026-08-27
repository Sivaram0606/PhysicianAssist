import sys
import os
from dotenv import load_dotenv

# Load environment variables from a .env file if it exists
load_dotenv()

# Inject the monorepo root path into sys.path to allow root configuration imports
current_dir = os.path.dirname(os.path.abspath(__file__))
monorepo_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if monorepo_root not in sys.path:
    sys.path.insert(0, monorepo_root)

# Pull configuration properties from the centralized settings module
from settings import (
    CLINGEN_MODEL as GEMINI_MODEL,
    GOOGLE_CLOUD_PROJECT,
    SURVEY_BUCKET_NAME,
    AGENT_ID,
    DYNAMIC_LINK_TEMPLATE
)
