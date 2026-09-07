.PHONY: help dev dev-build api web test test-api test-api-cov test-web lint lint-api lint-api-fix lint-web migrate migrate-down migrate-history seed build install clean logs ps

# Default target
help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# Development
dev: ## Start full stack (docker compose)
	docker compose up

dev-build: ## Build and start full stack
	docker compose up --build

api: ## Run API server locally (no Docker)
	cd apps/api && uvicorn main:app --reload --port 8000

web: ## Run frontend dev server locally (no Docker)
	cd apps/web && npm run dev

# Database
migrate: ## Run Alembic migrations
	cd apps/api && alembic upgrade head

migrate-down: ## Rollback one migration
	cd apps/api && alembic downgrade -1

migrate-history: ## Show migration history
	cd apps/api && alembic history

seed: ## Seed development data (requires --user-id)
	cd apps/api && python seed.py $(ARGS)

# Testing
test: test-api test-web ## Run all tests

test-api: ## Run backend tests
	cd apps/api && pytest -v --tb=short

test-api-cov: ## Run backend tests with coverage
	cd apps/api && pytest --cov=. --cov-report=term-missing

test-web: ## Run frontend end-to-end tests (Playwright)
	cd apps/web && npx playwright test

# Linting
lint: lint-api lint-web ## Run all linters

lint-api: ## Lint backend (ruff)
	cd apps/api && ruff check . && ruff format --check .

lint-api-fix: ## Auto-fix backend lint issues
	cd apps/api && ruff check --fix . && ruff format .

lint-web: ## Type-check and lint frontend
	cd apps/web && npx tsc --noEmit && npm run lint

# Building
build: ## Build frontend for production
	cd apps/web && npm run build

# Setup
install: ## Install all dependencies
	cd apps/api && pip install -r requirements.txt
	cd apps/web && npm install

# Cleanup
clean: ## Stop containers and remove volumes
	docker compose down -v

logs: ## Tail API logs
	docker compose logs -f api

ps: ## Show running services
	docker compose ps
