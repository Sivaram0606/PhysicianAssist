FROM python:3.12-slim-bookworm

WORKDIR /app

# Install minimal OS requirements for Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python application requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application files (monorepo root and services)
COPY . .

EXPOSE 8000

# Boot uvicorn serving the unified orchestrator main:app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
