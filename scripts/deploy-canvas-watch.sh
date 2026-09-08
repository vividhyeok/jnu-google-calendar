#!/usr/bin/env bash
set -euo pipefail
set +x

PROJECT="${1:-${PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}}"
REGION="${2:-${REGION:-asia-northeast3}}"
[[ -n "$PROJECT" && "$PROJECT" != "(unset)" ]] || {
  echo "Project ID is required. Usage: bash scripts/deploy-canvas-watch.sh PROJECT_ID [REGION]" >&2
  exit 1
}
[[ "$PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || { echo "Invalid project ID" >&2; exit 1; }
[[ "$REGION" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || { echo "Invalid region" >&2; exit 1; }

JOB="${CANVAS_JOB:-jnu-canvas-watch}"
SCHEDULER="${CANVAS_SCHEDULER:-jnu-canvas-watch}"
RUNTIME_SA="${RUNTIME_SA:-jnu-calendar@${PROJECT}.iam.gserviceaccount.com}"
SCHEDULER_SA="${SCHEDULER_SA:-jnu-scheduler@${PROJECT}.iam.gserviceaccount.com}"
BUCKET="${CANVAS_STATE_BUCKET:-${PROJECT}-canvas-watch-state}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/jnu-calendar:canvas-watch-$(date +%Y%m%d%H%M%S)"

# The Canvas watcher reuses service accounts created by scripts/deploy.sh.
for account in "$RUNTIME_SA" "$SCHEDULER_SA"; do
  gcloud iam service-accounts describe "$account" --project="$PROJECT" >/dev/null 2>&1 || {
    echo "Missing service account: $account" >&2
    echo "Run the timetable setup first: bash scripts/deploy.sh $PROJECT $REGION" >&2
    exit 1
  }
done

ensure_secret() {
  local name="$1" prompt="$2" value
  if ! gcloud secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    read -r -s -p "$prompt (input hidden): " value
    printf '\n'
    [[ -n "$value" ]] || { echo "$prompt is required" >&2; exit 1; }
    gcloud secrets create "$name" --project="$PROJECT" --replication-policy=automatic >/dev/null
    printf '%s' "$value" | gcloud secrets versions add "$name" --project="$PROJECT" --data-file=- >/dev/null
    unset value
  fi
  gcloud secrets add-iam-policy-binding "$name" \
    --project="$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

echo "Canvas secret input is hidden and is not stored in shell history."
ensure_secret jnu-canvas-api-token CANVAS_API_TOKEN
ensure_secret jnu-canvas-ics-url CANVAS_ICS_URL

if ! gcloud secrets describe jnu-discord-webhook --project="$PROJECT" >/dev/null 2>&1; then
  echo "Missing Discord webhook secret: jnu-discord-webhook" >&2
  echo "The Canvas watcher sends notifications through Discord." >&2
  echo "Rerun: bash scripts/deploy.sh $PROJECT $REGION" >&2
  echo "and answer y to 'Enable Discord notifications?', then run this script again." >&2
  exit 1
fi
gcloud secrets add-iam-policy-binding jnu-discord-webhook \
  --project="$PROJECT" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" >/dev/null 2>&1 || \
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT" --location="$REGION" --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectUser" \
  --quiet >/dev/null

gcloud builds submit . --project="$PROJECT" --tag="$IMAGE"

if gcloud run jobs describe "$JOB" --project="$PROJECT" --region="$REGION" >/dev/null 2>&1; then
  ACTION=update
else
  ACTION=create
fi

gcloud run jobs "$ACTION" "$JOB" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --service-account="$RUNTIME_SA" \
  --command=node \
  --args=dist/canvasWatchIndex.js \
  --set-env-vars="CANVAS_STATE_BUCKET=${BUCKET}" \
  --set-secrets="CANVAS_API_TOKEN=jnu-canvas-api-token:latest,CANVAS_ICS_URL=jnu-canvas-ics-url:latest,DISCORD_WEBHOOK_URL=jnu-discord-webhook:latest" \
  --max-retries=0 \
  --task-timeout=5m \
  --quiet

gcloud run jobs add-iam-policy-binding "$JOB" \
  --project="$PROJECT" \
  --region="$REGION" \
  --member="serviceAccount:${SCHEDULER_SA}" \
  --role="roles/run.invoker" \
  --quiet >/dev/null

# Establish the initial baseline and verify Canvas API/ICS/Storage before enabling automation.
gcloud run jobs execute "$JOB" \
  --project="$PROJECT" \
  --region="$REGION" \
  --wait

# Run 4x/day. The watcher itself guarantees at most one D-0..D-3 reminder summary per KST day.
URI="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT}/jobs/${JOB}:run"
if gcloud scheduler jobs describe "$SCHEDULER" --project="$PROJECT" --location="$REGION" >/dev/null 2>&1; then
  SCHED_ACTION=update
else
  SCHED_ACTION=create
fi

gcloud scheduler jobs "$SCHED_ACTION" http "$SCHEDULER" \
  --project="$PROJECT" \
  --location="$REGION" \
  --schedule="17 8,12,16,20 * * *" \
  --time-zone="Asia/Seoul" \
  --uri="$URI" \
  --http-method=POST \
  --oauth-service-account-email="$SCHEDULER_SA" \
  --oauth-token-scope="https://www.googleapis.com/auth/cloud-platform" \
  --quiet

echo "Canvas watcher deployed and scheduled: ${JOB}"
echo "State bucket: gs://${BUCKET}"
