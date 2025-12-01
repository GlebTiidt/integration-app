# Integration Flow & Troubleshooting

This document provides a detailed walkthrough of the Zabun → Airtable → Webflow pipeline and records the most common pitfalls observed during development. Use it as a companion to the main `README.md` whenever you need to diagnose issues or extend the workflow.

> **Scope**  
> The focus here is the production integration that runs under `src/`.

## System snapshot (production stack only)

### Components
- **Zabun API** – authoritative data source for properties and agents. Uses `/property/search`, `/property/{id}`, and `/api/v1/person`.
- **Airtable** – intermediate source of truth with two tables: `ZabunCash_Properties` and `Zabun_Agents`.
- **Webflow CMS** – public-facing consumers: Properties, Projects, Agents collections.
- **Node.js services** – orchestrated scripts under `src/` (ESM modules, async/await).

### Runtime entry points
- `npm start` → `src/index.js` runs the long-lived scheduler (default 120‑minute cadence, configurable via env).
- `npm run sync:agents` → `src/syncAgents.js` performs a one-off agent refresh.
- `npm run sync:webflow` → `src/webflowSync.js` pushes Airtable rows into Webflow.
- `npm run sync:all` → `src/fullSync.js` runs the full Zabun → Airtable → Webflow sequence once.

### Configuration and shared utilities
- `.env` supplies credentials (`ZABUN_*`, `AIRTABLE_*`, `WEBFLOW_*`) and knobs (`ZABUN_FETCH_LIMIT`, delays, publish flags).
- `src/dicts/` contains decoded dictionaries (statuses, transactions, layouts, etc.) shipped with the repo to avoid extra HTTP lookups.
- `src/cache/` stores heavier geo caches (countries, cities); helper loaders hydrate them once per process.
- `src/lib/logger.js` (if present) centralises emoji-prefixed logging used across scripts.

### Data hand-off summary
1. **Zabun ingestion** – `src/index.js` calls `fetchPropertiesBatch`, hydrates each property, normalises dictionary IDs, filters by publish/show/archived/deleted flags, then upserts into Airtable via `src/upsertAirtable.js`.
2. **Agents ingestion** – `src/syncAgents.js` orchestrates `fetchZabunAgents` + `upsertAirtableAgents`, applying the same “Active + active=true” filter.
3. **Webflow sync** – `src/webflowSync.js` reads both Airtable tables, rebuilds relationships, uploads assets if needed, and writes to Webflow collections with live publishing support when `WEBFLOW_PUBLISH_LIVE=true`.

### Error handling highlights
- Zabun fetch helpers surface HTTP metadata for pagination diagnostics and retry on transient 5xx responses.
- Airtable upserts automatically prune unknown columns (10-attempt limit) and log the offending field names before aborting.
- Webflow writes distinguish between create/update, outputting final counts (`Created: … Updated: …`) and surfacing missing scope errors (e.g., `OAuthForbidden`).

### Extensibility checkpoints
- To add new Zabun fields, extend the relevant dictionary or decoder inside `src/dicts/` and ensure Airtable/Webflow schemas expose matching field slugs.
- To onboard new schedules or pipelines, mirror the scheduler pattern in `src/index.js` (respecting delay/backoff helpers) to keep behaviour consistent.
- Any additional data stores should be documented here so future automation (GPT agents) can reason about available datasets without scanning the codebase.

## End-to-end flow

1. **Zabun → Airtable (properties)**  
   - `src/index.js` paginates through `/property/search`.  
   - Each property ID is rehydrated through `/property/{id}` to obtain the full payload.  
   - Properties are skipped unless they meet the publication rule:  
     `publish=true`, `show=true`, `archived=false`, `deleted=false`.  
   - Passed records are normalized and written into `ZabunCash_Properties` via the Airtable REST API.

2. **Zabun → Airtable (agents)**  
   - `src/fetchZabunAgents.js` loads `/api/v1/person`.  
   - Agents are skipped unless `active=true` and the status dictionary resolves to “Active”.  
   - Allowed records are upserted into `Zabun_Agents`.  
   - Dictionary lookups (status/profile/title/job title) are resolved once and cached.

3. **Airtable → Webflow (agents)**  
   - `src/webflowSync.js` reads every row from `Zabun_Agents`.  
   - Filtering is re-applied (`active` + “Active” status).  
   - Only the fields expected by the Webflow collection are sent:  
     `name`, `slug`, `person_id`, `profile`, `title`, `full_name`, `working_email`, `direct_phone`, `mobile_phone`.  
     Phone numbers are built by concatenating the respective country codes (`direct_phone_cc`, `mobile_phone_cc`).  
   - Successfully synced items are cached in maps (`airtableId → webflowId`, `personId → webflowId`) for later use.

4. **Airtable → Webflow (projects)**  
   - Eligible property rows where `is_project=true` are converted into project CMS items.  
   - Slugs follow the `project-<external_id>` pattern to ensure stability.

5. **Airtable → Webflow (properties)**  
   - Remaining non-project rows are filtered again by the publication rule.  
   - The agent reference is resolved either from the Airtable `agent` link (preferred) or from `responsible_salesrep_person_id`.  
   - Additional metadata such as `investment` and decoded `head_type` are stored alongside each property.  
   - The Webflow reference field `agent` receives the ID string returned by the agent sync.  
   - Assets are uploaded on demand; items are created/updated via `/items/live`, so they are published immediately.

## Field mapping snapshots

### Agents
| Airtable field | Webflow slug | Notes |
| -------------- | ------------ | ----- |
| `name` / fallback `full_name` | `name` | Primary label |
| derived `slugify(name)` | `slug` | 128 chars max |
| `person_id` | `person-id` | Numeric ID |
| `profile` | `profile` | Dictionary decoded |
| `title` | `title` | Dictionary decoded |
| `full_name` | `full-name` | Original full name |
| `working_email` | `working-email` | Plain text |
| `direct_phone_cc + direct_phone` | `direct-phone` | Concatenated string (country code + number) with whitespace and separators removed |
| `mobile_phone_cc + mobile_phone` | `mobile-phone-2` | Same concatenation logic as direct phone |

### Projects
| Airtable field | Webflow slug | Notes |
| -------------- | ------------ | ----- |
| `"project-" + external_id` | `name` | Generated label |
| `slugify("project-" + external_id)` | `slug` | 128 chars max |

### Properties
Refer to `FIELD_SLUG_MAP` inside `src/webflowSync.js`. The notable addition is the `agent` reference field which links each property to the synced agent item.

### Sample property payload (Zabun → Airtable)
The snippet below shows the shape of the `/property/{id}` response that feeds the Airtable upsert.  
Use it when validating dictionary lookups (e.g. `head_type_id`) or when reproducing sync bugs.

```json
{
  "property_id": 3913569,
  "status_id": 1,
  "publish": true,
  "show": true,
  "archived": false,
  "deleted": false,
  "transaction_id": 5,
  "type_id": 26,
  "building_type_id": 2,
  "head_type_id": 3,
  "investment": false,
  "reference": "PH",
  "address": {
    "street": "Petrus Stokmanslaan",
    "number": "11",
    "box": "",
    "zip": "2950",
    "city_geo_id": 1000031,
    "country_geo_id": 23,
    "latitude": 51.3266239,
    "longitude": 4.4468629
  },
  "layouts": [
    { "layout_id": 1, "count": 3, "surface": 0 },
    { "layout_id": 5, "count": 1, "surface": 0 },
    { "layout_id": 6, "count": 1, "surface": 0 }
  ],
  "technicals": [],
  "photo_url": "https://files.zabun.be/upload/4357/images/3ecd8f...jpg",
  "photos": [
    {
      "type_id": 2,
      "url": "https://files.zabun.be/upload/4357/images/3ecd8f...jpg",
      "url_thumbnail": "https://files.zabun.be/upload/4357/images/3ecd8f..._tn.jpg"
    }
  ],
  "videos": [
    {
      "type_id": 2,
      "url": "https://nodalview.com/s/3DN6S_pi13FQKQlpdGplAn"
    }
  ],
  "files": [
    {
      "type_id": 0,
      "url": "https://files.zabun.be/upload/4357/files/b357e8...pdf",
      "reference": "e3695827...RES-1.pdf"
    }
  ],
  "description": { "en": "" },
  "description_short": { "en": "" },
  "custom_epc_label": "",
  "epc_value": 265,
  "flooding_parcel_score": "A",
  "flooding_building_score": "A",
  "renovation_obligation_id": -1,
  "responsible_salesrep_person_id": 25606,
  "company_id": 4357,
  "creation": "2024-10-02T16:10:23+02:00",
  "changed": "2024-12-18T16:42:48.123+01:00"
}
```

## Logs & observability

- `⏭️ Skipping property …` or `⏭️ Skipping agent …` indicate that the record was ignored because publication/status flags did not match the required combination.
- `🔗 Property … linked to agent …` confirms that the agent reference was resolved and will be pushed to Webflow.
- `⚠️ Webflow collection missing expected field slug …` warns that Webflow does not expose the expected field. Publishing the collection usually resolves this.
- `⚠️ Airtable … fetch attempt … failed (500)` shows the automatic retry mechanism for transient Airtable errors.

## Common failure modes

| Symptom | Root cause | Suggested remediation |
| ------- | ---------- | --------------------- |
| Webflow validation error `Field not described in schema` | Field added in code but not published in Webflow | Publish the CMS collection or update the slug mapping |
| Webflow agent reference stays empty (`undefined` in logs) | The field is a reference but payload sent as string; ensure payload uses `{ id: … }` form or slug mismatch | Confirm field type and slug, review `agentFieldMeta` logging |
| Airtable returns 500 or 429 | API hiccup or rate limit | The sync retries automatically; if failures persist, re-run later or contact Airtable support |
| Properties appear in Airtable despite being archived | Filters missing or outdated | Confirm publish/show/archived/deleted flags in Zabun payload; logic lives in `shouldSyncProperty` |
| Agents appear without phone number | Either `direct_phone_cc` or `direct_phone` empty | Expect blank string in Webflow; update source data if needed |

## Extending the pipeline

- **New fields:** update dictionary modules if the field requires lookup, then adjust Airtable/Webflow payloads. Remember to publish schema changes in Webflow before syncing.
- **New filters:** centralize them in `shouldSyncProperty` / `shouldSyncAgentRecord` so both Airtable and Webflow stay in sync.
- **New collections:** mirror the pattern used for agents (fetch → filter → cache → sync → reference).

Document any new error patterns or recovery steps here so the workflow remains transparent for future engineers and for fine-tuning automated agents.
