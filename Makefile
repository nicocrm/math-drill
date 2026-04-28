-include .env
export

FUNCTIONS := api ingest-worker
DIST      := dist/functions
ZIPS      := $(addprefix $(DIST)/,$(addsuffix .zip,$(FUNCTIONS)))

.PHONY: all clean functions build-frontend deploy-frontend deploy terraform

all: functions

# Build frontend for production using Terraform outputs for API URLs.
# Requires: cd terraform && terraform init && terraform apply
build-frontend:
	VITE_CLERK_PUBLISHABLE_KEY=$$(terraform -chdir=terraform output -raw clerk_publishable_key 2>/dev/null) \
	VITE_API_URL=//$$(terraform -chdir=terraform output -raw api_url) \
	npm run build

# Sync built frontend to the Scaleway Object Storage bucket via S3-compatible API.
S3_ENDPOINT := https://s3.fr-par.scw.cloud
deploy-frontend: build-frontend
	$(eval BUCKET := $(shell terraform -chdir=terraform output -raw frontend_bucket))
	@echo "Uploading assets/ with immutable cache headers..."
	aws s3 sync dist/frontend/assets/ s3://$(BUCKET)/assets/ \
		--endpoint-url $(S3_ENDPOINT) \
		--cache-control "public, max-age=31536000, immutable" \
		--delete
	@echo "Uploading root files with short cache TTL..."
	aws s3 sync dist/frontend/ s3://$(BUCKET)/ \
		--endpoint-url $(S3_ENDPOINT) \
		--cache-control "public, max-age=300" \
		--exclude "assets/*" \
		--delete

terraform:
	cd terraform && terraform apply

deploy: functions terraform deploy-frontend

functions: $(ZIPS)

$(DIST)/%.zip: functions/%/handler.ts functions/lib/*.ts packages/core/src/**/*.ts
	@mkdir -p $(DIST)/$*
	npx esbuild $< --bundle --platform=node --target=node22 --format=cjs --outfile=$(DIST)/$*/handler.cjs
	cd $(DIST)/$* && zip -qr ../$(notdir $@) handler.cjs
	@rm -rf $(DIST)/$*

clean:
	rm -rf $(DIST)
