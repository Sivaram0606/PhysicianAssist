FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

WORKDIR /app

# Copy dependency mappings
COPY pyproject.toml .

# Automatically creates a .venv, resolves dependencies, and locks them cleanly
RUN uv sync --no-dev

# Copy application layer logic
COPY . .

EXPOSE 8000

# Run uvicorn bound to 0.0.0.0 inside the container environment
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]