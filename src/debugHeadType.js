import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config({ path: ".env" });

const TARGET_PROPERTY_IDS = ["3914134", "3914316"];
const TARGET_PROPERTY_SLUGS = TARGET_PROPERTY_IDS.map(
  id => `property-${id}`
);

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME,
  WEBFLOW_API_TOKEN,
  WEBFLOW_SITE_ID,
  WEBFLOW_PROPERTIES_COLLECTION_ID,
  ZABUN_X_CLIENT_ID,
  ZABUN_CLIENT_ID,
  ZABUN_SERVER_ID,
  ZABUN_API_KEY
} = process.env;

if (
  !AIRTABLE_TOKEN ||
  !AIRTABLE_BASE_ID ||
  !AIRTABLE_TABLE_NAME ||
  !WEBFLOW_API_TOKEN ||
  !WEBFLOW_SITE_ID ||
  !WEBFLOW_PROPERTIES_COLLECTION_ID
) {
  console.error("❌ Missing required environment configuration. Please check .env.");
  process.exit(1);
}

async function fetchJson(url, { headers = {}, label } = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `${label || "Request"} failed ${response.status}: ${text || response.statusText}`
    );
  }
  return response.json();
}

async function fetchZabunProperty(propertyId) {
  if (!ZABUN_API_KEY) return null;
  const headers = {
    "X-CLIENT-ID": ZABUN_X_CLIENT_ID,
    "client_id": ZABUN_CLIENT_ID,
    "server_id": ZABUN_SERVER_ID,
    "api_key": ZABUN_API_KEY,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  try {
    const url = `https://public.api-cms.zabun.be/api/v1/property/${propertyId}`;
    return await fetchJson(url, { headers, label: `Zabun property ${propertyId}` });
  } catch (err) {
    console.warn(
      `⚠️ Unable to fetch Zabun property ${propertyId}:`,
      err.message || err
    );
    return null;
  }
}

async function fetchAirtableRecords() {
  const baseUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}`;
  const filterFormula = `OR(${TARGET_PROPERTY_IDS.map(
    id => `{external_id}=${id}`
  ).join(",")})`;
  const params = new URLSearchParams({
    filterByFormula: filterFormula,
    pageSize: "100"
  });

  const headers = {
    Authorization: `Bearer ${AIRTABLE_TOKEN}`,
    Accept: "application/json"
  };

  const url = `${baseUrl}?${params}`;
  try {
    const data = await fetchJson(url, {
      headers,
      label: "Airtable property fetch"
    });
    return Array.isArray(data.records) ? data.records : [];
  } catch (err) {
    console.error("❌ Airtable request failed:", err.message || err);
    return [];
  }
}

async function fetchWebflowItems() {
  const items = [];
  let offset = 0;
  const limit = 100;

  const headers = {
    Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
    Accept: "application/json"
  };

  while (true) {
    const url = `https://api.webflow.com/v2/collections/${WEBFLOW_PROPERTIES_COLLECTION_ID}/items?limit=${limit}&offset=${offset}`;
    try {
      const data = await fetchJson(url, { headers, label: "Webflow items" });
      if (Array.isArray(data.items)) {
        items.push(...data.items);
      }
      if (!data.pagination || data.pagination.total <= offset + limit) {
        break;
      }
      offset += limit;
    } catch (err) {
      console.error("❌ Webflow request failed:", err.message || err);
      break;
    }
  }

  return items;
}

function resolveHeadTypeId(property, fallback = null) {
  if (!property || typeof property !== "object") return fallback;

  const candidates = [
    property.head_type_id,
    property.headTypeId,
    property.head_type,
    property.headType,
    property.general_type,
    property.generalType,
    property.type?.head_type_id,
    property.type?.headTypeId,
    property.type?.head_type,
    property.type?.headType,
    property.type?.general_type,
    property.type?.generalType
  ];

  const normalize = value => {
    if (value == null || value === "") return null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const normalized = normalize(entry);
        if (normalized != null) return normalized;
      }
      return null;
    }
    if (typeof value === "object") {
      const nested = normalize(
        value.id ??
          value.head_type_id ??
          value.headTypeId ??
          value.headType ??
          value.value ??
          value.slug ??
          value.code ??
          value.name?.en ??
          value.name ??
          value.label
      );
      if (nested != null) return nested;
      if (value.type) {
        return normalize(
          value.type.id ??
            value.type.head_type_id ??
            value.type.headTypeId ??
            value.type.headType ??
            value.type.value ??
            value.type.slug ??
            value.type.code ??
            value.type.name?.en ??
            value.type.name ??
            value.type.label
        );
      }
      return null;
    }

    const num = Number(value);
    if (Number.isFinite(num)) return num;
    if (typeof value === "string") return value.trim();
    return null;
  };

  for (const candidate of candidates) {
    const normalized = normalize(candidate);
    if (normalized != null) return normalized;
  }

  return fallback;
}

function sanitize(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

async function run() {
  console.log("🔍 Debugging head_type_new for properties:", TARGET_PROPERTY_IDS.join(", "));

  const [airtableRecords, webflowItems, webflowCollection] = await Promise.all([
    fetchAirtableRecords(),
    fetchWebflowItems(),
    (async () => {
      const headers = {
        Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
        Accept: "application/json"
      };
      try {
        return await fetchJson(
          `https://api.webflow.com/v2/collections/${WEBFLOW_PROPERTIES_COLLECTION_ID}`,
          { headers, label: "Webflow collection schema" }
        );
      } catch (err) {
        console.warn(
          "⚠️ Unable to fetch Webflow collection schema:",
          err.message || err
        );
        return null;
      }
    })()
  ]);

  if (webflowCollection) {
    const headTypeField = (webflowCollection.fields || []).find(
      field => field.slug === "head-type-new"
    );
    if (headTypeField) {
      console.log("\n🌐 Webflow head-type-new field meta:");
      console.log("  type       :", headTypeField.type);
      console.log("  isRequired :", headTypeField.isRequired ?? "n/a");
      console.log(
        "  options    :",
        Array.isArray(headTypeField.options)
          ? headTypeField.options.map(opt => opt?.name || opt?.label || opt?.value)
          : "n/a"
      );
    }
  }

  const airtableByExternalId = new Map();
  for (const record of airtableRecords) {
    const externalId = record.fields?.external_id;
    if (externalId != null) {
      airtableByExternalId.set(String(externalId), record);
    }
  }

  const webflowBySlug = new Map();
  for (const item of webflowItems) {
    const slug = item.fieldData?.slug;
    if (slug) {
      webflowBySlug.set(slug, item);
    }
  }

  for (const propertyId of TARGET_PROPERTY_IDS) {
    const slug = `property-${propertyId}`;
    console.log("\n===================================================");
    console.log(`Property ${propertyId} (slug: ${slug})`);

    const airtableRecord = airtableByExternalId.get(String(propertyId));
    if (airtableRecord) {
      const fields = airtableRecord.fields || {};
      console.log("📄 Airtable fields:");
      console.log("  head_type      :", sanitize(fields.head_type));
      console.log("  type           :", sanitize(fields.type));
      console.log("  transaction    :", sanitize(fields.transaction));
      console.log("  available keys :", Object.keys(fields));
    } else {
      console.log("📄 Airtable fields: not found");
    }

    const webflowItem = webflowBySlug.get(slug);
    if (webflowItem) {
      const fieldData = webflowItem.fieldData || {};
      console.log("🌐 Webflow fields:");
      console.log("  head-type-new  :", sanitize(fieldData["head-type-new"]));
      console.log("  head-type      :", sanitize(fieldData["head-type"]));
      console.log("  type           :", sanitize(fieldData["type"]));
      console.log("  transaction    :", sanitize(fieldData["transaction"]));
    } else {
      console.log("🌐 Webflow fields: item not found");
    }
  }
}

run().catch(err => {
  console.error("❌ Debug script failed:", err);
  process.exit(1);
});
