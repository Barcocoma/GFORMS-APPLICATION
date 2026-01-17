.PHONY: help build up down restart logs clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build Docker images
	docker-compose build

up: ## Start all services
	docker-compose up -d

down: ## Stop all services
	docker-compose down

restart: ## Restart all services
	docker-compose restart

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show backend logs
	docker-compose logs -f backend

logs-frontend: ## Show frontend logs
	docker-compose logs -f frontend

logs-db: ## Show database logs
	docker-compose logs -f db

dev: ## Start in development mode (with hot reload)
	docker-compose -f docker-compose.dev.yml up -d

dev-logs: ## Show development logs
	docker-compose -f docker-compose.dev.yml logs -f

dev-down: ## Stop development services
	docker-compose -f docker-compose.dev.yml down

dev-rebuild: ## Rebuild development containers
	docker-compose -f docker-compose.dev.yml build --no-cache
	docker-compose -f docker-compose.dev.yml up -d

clean: ## Remove all containers, volumes, and images
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v

init-db: ## Initialize database with default users
	docker-compose exec backend python database/init_db.py

shell-backend: ## Open shell in backend container
	docker-compose exec backend bash

shell-db: ## Open MySQL shell
	docker-compose exec db mysql -u root -p gleentforms

rebuild: ## Rebuild and restart all services
	docker-compose build --no-cache
	docker-compose up -d

