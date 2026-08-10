ROOT_DIR := $(shell dirname $(realpath $(firstword $(MAKEFILE_LIST))))
API_DIR := $(ROOT_DIR)/apps/api
WEB_DIR := $(ROOT_DIR)/apps/web
DB_SCHEMA := $(ROOT_DIR)/packages/db/prisma/schema.prisma
IMAGE_NAME := vendor-management

.PHONY: help dev dev-frontend dev-backend install install-frontend install-backend \
	build build-frontend build-backend \
	db-generate db-migrate db-migrate-create db-migrate-status db-migrate-deploy db-push db-studio \
	docker-build docker-run stop kill-port lint lint-frontend lint-backend \
	typecheck typecheck-frontend typecheck-backend \
	deploy deploy-ensure deploy-vars deploy-up

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Install ──────────────────────────────────────────────────

install: ## Install all workspace dependencies
	cd $(ROOT_DIR) && npm install

install-frontend: ## Install frontend workspace dependencies
	cd $(ROOT_DIR) && npm install --workspace apps/web

install-backend: ## Install backend workspace dependencies
	cd $(ROOT_DIR) && npm install --workspace apps/api

# ── Development ──────────────────────────────────────────────

dev: ## Start the API and frontend development servers
	cd $(ROOT_DIR) && npm run dev

dev-frontend: ## Start the frontend development server on port 5173
	cd $(ROOT_DIR) && npm run dev --workspace apps/web

dev-backend: kill-port ## Start the API development server on port 3001
	cd $(ROOT_DIR) && npm run dev --workspace apps/api

# ── Build ────────────────────────────────────────────────────

build: ## Build all workspaces for production
	cd $(ROOT_DIR) && npm run build

build-frontend: ## Build the React frontend for production
	cd $(ROOT_DIR) && npm run build --workspace apps/web

build-backend: ## Build the Express API for production
	cd $(ROOT_DIR) && npm run build --workspace apps/api

# ── Database ─────────────────────────────────────────────────

db-generate: ## Generate the Prisma client
	cd $(ROOT_DIR) && npm run db:generate

db-migrate: ## Create and apply a migration; use NAME=add-vendors
	@test -n "$(NAME)" || (echo "Set NAME, for example: make db-migrate NAME=add-vendors"; exit 1)
	cd $(ROOT_DIR) && npx prisma migrate dev --schema=$(DB_SCHEMA) --name $(NAME)

db-migrate-create: ## Create a migration without applying it; use NAME=add-vendors
	@test -n "$(NAME)" || (echo "Set NAME, for example: make db-migrate-create NAME=add-vendors"; exit 1)
	cd $(ROOT_DIR) && npx prisma migrate dev --schema=$(DB_SCHEMA) --create-only --name $(NAME)

db-migrate-status: ## Show Prisma migration status
	cd $(ROOT_DIR) && npx prisma migrate status --schema=$(DB_SCHEMA)

db-migrate-deploy: ## Apply existing migration files to the database; does not create new ones
	cd $(ROOT_DIR) && npx prisma migrate deploy --schema=$(DB_SCHEMA)

db-push: ## Block direct schema pushes; use db-migrate instead
	@echo "Blocked: db push bypasses reviewed migration files. Use make db-migrate NAME=your-change."
	@exit 1

db-studio: ## Open Prisma Studio
	cd $(ROOT_DIR) && npx prisma studio --schema=$(DB_SCHEMA)


# ── Type Checking and Tests ───────────────────────────────────

typecheck: ## Type-check all workspaces
	cd $(ROOT_DIR) && npm run typecheck

typecheck-frontend: ## Type-check the React frontend
	cd $(ROOT_DIR) && npm run typecheck --workspace apps/web

typecheck-backend: ## Type-check the Express API
	cd $(ROOT_DIR) && npm run typecheck --workspace apps/api

lint: ## Run available lint checks
	@echo "No lint command is configured yet."

lint-frontend: ## Run available frontend lint checks
	@echo "No frontend lint command is configured yet."

lint-backend: ## Run available backend lint checks
	@echo "No backend lint command is configured yet."

# ── Docker ───────────────────────────────────────────────────

docker-build: ## Build the Railway Docker image
	cd $(ROOT_DIR) && docker build -t $(IMAGE_NAME) .

docker-run: ## Run the production Docker image on port 3001
	cd $(ROOT_DIR) && docker run --rm -p 3001:3001 --env-file .env -e NODE_ENV=production $(IMAGE_NAME)

# ── Utilities ─────────────────────────────────────────────────

stop: ## Stop processes on ports 3001 and 5173
	@echo "Stopping API on port 3001..."
	@lsof -ti :3001 | xargs kill 2>/dev/null || true
	@echo "Stopping frontend on port 5173..."
	@lsof -ti :5173 | xargs kill 2>/dev/null || true
	@echo "Done."

kill-port: ## Stop any process on API port 3001
	@lsof -ti :3001 | xargs kill 2>/dev/null || true

# ── Railway Deployment ───────────────────────────────────────

deploy: deploy-ensure deploy-vars deploy-up ## Link Railway, upload variables, and deploy

deploy-ensure: ## Create or link a Railway project and service
	@if ! railway status >/dev/null 2>&1; then \
		echo "No Railway project is linked. Starting Railway setup..."; \
		railway init; \
	fi
	@if railway service list 2>&1 | grep -q "No services"; then \
		echo "No service found. Creating one..."; \
		railway add --service VendorManagement --variables "NODE_ENV=production" --json; \
		railway service link VendorManagement; \
	else \
		echo "Railway service already exists."; \
	fi

deploy-vars: ## Upload root .env values to the linked Railway service
	@echo "Uploading local environment values to Railway..."
	@cd $(ROOT_DIR) && grep -v '^#' .env | grep -v '^$$' | awk -F= '{ \
		key=$$1; \
		val=substr($$0, index($$0, "=") + 1); \
		gsub(/^"|"$$/, "", val); \
		gsub(/^'"'"'|'"'"'$$/, "", val); \
		print key "=" val \
	}' > /tmp/vendor-management-railway-vars.env
	cd $(ROOT_DIR) && railway variables set $$(tr '\n' ' ' < /tmp/vendor-management-railway-vars.env)
	@rm -f /tmp/vendor-management-railway-vars.env
	cd $(ROOT_DIR) && railway variables set NODE_ENV=production

deploy-up: ## Deploy the current branch to Railway
	cd $(ROOT_DIR) && railway up
