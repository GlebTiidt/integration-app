import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;

async function fetchAirtableRecords() {
  let offset = null;
  const records = [];
  do {
    const params = new URLSearchParams({ pageSize: 100 });
    if (offset) params.set("offset", offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
        AIRTABLE_TABLE_NAME
      )}?${params}`,
      {
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`
        }
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable fetch failed ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (Array.isArray(data.records)) records.push(...data.records);
    offset = data.offset ?? null;
  } while (offset);

  return records;
}

function getField(record, path) {
  return path.reduce((value, key) => {
    if (value == null) return undefined;
    return value[key];
  }, record);
}

function main(records) {
  const projects = records.filter(record => {
    const fields = record.fields || {};
    return Boolean(
      fields.is_project &&
        !fields.archived &&
        !fields.deleted &&
        fields.publish &&
        fields.show
    );
  });

  const summary = {
    totalRecords: records.length,
    projectCount: projects.length,
    sampleProjects: projects.slice(0, 5).map(record => ({
      id: record.id,
      external_id: getField(record, ["fields", "external_id"]),
      child_properties: getField(record, ["fields", "child_properties"]),
      childCount: Array.isArray(getField(record, ["fields", "child_properties"]))
        ? getField(record, ["fields", "child_properties"]).length
        : 0
    }))
  };

  console.log(JSON.stringify(summary, null, 2));
}

fetchAirtableRecords()
  .then(main)
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
