SHELL := /bin/bash

.DEFAULT_GOAL := help

COMPOSE_FILE := compose.yml
PROJECT_NAME := devbox
DOCKER_CFG := $(CURDIR)/.docker

.PHONY: help
help:
	@echo "DevBox – available targets:"
	@echo "  init        Install deps on WSL/Ubuntu (mkcert, compose)"
	@echo "  bootstrap   Install mkcert and generate TLS certs"
	@echo "  up          Start all services"
	@echo "  up-local    Start with localhost only (no custom domains)"
	@echo "  down        Stop services"
	@echo "  reset       Stop and remove containers & volumes"
	@echo "  logs        Tail logs"
	@echo "  seed        Seed example data"
	@echo "  test        Run API tests"

.PHONY: init
init:
	bash scripts/init.sh

.PHONY: bootstrap
bootstrap:
	bash scripts/bootstrap.sh

.PHONY: up
up: ensure-env ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" up -d --build
	@echo "Visit https://localhost (studio also mapped)"

.PHONY: up-local
up-local: ensure-env ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" up -d --build
	@echo "Visit https://localhost"

.PHONY: down
down: ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" down

.PHONY: reset
reset: ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" down -v --remove-orphans

.PHONY: logs
logs: ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" logs -f --tail=200

.PHONY: seed
seed: ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" exec -T api python -m app.seed || true

.PHONY: test
test: ensure-docker-config
	DOCKER_CONFIG="$(DOCKER_CFG)" docker compose -p "$(PROJECT_NAME)" -f "$(COMPOSE_FILE)" exec -T api pytest -q || true

.PHONY: ensure-env
ensure-env:
	@if [ ! -f .env ]; then \
		if [ -f .env.example ]; then cp .env.example .env; \
		elif [ -f .env.sample ]; then cp .env.sample .env; \
		else echo "No .env.example found. Create one before continuing." && exit 1; fi; \
	fi

.PHONY: ensure-docker-config
ensure-docker-config:
	@mkdir -p "$(DOCKER_CFG)"
	@if [ ! -f "$(DOCKER_CFG)/config.json" ]; then echo '{}' > "$(DOCKER_CFG)/config.json"; fi
