# Configs are passed explicitly (not via `doppler setup`) so *-prod can only touch prd.
DOPPLER_PROJECT     ?= apportal-frontend
DOPPLER_DEV_CONFIG  ?= dev
DOPPLER_PROD_CONFIG ?= prd

DOPPLER_DEV  := doppler run --project $(DOPPLER_PROJECT) --config $(DOPPLER_DEV_CONFIG) --
DOPPLER_PROD := doppler run --project $(DOPPLER_PROJECT) --config $(DOPPLER_PROD_CONFIG) --

.PHONY: start-dev build-prod start-prod lint format

start-dev:
	$(DOPPLER_DEV) npm run dev

# NEXT_PUBLIC_* vars are inlined at build time, so the build needs prd secrets too.
build-prod:
	$(DOPPLER_PROD) npm run build

start-prod: build-prod
	$(DOPPLER_PROD) npm run start

lint:
	npx eslint --fix .

format:
	npx prettier --write .
