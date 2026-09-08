#!/usr/bin/env bash
# Nasazení aplikace na Google Cloud Run + Cloud SQL (PostgreSQL).
# Skript je idempotentní – lze ho spouštět opakovaně (aktualizuje aplikaci).
#
# Použití (nejlépe v Google Cloud Shell, kde je gcloud předinstalovaný):
#   PROJECT_ID=muj-projekt ./deploy/gcp/deploy.sh
#
# Volitelné proměnné:
#   REGION      (výchozí europe-west3 – Frankfurt)
#   SERVICE     název Cloud Run služby (výchozí nabidky)
#   DB_INSTANCE název Cloud SQL instance (výchozí nabidky-db)
#   DB_TIER     výkon DB (výchozí db-f1-micro – nejlevnější, stačí pro malý tým)
#   APP_URL     veřejná adresa (vyplní se automaticky adresou z Cloud Run; nastavte při vlastní doméně)
set -euo pipefail

: "${PROJECT_ID:?Nastavte PROJECT_ID, např. PROJECT_ID=alkrino-nabidky ./deploy/gcp/deploy.sh}"
REGION="${REGION:-europe-west3}"
SERVICE="${SERVICE:-nabidky}"
DB_INSTANCE="${DB_INSTANCE:-nabidky-db}"
DB_TIER="${DB_TIER:-db-f1-micro}"
DB_NAME="nabidky"
DB_USER="nabidky"
SCHEDULER_JOB="${SERVICE}-fio-sync"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

log "Zapínám potřebné služby (může trvat minutu)"
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com cloudscheduler.googleapis.com >/dev/null

# ---------------------------------------------------------------- Cloud SQL
if ! gcloud sql instances describe "$DB_INSTANCE" >/dev/null 2>&1; then
  log "Vytvářím Cloud SQL instanci $DB_INSTANCE (PostgreSQL 16, $DB_TIER) – trvá 5–10 minut"
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_16 --edition=ENTERPRISE --tier="$DB_TIER" \
    --region="$REGION" --availability-type=zonal \
    --storage-size=10 --storage-auto-increase \
    --backup-start-time=02:00 --retained-backups-count=7 \
    --deletion-protection
else
  log "Cloud SQL instance $DB_INSTANCE už existuje"
fi
CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE" --format='value(connectionName)')

if ! gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE" >/dev/null 2>&1; then
  log "Vytvářím databázi $DB_NAME"
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"
fi

# ---------------------------------------------------------------- tajemství
ensure_secret() { # název, hodnota
  if gcloud secrets describe "$1" >/dev/null 2>&1; then
    return 0
  fi
  log "Vytvářím tajemství $1"
  printf '%s' "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic >/dev/null
}
random() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-"$1"; }

if ! gcloud secrets describe "${SERVICE}-db-password" >/dev/null 2>&1; then
  DB_PASSWORD=$(random 32)
  ensure_secret "${SERVICE}-db-password" "$DB_PASSWORD"
  log "Vytvářím DB uživatele $DB_USER"
  gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASSWORD" >/dev/null 2>&1 \
    || gcloud sql users set-password "$DB_USER" --instance="$DB_INSTANCE" --password="$DB_PASSWORD"
else
  DB_PASSWORD=$(gcloud secrets versions access latest --secret="${SERVICE}-db-password")
fi

ensure_secret "${SERVICE}-auth-secret" "$(random 48)"
ensure_secret "${SERVICE}-cron-secret" "$(random 32)"
ensure_secret "${SERVICE}-database-url" \
  "postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}&schema=public"

log "Přiděluji oprávnění service accountu Cloud Run"
for role in roles/cloudsql.client roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:${RUN_SA}" --role="$role" --condition=None >/dev/null
done

# ---------------------------------------------------------------- Cloud Run
log "Sestavuji image a nasazuji na Cloud Run (první build trvá 5–8 minut)"
APP_URL_ARG="${APP_URL:-}"
if [ -z "$APP_URL_ARG" ]; then
  APP_URL_ARG=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)' 2>/dev/null || true)
fi
gcloud run deploy "$SERVICE" \
  --source . --region="$REGION" --platform=managed --allow-unauthenticated \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --set-secrets="DATABASE_URL=${SERVICE}-database-url:latest,AUTH_SECRET=${SERVICE}-auth-secret:latest,CRON_SECRET=${SERVICE}-cron-secret:latest" \
  --set-env-vars="APP_URL=${APP_URL_ARG:-http://localhost}" \
  --memory=512Mi --cpu=1 --min-instances=0 --max-instances=3 --timeout=120

SERVICE_URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
if [ -z "${APP_URL:-}" ] && [ "$APP_URL_ARG" != "$SERVICE_URL" ]; then
  log "Nastavuji APP_URL=$SERVICE_URL"
  gcloud run services update "$SERVICE" --region="$REGION" --update-env-vars="APP_URL=${SERVICE_URL}" >/dev/null
fi

# ---------------------------------------------------------------- Fio cron
CRON_SECRET=$(gcloud secrets versions access latest --secret="${SERVICE}-cron-secret")
if gcloud scheduler jobs describe "$SCHEDULER_JOB" --location="$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$SCHEDULER_JOB" --location="$REGION" \
    --uri="${SERVICE_URL}/api/cron/fio" --http-method=GET \
    --update-headers="Authorization=Bearer ${CRON_SECRET}" >/dev/null
else
  log "Vytvářím Cloud Scheduler úlohu pro stahování výpisů z Fio (každou hodinu)"
  gcloud scheduler jobs create http "$SCHEDULER_JOB" --location="$REGION" \
    --schedule="15 * * * *" --time-zone="Europe/Prague" \
    --uri="${SERVICE_URL}/api/cron/fio" --http-method=GET \
    --headers="Authorization=Bearer ${CRON_SECRET}" \
    --attempt-deadline=120s >/dev/null
fi

log "Hotovo"
echo
echo "Aplikace běží na: ${SERVICE_URL}"
echo "Při prvním otevření vytvořte účet administrátora a doplňte Nastavení (bankovní účet, Fio token)."
echo "Výpisy z Fio se stahují automaticky každou hodinu (Cloud Scheduler: ${SCHEDULER_JOB})."
