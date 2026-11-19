#!/usr/bin/env bash
set -e

# Configuration
PROJECT_ID="central-shade-hn2tx"
SERVICE_NAME="life-reset-shopify-webhook"
REGION="asia-east1"
DATABASE_ID="ai-studio-lifereset-fa0dc91d-56b1-4b07-9d16-6c4304654eab"

echo "=========================================================="
echo "Deploying Dedicated Shopify Webhook Service to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Firestore Database: $DATABASE_ID"
echo "=========================================================="

# 1. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$PROJECT_ID"

# 2. Deploy Cloud Run service from source
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,FIRESTORE_DATABASE_ID=$DATABASE_ID" \
  --set-secrets="SHOPIFY_WEBHOOK_SECRET=SHOPIFY_WEBHOOK_SECRET:latest"

echo ""
echo "Deployment initiated. Retrieve your public service URL from the command output above."
