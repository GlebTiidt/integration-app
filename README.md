# Integration App

Pipeline that synchronizes real estate data across Zabun, Airtable, and Webflow.

## High-level flow

```
[Zabun API]
    │
    ├─► Properties Scheduler (`src/index.js`)
    │      • Fetches ~200 items per batch from `/property/search`
    │      • Hydrates full records (`/property/{id}`)
    │      • Decodes dictionary IDs (statuses, transaction, types, etc.)
    │      • Applies publish/show/archived/deleted filter
    │      • Upserts into Airtable table `ZabunCash_Properties`
    │
    ├─► Agents Sync (`src/syncAgents.js`)
    │      • Pulls `/api/v1/person`
    │      • Keeps only `active=true` + status “Active”
    │      • Upserts into Airtable `Zabun_Agents`
    │
[Airtable]
    │
    └─► Webflow Sync (`src/webflowSync.js`)
            • Reads `Zabun_Agents` and `ZabunCash_Properties`
            • Respects same publish/show/archived/deleted gates
            • Uploads assets when needed (photos/files)
            • Resolves agent reference (Airtable link or sales rep fallback)
            • Writes into Webflow collections:
                 – Agents
                 – Projects (`slug = project-<external_id>`)
                 – Properties (`slug = property-<external_id>`)
            • Live publish when `WEBFLOW_PUBLISH_LIVE=true`
```

## Project structure

- `src/index.js` – scheduler and full property sync logic.
- `src/fetchZabun.js`, `src/upsertAirtable.js` – Zabun property ingestion helpers.
- `src/fetchZabunAgents.js`, `src/upsertAirtableAgents.js`, `src/syncAgents.js` – Zabun agent ingestion.
- `src/webflowSync.js` – Airtable → Webflow sync.
- `src/fullSync.js` – one-shot pipeline (properties → agents → Webflow).
- `src/dicts/` – cached lookups used to decode coded values from Zabun.
- `src/cache/` – JSON caches with geographic metadata.
- `docs/` – supplemental documentation (`commands.md`, `zabun.md`).

## Prerequisites

- Node.js 18+ (project uses ESM modules).
- Access tokens for Zabun, Airtable, and Webflow with sufficient scopes.
- `.env` file (see below).

## Environment variables

Copy `.env.example` (if available) or create `.env` with the following keys:

```
ZABUN_URL=...
ZABUN_CLIENT_ID=...
ZABUN_SERVER_ID=...
ZABUN_API_KEY=...
ZABUN_X_CLIENT_ID=...
ZABUN_PERSON_URL=...

AIRTABLE_TOKEN=...
AIRTABLE_BASE_ID=...
AIRTABLE_TABLE_NAME=ZabunCash_Properties
AIRTABLE_AGENTS_TABLE_NAME=Zabun_Agents

ZABUN_FETCH_LIMIT=200
ZABUN_FETCH_OFFSET=0
ZABUN_SYNC_INTERVAL_MINUTES=120
ZABUN_PROPERTY_DELAY_MS=500

WEBFLOW_API_TOKEN=...
WEBFLOW_SITE_ID=...
WEBFLOW_PROPERTIES_COLLECTION_ID=...
WEBFLOW_AGENTS_COLLECTION_ID=...
WEBFLOW_PROJECTS_COLLECTION_ID=...
WEBFLOW_PUBLISH_LIVE=true
```

Adjust the limits and scheduler interval as needed.

## Running the pipeline

- `npm start` – launches the continuous Zabun → Airtable scheduler.
- `npm run sync:agents` – one-off agent sync.
- `npm run sync:webflow` – one-off Airtable → Webflow sync.
- `npm run sync:all` – executes the full cycle once (properties, agents, Webflow).

See `docs/commands.md` for a complete list of commands.

## Deployment notes

- The scheduler logs indicate progress for each batch and summary metrics. Monitor output for duplicate IDs or API errors.
- Webflow publishing requires `items:write` and `items:live` (or `sites:write` if fallback publish is used).
- If you disable live publishing (`WEBFLOW_PUBLISH_LIVE=false`), ensure the API token has `sites:publish` and the collection is included in the publish request.

## Filtering & field mapping highlights

- **Property filtering**  
  Zabun records are skipped unless they satisfy `publish=true`, `show=true`, `archived=false`, `deleted=false`. The same rule is enforced again before pushing data from Airtable to Webflow.

- **Agent filtering**  
  Only agents with `active=true` and status “Active” are synced. In Airtable the link to an agent is stored in the `agent` field and is used to populate the Webflow reference.

- **Agent Webflow fields**  
  Webflow receives the following fields: `name`, `slug`, `person_id`, `profile`, `title`, `full_name`, `working_email`, `direct_phone`, and `mobile_phone`. The phone numbers are derived from `direct_phone_cc + direct_phone` and `mobile_phone_cc + mobile_phone` (whitespace and separators stripped) in Airtable.

- **Projects Webflow collection**  
  Rows with `is_project=true` become entries in the Projects collection with slugs `project-<external_id>` and carry the multi-reference list of published child properties.

- **Property Webflow reference**  
  The `agent` reference field expects a Webflow item ID. The sync automatically resolves it from Airtable’s `agent` link or, as a fallback, from `responsible_salesrep_person_id`. Items are created/updated through the Webflow live endpoints so they are published immediately.

- **Additional Airtable fields**  
  Booleans like `investment` and decoded labels such as `head_type` are stored alongside each property for downstream reporting or Webflow use.

- **Logging**  
  The sync logs skipped records and the resolved Webflow IDs (e.g. `🔗 Property … linked to agent …`), making troubleshooting easier. Common runtime issues such as Airtable 500 responses or missing Webflow field slugs are surfaced in the console.
