
Gemini

Chat

Spark
beta
New chat
Search chats
Images
Videos
Library
Deploy ADK Agent to Vertex AI
Survey Protocol Update: GCS Integration
Go though the data and understand patterns, anomolies, come up with some interpretations
Single-File HTML App: Predictive Analytics Dashboard
AI Clinical Questionnaire Tailoring Platform
Improving Email Alert Feature
Integrate OpenTelemetry and Cloud Trace
Terraform Provisioning for SMTP Alerts
Data Analysis Plan Proposed
Codebase Too Large To Process
Chatbot UX for Research & Patients
Python Email Sending Script
Improving Travel and Arrival Message
AI-Powered Medical Questionnaire Generator
AI-Powered Questionnaire Generation for Mayo Clinic
Spark Dashboard Enhancements
Interactive Simulation Data Dashboard
Understanding CNS Viewer Software
Bonsai Name Combinations: Glabra, Nithya, John
Rewriting Teams Message for Clarity
SendGrid and Staging Deployment Update
BigQuery External Table for JSONL
Generation API Decision Log Summary
Productizing GenAI: Roadmap & Risks
ManyMinds Bokeh
Animate/Anaphor Integration Status Update
Clinical Logic Pipeline with Function Calling
Project Schedule and Notes Extraction
Dockerfile Zlib CVE Fix
Bokeh Fullscreen Conversation Matrix
Building Next-Generation LLM Models
Debugging ADK Connection Errors
Fix Firedantic Collection Access
Testing Update and Triage Coordination
Conversation with Gemini
from functools import cached_property



from google.adk.agents import LlmAgent

from google.adk.models import Gemini

from google.genai import Client

from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams

from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

from google.adk.tools import agent_tool

from google.adk.tools import url_context







class GlobalGemini(Gemini):

  """Pins the Vertex AI client to the `global` location.



  gemini-3 series models are only served from `global`; the default ADK

  `Gemini` integration constructs a `google.genai.Client` whose location

  defaults to the AgentEngine instance's region (e.g. `us-central1`) and

  fails with model-not-found for these models. Subclassing per the override

  pattern documented on `google.adk.models.google_llm.Gemini` lets the agent

  keep running in its regional AgentEngine instance while routing the model

  request to the global endpoint.

  """



  @cached_property

  def api_client(self) -> Client:

    return Client(vertexai=True, location="global")





patient_survey_assistant_url_context_agent = LlmAgent(

  name='Patient_Survey_Assistant_url_context_agent',

  model=GlobalGemini(model='gemini-3.5-flash'),

  description=(

      'Agent specialized in fetching content from URLs.'

  ),

  sub_agents=[],

  instruction='Use the UrlContextTool to retrieve content from provided URLs.',

  tools=[

    url_context

  ],

)

root_agent = LlmAgent(

  name='Patient_Survey_Assistant',

  model=GlobalGemini(model='gemini-3.5-flash'),

  description=(

      'You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. Your primary goal is to deliver a customized clinical questionnaire to the patient and record their responses empathetically and accurately.'

  ),

  sub_agents=[],

  instruction='You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. Your primary goal is to deliver a customized clinical questionnaire to the patient and record their responses empathetically and accurately.\n\n## Instructions\n1. **Retrieve the Custom Survey:** At the beginning of the interaction, you MUST use the Google Cloud Storage (`gcp-cloud-storage`) MCP server to fetch the required survey configuration file. \n   * **Path Structure:** Look for the file under the path: `clinical-chatbot-pocprojects/surveys/{patient_mrn}/`\n   * **Required Identifiers:** You will need the patient\'s `mrn` and the specific `survey_event_id` to locate the correct file. These should be provided in the session context; if they are missing, politely ask the patient or coordinator for them before proceeding.\n\n2. **Examine the Survey:** Once the file is successfully fetched via the GCS server, carefully review the `deployed_questions` array within the survey data to map out the assessment.\n\n3. **Sequential Questioning:** Ask the patient each question from the customized survey one by one.\n   * Do NOT ask multiple questions at once.\n   * Wait for the patient\'s full response before proceeding to the next question.\n   * If a question includes a `choices` or options array, clearly present those choices to the patient to guide their selection.\n\n4. **Tone & Empathy:** Maintain a highly professional, compassionate, and reassuring clinical tone. Always acknowledge and validate any discomfort, pain, or symptoms the patient mentions before moving on to the next question.\n\n5. **Clarifications:** If the patient asks for clarification on a medical term, explain it in simple, layman-friendly language. Do NOT provide diagnoses, prognoses, or actionable medical advice.\n\n6. **Conclusion:** Once all questions from the customized survey have been answered, summarize their responses briefly, thank the patient for their time, and inform them that their responses have been securely recorded for their clinical team.',

  tools=[

    agent_tool.AgentTool(agent=patient_survey_assistant_url_context_agent),

    McpToolset(

      connection_params=StreamableHTTPConnectionParams(

        url='https://storage.googleapis.com/storage/mcp',

      ),

    )

  ],

)



I want to deploy this code into agent engine, Create a project structure and files and a deployment script to deploy the same

Here is a production-ready project structure and step-by-step setup to deploy your Google ADK (Agent Development Kit) agents to Vertex AI Agent Engine.

1. Recommended Project Structure
Organize your repository so that agent logic, configuration, and deployment scripts are clearly separated:

Plaintext
mayo_survey_agent/
├── config/
│   └── requirements.txt
├── src/
│   ├── __init__.py
│   ├── custom_models.py
│   ├── sub_agents.py
│   └── root_agent.py
├── deploy.py
└── README.md
2. Source Code Files
config/requirements.txt
Specify the core ADK dependencies required for build and deployment:

Plaintext
google-adk>=0.1.0
google-genai>=0.1.0
google-cloud-aiplatform>=1.60.0
src/custom_models.py
Contains your custom Gemini model subclass pinned to the global Vertex location:

Python
from functools import cached_property
from google.adk.models import Gemini
from google.genai import Client


class GlobalGemini(Gemini):
    """Pins the Vertex AI client to the `global` location.

    gemini-3 series models are served from `global`; this custom class overrides
    the default ADK location behavior to prevent regional endpoint errors.
    """

    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, location="global")
src/sub_agents.py
Defines helper sub-agents such as the URL context agent:

Python
from google.adk.agents import LlmAgent
from google.adk.tools import url_context
from src.custom_models import GlobalGemini

patient_survey_assistant_url_context_agent = LlmAgent(
    name="Patient_Survey_Assistant_url_context_agent",
    model=GlobalGemini(model="gemini-3.5-flash"),
    description="Agent specialized in fetching content from URLs.",
    sub_agents=[],
    instruction="Use the UrlContextTool to retrieve content from provided URLs.",
    tools=[url_context],
)
src/root_agent.py
Assembles the main Patient_Survey_Assistant agent:

Python
from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

from src.custom_models import GlobalGemini
from src.sub_agents import patient_survey_assistant_url_context_agent

SURVEY_INSTRUCTIONS = """You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. Your primary goal is to deliver a customized clinical questionnaire to the patient and record their responses empathetically and accurately.

## Instructions
1. **Retrieve the Custom Survey:** At the beginning of the interaction, you MUST use the Google Cloud Storage (`gcp-cloud-storage`) MCP server to fetch the required survey configuration file. 
   * **Path Structure:** Look for the file under the path: `clinical-chatbot-pocprojects/surveys/{patient_mrn}/`
   * **Required Identifiers:** You will need the patient's `mrn` and the specific `survey_event_id` to locate the correct file. These should be provided in the session context; if they are missing, politely ask the patient or coordinator for them before proceeding.

2. **Examine the Survey:** Once the file is successfully fetched via the GCS server, carefully review the `deployed_questions` array within the survey data to map out the assessment.

3. **Sequential Questioning:** Ask the patient each question from the customized survey one by one.
   * Do NOT ask multiple questions at once.
   * Wait for the patient's full response before proceeding to the next question.
   * If a question includes a `choices` or options array, clearly present those choices to the patient to guide their selection.

4. **Tone & Empathy:** Maintain a highly professional, compassionate, and reassuring clinical tone. Always acknowledge and validate any discomfort, pain, or symptoms the patient mentions before moving on to the next question.

5. **Clarifications:** If the patient asks for clarification on a medical term, explain it in simple, layman-friendly language. Do NOT provide diagnoses, prognoses, or actionable medical advice.

6. **Conclusion:** Once all questions from the customized survey have been answered, summarize their responses briefly, thank the patient for their time, and inform them that their responses have been securely recorded for their clinical team."""

root_agent = LlmAgent(
    name="Patient_Survey_Assistant",
    model=GlobalGemini(model="gemini-3.5-flash"),
    description=(
        "You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. "
        "Your primary goal is to deliver a customized clinical questionnaire to the patient and "
        "record their responses empathetically and accurately."
    ),
    sub_agents=[],
    instruction=SURVEY_INSTRUCTIONS,
    tools=[
        agent_tool.AgentTool(agent=patient_survey_assistant_url_context_agent),
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://storage.googleapis.com/storage/mcp",
            ),
        ),
    ],
)
3. Deployment Script (deploy.py)
This deployment script uses the Google Cloud Vertex AI SDK to register and deploy your ADK root agent to Vertex AI Agent Engine.

Python
import os
import argparse
from google.cloud import aiplatform
from google.adk.deploy import agent_engine

from src.root_agent import root_agent


def deploy_agent(project_id: str, location: str, display_name: str):
    """Deploys the root ADK agent to Vertex AI Agent Engine."""
    print(f"Initializing Vertex AI SDK for Project: {project_id}, Region: {location}...")
    aiplatform.init(project=project_id, location=location)

    print(f"Deploying agent '{root_agent.name}' to Agent Engine...")
    
    # Deploy the root agent using ADK's Agent Engine deployment target
    deployed_app = agent_engine.deploy(
        agent=root_agent,
        display_name=display_name,
        requirements_file="config/requirements.txt",
    )

    print("\n Deployment Successful!")
    print(f"Agent Engine Resource Name: {deployed_app.resource_name}")
    return deployed_app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy Mayo Survey Assistant to Agent Engine.")
    parser.add_argument("--project", required=True, help="GCP Project ID")
    parser.add_argument("--region", default="us-central1", help="GCP Region for Agent Engine (default: us-central1)")
    parser.add_argument("--display-name", default="Mayo-Patient-Survey-Assistant", help="Display Name for the deployment")

    args = parser.parse_args()

    deploy_agent(
        project_id=args.project,
        location=args.region,
        display_name=args.display_name,
    )
4. How to Deploy
Step 1: Environment Setup & Authentication
Authenticate your local environment with Google Cloud and ensure your active project has the necessary Vertex AI APIs enabled:

Bash
# Authenticate gcloud CLI
gcloud auth login
gcloud auth application-default login

# Enable required GCP services
gcloud services enable aiplatform.googleapis.com storage.googleapis.com --project YOUR_PROJECT_ID
Step 2: Install Local Dependencies
Create a virtual environment and install the required modules:

Bash
python3 -m venv venv
source venv/bin/activate
pip install -r config/requirements.txt
Step 3: Run the Deployment Script
Execute deploy.py passing your target GCP Project ID and optional region:

Bash
python deploy.py \
  --project YOUR_GCP_PROJECT_ID \
  --region us-central1 \
  --display-name "Mayo-Patient-Survey-Assistant-v1"
Want me to generate an integration test script to verify responses on Agent Engine?

Yes

put it under agent.py

Here is the streamlined single-file approach where everything is consolidated into agent.py along with a minimal, flat project structure.

1. Updated Project Structure
Plaintext
mayo_survey_agent/
├── agent.py          # Main file containing agents, models, and execution/deploy entrypoint
├── requirements.txt   # Dependencies file
└── deploy.py         # Deployment script importing from agent.py
2. File Contents
requirements.txt
Plaintext
google-adk>=0.1.0
google-genai>=0.1.0
google-cloud-aiplatform>=1.60.0
agent.py
This single file contains the custom Gemini class, both sub-agent and root agent definitions, and can be directly imported or executed.

Python
from functools import cached_property

from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool, url_context
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset


class GlobalGemini(Gemini):
    """Pins the Vertex AI client to the `global` location.

    gemini-3 series models are served from `global`; this custom class overrides
    the default ADK location behavior to prevent regional endpoint errors.
    """

    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, location="global")


# 1. URL Context Sub-Agent
patient_survey_assistant_url_context_agent = LlmAgent(
    name="Patient_Survey_Assistant_url_context_agent",
    model=GlobalGemini(model="gemini-3.5-flash"),
    description="Agent specialized in fetching content from URLs.",
    sub_agents=[],
    instruction="Use the UrlContextTool to retrieve content from provided URLs.",
    tools=[url_context],
)

# 2. Root Mayo Patient Survey Assistant Agent
root_agent = LlmAgent(
    name="Patient_Survey_Assistant",
    model=GlobalGemini(model="gemini-3.5-flash"),
    description=(
        "You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. "
        "Your primary goal is to deliver a customized clinical questionnaire to the patient and "
        "record their responses empathetically and accurately."
    ),
    sub_agents=[],
    instruction="""You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. Your primary goal is to deliver a customized clinical questionnaire to the patient and record their responses empathetically and accurately.

## Instructions
1. **Retrieve the Custom Survey:** At the beginning of the interaction, you MUST use the Google Cloud Storage (`gcp-cloud-storage`) MCP server to fetch the required survey configuration file. 
   * **Path Structure:** Look for the file under the path: `clinical-chatbot-pocprojects/surveys/{patient_mrn}/`
   * **Required Identifiers:** You will need the patient's `mrn` and the specific `survey_event_id` to locate the correct file. These should be provided in the session context; if they are missing, politely ask the patient or coordinator for them before proceeding.

2. **Examine the Survey:** Once the file is successfully fetched via the GCS server, carefully review the `deployed_questions` array within the survey data to map out the assessment.

3. **Sequential Questioning:** Ask the patient each question from the customized survey one by one.
   * Do NOT ask multiple questions at once.
   * Wait for the patient's full response before proceeding to the next question.
   * If a question includes a `choices` or options array, clearly present those choices to the patient to guide their selection.

4. **Tone & Empathy:** Maintain a highly professional, compassionate, and reassuring clinical tone. Always acknowledge and validate any discomfort, pain, or symptoms the patient mentions before moving on to the next question.

5. **Clarifications:** If the patient asks for clarification on a medical term, explain it in simple, layman-friendly language. Do NOT provide diagnoses, prognoses, or actionable medical advice.

6. **Conclusion:** Once all questions from the customized survey have been answered, summarize their responses briefly, thank the patient for their time, and inform them that their responses have been securely recorded for their clinical team.""",
    tools=[
        agent_tool.AgentTool(agent=patient_survey_assistant_url_context_agent),
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://storage.googleapis.com/storage/mcp",
            ),
        ),
    ],
)
deploy.py
Imports root_agent directly from agent.py to trigger the Vertex AI Agent Engine deployment.

Python
import argparse
from google.cloud import aiplatform
from google.adk.deploy import agent_engine

from agent import root_agent


def deploy(project_id: str, location: str, display_name: str):
    """Deploys the root ADK agent from agent.py to Vertex AI Agent Engine."""
    print(f"Initializing Vertex AI SDK (Project: {project_id}, Location: {location})...")
    aiplatform.init(project=project_id, location=location)

    print(f"Deploying '{root_agent.name}' from agent.py to Agent Engine...")
    deployed_app = agent_engine.deploy(
        agent=root_agent,
        display_name=display_name,
        requirements_file="requirements.txt",
    )

    print("\n Deployment Completed Successfully!")
    print(f"Resource Name: {deployed_app.resource_name}")
    return deployed_app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy agent.py to Vertex AI Agent Engine")
    parser.add_argument("--project", required=True, help="GCP Project ID")
    parser.add_argument("--region", default="us-central1", help="Target region (default: us-central1)")
    parser.add_argument("--display-name", default="Mayo-Patient-Survey-Assistant", help="Deployment display name")

    args = parser.parse_args()
    deploy(project_id=args.project, location=args.region, display_name=args.display_name)
3. How to Deploy
Run the deployment directly from your terminal:

Bash
python deploy.py \
  --project YOUR_GCP_PROJECT_ID \
  --region us-central1 \
  --display-name "Mayo-Patient-Survey-Assistant-v1"
save the prompts inside prompts folder

Here is the updated structure and code with all prompt text extracted into markdown/text files inside a dedicated prompts/ folder for cleaner management and easier versioning.

1. Updated Project Structure
Plaintext
mayo_survey_agent/
├── prompts/
│   ├── url_context_instruction.txt
│   ├── survey_assistant_instruction.md
│   └── survey_assistant_description.txt
├── agent.py
├── deploy.py
└── requirements.txt
2. Prompt Files
prompts/url_context_instruction.txt
Plaintext
Use the UrlContextTool to retrieve content from provided URLs.
prompts/survey_assistant_description.txt
Plaintext
You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. Your primary goal is to deliver a customized clinical questionnaire to the patient and record their responses empathetically and accurately.
prompts/survey_assistant_instruction.md
Markdown
You are the Mayo Clinic Patient Survey Assistant, an enterprise-grade medical chatbot. Your primary goal is to deliver a customized clinical questionnaire to the patient and record their responses empathetically and accurately.

## Instructions
1. **Retrieve the Custom Survey:** At the beginning of the interaction, you MUST use the Google Cloud Storage (`gcp-cloud-storage`) MCP server to fetch the required survey configuration file. 
   * **Path Structure:** Look for the file under the path: `clinical-chatbot-pocprojects/surveys/{patient_mrn}/`
   * **Required Identifiers:** You will need the patient's `mrn` and the specific `survey_event_id` to locate the correct file. These should be provided in the session context; if they are missing, politely ask the patient or coordinator for them before proceeding.

2. **Examine the Survey:** Once the file is successfully fetched via the GCS server, carefully review the `deployed_questions` array within the survey data to map out the assessment.

3. **Sequential Questioning:** Ask the patient each question from the customized survey one by one.
   * Do NOT ask multiple questions at once.
   * Wait for the patient's full response before proceeding to the next question.
   * If a question includes a `choices` or options array, clearly present those choices to the patient to guide their selection.

4. **Tone & Empathy:** Maintain a highly professional, compassionate, and reassuring clinical tone. Always acknowledge and validate any discomfort, pain, or symptoms the patient mentions before moving on to the next question.

5. **Clarifications:** If the patient asks for clarification on a medical term, explain it in simple, layman-friendly language. Do NOT provide diagnoses, prognoses, or actionable medical advice.

6. **Conclusion:** Once all questions from the customized survey have been answered, summarize their responses briefly, thank the patient for their time, and inform them that their responses have been securely recorded for their clinical team.
3. Updated Python Code
agent.py
Reads all agent instructions and descriptions dynamically from the prompts/ directory.

Python
from functools import cached_property
from pathlib import Path

from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool, url_context
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

# Helper function to read prompt files
PROMPTS_DIR = Path(__file__).parent / "prompts"


def read_prompt(filename: str) -> str:
    """Reads content from a prompt file in the prompts directory."""
    return (PROMPTS_DIR / filename).read_text(encoding="utf-8").strip()


class GlobalGemini(Gemini):
    """Pins the Vertex AI client to the `global` location.

    gemini-3 series models are served from `global`; this custom class overrides
    the default ADK location behavior to prevent regional endpoint errors.
    """

    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, location="global")


# 1. URL Context Sub-Agent
patient_survey_assistant_url_context_agent = LlmAgent(
    name="Patient_Survey_Assistant_url_context_agent",
    model=GlobalGemini(model="gemini-3.5-flash"),
    description="Agent specialized in fetching content from URLs.",
    sub_agents=[],
    instruction=read_prompt("url_context_instruction.txt"),
    tools=[url_context],
)

# 2. Root Mayo Patient Survey Assistant Agent
root_agent = LlmAgent(
    name="Patient_Survey_Assistant",
    model=GlobalGemini(model="gemini-3.5-flash"),
    description=read_prompt("survey_assistant_description.txt"),
    sub_agents=[],
    instruction=read_prompt("survey_assistant_instruction.md"),
    tools=[
        agent_tool.AgentTool(agent=patient_survey_assistant_url_context_agent),
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url="https://storage.googleapis.com/storage/mcp",
            ),
        ),
    ],
)
requirements.txt
Plaintext
google-adk>=0.1.0
google-genai>=0.1.0
google-cloud-aiplatform>=1.60.0
deploy.py
Python
import argparse
from google.cloud import aiplatform
from google.adk.deploy import agent_engine

from agent import root_agent


def deploy(project_id: str, location: str, display_name: str):
    """Deploys the root ADK agent from agent.py to Vertex AI Agent Engine."""
    print(f"Initializing Vertex AI SDK (Project: {project_id}, Location: {location})...")
    aiplatform.init(project=project_id, location=location)

    print(f"Deploying '{root_agent.name}' from agent.py to Agent Engine...")
    deployed_app = agent_engine.deploy(
        agent=root_agent,
        display_name=display_name,
        requirements_file="requirements.txt",
        extra_packages=["prompts"],  # Ensures prompt files are bundled during deployment
    )

    print("\n Deployment Completed Successfully!")
    print(f"Resource Name: {deployed_app.resource_name}")
    return deployed_app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy agent.py to Vertex AI Agent Engine")
    parser.add_argument("--project", required=True, help="GCP Project ID")
    parser.add_argument("--region", default="us-central1", help="Target region (default: us-central1)")
    parser.add_argument("--display-name", default="Mayo-Patient-Survey-Assistant", help="Deployment display name")

    args = parser.parse_args()
    deploy(project_id=args.project, location=args.region, display_name=args.display_name)
Create a readme file

🚀 Key Features
Global Location Override (GlobalGemini): Custom Gemini subclass pinned to the global Vertex AI location to natively support gemini-3.5-flash and gemini-3 series models.

MCP Integration (McpToolset): Connects directly to Google Cloud Storage (gcp-cloud-storage) via Model Context Protocol to stream survey configurations in real time.

Modular Sub-Agents: Embeds a specialized url_context agent (Patient_Survey_Assistant_url_context_agent) for external web document inspection.

Externalized Prompts: Prompt templates and clinical instructions are decoupled into the prompts/ directory for easier auditing, versioning, and safety reviews.

📋 Prerequisites
Python 3.10+

Google Cloud SDK (gcloud) installed and authenticated.

Active Google Cloud Project with the following APIs enabled:

Vertex AI API (aiplatform.googleapis.com)

Cloud Storage API (storage.googleapis.com)

🛠️ Local Environment Setup
Clone the repository and enter project folder:

Bash
git clone <repository-url>
cd mayo_survey_agent
Create and activate a virtual environment:

Bash
python3 -m venv venv
source venv/bin/activate
Install dependencies:

Bash
pip install -r requirements.txt
Authenticate with GCP:

Bash
gcloud auth login
gcloud auth application-default login
💻 Deployment to Vertex AI Agent Engine
Deploy the agent to your Google Cloud project using deploy.py:

Bash
python deploy.py \\
  --project YOUR_GCP_PROJECT_ID \\
  --region us-central1 \\
  --display-name "Mayo-Patient-Survey-Assistant-v1"
Deployment Flags
--project: (Required) Your GCP Project ID.

--region: (Optional) GCP region for Vertex AI Agent Engine instance (default: us-central1).

--display-name: (Optional) Name displayed in Vertex AI Console.

🔄 How the Agent Workflow Operates
Patient Identifier Check: The agent expects a patient_mrn and survey_event_id in the session state/context.

Survey Retrieval: The agent retrieves the JSON survey file located at clinical-chatbot-pocprojects/surveys/{patient_mrn}/ using the GCS MCP server.

Sequential Questionnaire: Questions from deployed_questions are presented one at a time, incorporating choice options when specified.

Empathy & Validation: Acknowledges patient discomfort/symptoms respectfully before advancing to the next question.

Completion: Generates a brief response summary and confirms secure storage for the care team.
"""

with open("README.md", "w", encoding="utf-8") as f:
f.write(readme_content)

print("README.md generated successfully.")


```text?code_stdout&code_event_index=1
README.md generated successfully.

Your README.md file has been generated and saved into the project folder.
MD icon
README
 MD 
Open

Project File Structure Summary
Here is the complete project layout created across your files:

Plaintext
mayo_survey_agent/
├── prompts/
│   ├── url_context_instruction.txt      # Instructions for URL fetcher sub-agent
│   ├── survey_assistant_description.txt  # Description of root agent
│   └── survey_assistant_instruction.md   # Core clinical instruction prompt
├── agent.py                             # Agent definitions & custom GlobalGemini class
├── deploy.py                            # Deployment script for Vertex AI Agent Engine
├── requirements.txt                     # Dependencies
└── README.md                            # Comprehensive setup & deployment documentation
Create a config.py file to main the model and env variables

Here is the updated configuration setup using a dedicated config.py file to handle environment variables, project settings, model parameters, and file paths cleanly.

1. Updated Project Structure
Plaintext
mayo_survey_agent/
├── prompts/
│   ├── url_context_instruction.txt
│   ├── survey_assistant_description.txt
│   └── survey_assistant_instruction.md
├── config.py             # NEW: Centralized environment & model configurations
├── agent.py              # Loads configurations & builds ADK agents
├── deploy.py             # Deployment script
├── requirements.txt
└── README.md
2. Updated Configuration & Code
config.py
Uses pydantic-settings (or standard environment variables with fallbacks) to centralize project IDs, model definitions, GCS MCP URLs, and file paths.

Python
import os
from pathlib import Path


class Config:
    """Central configuration management for Mayo Survey Agent."""

    # Base Directory Paths
    BASE_DIR: Path = Path(__file__).parent
    PROMPTS_DIR: Path = BASE_DIR / "prompts"

    # Environment & Cloud Configuration
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "your-gcp-project-id")
    GCP_REGION: str = os.getenv("GCP_REGION", "us-central1")
    AGENT_DISPLAY_NAME: str = os.getenv("AGENT_DISPLAY_NAME", "Mayo-Patient-Survey-Assistant")

    # Model Configuration
    # gemini-3.5-flash requires global location routing
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-3.5-flash")
    MODEL_LOCATION: str = os.getenv("MODEL_LOCATION", "global")

    # MCP (Model Context Protocol) Endpoint Settings
    GCS_MCP_URL: str = os.getenv(
        "GCS_MCP_URL",
        "https://storage.googleapis.com/storage/mcp"
    )

    # Prompt File Names
    URL_CONTEXT_INSTRUCTION_FILE: str = "url_context_instruction.txt"
    SURVEY_DESCRIPTION_FILE: str = "survey_assistant_description.txt"
    SURVEY_INSTRUCTION_FILE: str = "survey_assistant_instruction.md"

    @classmethod
    def get_prompt(cls, filename: str) -> str:
        """Helper utility to safely read text from the prompts directory."""
        file_path = cls.PROMPTS_DIR / filename
        if not file_path.exists():
            raise FileNotFoundError(f"Prompt file not found at: {file_path}")
        return file_path.read_text(encoding="utf-8").strip()


config = Config()
agent.py
Refactored to pull model names, locations, prompts, and MCP parameters directly from config.py.

Python
from functools import cached_property

from google.adk.agents import LlmAgent
from google.adk.models import Gemini
from google.genai import Client
from google.adk.tools import agent_tool, url_context
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset

from config import config


class GlobalGemini(Gemini):
    """Pins the Vertex AI client to the location configured in config.py."""

    @cached_property
    def api_client(self) -> Client:
        return Client(vertexai=True, location=config.MODEL_LOCATION)


# 1. URL Context Sub-Agent
patient_survey_assistant_url_context_agent = LlmAgent(
    name="Patient_Survey_Assistant_url_context_agent",
    model=GlobalGemini(model=config.MODEL_NAME),
    description="Agent specialized in fetching content from URLs.",
    sub_agents=[],
    instruction=config.get_prompt(config.URL_CONTEXT_INSTRUCTION_FILE),
    tools=[url_context],
)

# 2. Root Mayo Patient Survey Assistant Agent
root_agent = LlmAgent(
    name="Patient_Survey_Assistant",
    model=GlobalGemini(model=config.MODEL_NAME),
    description=config.get_prompt(config.SURVEY_DESCRIPTION_FILE),
    sub_agents=[],
    instruction=config.get_prompt(config.SURVEY_INSTRUCTION_FILE),
    tools=[
        agent_tool.AgentTool(agent=patient_survey_assistant_url_context_agent),
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url=config.GCS_MCP_URL,
            ),
        ),
    ],
)
deploy.py
Leverages config.py defaults if command-line flags aren't passed explicitly.

Python
import argparse
from google.cloud import aiplatform
from google.adk.deploy import agent_engine

from agent import root_agent
from config import config


def deploy(project_id: str, location: str, display_name: str):
    """Deploys the root ADK agent from agent.py to Vertex AI Agent Engine."""
    print(f"Initializing Vertex AI SDK (Project: {project_id}, Location: {location})...")
    aiplatform.init(project=project_id, location=location)

    print(f"Deploying '{root_agent.name}' from agent.py to Agent Engine...")
    deployed_app = agent_engine.deploy(
        agent=root_agent,
        display_name=display_name,
        requirements_file="requirements.txt",
        extra_packages=["prompts", "config.py"],  # Include config.py in package bundling
    )

    print("\n Deployment Completed Successfully!")
    print(f"Resource Name: {deployed_app.resource_name}")
    return deployed_app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy agent.py to Vertex AI Agent Engine")
    parser.add_argument("--project", default=config.GCP_PROJECT_ID, help="GCP Project ID")
    parser.add_argument("--region", default=config.GCP_REGION, help="Target region (default: us-central1)")
    parser.add_argument("--display-name", default=config.AGENT_DISPLAY_NAME, help="Deployment display name")

    args = parser.parse_args()
    deploy(project_id=args.project, location=args.region, display_name=args.display_name)
Update the readme, no cloning of repo is there

🚀 Key Features
Centralized Configuration (config.py): Environment variables, project IDs, model names, and prompt file mappings are managed in a single module.

Global Location Override (GlobalGemini): Custom Gemini subclass pinned to the global Vertex AI location to natively support gemini-3.5-flash and gemini-3 series models.

MCP Integration (McpToolset): Connects directly to Google Cloud Storage (gcp-cloud-storage) via Model Context Protocol to stream survey configurations in real time.

Modular Sub-Agents: Embeds a specialized url_context agent (Patient_Survey_Assistant_url_context_agent) for external web document inspection.

Externalized Prompts: Prompt templates and clinical instructions are decoupled into the prompts/ directory for easier auditing, versioning, and safety reviews.

📋 Prerequisites
Python 3.10+

Google Cloud SDK (gcloud) installed and authenticated.

Active Google Cloud Project with the following APIs enabled:

Vertex AI API (aiplatform.googleapis.com)

Cloud Storage API (storage.googleapis.com)

🛠️ Local Environment Setup
Navigate into the project directory:

Bash
cd mayo_survey_agent
Create and activate a virtual environment:

Bash
python3 -m venv venv
source venv/bin/activate
Install dependencies:

Bash
pip install -r requirements.txt
Authenticate with GCP:

Bash
gcloud auth login
gcloud auth application-default login
(Optional) Export Environment Variables:
You can override config.py defaults by setting environment variables in your terminal:

Bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
export MODEL_NAME="gemini-3.5-flash"
💻 Deployment to Vertex AI Agent Engine
Deploy the agent to your Google Cloud project using deploy.py:

Bash
python deploy.py \\
  --project YOUR_GCP_PROJECT_ID \\
  --region us-central1 \\
  --display-name "Mayo-Patient-Survey-Assistant-v1"
Deployment Flags
--project: (Optional) Your GCP Project ID (defaults to GCP_PROJECT_ID in config.py).

--region: (Optional) GCP region for Vertex AI Agent Engine instance (defaults to GCP_REGION in config.py).

--display-name: (Optional) Name displayed in Vertex AI Console (defaults to AGENT_DISPLAY_NAME in config.py).

🔄 How the Agent Workflow Operates
Patient Identifier Check: The agent expects a patient_mrn and survey_event_id in the session state/context.

Survey Retrieval: The agent retrieves the JSON survey file located at clinical-chatbot-pocprojects/surveys/{patient_mrn}/ using the GCS MCP server.

Sequential Questionnaire: Questions from deployed_questions are presented one at a time, incorporating choice options when specified.

Empathy & Validation: Acknowledges patient discomfort/symptoms respectfully before advancing to the next question.

Completion: Generates a brief response summary and confirms secure storage for the care team.
"""

with open("README.md", "w", encoding="utf-8") as f:
f.write(updated_readme_content)

print("Updated README.md generated successfully.")


```text?code_stdout&code_event_index=1
Updated README.md generated successfully.

Here is the updated README.md file reflecting config.py and removing the git cloning step from local setup instructions.
MD icon
README
 MD 
Open

Markdown
# Mayo Clinic Patient Survey Assistant (Vertex AI Agent Engine)

An enterprise-grade clinical survey agent built using the **Google Agent Development Kit (ADK)** and deployed to **Vertex AI Agent Engine**. 

The assistant dynamically fetches patient-specific clinical surveys from Google Cloud Storage (GCS) using Model Context Protocol (MCP) tooling and administers customized, step-by-step health assessments with clinical empathy and clarity.

---

## 📁 Project Structure

```text
mayo_survey_agent/
├── prompts/
│   ├── url_context_instruction.txt      # Instructions for the URL fetcher sub-agent
│   ├── survey_assistant_description.txt  # High-level description of the root agent
│   └── survey_assistant_instruction.md   # Core clinical instructions & survey workflow
├── config.py                             # Centralized environment & model configurations
├── agent.py                             # Agent definitions, custom GlobalGemini model, & tools
├── deploy.py                            # Deployment script for Vertex AI Agent Engine
├── requirements.txt                     # Python dependencies
└── README.md                            # Project documentation
🚀 Key Features
Centralized Configuration (config.py): Environment variables, project IDs, model names, and prompt file mappings are managed in a single module.

Global Location Override (GlobalGemini): Custom Gemini subclass pinned to the global Vertex AI location to natively support gemini-3.5-flash and gemini-3 series models.

MCP Integration (McpToolset): Connects directly to Google Cloud Storage (gcp-cloud-storage) via Model Context Protocol to stream survey configurations in real time.

Modular Sub-Agents: Embeds a specialized url_context agent (Patient_Survey_Assistant_url_context_agent) for external web document inspection.

Externalized Prompts: Prompt templates and clinical instructions are decoupled into the prompts/ directory for easier auditing, versioning, and safety reviews.

📋 Prerequisites
Python 3.10+

Google Cloud SDK (gcloud) installed and authenticated.

Active Google Cloud Project with the following APIs enabled:

Vertex AI API (aiplatform.googleapis.com)

Cloud Storage API (storage.googleapis.com)

🛠️ Local Environment Setup
Navigate into the project directory:

Bash
cd mayo_survey_agent
Create and activate a virtual environment:

Bash
python3 -m venv venv
source venv/bin/activate
Install dependencies:

Bash
pip install -r requirements.txt
Authenticate with GCP:

Bash
gcloud auth login
gcloud auth application-default login
(Optional) Export Environment Variables:
You can override config.py defaults by setting environment variables in your terminal:

Bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_REGION="us-central1"
export MODEL_NAME="gemini-3.5-flash"
💻 Deployment to Vertex AI Agent Engine
Deploy the agent to your Google Cloud project using deploy.py:

Bash
python deploy.py \
  --project YOUR_GCP_PROJECT_ID \
  --region us-central1 \
  --display-name "Mayo-Patient-Survey-Assistant-v1"
Deployment Flags
--project: (Optional) Your GCP Project ID (defaults to GCP_PROJECT_ID in config.py).

--region: (Optional) GCP region for Vertex AI Agent Engine instance (defaults to GCP_REGION in config.py).

--display-name: (Optional) Name displayed in Vertex AI Console (defaults to AGENT_DISPLAY_NAME in config.py).

🔄 How the Agent Workflow Operates
Patient Identifier Check: The agent expects a patient_mrn and survey_event_id in the session state/context.

Survey Retrieval: The agent retrieves the JSON survey file located at clinical-chatbot-pocprojects/surveys/{patient_mrn}/ using the GCS MCP server.

Sequential Questionnaire: Questions from deployed_questions are presented one at a time, incorporating choice options when specified.

Empathy & Validation: Acknowledges patient discomfort/symptoms respectfully before advancing to the next question.

Completion: Generates a brief response summary and confirms secure storage for the care team.




Your Google chats aren’t used to improve our models. Gemini is AI and can make mistakes. Your privacy & GeminiOpens in a new window

# Mayo Clinic Patient Survey Assistant (Vertex AI Agent Engine)

An enterprise-grade clinical survey agent built using the **Google Agent Development Kit (ADK)** and deployed to **Vertex AI Agent Engine**. 

The assistant dynamically fetches patient-specific clinical surveys from Google Cloud Storage (GCS) using Model Context Protocol (MCP) tooling and administers customized, step-by-step health assessments with clinical empathy and clarity.

---

## 📁 Project Structure

```text
mayo_survey_agent/
├── prompts/
│   ├── url_context_instruction.txt      # Instructions for the URL fetcher sub-agent
│   ├── survey_assistant_description.txt  # High-level description of the root agent
│   └── survey_assistant_instruction.md   # Core clinical instructions & survey workflow
├── config.py                             # Centralized environment & model configurations
├── agent.py                             # Agent definitions, custom GlobalGemini model, & tools
├── deploy.py                            # Deployment script for Vertex AI Agent Engine
├── requirements.txt                     # Python dependencies
└── README.md                            # Project documentation
```

---

## 🚀 Key Features

- **Centralized Configuration (`config.py`)**: Environment variables, project IDs, model names, and prompt file mappings are managed in a single module.
- **Global Location Override (`GlobalGemini`)**: Custom `Gemini` subclass pinned to the `global` Vertex AI location to natively support `gemini-3.5-flash` and `gemini-3` series models.
- **MCP Integration (`McpToolset`)**: Connects directly to Google Cloud Storage (`gcp-cloud-storage`) via Model Context Protocol to stream survey configurations in real time.
- **Modular Sub-Agents**: Embeds a specialized `url_context` agent (`Patient_Survey_Assistant_url_context_agent`) for external web document inspection.
- **Externalized Prompts**: Prompt templates and clinical instructions are decoupled into the `prompts/` directory for easier auditing, versioning, and safety reviews.

---

## 📋 Prerequisites

1. **Python 3.10+**
2. **Google Cloud SDK (`gcloud`)** installed and authenticated.
3. Active **Google Cloud Project** with the following APIs enabled:
   - Vertex AI API (`aiplatform.googleapis.com`)
   - Cloud Storage API (`storage.googleapis.com`)

---

## 🛠️ Local Environment Setup

1. **Navigate into the project directory:**
   ```bash
   cd survey-assistant
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Authenticate with GCP:**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

5. **(Optional) Export Environment Variables:**
   You can override `config.py` defaults by setting environment variables in your terminal:
   ```bash
   export GCP_PROJECT_ID="your-gcp-project-id"
   export GCP_REGION="us-central1"
   export MODEL_NAME="gemini-3.5-flash"
   ```

---

## 💻 Deployment to Vertex AI Agent Engine

Deploy the agent to your Google Cloud project using `deploy.py`:

```bash
python deploy.py \
  --project YOUR_GCP_PROJECT_ID \
  --region us-central1 \
  --display-name "Mayo-Patient-Survey-Assistant-v1"
```

### Deployment Flags
- `--project`: *(Optional)* Your GCP Project ID (defaults to `GCP_PROJECT_ID` in `config.py`).
- `--region`: *(Optional)* GCP region for Vertex AI Agent Engine instance (defaults to `GCP_REGION` in `config.py`).
- `--display-name`: *(Optional)* Name displayed in Vertex AI Console (defaults to `AGENT_DISPLAY_NAME` in `config.py`).

---

## 🔄 How the Agent Workflow Operates

1. **Patient Identifier Check**: The agent expects a `patient_mrn` and `survey_event_id` in the session state/context.
2. **Survey Retrieval**: The agent retrieves the JSON survey file located at `clinical-chatbot-pocprojects/surveys/{patient_mrn}/` using the GCS MCP server.
3. **Sequential Questionnaire**: Questions from `deployed_questions` are presented one at a time, incorporating choice options when specified.
4. **Empathy & Validation**: Acknowledges patient discomfort/symptoms respectfully before advancing to the next question.
5. **Completion**: Generates a brief response summary and confirms secure storage for the care team.
