.PHONY: db-up db-down migrate seed dev build test typecheck

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

migrate:
	pnpm db:migrate

seed:
	pnpm db:seed

dev:
	pnpm dev

build:
	pnpm build

test:
	pnpm test

typecheck:
	pnpm typecheck
