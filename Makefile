FUNCTIONS := get-exercises get-exercise delete-exercise post-ingest get-ingest-status ingest-worker
DIST      := dist/functions
ZIPS      := $(addprefix $(DIST)/,$(addsuffix .zip,$(FUNCTIONS)))

.PHONY: all clean functions build-frontend

all: functions

# Build frontend for production using Terraform outputs for API URLs.
# Requires: cd terraform && terraform init && terraform apply
build-frontend:
	VITE_GET_EXERCISES_URL=$$(terraform -chdir=terraform output -raw get_exercises_url) \
	VITE_GET_EXERCISE_URL=$$(terraform -chdir=terraform output -raw get_exercise_url) \
	VITE_DELETE_EXERCISE_URL=$$(terraform -chdir=terraform output -raw delete_exercise_url) \
	VITE_POST_INGEST_URL=$$(terraform -chdir=terraform output -raw post_ingest_url) \
	VITE_GET_INGEST_STATUS_URL=$$(terraform -chdir=terraform output -raw get_ingest_status_url) \
	npm run build

functions: $(ZIPS)

$(DIST)/%.zip: functions/%/handler.ts functions/lib/*.ts packages/core/src/**/*.ts
	@mkdir -p $(DIST)/$*
	npx esbuild $< --bundle --platform=node --target=node22 --format=cjs --outfile=$(DIST)/$*/handler.cjs
	cd $(DIST)/$* && zip -qr ../$(notdir $@) handler.cjs
	@rm -rf $(DIST)/$*

clean:
	rm -rf $(DIST)
