-include .env
export

FUNCTIONS := get-exercises get-exercise delete-exercise post-ingest get-ingest-status ingest-worker
DIST      := dist/functions
ZIPS      := $(addprefix $(DIST)/,$(addsuffix .zip,$(FUNCTIONS)))

.PHONY: all clean functions build-frontend deploy-frontend deploy

all: functions

# Build frontend for production using Terraform outputs for API URLs.
# Requires: cd terraform && terraform init && terraform apply
build-frontend:
	VITE_CLERK_PUBLISHABLE_KEY=$$(terraform -chdir=terraform output -raw clerk_publishable_key 2>/dev/null) \
	VITE_GET_EXERCISES_URL=$$(terraform -chdir=terraform output -raw get_exercises_url) \
	VITE_GET_EXERCISE_URL=$$(terraform -chdir=terraform output -raw get_exercise_url) \
	VITE_DELETE_EXERCISE_URL=$$(terraform -chdir=terraform output -raw delete_exercise_url) \
	VITE_POST_INGEST_URL=$$(terraform -chdir=terraform output -raw post_ingest_url) \
	VITE_GET_INGEST_STATUS_URL=$$(terraform -chdir=terraform output -raw get_ingest_status_url) \
	npm run build

# Sync built frontend to the Scaleway Object Storage bucket via S3-compatible API.
S3_ENDPOINT := https://s3.fr-par.scw.cloud
deploy-frontend: build-frontend
	$(eval BUCKET := $(shell terraform -chdir=terraform output -raw frontend_bucket))
	@echo "Uploading assets/ with immutable cache headers..."
	aws s3 sync dist/assets/ s3://$(BUCKET)/assets/ \
		--endpoint-url $(S3_ENDPOINT) \
		--cache-control "public, max-age=31536000, immutable" \
		--delete
	@echo "Uploading root files with short cache TTL..."
	aws s3 sync dist/ s3://$(BUCKET)/ \
		--endpoint-url $(S3_ENDPOINT) \
		--cache-control "public, max-age=300" \
		--exclude "assets/*" \
		--delete

deploy: functions deploy-frontend

functions: $(ZIPS)

$(DIST)/%.zip: functions/%/handler.ts functions/lib/*.ts packages/core/src/**/*.ts
	@mkdir -p $(DIST)/$*
	npx esbuild $< --bundle --platform=node --target=node22 --format=cjs --outfile=$(DIST)/$*/handler.cjs
	cd $(DIST)/$* && zip -qr ../$(notdir $@) handler.cjs
	@rm -rf $(DIST)/$*

clean:
	rm -rf $(DIST)
