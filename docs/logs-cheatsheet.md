# Operations Log Cheatsheet

Use this sheet to decode common warnings/errors that surface during a full sync cycle and the remediation steps to eliminate them.

| Log message | Meaning | How to resolve / silence |
|-------------|---------|--------------------------|
| `⚠️ Building obligation not found for ID …` | The Zabun payload includes a `building_obligation_id` that is not available in the cached dictionary. | Publish the missing option in Zabun or update `src/dicts/building_obligations.js` to include the ID. If the ID is `-1`, Zabun is signalling “not set” — no action required. |
| `⚠️ Garden direction not found for ID …` | Similar to the line above, but for `direction_garden_id`. | Extend `src/dicts/garden_directions.js` or leave unset if the upstream value is `0` (“not set”). |
| `⚠️ Exception during agent lookup for person_id …` | Airtable lookup for the Agents table failed (network issue, throttling). The agent reference falls back to `null`. | Re-run the sync once connectivity is restored. If it keeps failing, verify `AIRTABLE_AGENTS_TABLE_NAME` and the `person_id` column exist. |
| `❌ Error during sync: request to https://api.airtable.com/v0/... failed, reason:` | Generic network failure when calling the Airtable REST API. | Usually transient. Re-run the sync; if it persists, inspect your network or rotate the Airtable PAT. |
| `⚠️ Missing Airtable fields for property …` | One or more required Airtable columns received no data for this property. | Ensure those columns exist and are the correct type. Inspect the source payload (property id is in the message) to confirm Zabun actually supplies the values. |
| `ℹ️ No Airtable record found for property … to delete.` | A property failed the publish/show/archived/deleted gate and the cleaner could not find its record in Airtable. | Nothing to fix unless the record should exist (in that case, investigate why Airtable delete previously ran). |
| `⚠️ Unable to resolve … reference for property …` | When syncing Webflow, the property could not find the corresponding Location/Legal/etc. entry (slug mismatch). | Run the individual collection syncs first (they execute automatically when `npm run sync:webflow` runs) and ensure the reference collections share the same slug as the property (`slug = property-<external_id>`). |
| `UNKNOWN_FIELD_NAME` errors from Airtable | The Airtable table does not contain a column named in the payload (e.g., `available_date`). | Create the column (matching type) or remove the field from `sendToAirtable`. Once the schema is aligned, rerun the sync. |
| Zabun dictionary fetch logs (`🌐 Fetching …`) appearing frequently | A new process started and is warming caches. | No remediation. Once caches are populated, subsequent lookups switch to the `🧠 Using cached …` path. |

**Tip:** Property `4144406` is forced to sync first every cycle so you can test newly added fields quickly. If you no longer need that behavior, remove the ID from `ALWAYS_SYNC_PROPERTY_IDS` in `src/index.js`.
