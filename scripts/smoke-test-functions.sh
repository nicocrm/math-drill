#!/usr/bin/env bash
# Smoke test the unified api serverless function using curl.
# Run from project root. API_URL defaults to terraform output; override with env var.
#
# Prerequisites:
#   - terraform output (or set API_URL)
#   - Function code must be deployed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

get_tf_output() {
  (cd "$TERRAFORM_DIR" && terraform output -raw "$1" 2>/dev/null) || echo ""
}

# Resolve API URL: env var overrides terraform output
RAW_API_URL="${API_URL:-$(get_tf_output api_url)}"

# Ensure we have a URL with https scheme
add_https() {
  local u="$1"
  [[ -z "$u" ]] && return
  [[ "$u" =~ ^https?:// ]] || u="https://${u}"
  echo "$u"
}

API_URL=$(add_https "$RAW_API_URL")

if [[ -z "$API_URL" || "$API_URL" == "https://" ]]; then
  echo "Error: No API URL. Run 'cd terraform && terraform output api_url' or set API_URL."
  exit 1
fi

FAILED=0
CURL_OPTS=(-s -w "%{http_code}" -o /tmp/smoke_body.json --connect-timeout 15 --max-time 30)

run_test() {
  local name="$1"
  local expected_code="$2"
  shift 2
  local res
  res=$(curl "${CURL_OPTS[@]}" "$@") || true
  if [[ "$res" == "000" ]]; then
    echo "  ✗ $name (connection failed - DNS/network or function not deployed)"
    FAILED=$((FAILED + 1))
  elif [[ "$res" == "$expected_code" ]]; then
    echo "  ✓ $name (HTTP $res)"
  else
    echo "  ✗ $name (expected $expected_code, got $res)"
    [[ -f /tmp/smoke_body.json ]] && head -c 200 /tmp/smoke_body.json
    echo ""
    FAILED=$((FAILED + 1))
  fi
}

echo "Smoke testing unified api function at ${API_URL}..."
echo ""

echo "1. GET exercises (list)"
run_test "GET /api/exercises" 200 "${API_URL}/api/exercises"

echo ""
echo "2. GET exercise by id (expect 404)"
run_test "GET /api/exercises/nonexistent-id" 404 "${API_URL}/api/exercises/nonexistent-id-12345"

echo ""
echo "3. GET ingest status (expect 404 - job not found)"
run_test "GET /api/ingest/status?jobId=..." 404 "${API_URL}/api/ingest/status?jobId=smoke-test-fake-job-id"

echo ""
echo "4. POST ingest without auth (expect 401)"
run_test "POST /api/ingest" 401 -X POST "${API_URL}/api/ingest" \
  -H "Content-Type: application/json" \
  -d '{"pdf":"dGVzdA=="}'

echo ""
echo "5. DELETE exercise without auth (expect 401)"
run_test "DELETE /api/exercises/some-id" 401 -X DELETE "${API_URL}/api/exercises/some-id"

echo ""
echo "6. Unknown route (expect 404)"
run_test "GET /api/unknown" 404 "${API_URL}/api/unknown"

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo "All smoke tests passed."
  exit 0
else
  echo "$FAILED test(s) failed."
  exit 1
fi
