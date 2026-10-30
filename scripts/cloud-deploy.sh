#!/usr/bin/env bash
# Deploys Sparkflow in the cloud to Cloud Run (project sparkflow-ai, region europe-west1).
# Secrets come from Secret Manager: sparkflow-muse-key (MODEL_API_KEY), sparkflow-modal-id and
# sparkflow-modal-secret (MODAL_TOKEN_ID/SECRET). Data (projects, events, screenshots) lives in the
# bucket mounted at /data. One instance at a time: the projects are files and the runs live in memory.
# CLOUD_MIN_INSTANCES=1 keeps it warm (no cold start, ~100 $/month); 0 scales to zero when unused.
set -euo pipefail
PROJECT="${GCP_PROJECT:-sparkflow-ai}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="${CLOUD_SERVICE:-sparkflow}"
BUCKET="${CLOUD_BUCKET:-sparkflow-ai-cloud-data}"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/sparkflow/server:$(git rev-parse --short HEAD)"

# Global builds: a regional one needs a private pool on this project.
gcloud builds submit --project "$PROJECT" --tag "$IMAGE" .
gcloud run deploy "$SERVICE" --project "$PROJECT" --region "$REGION" --image "$IMAGE" \
  --execution-environment gen2 --cpu 2 --memory 4Gi --no-cpu-throttling \
  --min-instances "${CLOUD_MIN_INSTANCES:-0}" --max-instances 1 --concurrency 80 --timeout 3600 --session-affinity \
  --allow-unauthenticated \
  --add-volume name=data,type=cloud-storage,bucket="$BUCKET" --add-volume-mount volume=data,mount-path=/data \
  --set-secrets MODEL_API_KEY=sparkflow-muse-key:latest,MODAL_TOKEN_ID=sparkflow-modal-id:latest,MODAL_TOKEN_SECRET=sparkflow-modal-secret:latest
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format "value(status.url)"
