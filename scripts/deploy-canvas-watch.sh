#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT:-jnu-calendar-507911}"
REGION="${REGION:-asia-northeast3}"
JOB="${CANVAS_JOB:-jnu-canvas-watch}"
SCHEDULER="${CANVAS_SCHEDULER:-jnu-canvas-watch}"
RUNTIME_SA="${RUNTIME_SA:-jnu-calendar@${PROJECT}.iam.gserviceaccount.com}"
SCHEDULER_SA="${SCHEDULER_SA:-jnu-scheduler@${PROJECT}.iam.gserviceaccount.com}"
BUCKET="${CANVAS_STATE_BUCKET:-${PROJECT}-canvas-watch-state}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/jnu-calendar:canvas-watch-$(date +%Y%m%d%H%M%S)"

for secret in jnu-canvas-api-token jnu-canvas-ics-url jnu-discord-webhook; do
  gcloud secrets describe "$secret" --project="$PROJECT" >/dev/null
  gcloud secrets add-iam-policy-binding "$secret" \
    --project="$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
done

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

echo "Canvas watcher deployed: ${JOB}"
echo "State bucket: gs://${BUCKET}"
