# Nabídky a faktury

Webová aplikace pro obchodníka: **ceník**, **nabídky** se stavy a slevami, **faktury** (běžné, zálohové, daňové doklady k přijaté platbě, dobropisy), export do **PDF** a **ISDOC**, načítání subjektů z **ARES**, stahování výpisů z **Fio banky** s automatickým párováním plateb a **přihlášení s rolemi**.

## Funkce

- **Ceník** – položky s kódem, měrnou jednotkou, cenou v CZK (volitelně i v EUR) a sazbou DPH (21/12/0 %).
- **Subjekty** – odběratelé; stačí zadat IČO a údaje se doplní z ARES.
- **Nabídky** – položky z ceníku nebo volné, sleva na položku (%) i na celý doklad (% nebo částka), stavy *rozpracovaná → odeslaná → přijatá / odmítnutá / vypršela → vyfakturovaná*, duplikování, PDF.
- **Faktury** – vystavení z nabídky nebo ručně, číselné řady, variabilní symbol, DUZP, splatnost, QR platba na PDF, zaokrouhlení, evidence úhrad.
  - **Zálohová faktura** → po úhradě **daňový doklad k přijaté platbě** → **konečná faktura** s odpočtem zálohy.
  - **Opravný daňový doklad (dobropis)** k vystavené faktuře.
  - Faktury v **EUR** s kurzem ČNB k datu vystavení (rekapitulace DPH i v CZK).
  - Export **PDF** a **ISDOC 6.0.1** (import do účetních programů – Pohoda, Money, ABRA…).
- **Banka (Fio)** – stažení pohybů přes Fio API, automatické spárování příchozích plateb s fakturami podle variabilního symbolu, ruční párování, endpoint pro pravidelnou synchronizaci.
- **Uživatelé a role** – *administrátor*, *obchodník*, *účetní*, *jen čtení*; pozvánky odkazem, deaktivace, reset hesla.

## Nasazení na Google Cloud

Podrobný návod pro Cloud Run + Cloud SQL včetně skriptu je v [`deploy/gcp/README.md`](deploy/gcp/README.md).

## Nasazení na vlastní server (Docker Compose)

Potřebujete server s Dockerem (VPS, NAS, Coolify, Portainer…).

```bash
git clone <adresa-repozitáře> nabidky
cd nabidky
cp .env.example .env
# upravte .env – minimálně POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -base64 48) a APP_URL
docker compose up -d --build
```

Aplikace poběží na `http://server:3000` (port změníte proměnnou `APP_PORT`). Při prvním otevření vytvoříte účet administrátora, poté vyplňte **Nastavení** (údaje firmy, bankovní účet, číselné řady, Fio token).

Pro provoz na veřejné adrese dejte před aplikaci reverzní proxy s HTTPS (Caddy, Traefik, nginx) a nastavte `APP_URL=https://vase-domena.cz`.

### Proměnné prostředí

| Proměnná | Význam |
| --- | --- |
| `POSTGRES_PASSWORD` | heslo k databázi v Compose |
| `DATABASE_URL` | připojení k PostgreSQL (Compose ji sestaví automaticky) |
| `AUTH_SECRET` | tajný klíč pro podepisování session cookies (min. 32 znaků) |
| `APP_URL` | veřejná adresa aplikace, používá se v odkazech pozvánek |
| `APP_PORT` | port publikovaný na hostiteli (výchozí 3000) |
| `CRON_SECRET` | klíč pro `GET /api/cron/fio`; služba `fio-cron` v Compose volá endpoint každou hodinu |

### Fio banka

1. V internetovém bankovnictví Fio: *Nastavení → API → Přidat token* (stačí oprávnění „pouze sledovat“).
2. Token vložte v aplikaci do *Nastavení → Bankovní spojení → Fio API token*.
3. Na stránce **Banka** stáhněte pohyby tlačítkem, nebo nechte běžet službu `fio-cron` (vyžaduje `CRON_SECRET`). Endpoint můžete volat i z vlastního cronu:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://vase-domena.cz/api/cron/fio
```

Příchozí platby se párují podle variabilního symbolu a měny s vystavenými fakturami; po úplné úhradě se faktura označí jako uhrazená. Nespárované platby lze přiřadit ručně.

### Zálohování

Data jsou v databázi (svazek `db-data`). Záloha:

```bash
docker compose exec db pg_dump -U nabidky nabidky > zaloha.sql
```

## Role a oprávnění

| Role | Ceník | Subjekty | Nabídky | Faktury | Úhrady a banka | Nastavení, uživatelé |
| --- | --- | --- | --- | --- | --- | --- |
| Administrátor | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Obchodník | ✔ | ✔ | ✔ | ✔ | čtení | – |
| Účetní | čtení | ✔ | čtení | ✔ | ✔ | – |
| Jen čtení | čtení | čtení | čtení | čtení | čtení | – |

## Lokální vývoj

```bash
npm install
cp .env.example .env            # nastavte DATABASE_URL na lokální PostgreSQL
npx prisma migrate deploy       # vytvoří tabulky
npm run dev                     # http://localhost:3000
```

Užitečné příkazy: `npm run typecheck`, `npm run build`, `npx prisma studio`.

Změna datového modelu: upravte `prisma/schema.prisma` a vytvořte migraci `npx prisma migrate dev --name popis`.

## Technologie

Next.js 15 (App Router, Server Actions), TypeScript, Prisma + PostgreSQL, Tailwind CSS, pdfmake (PDF s QR platbou), vlastní generátor ISDOC, ARES REST API, ČNB kurzovní lístek, Fio API.
