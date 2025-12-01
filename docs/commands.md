# Project Commands

## npm scripts

- `npm start`  
  Launches the Zabun → Airtable scheduler (`src/index.js`). Runs continuously and executes a sync cycle at the interval configured in `.env`.

- `npm run sync:all`  
  Executes the full pipeline once: Zabun → Airtable (properties), Zabun → Airtable (agents), then Airtable → Webflow.

- `npm run sync:webflow`  
  Syncs Airtable properties into Webflow only. Useful after manual updates in Airtable.

- `npm run sync:webflow:comfort`  
  Runs only the Comfort collection sync to Webflow (helpful when debugging option mappings). All other collections are skipped.

- `npm run sync:webflow:facilities`  
  Syncs only the Facilities collection (`name`/`slug` items) to Webflow so you can refresh the list of amenities without touching other collections.

- `npm run sync:webflow:environments`  
  Syncs only the Environments collection (`name`/`slug` items) based on the Zabun dictionary.

- `npm run sync:webflow:properties`  
  Updates only the main Properties collection in Webflow (still loads reference collections so links stay valid).

- `npm run sync:property`  
  Fetches a single Zabun property (defaults to `4144406`, pass another ID as an argument) and upserts it into the main Airtable table for debugging:
  ```bash
  npm run sync:property -- 4144406
  ```

- `npm run debug:headtype`  
  Fetches diagnostics for properties 3914134 and 3914316 from Airtable/Webflow to inspect `head_type_new` values.

- `npm run sync:agents`  
  Fetches Zabun agents and upserts them into the `Zabun_Agents` Airtable table.

- `npm run test:airtable`  
  Executes `src/testAirtable.js` (if populated) for targeted Airtable connectivity tests.

## Utility commands

- `npm install`  
  Installs project dependencies. Run after cloning or when dependencies change.

- `npm fund`  
  Lists dependencies that offer funding/support options (optional informational command).
