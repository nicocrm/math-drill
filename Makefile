FUNCTIONS := get-exercises get-exercise delete-exercise post-ingest get-ingest-status ingest-worker
DIST      := dist/functions
ZIPS      := $(addprefix $(DIST)/,$(addsuffix .zip,$(FUNCTIONS)))

.PHONY: all clean functions

all: functions

functions: $(ZIPS)

$(DIST)/%.zip: functions/%/handler.ts functions/lib/*.ts packages/core/src/**/*.ts
	@mkdir -p $(DIST)/$*
	npx esbuild $< --bundle --platform=node --target=node22 --format=cjs --outfile=$(DIST)/$*/handler.cjs
	cd $(DIST)/$* && zip -qr ../$(notdir $@) handler.cjs
	@rm -rf $(DIST)/$*

clean:
	rm -rf $(DIST)
