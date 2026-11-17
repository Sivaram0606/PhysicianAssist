.PHONY: run deploy destroy

PYTHON := $(shell if [ -x .venv/bin/python ]; then echo .venv/bin/python; else echo python3; fi)
NODE_DIR := $(shell for d in $(HOME)/.nvm/versions/node/*/bin /usr/local/bin /opt/homebrew/bin; do \
	if [ -x "$$d/node" ] && [ -x "$$d/npm" ] && "$$d/node" -v >/dev/null 2>&1; then \
		echo "$$d"; break; \
	fi; \
done)
ifneq ($(NODE_DIR),)
export PATH := $(NODE_DIR):$(PATH)
endif

run:
	@if [ -z "$(NODE_DIR)" ] && ! node -v >/dev/null 2>&1; then \
		echo "Error: No working/allowlisted Node.js binary found (Homebrew node may be blocked by Santa)."; \
		echo "Fix: Install signed Node LTS via 'nvm install --lts' or https://nodejs.org, or upvote the binary and run 'santactl sync'."; \
		exit 1; \
	fi
	@if [ ! -d frontend/node_modules ]; then \
		echo "Installing frontend dependencies..."; \
		(cd frontend && npm install); \
	fi
	@trap 'kill 0' INT TERM; \
		PORT=8001 GOOGLE_API_USE_CLIENT_CERTIFICATE=false $(PYTHON) main.py & \
		(cd frontend && npm run dev) & \
		(for i in $$(seq 1 60); do \
			if curl -sf http://127.0.0.1:8001/ >/dev/null 2>&1 && curl -sf http://localhost:5173/ >/dev/null 2>&1; then \
				sleep 0.3; \
				echo ""; \
				echo "============================================================"; \
				echo "  Agentic-PhysicianAssist is Ready!"; \
				echo "  ➜  Frontend UI:   http://localhost:5173/"; \
				echo "  ➜  Backend Docs:  http://localhost:8001/docs"; \
				echo "  (Press CTRL+C to quit)"; \
				echo "============================================================"; \
				echo ""; \
				break; \
			fi; \
			sleep 0.5; \
		done) & \
		wait

deploy:
	terraform -chdir=terraform init -reconfigure -upgrade=false
	terraform -chdir=terraform apply

destroy:
	terraform -chdir=terraform destroy
