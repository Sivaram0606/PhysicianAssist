.PHONY: run deploy destroy

PYTHON := $(shell if [ -x .venv/bin/python ]; then echo .venv/bin/python; else echo python3; fi)

run:
	@trap 'kill 0' INT TERM; \
		PORT=8001 $(PYTHON) main.py & \
		(cd frontend && npm run dev) & \
		wait

deploy:
	terraform -chdir=terraform init -reconfigure -upgrade=false
	terraform -chdir=terraform apply

destroy:
	terraform -chdir=terraform destroy
