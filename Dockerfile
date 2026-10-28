# Stage 1: Build the React Frontend
FROM node:24-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
# Leave VITE_API_URL empty so all API calls use relative /api/... paths on the same Cloud Run host
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Build the Unified FastAPI Backend + Static Frontend Image
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

# Copy compiled frontend static assets from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 8000

# Boot uvicorn serving the unified orchestrator main:app (API + UI)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

