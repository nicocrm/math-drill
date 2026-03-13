#!/usr/bin/env bash
# Smoke test deployed Scaleway serverless functions using curl.
# Run from project root. URLs default to terraform outputs; override with env vars.
#
# Prerequisites:
#   - terraform output (or set GET_EXERCISES_URL, etc.)
#   - Function code must be deployed (scw function deploy) — Terraform alone
#     creates resources; DNS/endpoints may not resolve until code is deployed.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

get_tf_output() {
  (cd "$TERRAFORM_DIR" && terraform output -raw "$1" 2>/dev/null) || echo ""
}

# Resolve URLs: env vars override terraform outputs
GET_EXERCISES_URL="${GET_EXERCISES_URL:-$(get_tf_output get_exercises_url)}"
GET_EXERCISE_URL="${GET_EXERCISE_URL:-$(get_tf_output get_exercise_url)}"
DELETE_EXERCISE_URL="${DELETE_EXERCISE_URL:-$(get_tf_output delete_exercise_url)}"
POST_INGEST_URL="${POST_INGEST_URL:-$(get_tf_output post_ingest_url)}"
GET_INGEST_STATUS_URL="${GET_INGEST_STATUS_URL:-$(get_tf_output get_ingest_status_url)}"

BASE_URL="${BASE_URL:-}"  # Optional: e.g. https://api.example.com
if [[ -n "$BASE_URL" ]]; then
  GET_EXERCISES_URL="${BASE_URL}/exercises"
  GET_EXERCISE_URL="${BASE_URL}/exercises"
  DELETE_EXERCISE_URL="${BASE_URL}/exercises"
  POST_INGEST_URL="${BASE_URL}/ingest"
  GET_INGEST_STATUS_URL="${BASE_URL}/ingest/status"
fi

# Ensure we have hostnames (add https if only hostname)
add_https() {
  local u="$1"
  [[ -z "$u" ]] && return
  [[ "$u" =~ ^https?:// ]] || u="https://${u}"
  echo "$u"
}

GET_EXERCISES_URL=$(add_https "$GET_EXERCISES_URL")
GET_EXERCISE_URL=$(add_https "$GET_EXERCISE_URL")
DELETE_EXERCISE_URL=$(add_https "$DELETE_EXERCISE_URL")
POST_INGEST_URL=$(add_https "$POST_INGEST_URL")
GET_INGEST_STATUS_URL=$(add_https "$GET_INGEST_STATUS_URL")

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

echo "Smoke testing serverless functions..."
echo ""

if [[ -z "$GET_EXERCISES_URL" || "$GET_EXERCISES_URL" == "https://" ]]; then
  echo "Error: No URLs. Run 'cd terraform && terraform output' or set GET_EXERCISES_URL etc."
  exit 1
fi

echo "1. GET exercises (list)"
run_test "GET /" 200 "$GET_EXERCISES_URL/"

echo ""
echo "2. GET exercise by id (expect 404)"
run_test "GET /nonexistent-id" 404 "${GET_EXERCISE_URL}/nonexistent-id-12345"

echo ""
echo "3. GET ingest status (expect 404 - job not found)"
run_test "GET ?jobId=..." 404 "${GET_INGEST_STATUS_URL}/?jobId=smoke-test-fake-job-id"

echo ""
echo "4. POST ingest without auth (expect 401)"
run_test "POST /" 401 -X POST "${POST_INGEST_URL}/" \
  -H "Content-Type: application/json" \
  -d '{"pdf":"dGVzdA=="}'

echo ""
echo "5. DELETE exercise without auth (expect 401)"
run_test "DELETE /some-id" 401 -X DELETE "${DELETE_EXERCISE_URL}/some-id"

echo ""
if [[ $FAILED -eq 0 ]]; then
  echo "All smoke tests passed."
  exit 0
else
  echo "$FAILED test(s) failed."
  exit 1
fi
