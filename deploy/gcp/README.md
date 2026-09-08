# Nasazení na Google Cloud (Cloud Run + Cloud SQL)

Aplikace poběží jako kontejner v **Cloud Run** (HTTPS zdarma, škáluje na nulu, platíte jen za provoz) s databází **Cloud SQL PostgreSQL** (automatické denní zálohy). Výpisy z Fio stahuje **Cloud Scheduler** každou hodinu.

Orientační cena: Cloud SQL `db-f1-micro` cca 8–10 USD/měsíc, Cloud Run při běžném používání malým týmem obvykle zdarma nebo do 2 USD, Cloud Scheduler zdarma (3 úlohy v ceně).

## 1. Založení projektu

1. Přihlaste se na <https://console.cloud.google.com>.
2. Vlevo nahoře *Vybrat projekt → Nový projekt*, název např. `alkrino-nabidky`. Zapamatujte si **ID projektu** (např. `alkrino-nabidky` nebo `alkrino-nabidky-123456`).
3. V menu *Fakturace* připojte k projektu platební účet (bez něj nejde Cloud SQL vytvořit).

## 2. Nasazení z Cloud Shellu (nic neinstalujete)

1. V konzoli vpravo nahoře klikněte na ikonu **Aktivovat Cloud Shell** (terminál v prohlížeči, gcloud je předinstalovaný).
2. V terminálu spusťte:

```bash
git clone https://github.com/Vojcl17/Nab-dky-.git nabidky
cd nabidky
git checkout claude/trader-app-offers-invoices-f6gb6g   # nebo main po sloučení
PROJECT_ID=alkrino-nabidky ./deploy/gcp/deploy.sh
```

Skript se při prvním spuštění zeptá na autorizaci (klikněte *Authorize*). Vytvoří databázi (5–10 minut), tajné klíče, sestaví image, nasadí aplikaci a nastaví hodinové stahování z Fio. Na konci vypíše adresu typu `https://nabidky-xxxxxxxx-ey.a.run.app`.

3. Otevřete adresu, vytvořte účet administrátora a v **Nastavení** doplňte bankovní účet a Fio token.

Skript můžete spouštět opakovaně: znovu sestaví a nasadí aktuální verzi kódu, databázi a tajemství zachová.

## 3. Aktualizace aplikace

```bash
cd nabidky && git pull
PROJECT_ID=alkrino-nabidky ./deploy/gcp/deploy.sh
```

## 4. Vlastní subdoména (volitelné, kdykoli později)

1. V konzoli otevřete *Cloud Run → služba nabidky → Integrace / Správa vlastních domén* (nebo `gcloud beta run domain-mappings create --service nabidky --domain nabidky.alkrino.cz --region europe-west3`).
2. U registrátora domény přidejte DNS záznam, který Google zobrazí (CNAME `nabidky` → `ghs.googlehosted.com.`). Certifikát se vystaví automaticky do cca hodiny.
3. Nastavte novou adresu do aplikace (používá se v odkazech pozvánek):

```bash
gcloud run services update nabidky --region europe-west3 --update-env-vars APP_URL=https://nabidky.alkrino.cz
```

Případně spouštějte skript s `APP_URL=https://nabidky.alkrino.cz PROJECT_ID=... ./deploy/gcp/deploy.sh`.

## 5. Zálohy a obnova

Cloud SQL zálohuje denně ve 2:00, uchovává 7 záloh. Ruční záloha: *SQL → instance → Zálohy → Vytvořit zálohu*. Export do souboru:

```bash
gcloud sql export sql nabidky-db gs://<bucket>/nabidky.sql --database=nabidky
```

## 6. Užitečné příkazy

```bash
# logy aplikace
gcloud run services logs read nabidky --region europe-west3 --limit 100
# ruční spuštění stažení výpisů z Fio
gcloud scheduler jobs run nabidky-fio-sync --location europe-west3
# zobrazení tajemství (např. CRON_SECRET)
gcloud secrets versions access latest --secret nabidky-cron-secret
```

## Co skript vytvoří

| Zdroj | Název | Poznámka |
| --- | --- | --- |
| Cloud SQL | `nabidky-db` | PostgreSQL 16, db-f1-micro, 10 GB, ochrana proti smazání |
| Secret Manager | `nabidky-database-url`, `nabidky-auth-secret`, `nabidky-cron-secret`, `nabidky-db-password` | hesla generuje náhodně |
| Cloud Run | `nabidky` | 512 MB RAM, 0–3 instance, veřejný přístup (aplikace má vlastní přihlášení) |
| Cloud Scheduler | `nabidky-fio-sync` | každou hodinu v :15, volá `/api/cron/fio` |
