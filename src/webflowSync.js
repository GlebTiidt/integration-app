import dotenv from "dotenv";
import fetch, { FormData, Blob } from "node-fetch";
import { pathToFileURL } from "url";
import { convertHtmlToRichText } from "./utils/richText.js";
import { getAllFacilities } from "./dicts/facilities.js";
import { decodeEnvironments, getAllEnvironments } from "./dicts/environments.js";
import {
  translateFacilityLabel,
  translateEnvironmentLabel
} from "./utils/referenceTranslations.js";
import {
  translateHeritageLabel,
  translateTownPlanningLabel,
  translateTownPlanningViolationLabel
} from "./utils/legalTranslations.js";

dotenv.config();

const {
  AIRTABLE_TOKEN,
  AIRTABLE_BASE_ID,
  AIRTABLE_TABLE_NAME,
  AIRTABLE_AGENTS_TABLE_NAME,
  WEBFLOW_API_TOKEN,
  WEBFLOW_SITE_ID,
  WEBFLOW_PROPERTIES_COLLECTION_ID,
  WEBFLOW_AGENTS_COLLECTION_ID,
  WEBFLOW_PROJECTS_COLLECTION_ID,
  WEBFLOW_FILES_LINKS_COLLECTION_ID,
  WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID,
  WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID,
  WEBFLOW_COMFORT_COLLECTION_ID,
  WEBFLOW_FACILITIES_COLLECTION_ID,
  WEBFLOW_ENVIRONMENTS_COLLECTION_ID,
  WEBFLOW_LEGALS_COLLECTION_ID,
  WEBFLOW_LOCATIONS_COLLECTION_ID,
  WEBFLOW_PUBLISH_LIVE,
  WEBFLOW_PUBLISH_DOMAIN
} = process.env;

if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
  throw new Error("Missing Airtable configuration in .env");
}

if (
  !WEBFLOW_API_TOKEN ||
  !WEBFLOW_SITE_ID ||
  !WEBFLOW_PROPERTIES_COLLECTION_ID
) {
  throw new Error("Missing Webflow configuration in .env");
}

const AIRTABLE_PROPERTIES_BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
  AIRTABLE_TABLE_NAME
)}`;
const AIRTABLE_AGENTS_BASE_URL = AIRTABLE_AGENTS_TABLE_NAME
  ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
      AIRTABLE_AGENTS_TABLE_NAME
    )}`
  : null;
const WEBFLOW_BASE_URL = "https://api.webflow.com/v2";
const SHOULD_PUBLISH_LIVE =
  WEBFLOW_PUBLISH_LIVE == null ? true : WEBFLOW_PUBLISH_LIVE === "true";

const assetCache = new Map();

async function buildReferenceMapFromCollection(collectionId) {
  if (!collectionId) return new Map();
  const items = await fetchWebflowItems(collectionId);
  const map = new Map();
  for (const item of items) {
    const slug = item.fieldData?.slug;
    if (slug && item.id) {
      map.set(slug, item.id);
    }
  }
  return map;
}

const FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  creation: "creation",
  available_date: ["available_date", "available-date"],
  company_id: ["company_id", "company-id"],
  deleted: "deleted",
  archived: "archived",
  investment: "investment",
  equity: "equity",
  exclusive: "exclusive",
  holiday_residence: ["holiday_residence", "holiday-residence"],
  energy_house: ["energy_house", "energy-house"],
  main_residence: ["main_residence", "main-residence"],
  passive_house: ["passive_house", "passive-house"],
  student_residence: ["student_residence", "student-residence"],
  development: "development",
  transaction: "transaction",
  head_type: ["head_type", "head-type", "head-type-2"],
  type: "type",
  price: "price",
  description_short: ["description_short", "description-short"],
  description_full: ["description_full", "description-full"],
  floor: "floor",
  floors_total: ["floors_total", "floors-total", "floor_total"],
  elevator: "elevator",
  pets_allowed: ["pets_allowed", "pets-allowed"],
  furniture: "furniture",
  furniture_value: ["furniture_value", "furniture-value"],
  construction_year: ["construction_year", "construction-year"],
  renovation_year: ["renovation_year", "renovation-year"],
  co2: "co2",
  co2_shared: ["co2_shared", "co2-shared"],
  condition: "condition",
  construction_status: ["construction_status", "construction-status"],
  sticker: "sticker",
  environments: ["environments", "environments-new", "environments_new"],
  agent: "agent",
  location: "location",
  legal: "legal",
  files: "files",
  layouts_inside: ["layouts_inside", "layouts-inside"],
  layouts_outside: ["layouts_outside", "layouts-outside"],
  comfort: ["comfort", "comforts"]
};

const REQUIRED_FIELD_SLUGS = Object.values(FIELD_SLUG_MAP);

const AGENT_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  person_id: "person-id",
  rank: "rank",
  profile: "profile",
  title: "title",
  full_name: "full-name",
  working_email: "working-email",
  direct_phone: "direct-phone",
  mobile_phone: "mobile-phone-2"
};

const REQUIRED_AGENT_FIELD_SLUGS = Object.values(AGENT_FIELD_SLUG_MAP);

const PROJECT_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  properties: "properties"
};

const REQUIRED_PROJECT_FIELD_SLUGS = Object.values(PROJECT_FIELD_SLUG_MAP);

const LOCATION_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  address_full: "address-full",
  country: "country",
  state: "state",
  city: "city",
  street: "street",
  box: "box",
  number: "number",
  zip: "zip",
  latitude: "latitude",
  longitude: "longitude"
};

const REQUIRED_LOCATION_FIELD_SLUGS = Object.values(LOCATION_FIELD_SLUG_MAP);

const LEGAL_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  access_for_disabled: "access-for-disabled",
  building_license: "building-license",
  building_obligation: "building-obligation",
  building_permit: "building-permit",
  building_type: "building-type",
  certificate_asbuilt: "certificate-asbuilt",
  certificate_electricity: "certificate-electricity",
  certificate_ep_shared: "certificate-ep-shared",
  certificate_ep: "certificate-ep",
  custom_epc_label: "custom-epc-label",
  custom_epc_label_shared: "custom-epc-label-shared",
  indexed_ki: "indexed-ki",
  non_indexed_ki: "non-indexed-ki",
  epb_reference: "epb-reference",
  epb_reference_shared: "epb-reference-shared",
  epc_date: "epc-date",
  epc_date_expire: "epc-date-expire",
  epc_date_shared: "epc-date-shared",
  epc_reference: "epc-reference",
  epc_reference_shared: "epc-reference-shared",
  epc_value: "epc-value",
  epc_value_shared: "epc-value-shared",
  epc_value_total: "epc-value-total",
  epc_value_total_shared: "epc-value-total-shared",
  flooding_building_score: "flooding-building-score",
  flooding_parcel_score: "flooding-parcel-score",
  o_level_flooding_sensitivity: "o-level-flooding-sensitivity",
  o_level_flooding_zone: "o-level-flooding-zone",
  heritage_protected: "heritage-protected",
  heritage: "heritage",
  pre_emption_right: "pre-emption-right",
  presale_right: "presale-right",
  renovation_obligation: "renovation-obligation",
  allocation_license: "allocation-license",
  town_planning: "town-planning",
  town_planning_violation: "town-planning-violation",
  urban_designation: "urban-designation",
  urban_violation: "urban-violation",
  water_sensitive_open_space_area: "water-sensitive-open-space-area",
  water_sensitive_open_space_area_expire: "water-sensitive-open-space-area-expire"
};

const REQUIRED_LEGAL_FIELD_SLUGS = Object.values(LEGAL_FIELD_SLUG_MAP);

const FILE_LINK_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  photo_url: "photo-url",
  photo_gallery: "photo-gallery",
  video_link: "video-link",
  virtual_tour_link: "virtual-tour-link",
  file_asbestos: "file-asbestos",
  file_book_of_expenses: "file-book-of-expenses",
  file_elektra_keuring: "file-elektra-keuring",
  file_epc: "file-epc",
  file_estimation: "file-estimation",
  file_pamphlet: "file-pamphlet",
  file_plan: "file-plan",
  file_water_sensitivity: "file-water-sensitivity"
};

const REQUIRED_FILE_LINK_FIELD_SLUGS = Object.values(
  FILE_LINK_FIELD_SLUG_MAP
);

const LAYOUT_INSIDE_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  attics: "attics",
  attic_area: "attic-area",
  bathrooms: "bathrooms",
  bathroom_area: "bathroom-area",
  bedrooms: "bedrooms",
  bedroom_area: "bedroom-area",
  cellars: "cellars",
  cellar_area: "cellar-area",
  cupboards: "cupboards",
  cupboard_area: "cupboard-area",
  depots: "depots",
  depot_area: "depot-area",
  depth_floor: "depth-floor",
  depth_ground_floor: "depth-ground-floor",
  dining_rooms: "dining-rooms",
  dining_room_area: "dining-room-area",
  dressing_rooms: "dressing-rooms",
  dressing_room_area: "dressing-room-area",
  eethoek: "eethoek",
  eethoek_area: "eethoek-area",
  fireplaces: "fireplaces",
  fireplace_area: "fireplace-area",
  garages: "garages",
  garage_area: "garage-area",
  hal: "hal",
  hal_area: "hal-area",
  kitchens: "kitchens",
  kitchen_area: "kitchen-area",
  living_rooms: "living-rooms",
  living_room_area: "living-room-area",
  offices: "offices",
  office_area: "office-area",
  restrooms: "restrooms",
  restroom_area: "restroom-area",
  saunas: "saunas",
  sauna_area: "sauna-area",
  service_halls: "service-halls",
  service_hall_area: "service-hall-area",
  sheds: "sheds",
  shed_area: "shed-area",
  showrooms: "showrooms",
  showroom_area: "showroom-area",
  store_cupboards: "store-cupboards",
  store_cupboard_area: "store-cupboard-area",
  suites: "suites",
  suite_area: "suite-area",
  video_cinema_tv_rooms: "video-cinema-tv-rooms",
  video_cinema_tv_room_area: "video-cinema-tv-room-area",
  washing_rooms: "washing-rooms",
  washing_room_area: "washing-room-area",
  wine_cellars: "wine-cellars",
  wine_cellar_area: "wine-cellar-area"
};

const REQUIRED_LAYOUT_INSIDE_FIELD_SLUGS = Object.values(
  LAYOUT_INSIDE_FIELD_SLUG_MAP
);

const LAYOUT_OUTSIDE_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  area_buildable: "area-buildable",
  area_build: "area-build",
  area_ground: "area-ground",
  balconies: "balconies",
  balcony_area: "balcony-area",
  courts: "courts",
  court_area: "court-area",
  width_ground: "width-ground",
  depth_ground: "depth-ground",
  depth_house: "depth-house",
  width_house: "width-house",
  direction_garden: "direction-garden",
  gardens: "gardens",
  garden_houses: "garden-houses",
  garden_house_area: "garden-house-area",
  garden_area: "garden-area",
  parking_places: "parking-places",
  parking_place_area: "parking-place-area",
  ponds: "ponds",
  pond_area: "pond-area",
  porches: "porches",
  porch_area: "porch-area",
  swimming_pools: "swimming-pools",
  swimming_pool_area: "swimming-pool-area",
  terraces: "terraces",
  terrace_area: "terrace-area"
};

const REQUIRED_LAYOUT_OUTSIDE_FIELD_SLUGS = Object.values(
  LAYOUT_OUTSIDE_FIELD_SLUG_MAP
);

const COMFORT_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug",
  glazing_type: "glazing-type",
  glazing_evaluation: "glazing-evaluation",
  heating_system_type: "heating-system-type",
  heating_system_evaluation: "heating-system-evaluation",
  roof_type: "roof-type",
  roof_evaluation: "roof-evaluation",
  window_frame_type: "window-frame-type",
  window_frame_evaluation: "window-frame-evaluation",
  electricity_evaluation: "electricity-evaluation",
  plumber_evaluation: "plumber-evaluation",
  sanitary_fittings_evaluation: "sanitary-fittings-evaluation",
  isolation_evaluation: "isolation-evaluation",
  kitchen_type: "kitchen-type",
  kitchen_evaluation: "kitchen-evaluation",
  facilities_new: "facilities-new"
};

const REQUIRED_COMFORT_FIELD_SLUGS = Object.values(COMFORT_FIELD_SLUG_MAP);

const FACILITY_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug"
};

const REQUIRED_FACILITY_FIELD_SLUGS = Object.values(FACILITY_FIELD_SLUG_MAP);

const ENVIRONMENT_FIELD_SLUG_MAP = {
  name: "name",
  slug: "slug"
};

const REQUIRED_ENVIRONMENT_FIELD_SLUGS = Object.values(ENVIRONMENT_FIELD_SLUG_MAP);

const MAX_AIRTABLE_RETRIES = 3;
const AIRTABLE_RETRY_DELAY_MS = 2000;

async function fetchAirtableJson(url, label) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
    });

    if (response.ok) {
      return response.json();
    }

    const text = await response.text().catch(() => "");
    const isRetryable =
      response.status >= 500 || response.status === 429 || response.status === 408;

    if (!isRetryable || attempt >= MAX_AIRTABLE_RETRIES) {
      throw new Error(
        `Airtable ${label} fetch failed ${response.status}: ${text}`
      );
    }

    const delay = AIRTABLE_RETRY_DELAY_MS * attempt;
    console.warn(
      `⚠️ Airtable ${label} fetch attempt ${attempt} failed (${response.status}). Retrying in ${delay} ms...`
    );
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

async function fetchAirtablePropertyRecords() {
  let offset = null;
  const records = [];

  do {
    const params = new URLSearchParams({ pageSize: 100 });
    if (offset) params.set("offset", offset);

    const data = await fetchAirtableJson(
      `${AIRTABLE_PROPERTIES_BASE_URL}?${params.toString()}`,
      "properties"
    );
    if (Array.isArray(data.records)) {
      records.push(...data.records);
    }
    offset = data.offset ?? null;
  } while (offset);

  console.log(`📥 Airtable records to sync: ${records.length}`);
  return records;
}

async function fetchAirtableAgentRecords() {
  if (!AIRTABLE_AGENTS_BASE_URL) {
    console.warn("⚠️ AIRTABLE_AGENTS_TABLE_NAME is not configured; skipping agents sync.");
    return [];
  }

  let offset = null;
  const records = [];

  do {
    const params = new URLSearchParams({ pageSize: 100 });
    if (offset) params.set("offset", offset);

    const data = await fetchAirtableJson(
      `${AIRTABLE_AGENTS_BASE_URL}?${params.toString()}`,
      "agents"
    );
    if (Array.isArray(data.records)) {
      records.push(...data.records);
    }
    offset = data.offset ?? null;
  } while (offset);

  console.log(`📥 Airtable agents to sync: ${records.length}`);
  return records;
}

async function fetchWebflowCollectionSchema(collectionId, requiredSlugs = []) {
  const response = await fetch(
    `${WEBFLOW_BASE_URL}/collections/${collectionId}`,
    {
      headers: {
        Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to load Webflow collection schema ${response.status}: ${text}`
    );
  }

  const data = await response.json();
  const fieldSlugs = new Set(
    (data.fields || []).map(field => field.slug)
  );
  requiredSlugs.forEach(slug => {
    if (!fieldSlugs.has(slug)) {
      console.warn(
        `⚠️ Webflow collection missing expected field slug "${slug}". Available fields: ${Array.from(
          fieldSlugs
        ).join(", ")}`
      );
    }
  });
  return data;
}

async function fetchWebflowItems(collectionId) {
  const items = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await fetch(
      `${WEBFLOW_BASE_URL}/collections/${collectionId}/items?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch Webflow items ${response.status}: ${text}`);
    }

    const data = await response.json();
    if (Array.isArray(data.items)) {
      items.push(...data.items);
    }

    if (!data.pagination || data.pagination.total <= offset + limit) {
      break;
    }

    offset += limit;
  }

  console.log(
    `📦 Webflow items currently in collection ${collectionId}: ${items.length}`
  );
  return items;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 128) || "item";
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeSlugForMatch(slug) {
  if (!slug) return null;
  return slug.replace(/-\d+$/, "").toLowerCase();
}

function enforceSlugFromName(fieldData = {}) {
  if (fieldData.name) {
    fieldData.slug = slugify(fieldData.name);
  }
  return fieldData;
}

function cleanDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "yes", "y", "1"].includes(normalized);
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  return false;
}

function resolveReferenceBySlug(referenceMap, slug) {
  if (!referenceMap || !slug) return null;
  return referenceMap.get(slug) ?? null;
}

function shouldSyncAgentRecord(fields) {
  if (!fields) return false;
  return parseBoolean(fields.active ?? fields.is_active);
}

function shouldSyncPropertyRecord(fields) {
  if (!fields) return false;
  const publish = parseBoolean(fields.publish);
  const show = parseBoolean(fields.show);
  const archived = parseBoolean(fields.archived);
  const deleted = parseBoolean(fields.deleted);
  return publish && show && !archived && !deleted;
}

function combinePhone(ccRaw, phoneRaw) {
  const cc = (ccRaw ?? "").toString().trim();
  const phone = (phoneRaw ?? "").toString().trim();
  if (!cc && !phone) return "";
  return `${cc}${phone}`.replace(/[\s()+-]/g, "");
}

function buildAddressFull({ street, box, zip, city }) {
  const leftPart = [street, box && box !== "N/A" ? box : null]
    .filter(Boolean)
    .join(" ")
    .trim();
  const rightPart = [zip, city].filter(Boolean).join(" ").trim();
  return [leftPart, rightPart].filter(Boolean).join(", ");
}

function parseGallery(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function parseFacilitiesField(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(entry => (typeof entry === "string" ? entry.trim() : entry?.name?.trim()))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function extractTextValue(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const extracted = extractTextValue(entry);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === "object") {
    const candidateKeys = [
      "name",
      "label",
      "value",
      "text",
      "title",
      "slug",
      "displayName"
    ];
    for (const key of candidateKeys) {
      if (value[key] != null) {
        const extracted = extractTextValue(value[key]);
        if (extracted) return extracted;
      }
    }
    return null;
  }
  return null;
}

async function uploadAssetFromUrl(url) {
  if (!url) return null;
  if (assetCache.has(url)) return assetCache.get(url);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`⚠️ Unable to fetch asset ${url}: ${response.status}`);
      assetCache.set(url, null);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      response.headers.get("content-type") || guessContentType(url);
    const filename = inferFilename(url, contentType);

    const formData = new FormData();
    formData.append("file", new Blob([buffer], { type: contentType }), filename);
    formData.append("siteId", WEBFLOW_SITE_ID);

    const uploadResponse = await fetch(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/assets/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          Accept: "application/json"
        },
        body: formData
      }
    );

    const uploadJson = await uploadResponse.json().catch(() => ({}));

    if (!uploadResponse.ok) {
      console.error(
        "❌ Asset upload failed:",
        uploadResponse.status,
        JSON.stringify(uploadJson)
      );
      assetCache.set(url, null);
      return null;
    }

    const fileId =
      uploadJson?.files?.[0]?.fileId ||
      uploadJson?.asset?.fileId ||
      uploadJson?.fileId ||
      null;

    if (!fileId) {
      console.error("❌ Asset upload response missing fileId:", uploadJson);
      assetCache.set(url, null);
      return null;
    }

    assetCache.set(url, fileId);
    return fileId;
  } catch (err) {
    console.error("❌ Asset upload exception:", err);
    assetCache.set(url, null);
    return null;
  }
}

function guessContentType(url) {
  const lower = url.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function inferFilename(url, contentType) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop();
    if (last && last.includes(".")) return decodeURIComponent(last);
  } catch {
    // ignore
  }

  const extension = contentType.split("/")[1] || "dat";
  return `file.${extension}`;
}

async function prepareWebflowFieldData(
  record,
  agentReferenceMaps,
  supportReferences,
  allowedSlugs,
  fieldMetaMap
) {
  const fields = record.fields || {};
  const externalId = fields.external_id;

  if (!externalId) {
    console.warn("⚠️ Skipped record without external_id:", record.id);
    return null;
  }

  const fallbackName = `property-${externalId}`;
  const name = fields.name || fallbackName;
  const slug = slugify(name);

  const descriptionShortRich = convertHtmlToRichText(
    fields.description_short || ""
  );
  const descriptionFullRich = convertHtmlToRichText(
    fields.description_full || ""
  );
  let agentWebflowId = null;
  const agentFieldMeta = fieldMetaMap?.get("agent") || null;
  if (agentReferenceMaps) {
    const recordsRaw = Array.isArray(fields.agent)
      ? fields.agent
      : [];
    const records = recordsRaw.map(ref => (ref && ref.id ? ref.id : ref));
    for (const ref of records) {
      const id =
        agentReferenceMaps.byAirtableId?.get(ref) ||
        agentReferenceMaps.byAirtableId?.get(String(ref)) ||
        null;
      if (id) {
        agentWebflowId = id;
        break;
      }
    }
    if (!agentWebflowId) {
      const responsibleId =
        fields.responsible_salesrep_person_id ??
        fields.responsibleSalesrepPersonId ??
        fields.responsible_salesrep ??
        null;
      if (responsibleId != null) {
        const key = String(responsibleId);
        agentWebflowId =
          agentReferenceMaps.byPersonId?.get(key) ||
          agentReferenceMaps.byPersonId?.get(Number(key)) ||
          null;
      }
    }

    if (!agentWebflowId) {
      console.warn(
        `⚠️ Unable to resolve agent reference for property ${slug}:`,
        {
          airtableAgentRefs: records,
          responsibleSalesrep: fields.responsible_salesrep_person_id
        }
      );
    } else {
      console.log(
        `🔗 Property ${slug} linked to agent ${agentWebflowId} (field type: ${agentFieldMeta?.type || "unknown"})`
      );
    }
  }

  let agentFieldValue = null;
  if (agentWebflowId != null) {
    if (agentFieldMeta?.type === "MultiReference") {
      agentFieldValue = [agentWebflowId];
    } else {
      agentFieldValue = agentWebflowId;
    }
  }

  const headTypeValue =
    extractTextValue(fields.head_type) ||
    extractTextValue(fields.head_type_new) ||
    null;
  const typeValue = extractTextValue(fields.type) || null;

  const resolveSupportRef = (map, label) => {
    if (!map || map.size === 0) return null;
    const resolved = resolveReferenceBySlug(map, slug);
    if (!resolved) {
      console.warn(`⚠️ Unable to resolve ${label} reference for property ${slug}`);
    }
    return resolved;
  };

  const locationRef = resolveSupportRef(supportReferences.locations, "location");
  const legalRef = resolveSupportRef(supportReferences.legals, "legal");
  const filesRef = resolveSupportRef(supportReferences.files, "files");
  const layoutInsideRef = resolveSupportRef(
    supportReferences.layoutsInside,
    "layouts_inside"
  );
  const layoutOutsideRef = resolveSupportRef(
    supportReferences.layoutsOutside,
    "layouts_outside"
  );
  const comfortRef = resolveSupportRef(supportReferences.comfort, "comfort");
  const facilitiesRefMap = supportReferences.facilities || new Map();
  const environmentsRefMap = supportReferences.environments || new Map();

  const facilityIds = [];
  for (const label of parseFacilitiesField(fields.facilities)) {
    const translated = translateFacilityLabel(label) || label;
    const slugKey = slugify(translated);
    const facilityId = facilitiesRefMap.get(slugKey);
    if (facilityId) {
      facilityIds.push(facilityId);
    } else {
      console.warn(
        `⚠️ Property ${slug} facility "${label}" missing in Facilities collection; skipping.`
      );
    }
  }

  const environmentIds = [];
  const environmentsField = fields.environments_new || fields.environments;
  for (const label of parseFacilitiesField(environmentsField)) {
    const translatedEnv = translateEnvironmentLabel(label) || label;
    const slugKey = slugify(translatedEnv);
    const envId = environmentsRefMap.get(slugKey);
    if (envId) {
      environmentIds.push(envId);
    } else {
      console.warn(
        `⚠️ Property ${slug} environment "${label}" missing in Environments collection; skipping.`
      );
    }
  }

  const rawFieldData = enforceSlugFromName({
    name,
    slug,
    creation: cleanDate(fields.creation),
    available_date: cleanDate(fields.available_date),
    company_id:
      fields.company_id != null ? String(fields.company_id) : "",
    deleted: parseBoolean(fields.deleted),
    archived: parseBoolean(fields.archived),
    investment: parseBoolean(fields.investment),
    equity: parseBoolean(fields.equity),
    exclusive: parseBoolean(fields.exclusive),
    holiday_residence: parseBoolean(fields.holiday_residence),
    energy_house: parseBoolean(fields.energy_house || fields.low_energy_house),
    main_residence: parseBoolean(fields.main_residence),
    passive_house: parseBoolean(fields.passive_house),
    student_residence: parseBoolean(fields.student_residence),
    development: parseBoolean(fields.development),
    transaction: fields.transaction || null,
    head_type: headTypeValue,
    type: typeValue,
    price: parseNumber(fields.price),
    description_short: descriptionShortRich,
    description_full: descriptionFullRich,
    floor: parseNumber(fields.floor),
    floors_total: parseNumber(fields.floors_total),
    elevator: parseBoolean(fields.elevator),
    pets_allowed: parseBoolean(
      fields.pets_allowed_ynu ?? fields.pets_allowed
    ),
    furniture: parseBoolean(fields.furniture_ynu ?? fields.furniture),
    furniture_value:
      fields.furniture_value != null ? String(fields.furniture_value) : "",
    construction_year: parseNumber(fields.construction_year),
    renovation_year: parseNumber(fields.renovation_year),
    co2: parseNumber(fields.co2),
    co2_shared: parseNumber(fields.co2_shared),
    condition: fields.condition || "",
    construction_status: fields.construction_status || "",
    sticker: fields.sticker || "",
    agent: agentFieldValue,
    location: locationRef,
    legal: legalRef,
    files: filesRef,
    layouts_inside: layoutInsideRef,
    layouts_outside: layoutOutsideRef,
    comfort: comfortRef,
    facilities_new: facilityIds.length ? facilityIds : undefined,
    environments: environmentIds.length ? environmentIds : undefined
  });

  return mapToWebflowFields(rawFieldData, allowedSlugs, fieldMetaMap);
}

function normalizeSlugEntry(entry) {
  if (Array.isArray(entry)) return entry.filter(Boolean);
  if (entry == null) return [];
  return [entry];
}

function mapToWebflowFields(rawFieldData, allowedSlugs, fieldMetaMap) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    const slugCandidates = [
      ...normalizeSlugEntry(FIELD_SLUG_MAP[key]),
      key
    ];
    let matchedSlug = null;
    for (const candidate of slugCandidates) {
      if (!candidate) continue;
      if (!allowedSlugs || allowedSlugs.has(candidate)) {
        matchedSlug = candidate;
        break;
      }
      const alternatives = [];
      if (candidate.includes("-")) {
        alternatives.push(candidate.replace(/-/g, "_"));
      }
      if (candidate.includes("_")) {
        alternatives.push(candidate.replace(/_/g, "-"));
      }
      for (const alt of alternatives) {
        if (!allowedSlugs || allowedSlugs.has(alt)) {
          matchedSlug = alt;
          break;
        }
      }
      if (matchedSlug) break;
    }
    if (!matchedSlug) continue;
    const fieldMeta = resolveFieldMeta(fieldMetaMap, matchedSlug);
    const normalizedValue = normalizeFieldValueForWebflow(value, fieldMeta, key);
    if (normalizedValue === undefined) continue;
    mapped[matchedSlug] = normalizedValue;
  }
  return mapped;
}

function resolveFieldMeta(fieldMetaMap, slug) {
  if (!fieldMetaMap) return null;
  if (fieldMetaMap.has(slug)) return fieldMetaMap.get(slug);
  if (slug.includes("-")) {
    const alt = slug.replace(/-/g, "_");
    if (fieldMetaMap.has(alt)) return fieldMetaMap.get(alt);
  }
  if (slug.includes("_")) {
    const alt = slug.replace(/_/g, "-");
    if (fieldMetaMap.has(alt)) return fieldMetaMap.get(alt);
  }
  return null;
}

function normalizeFieldValueForWebflow(value, fieldMeta, fieldKey) {
  if (!fieldMeta) return value;
  if (fieldMeta.type === "Option") {
    return resolveOptionFieldValue(value, fieldMeta, fieldKey);
  }
  return value;
}

function resolveOptionFieldValue(value, fieldMeta, fieldKey) {
  if (value == null || value === "") return null;

  const options = Array.isArray(fieldMeta?.validations?.options)
    ? fieldMeta.validations.options
    : [];
  if (options.length === 0) return value;

  const tryMatch = candidate => {
    if (candidate == null || candidate === "") return null;
    const candidateStr = String(candidate).trim();
    if (!candidateStr) return null;

    const directMatch = options.find(opt => opt?.id === candidateStr);
    if (directMatch) return directMatch.id;

    const lower = candidateStr.toLowerCase();
    const nameMatch = options.find(
      opt => typeof opt?.name === "string" && opt.name.trim().toLowerCase() === lower
    );
    if (nameMatch) return nameMatch.id;

    const slugMatch = options.find(opt => {
      if (typeof opt?.name !== "string") return false;
      return slugify(opt.name) === slugify(candidateStr);
    });
    if (slugMatch) return slugMatch.id;
    return null;
  };

  if (Array.isArray(value)) {
    for (const entry of value) {
      const match = tryMatch(entry);
      if (match) return match;
    }
  } else {
    const match = tryMatch(value);
    if (match) return match;
  }

  console.warn(
    `⚠️ Unable to match option value "${value}" for field ${fieldMeta.slug || fieldKey}. Expected: ${options
      .map(opt => opt?.name)
      .filter(Boolean)
      .join(", ")}`
  );
  return undefined;
}

async function prepareWebflowAgentFieldData(record, allowedSlugs) {
  const fields = record.fields || {};
  const personId =
    fields.person_id ??
    fields.personId ??
    fields["person-id"] ??
    null;

  if (personId == null) {
    console.warn("⚠️ Skipped agent record without person_id:", record.id);
    return null;
  }

  const name =
    fields.name ||
    fields.full_name ||
    `agent-${personId}`;

  const slug = slugify(name);
  const parsedPersonId = parseNumber(personId);
  const numericPersonId = Number.isFinite(parsedPersonId)
    ? parsedPersonId
    : Number.isFinite(Number(personId))
      ? Number(personId)
      : null;

  const directPhone = combinePhone(fields.direct_phone_cc, fields.direct_phone);
  const mobilePhone = combinePhone(fields.mobile_phone_cc, fields.mobile_phone);

  const rawFieldData = {
    name,
    slug,
    person_id: numericPersonId,
    rank:
      parseNumber(fields.rank) ??
      parseNumber(fields.order) ??
      0,
    profile: fields.profile || "",
    title: fields.title || "",
    full_name: fields.full_name || "",
    working_email: fields.working_email || "",
    direct_phone: directPhone,
    mobile_phone: mobilePhone
  };

  return mapAgentToWebflowFields(rawFieldData, allowedSlugs);
}

function mapAgentToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = AGENT_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function mapLocationToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = LOCATION_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowLocationFieldData(record, allowedSlugs) {
  const fields = record.fields || {};
  const name =
    fields.name ||
    `location-${fields.external_id ?? record.id ?? Date.now()}`;
  const slug = slugify(name);

  const addressFull =
    fields.address_full ||
    buildAddressFull({
      street: fields.street,
      box: fields.box,
      zip: fields.zip,
      city: fields.city
    });

  const rawFieldData = enforceSlugFromName({
    name,
    slug,
    address_full: addressFull || "",
    country: fields.country || "",
    state: fields.state || "",
    city: fields.city || "",
    street: fields.street || "",
    box: fields.box || "",
    number: fields.number || "",
    zip: parseNumber(fields.zip),
    latitude: parseNumber(fields.latitude),
    longitude: parseNumber(fields.longitude)
  });

  return mapLocationToWebflowFields(rawFieldData, allowedSlugs);
}

function mapLegalToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = LEGAL_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowLegalFieldData(record, allowedSlugs) {
  const fields = record.fields || {};
  const name = fields.name || `legal-${fields.external_id ?? record.id ?? Date.now()}`;
  const slug = slugify(name);

  const heritageValue =
    translateHeritageLabel(extractTextValue(fields.heritage)) || "";
  const townPlanningValue =
    translateTownPlanningLabel(extractTextValue(fields.town_planning)) || "";
  const townPlanningViolationValue =
    translateTownPlanningViolationLabel(
      extractTextValue(fields.town_planning_violation)
    ) || "";

  const rawFieldData = enforceSlugFromName({
    name,
    slug,
    access_for_disabled: parseBoolean(fields.access_for_disabled_ynu),
    allocation_license: parseBoolean(
      fields.allocation_license_ynu ?? fields.allocation_license
    ),
    building_license: fields.building_license || "",
    building_obligation: fields.building_obligation || "",
    building_permit: fields.building_permit || "",
    building_type: fields.building_type || "",
    certificate_asbuilt: parseBoolean(fields.certificate_asbuilt_ynu),
    certificate_electricity: parseBoolean(fields.certificate_electricity_ynu),
    certificate_ep_shared: parseBoolean(fields.certificate_ep_shared_ynu),
    certificate_ep: parseBoolean(fields.certificate_ep_ynu),
    custom_epc_label: fields.custom_epc_label || "",
    custom_epc_label_shared: fields.custom_epc_label_shared || "",
    indexed_ki: parseNumber(fields.indexed_ki),
    non_indexed_ki: parseNumber(fields.non_indexed_ki),
    epb_reference: fields.epb_reference || "",
    epb_reference_shared: fields.epb_reference_shared || "",
    epc_date: fields.epc_date ? cleanDate(fields.epc_date) : null,
    epc_date_expire: fields.epc_date_expire ? cleanDate(fields.epc_date_expire) : null,
    epc_date_shared: fields.epc_date_shared ? cleanDate(fields.epc_date_shared) : null,
    epc_reference: fields.epc_reference || "",
    epc_reference_shared: fields.epc_reference_shared || "",
    epc_value: parseNumber(fields.epc_value),
    epc_value_shared: parseNumber(fields.epc_value_shared),
    epc_value_total: parseNumber(fields.epc_value_total),
    epc_value_total_shared: parseNumber(fields.epc_value_total_shared),
    flooding_building_score: fields.flooding_building_score || "",
    flooding_parcel_score: fields.flooding_parcel_score || "",
    o_level_flooding_sensitivity:
      fields.o_level_flooding_sensitivity || "",
    o_level_flooding_zone: fields.o_level_flooding_zone || "",
    heritage_protected: parseBoolean(fields.heritage_protected_ynu),
    heritage: heritageValue,
    pre_emption_right: fields.pre_emption_right || "",
    presale_right: parseBoolean(fields.presale_right_ynu),
    renovation_obligation: fields.renovation_obligation || "",
    town_planning: townPlanningValue,
    town_planning_violation: townPlanningViolationValue,
    urban_designation: fields.urban_designation || "",
    urban_violation: fields.urban_violation || "",
    water_sensitive_open_space_area: parseNumber(fields.water_sensitive_open_space_area),
    water_sensitive_open_space_area_expire: fields.water_sensitive_open_space_area_expire
      ? cleanDate(fields.water_sensitive_open_space_area_expire)
      : null
  });

  return mapLegalToWebflowFields(rawFieldData, allowedSlugs);
}

function mapFilesLinksToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = FILE_LINK_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowFilesLinksFieldData(record, allowedSlugs) {
  const fields = record.fields || {};
  const name = fields.name || `files-${fields.external_id ?? record.id ?? Date.now()}`;
  const slug = slugify(name);

  const rawFieldData = enforceSlugFromName({
    name,
    slug,
    photo_url: fields.photo_url || "",
    photo_gallery: fields.photo_gallery || "",
    video_link: fields.video_link || "",
    virtual_tour_link: fields.virtual_tour_link || "",
    file_asbestos: fields.file_asbestos || "",
    file_book_of_expenses: fields.file_book_of_expenses || "",
    file_elektra_keuring: fields.file_elektra_keuring || "",
    file_epc: fields.file_epc || "",
    file_estimation: fields.file_estimation || "",
    file_pamphlet: fields.file_pamphlet || "",
    file_plan: fields.file_plan || "",
    file_water_sensitivity: fields.file_water_sensitivity || ""
  });

  return mapFilesLinksToWebflowFields(rawFieldData, allowedSlugs);
}

function mapLayoutInsideToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = LAYOUT_INSIDE_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowLayoutInsideFieldData(record, allowedSlugs) {
  const fields = record.fields || {};
  const name = fields.name || `layout-inside-${fields.external_id ?? record.id ?? Date.now()}`;
  const slug =
    (fields.slug && slugify(fields.slug)) || slugify(name);

  const numberFields = [
    "attics",
    "attic_area",
    "bathrooms",
    "bathroom_area",
    "bedrooms",
    "bedroom_area",
    "cellars",
    "cellar_area",
    "cupboards",
    "cupboard_area",
    "depots",
    "depot_area",
    "depth_floor",
    "depth_ground_floor",
    "dining_rooms",
    "dining_room_area",
    "dressing_rooms",
    "dressing_room_area",
    "eethoek",
    "eethoek_area",
    "fireplaces",
    "fireplace_area",
    "garages",
    "garage_area",
    "hal",
    "hal_area",
    "kitchens",
    "kitchen_area",
    "living_rooms",
    "living_room_area",
    "offices",
    "office_area",
    "restrooms",
    "restroom_area",
    "saunas",
    "sauna_area",
    "service_halls",
    "service_hall_area",
    "sheds",
    "shed_area",
    "showrooms",
    "showroom_area",
    "store_cupboards",
    "store_cupboard_area",
    "suites",
    "suite_area",
    "video_cinema_tv_rooms",
    "video_cinema_tv_room_area",
    "washing_rooms",
    "washing_room_area",
    "wine_cellars",
    "wine_cellar_area"
  ];

  const rawFieldData = { name, slug };

  for (const key of numberFields) {
    rawFieldData[key] = parseNumber(fields[key]);
  }

  return mapLayoutInsideToWebflowFields(
    enforceSlugFromName(rawFieldData),
    allowedSlugs
  );
}

function mapLayoutOutsideToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = LAYOUT_OUTSIDE_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowLayoutOutsideFieldData(record, allowedSlugs) {
  const fields = record.fields || {};
  const name = fields.name || `layout-outside-${fields.external_id ?? record.id ?? Date.now()}`;
  const slug = slugify(name);

  const numberFields = [
    "area_build",
    "area_buildable",
    "area_ground",
    "balconies",
    "balcony_area",
    "courts",
    "court_area",
    "width_ground",
    "depth_ground",
    "depth_house",
    "width_house",
    "gardens",
    "garden_houses",
    "garden_house_area",
    "garden_area",
    "parking_places",
    "parking_place_area",
    "ponds",
    "pond_area",
    "porches",
    "porch_area",
    "swimming_pools",
    "swimming_pool_area",
    "terraces",
    "terrace_area"
  ];

  const rawFieldData = { name, slug, direction_garden: fields.direction_garden || "" };

  for (const key of numberFields) {
    rawFieldData[key] = parseNumber(fields[key]);
  }

  return mapLayoutOutsideToWebflowFields(
    enforceSlugFromName(rawFieldData),
    allowedSlugs
  );
}

function mapComfortToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = COMFORT_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowComfortFieldData(record, allowedSlugs, facilityReferenceMap = new Map()) {
  const fields = record.fields || {};
  const name = fields.name || `comfort-${fields.external_id ?? record.id ?? Date.now()}`;
  const slug = slugify(name);

  const facilityIds = [];
  for (const label of parseFacilitiesField(fields.facilities)) {
    const translated = translateFacilityLabel(label) || label;
    const slugKey = slugify(translated);
    const facilityId = facilityReferenceMap.get(slugKey);
    if (facilityId) {
      facilityIds.push(facilityId);
    } else {
      console.warn(
        `⚠️ Comfort facility "${label}" not found in Webflow Facilities collection; skipping.`
      );
    }
  }

  const rawFieldData = enforceSlugFromName({
    name,
    slug,
    glazing_type: fields.glazing_type || "",
    glazing_evaluation: fields.glazing_evaluation || "",
    heating_system_type: fields.heating_system_type || "",
    heating_system_evaluation: fields.heating_system_evaluation || "",
    roof_type: fields.roof_type || "",
    roof_evaluation: fields.roof_evaluation || "",
    window_frame_type: fields.window_frame_type || "",
    window_frame_evaluation: fields.window_frame_evaluation || "",
    electricity_evaluation: fields.electricity_evaluation || "",
    plumber_evaluation: fields.plumber_evaluation || "",
    sanitary_fittings_evaluation: fields.sanitary_fittings_evaluation || "",
    isolation_evaluation: fields.isolation_evaluation || "",
    kitchen_type: fields.kitchen_type || "",
    kitchen_evaluation: fields.kitchen_evaluation || ""
  });

  if (facilityIds.length > 0) {
    rawFieldData.facilities_new = facilityIds;
  }

  return mapComfortToWebflowFields(rawFieldData, allowedSlugs);
}

function mapFacilitiesToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = FACILITY_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowFacilityFieldData(name, allowedSlugs) {
  if (!name) return null;
  const rawFieldData = {
    name,
    slug: slugify(name)
  };
  return mapFacilitiesToWebflowFields(rawFieldData, allowedSlugs);
}

function mapEnvironmentToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = ENVIRONMENT_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) continue;
    }
    mapped[slug] = value;
  }
  return mapped;
}

function prepareWebflowEnvironmentFieldData(name, allowedSlugs) {
  if (!name) return null;
  const rawFieldData = { name, slug: slugify(name) };
  return mapEnvironmentToWebflowFields(rawFieldData, allowedSlugs);
}

function prepareWebflowProjectFieldData(record, allowedSlugs, propertyReferenceMap) {
  const fields = record.fields || {};
  const externalId = fields.external_id;
  if (!externalId) {
    console.warn("⚠️ Skipped project record without external_id:", record.id);
    return null;
  }

  const name = `project-${externalId}`;
  const slug = slugify(name);

  let childPropsRaw = fields.child_properties;
  if (typeof childPropsRaw === "string") {
    try {
      const parsed = JSON.parse(childPropsRaw);
      childPropsRaw = Array.isArray(parsed) ? parsed : childPropsRaw;
    } catch {
      // leave as-is
    }
  }
  let propertyReferences = [];
  if (Array.isArray(childPropsRaw)) {
    const resolved = [];
    for (const child of childPropsRaw) {
      const childId =
        (child && (child.property_id ?? child.id ?? child.external_id)) ?? child;
      if (childId == null) continue;
      const key = String(childId);
      const refId = propertyReferenceMap?.get(key);
      if (refId) {
        resolved.push(refId);
      } else {
        console.warn(
          `⚠️ Project ${slug} child property ${key} has no Webflow reference; skipping.`
        );
      }
    }
    propertyReferences = resolved;
    console.log(
      `🔗 Project ${slug} mapped properties:`,
      propertyReferences
    );
  }

  const rawFieldData = enforceSlugFromName({
    name,
    slug,
    properties: propertyReferences
  });

  return mapProjectToWebflowFields(rawFieldData, allowedSlugs);
}

function mapProjectToWebflowFields(rawFieldData, allowedSlugs) {
  const mapped = {};
  for (const [key, value] of Object.entries(rawFieldData)) {
    if (value === undefined) continue;
    let slug = PROJECT_FIELD_SLUG_MAP[key] || key;
    if (allowedSlugs && !allowedSlugs.has(slug)) {
      const alternatives = [];
      if (slug.includes("-")) alternatives.push(slug.replace(/-/g, "_"));
      if (slug.includes("_")) alternatives.push(slug.replace(/_/g, "-"));
      for (const alt of alternatives) {
        if (allowedSlugs.has(alt)) {
          slug = alt;
          break;
        }
      }
      if (!allowedSlugs.has(slug)) {
        // Force slug/name even if schema differs to avoid creating duplicate items with auto-generated slugs
        if (key === "slug" || key === "name") {
          mapped[key] = value;
        }
        continue;
      }
    }
    mapped[slug] = value;
  }
  return mapped;
}

function buildSeenSlugSet(slugs) {
  const set = new Set();
  for (const slug of slugs) {
    if (!slug) continue;
    set.add(slug);
    const normalized = normalizeSlugForMatch(slug);
    if (normalized) set.add(normalized);
  }
  return set;
}

async function removeStaleItems(collectionId, webflowItems, seenSlugSet, label) {
  if (!Array.isArray(webflowItems) || webflowItems.length === 0) return { removed: 0, errors: 0 };
  let removed = 0;
  let errors = 0;

  for (const item of webflowItems) {
    const slug = item.fieldData?.slug;
    const normalized = normalizeSlugForMatch(slug);
    if (seenSlugSet.has(slug) || (normalized && seenSlugSet.has(normalized))) {
      continue;
    }
    try {
      await deleteWebflowItem(collectionId, item.id);
      removed += 1;
      if (label) {
        console.log(`🗑️ Deleted stale Webflow ${label} ${slug || item.id}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to delete stale Webflow ${label || "item"} ${slug || item.id}:`,
        err.message || err
      );
    }
  }

  return { removed, errors };
}

async function createWebflowItem(collectionId, fieldData, { live } = { live: true }) {
  const basePath = `${WEBFLOW_BASE_URL}/collections/${collectionId}/items`;
  const url = live ? `${basePath}/live` : basePath;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: false,
      fieldData
    })
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Failed to create Webflow item ${response.status}: ${JSON.stringify(json)}`
    );
  }

  return json;
}

async function updateWebflowItem(collectionId, itemId, fieldData, { live } = { live: true }) {
  const basePath = `${WEBFLOW_BASE_URL}/collections/${collectionId}/items/${itemId}`;
  const url = live ? `${basePath}/live` : basePath;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      isArchived: false,
      isDraft: false,
      fieldData
    })
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Failed to update Webflow item ${response.status}: ${JSON.stringify(json)}`
    );
  }

  return json;
}

async function deleteWebflowItem(collectionId, itemId, { live } = { live: true }) {
  const basePath = `${WEBFLOW_BASE_URL}/collections/${collectionId}/items/${itemId}`;
  const url = live ? `${basePath}/live` : basePath;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to delete Webflow item ${response.status}: ${JSON.stringify(json)}`
    );
  }
}

async function publishWebflowSite(collectionIds) {
  if (!Array.isArray(collectionIds) || collectionIds.length === 0) return;

  const preferredDomain =
    WEBFLOW_PUBLISH_DOMAIN != null
      ? WEBFLOW_PUBLISH_DOMAIN.replace(/^https?:\/\//i, "").replace(/\/$/, "")
      : null;

  let domainIds = [];
  let domainNames = preferredDomain ? [preferredDomain] : [];

  let lastDomainFetchStatus = null;
  try {
    const response = await fetch(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/domains`,
      {
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    lastDomainFetchStatus = response.status;

    if (response.ok) {
      const domains = await response.json();
      const filtered = Array.isArray(domains)
        ? domains.filter(domain => {
            if (!domain) return false;
            if (!preferredDomain) return true;
            const candidate =
              domain.name ||
              domain.url ||
              `${domain.protocol || "https"}://${domain.domain || domain.name}`;
            if (!candidate) return false;
            const normalized = String(candidate)
              .replace(/^https?:\/\//i, "")
              .replace(/\/$/, "");
            return normalized === preferredDomain;
          })
        : [];
      domainIds = filtered.map(domain => domain.id).filter(Boolean);
      if (!preferredDomain && filtered.length > 0) {
        domainNames = filtered
          .map(domain => domain.name || domain.url || domain.domain)
          .filter(Boolean)
          .map(value =>
            String(value).replace(/^https?:\/\//i, "").replace(/\/$/, "")
          );
      }
    } else if (response.status !== 404) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to fetch domains ${response.status}: ${text}`);
    }

    if (domainIds.length === 0 && lastDomainFetchStatus === 404) {
      throw new Error("v2 domains route unavailable, falling back to v1");
    }
  } catch (err) {
    console.warn(
      "⚠️ Falling back to Webflow v1 domains endpoint:",
      err.message || err
    );
    try {
      const responseV1 = await fetch(
        `https://api.webflow.com/sites/${WEBFLOW_SITE_ID}`,
        {
          headers: {
            Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
            "accept-version": "1.0.0",
            "Content-Type": "application/json"
          }
        }
      );
      if (responseV1.ok) {
        const data = await responseV1.json();
        const published =
          data?.published ||
          data?.domains ||
          (Array.isArray(data) ? data : []);
        const normalizedDomains = Array.isArray(published)
          ? published
              .map(value =>
                typeof value === "string"
                  ? value
                  : value?.name || value?.url || value?.domain || value?._id
              )
              .filter(Boolean)
              .map(value =>
                String(value).replace(/^https?:\/\//i, "").replace(/\/$/, "")
              )
          : [];
        if (preferredDomain) {
          domainNames = normalizedDomains.includes(preferredDomain)
            ? [preferredDomain]
            : domainNames.length
              ? domainNames
              : [];
        } else if (normalizedDomains.length > 0) {
          domainNames = normalizedDomains;
        }
      } else {
        const text = await responseV1.text().catch(() => "");
        console.error(
          `⚠️ Unable to load Webflow domains via v1 ${responseV1.status}: ${text}`
        );
      }
    } catch (fallbackErr) {
      console.error(
        "⚠️ Failed to load Webflow domains via v1:",
        fallbackErr.message || fallbackErr
      );
    }
  }

  if (domainNames.length > 1) {
    domainNames = Array.from(new Set(domainNames));
  }

  if (domainIds.length > 0) {
    const response = await fetch(
      `${WEBFLOW_BASE_URL}/sites/${WEBFLOW_SITE_ID}/publish`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domains: domainIds,
          collectionIds
        })
      }
    );

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error(
        `⚠️ Site publish failed ${response.status}: ${JSON.stringify(json)}`
      );
    } else {
      console.log("🚀 Webflow site publish triggered (v2).");
    }
    return;
  }

  if (domainNames.length > 0) {
    const response = await fetch(
      `https://api.webflow.com/sites/${WEBFLOW_SITE_ID}/publish`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          "accept-version": "1.0.0",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domains: domainNames
        })
      }
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error(
        `⚠️ Site publish (v1) failed ${response.status}: ${JSON.stringify(json)}`
      );
    } else {
      console.log("🚀 Webflow site publish triggered (v1).");
    }
    return;
  }

  console.warn(
    "⚠️ Skipping Webflow site publish because no domains could be resolved."
  );
}

async function syncWebflowAgents() {
  if (!AIRTABLE_AGENTS_BASE_URL || !WEBFLOW_AGENTS_COLLECTION_ID) {
    console.log("ℹ️ Agents collection or table not configured; skipping Webflow agent sync.");
    return {
      references: {
        byAirtableId: new Map(),
        byPersonId: new Map()
      },
      hasChanges: false
    };
  }

  const agentCollection = await fetchWebflowCollectionSchema(
    WEBFLOW_AGENTS_COLLECTION_ID,
    REQUIRED_AGENT_FIELD_SLUGS
  );
  const agentAllowedSlugs = new Set(
    (agentCollection.fields || []).map(field => field.slug)
  );

  const webflowAgents = await fetchWebflowItems(WEBFLOW_AGENTS_COLLECTION_ID);

  const webflowBySlug = new Map();
  const webflowByPersonId = new Map();
  const personIdToWebflow = new Map();
  for (const item of webflowAgents) {
    const slug = item.fieldData?.slug;
    if (slug) webflowBySlug.set(slug, item);
    const personId = item.fieldData?.["person-id"];
    if (personId != null) {
      const key = String(personId);
      webflowByPersonId.set(key, item);
      personIdToWebflow.set(key, item.id);
    }
  }

  let airtableAgents;
  try {
    airtableAgents = await fetchAirtableAgentRecords();
  } catch (err) {
    console.error(
      "⚠️ Unable to fetch Airtable agents, skipping agent sync:",
      err.message || err
    );
    return {
      references: {
        byAirtableId: new Map(),
        byPersonId: personIdToWebflow
      },
      hasChanges: false
    };
  }

  const airtableToWebflow = new Map();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seenSlugs = [];

  for (const record of airtableAgents) {
    const agentFields = record.fields || {};
    if (!shouldSyncAgentRecord(agentFields)) {
      skipped += 1;
      const agentIdentifier = agentFields.person_id ?? record.id ?? "unknown";
      console.log(
        `⏭️ Skipping agent ${agentIdentifier} due to inactive status flags.`
      );
      continue;
    }

    const fieldData = await prepareWebflowAgentFieldData(
      record,
      agentAllowedSlugs
    );
    if (!fieldData) {
      skipped += 1;
      continue;
    }

    const personKey =
      fieldData["person-id"] != null ? String(fieldData["person-id"]) : null;
    let existing =
      (personKey && webflowByPersonId.get(personKey)) ||
      webflowBySlug.get(fieldData.slug);

    try {
      let item;
      if (existing) {
        item = await updateWebflowItem(
          WEBFLOW_AGENTS_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
      } else {
        item = await createWebflowItem(
          WEBFLOW_AGENTS_COLLECTION_ID,
          fieldData
        );
        created += 1;
      }

      const slug = item.fieldData?.slug || fieldData.slug;
      if (slug) {
        webflowBySlug.set(slug, item);
      }
      if (personKey) {
        webflowByPersonId.set(personKey, item);
        personIdToWebflow.set(personKey, item.id);
      }
      if (record.id) {
        airtableToWebflow.set(record.id, item.id);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync Webflow agent ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow agents sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  return {
    references: {
      byAirtableId: airtableToWebflow,
      byPersonId: personIdToWebflow
    },
    hasChanges: created > 0 || updated > 0
  };
}

async function syncWebflowProjects(airtableRecords, propertyReferenceMap) {
  if (!WEBFLOW_PROJECTS_COLLECTION_ID) {
    console.log("ℹ️ Projects collection not configured; skipping Webflow project sync.");
    return { hasChanges: false };
  }

  let projectCollection;
  try {
    projectCollection = await fetchWebflowCollectionSchema(
      WEBFLOW_PROJECTS_COLLECTION_ID,
      REQUIRED_PROJECT_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow projects collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }
  const projectAllowedSlugs = new Set(
    (projectCollection.fields || []).map(field => field.slug)
  );
  const webflowItems = await fetchWebflowItems(WEBFLOW_PROJECTS_COLLECTION_ID);

  // Map both the exact slug and a normalized slug (strip trailing -<number>)
  const webflowMap = new Map();
  for (const item of webflowItems) {
    const slug = item.fieldData?.slug;
    if (!slug) continue;
    webflowMap.set(slug, item);
    const normalized = slug.replace(/-\d+$/, "");
    if (normalized && !webflowMap.has(normalized)) {
      webflowMap.set(normalized, item);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seenSlugs = [];

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (!parseBoolean(propertyFields.is_project)) {
      continue;
    }

    const fieldData = prepareWebflowProjectFieldData(
      record,
      projectAllowedSlugs,
      propertyReferenceMap
    );
    if (!fieldData) {
      skipped += 1;
      continue;
    }

    const existing = webflowMap.get(fieldData.slug);

    try {
      console.log(
        `➡️ Preparing Webflow project payload for ${fieldData.slug}: properties=${JSON.stringify(fieldData.properties)}`
      );
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_PROJECTS_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow project ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_PROJECTS_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow project ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(`❌ Failed to sync project ${fieldData.slug}:`, err.message);
    }
  }

  console.log(
    `✅ Webflow projects sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowLocations(airtableRecords) {
  if (!WEBFLOW_LOCATIONS_COLLECTION_ID) {
    console.log("ℹ️ Locations collection not configured; skipping locations sync.");
    return { hasChanges: false };
  }

  let locationCollection;
  try {
    locationCollection = await fetchWebflowCollectionSchema(
      WEBFLOW_LOCATIONS_COLLECTION_ID,
      REQUIRED_LOCATION_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow locations collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const locationAllowedSlugs = new Set(
    (locationCollection.fields || []).map(field => field.slug)
  );

  const webflowItems = await fetchWebflowItems(WEBFLOW_LOCATIONS_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seenSlugs = [];

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      continue;
    }

    const fieldData = prepareWebflowLocationFieldData(
      record,
      locationAllowedSlugs
    );
    if (!fieldData?.slug) {
      skipped += 1;
      continue;
    }
    seenSlugs.push(fieldData.slug);

    const existing = webflowMap.get(fieldData.slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_LOCATIONS_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow location ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_LOCATIONS_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow location ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync location ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  const staleResult = await removeStaleItems(
    WEBFLOW_LOCATIONS_COLLECTION_ID,
    webflowItems,
    buildSeenSlugSet(seenSlugs),
    "location"
  );
  errors += staleResult.errors;

  console.log(
    `✅ Webflow locations sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowLegals(airtableRecords) {
  if (!WEBFLOW_LEGALS_COLLECTION_ID) {
    console.log("ℹ️ Legals collection not configured; skipping legals sync.");
    return { hasChanges: false };
  }

  let legalCollection;
  try {
    legalCollection = await fetchWebflowCollectionSchema(
      WEBFLOW_LEGALS_COLLECTION_ID,
      REQUIRED_LEGAL_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow legals collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const legalAllowedSlugs = new Set(
    (legalCollection.fields || []).map(field => field.slug)
  );

  const webflowItems = await fetchWebflowItems(WEBFLOW_LEGALS_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const seenSlugs = [];

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      continue;
    }

    const fieldData = prepareWebflowLegalFieldData(
      record,
      legalAllowedSlugs
    );
    if (!fieldData?.slug) {
      skipped += 1;
      continue;
    }
    seenSlugs.push(fieldData.slug);

    const existing = webflowMap.get(fieldData.slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_LEGALS_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow legal ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_LEGALS_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow legal ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync legal ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  const staleResult = await removeStaleItems(
    WEBFLOW_LEGALS_COLLECTION_ID,
    webflowItems,
    buildSeenSlugSet(seenSlugs),
    "legal"
  );
  errors += staleResult.errors;

  console.log(
    `✅ Webflow legals sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0 || staleResult.removed > 0,
    references
  };
}

async function syncWebflowFilesAndLinks(airtableRecords) {
  if (!WEBFLOW_FILES_LINKS_COLLECTION_ID) {
    console.log("ℹ️ Files & Links collection not configured; skipping.");
    return { hasChanges: false };
  }

  let collection;
  try {
    collection = await fetchWebflowCollectionSchema(
      WEBFLOW_FILES_LINKS_COLLECTION_ID,
      REQUIRED_FILE_LINK_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow Files & Links collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const allowedSlugs = new Set((collection.fields || []).map(field => field.slug));
  const webflowItems = await fetchWebflowItems(WEBFLOW_FILES_LINKS_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      continue;
    }

    const fieldData = prepareWebflowFilesLinksFieldData(record, allowedSlugs);
    if (!fieldData?.slug) {
      skipped += 1;
      continue;
    }

    const existing = webflowMap.get(fieldData.slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_FILES_LINKS_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow files item ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_FILES_LINKS_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow files item ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync files item ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow files & links sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowLayoutsInside(airtableRecords) {
  if (!WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID) {
    console.log("ℹ️ Layouts Inside collection not configured; skipping.");
    return { hasChanges: false };
  }

  let collection;
  try {
    collection = await fetchWebflowCollectionSchema(
      WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID,
      REQUIRED_LAYOUT_INSIDE_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow Layouts Inside collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const allowedSlugs = new Set((collection.fields || []).map(field => field.slug));
  const webflowItems = await fetchWebflowItems(WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      continue;
    }

    const fieldData = prepareWebflowLayoutInsideFieldData(
      record,
      allowedSlugs
    );
    if (!fieldData?.slug) {
      skipped += 1;
      continue;
    }

    const existing = webflowMap.get(fieldData.slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow layout (inside) ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow layout (inside) ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync layout (inside) ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow layouts inside sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowLayoutsOutside(airtableRecords) {
  if (!WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID) {
    console.log("ℹ️ Layouts Outside collection not configured; skipping.");
    return { hasChanges: false };
  }

  let collection;
  try {
    collection = await fetchWebflowCollectionSchema(
      WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID,
      REQUIRED_LAYOUT_OUTSIDE_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow Layouts Outside collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const allowedSlugs = new Set((collection.fields || []).map(field => field.slug));
  const webflowItems = await fetchWebflowItems(WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      continue;
    }

    const fieldData = prepareWebflowLayoutOutsideFieldData(
      record,
      allowedSlugs
    );
    if (!fieldData?.slug) {
      skipped += 1;
      continue;
    }

    const existing = webflowMap.get(fieldData.slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow layout (outside) ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow layout (outside) ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync layout (outside) ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow layouts outside sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowComforts(airtableRecords, facilityReferenceMap = new Map()) {
  if (!WEBFLOW_COMFORT_COLLECTION_ID) {
    console.log("ℹ️ Comfort collection not configured; skipping.");
    return { hasChanges: false };
  }

  let collection;
  try {
    collection = await fetchWebflowCollectionSchema(
      WEBFLOW_COMFORT_COLLECTION_ID,
      REQUIRED_COMFORT_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow Comfort collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const comfortFields = collection.fields || [];
  const allowedSlugs = new Set(comfortFields.map(field => field.slug));

  const webflowItems = await fetchWebflowItems(WEBFLOW_COMFORT_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    if (!shouldSyncPropertyRecord(propertyFields)) {
      skipped += 1;
      continue;
    }
    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      continue;
    }

    const fieldData = prepareWebflowComfortFieldData(
      record,
      allowedSlugs,
      facilityReferenceMap
    );
    if (!fieldData?.slug) {
      skipped += 1;
      continue;
    }

    const existing = webflowMap.get(fieldData.slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_COMFORT_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        console.log(`🛠️ Updated Webflow comfort ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_COMFORT_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        console.log(`✨ Created Webflow comfort ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync comfort ${fieldData.slug}:`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow comforts sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowFacilities(airtableRecords) {
  if (!WEBFLOW_FACILITIES_COLLECTION_ID) {
    console.log("ℹ️ Facilities collection not configured; skipping.");
    return { hasChanges: false };
  }

  let collection;
  try {
    collection = await fetchWebflowCollectionSchema(
      WEBFLOW_FACILITIES_COLLECTION_ID,
      REQUIRED_FACILITY_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow Facilities collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const allowedSlugs = new Set((collection.fields || []).map(field => field.slug));
  const webflowItems = await fetchWebflowItems(WEBFLOW_FACILITIES_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  const facilityNames = new Map();
  try {
    const catalog = await getAllFacilities();
    for (const entry of catalog) {
      const label =
        entry?.name?.en ||
        entry?.name?.nl ||
        entry?.name?.fr ||
        entry?.name ||
        "";
      const translated = translateFacilityLabel(label)?.trim();
      if (!translated) continue;
      const slug = slugify(translated);
      if (!facilityNames.has(slug)) {
        facilityNames.set(slug, translated);
      }
    }
  } catch (err) {
    console.error(
      "❌ Unable to build facilities catalog from Zabun:",
      err.message || err
    );
    return { hasChanges: false };
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [slug, name] of facilityNames.entries()) {
    const fieldData = prepareWebflowFacilityFieldData(name, allowedSlugs);
    if (!fieldData) continue;
    const existing = webflowMap.get(slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_FACILITIES_COLLECTION_ID,
          existing.id,
          fieldData,
          { live: false }
        );
        updated += 1;
        webflowMap.set(slug, updatedItem);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_FACILITIES_COLLECTION_ID,
          fieldData,
          { live: false }
        );
        created += 1;
        webflowMap.set(slug, createdItem);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync facility "${name}":`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow facilities sync complete. Created: ${created}, Updated: ${updated}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowEnvironments(airtableRecords) {
  if (!WEBFLOW_ENVIRONMENTS_COLLECTION_ID) {
    console.log("ℹ️ Environments collection not configured; skipping.");
    return { hasChanges: false };
  }

  let collection;
  try {
    collection = await fetchWebflowCollectionSchema(
      WEBFLOW_ENVIRONMENTS_COLLECTION_ID,
      REQUIRED_ENVIRONMENT_FIELD_SLUGS
    );
  } catch (err) {
    console.error(
      "⚠️ Unable to load Webflow Environments collection schema:",
      err.message || err
    );
    return { hasChanges: false };
  }

  const allowedSlugs = new Set((collection.fields || []).map(field => field.slug));
  const webflowItems = await fetchWebflowItems(WEBFLOW_ENVIRONMENTS_COLLECTION_ID);
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );

  const environmentNames = new Map();
  try {
    const catalog = await getAllEnvironments();
    for (const entry of catalog) {
      const label =
        entry?.name?.en ||
        entry?.name?.nl ||
        entry?.name?.fr ||
        entry?.name ||
        "";
      const translated = translateEnvironmentLabel(label)?.trim();
      if (!translated) continue;
      const slug = slugify(translated);
      if (!environmentNames.has(slug)) {
        environmentNames.set(slug, translated);
      }
    }
  } catch (err) {
    console.error(
      "❌ Unable to build environments catalog from Zabun:",
      err.message || err
    );
    return { hasChanges: false };
  }

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const [slug, name] of environmentNames.entries()) {
    const fieldData = prepareWebflowEnvironmentFieldData(name, allowedSlugs);
    if (!fieldData) continue;
    const existing = webflowMap.get(slug);

    try {
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_ENVIRONMENTS_COLLECTION_ID,
          existing.id,
          fieldData,
          { live: false }
        );
        updated += 1;
        webflowMap.set(slug, updatedItem);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_ENVIRONMENTS_COLLECTION_ID,
          fieldData,
          { live: false }
        );
        created += 1;
        webflowMap.set(slug, createdItem);
      }
    } catch (err) {
      errors += 1;
      console.error(
        `❌ Failed to sync environment "${name}":`,
        err.message || err
      );
    }
  }

  console.log(
    `✅ Webflow environments sync complete. Created: ${created}, Updated: ${updated}, Errors: ${errors}.`
  );

  const references = new Map();
  for (const [slugKey, item] of webflowMap.entries()) {
    if (slugKey && item?.id) {
      references.set(slugKey, item.id);
    }
  }

  return {
    hasChanges: created > 0 || updated > 0,
    references
  };
}

async function syncWebflowProperties(
  agentReferenceMaps,
  airtableRecords,
  supportReferences = {},
  options = {}
) {
  const forcePropertyIdSet = new Set(
    (options.forcePropertyIds || [])
      .map(value =>
        value == null ? null : String(value).trim().toLowerCase()
      )
      .filter(Boolean)
  );

  const propertyCollection = await fetchWebflowCollectionSchema(
    WEBFLOW_PROPERTIES_COLLECTION_ID,
    REQUIRED_FIELD_SLUGS
  );
  const propertyAllowedSlugs = new Set(
    (propertyCollection.fields || []).map(field => field.slug)
  );
  const propertyFieldMetaMap = new Map(
    (propertyCollection.fields || []).map(field => [field.slug, field])
  );
  if (!propertyAllowedSlugs.has("agent")) {
    console.warn(
      `⚠️ Webflow properties collection ${WEBFLOW_PROPERTIES_COLLECTION_ID} missing 'agent' slug. Available: ${Array.from(
        propertyAllowedSlugs
      ).join(", ")}`
    );
  }
  const agentMeta = propertyFieldMetaMap.get("agent");
  if (agentMeta) {
    console.log(
      `ℹ️ Webflow agent field meta: type=${agentMeta.type}, isMulti=${agentMeta.isMultiple}`
    );
  }

  const webflowItems = await fetchWebflowItems(
    WEBFLOW_PROPERTIES_COLLECTION_ID
  );
  const webflowMap = new Map(
    webflowItems.map(item => [item.fieldData?.slug, item])
  );
  const propertyReferenceMap = new Map();
  for (const item of webflowItems) {
    const slug = item.fieldData?.slug;
    if (slug && slug.startsWith("property-")) {
      const externalId = slug.replace(/^property-/, "");
      propertyReferenceMap.set(externalId, item.id);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of airtableRecords || []) {
    const propertyFields = record.fields || {};
    const externalIdValue =
      propertyFields.external_id != null
        ? String(propertyFields.external_id)
        : null;
    const externalIdLower = externalIdValue
      ? externalIdValue.trim().toLowerCase()
      : null;
    const slugValueRaw =
      typeof propertyFields.slug === "string" && propertyFields.slug.trim()
        ? propertyFields.slug.trim()
        : externalIdValue
          ? `property-${externalIdValue}`
          : record.id;
    const slugLower = slugValueRaw ? slugValueRaw.toLowerCase() : null;
    const slugNoPrefixLower =
      slugLower && slugLower.startsWith("property-")
        ? slugLower.replace(/^property-/, "")
        : null;

    const isForced =
      (slugLower && forcePropertyIdSet.has(slugLower)) ||
      (slugNoPrefixLower && forcePropertyIdSet.has(slugNoPrefixLower)) ||
      (externalIdLower && forcePropertyIdSet.has(externalIdLower));

    const shouldSync = shouldSyncPropertyRecord(propertyFields);

    if (!shouldSync && !isForced) {
      skipped += 1;
      const flags = {
        publish: parseBoolean(propertyFields.publish),
        show: parseBoolean(propertyFields.show),
        archived: parseBoolean(propertyFields.archived),
        deleted: parseBoolean(propertyFields.deleted)
      };
      console.log(
        `⏭️ Skipping property ${slugValueRaw} due to publish/show/archived/deleted flags.`,
        flags
      );
      continue;
    } else if (!shouldSync && isForced) {
      const flags = {
        publish: parseBoolean(propertyFields.publish),
        show: parseBoolean(propertyFields.show),
        archived: parseBoolean(propertyFields.archived),
        deleted: parseBoolean(propertyFields.deleted)
      };
      console.log(
        `⚠️ Forcing property ${slugValueRaw} despite publish/show/archived/deleted flags.`,
        flags
      );
    }

    if (parseBoolean(propertyFields.is_project)) {
      skipped += 1;
      console.log(
        `⏭️ Skipping property ${slugValueRaw} because is_project=true (handled in Projects collection).`
      );
      continue;
    }

    const fieldData = await prepareWebflowFieldData(
      record,
      agentReferenceMaps,
      supportReferences,
      propertyAllowedSlugs,
      propertyFieldMetaMap
    );
    if (!fieldData) {
      skipped += 1;
      continue;
    }

    const existing = webflowMap.get(fieldData.slug);

    try {
      console.log(
        `➡️ Preparing Webflow payload for ${fieldData.slug}: agent=${JSON.stringify(fieldData.agent)}, head_type=${JSON.stringify(fieldData["head-type"]) ?? "null"}`
      );
      if (existing) {
        const updatedItem = await updateWebflowItem(
          WEBFLOW_PROPERTIES_COLLECTION_ID,
          existing.id,
          fieldData
        );
        updated += 1;
        const slug = updatedItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, updatedItem);
        }
        if (externalIdValue) {
          propertyReferenceMap.set(externalIdValue, updatedItem.id);
        }
        console.log(
          `🔁 Webflow item ${fieldData.slug} agent field after update:`,
          JSON.stringify(updatedItem.fieldData?.agent)
        );
        console.log(`🛠️ Updated Webflow item ${fieldData.slug}`);
      } else {
        const createdItem = await createWebflowItem(
          WEBFLOW_PROPERTIES_COLLECTION_ID,
          fieldData
        );
        created += 1;
        const slug = createdItem.fieldData?.slug || fieldData.slug;
        if (slug) {
          webflowMap.set(slug, createdItem);
        }
        if (externalIdValue) {
          propertyReferenceMap.set(externalIdValue, createdItem.id);
        }
        console.log(
          `✨ Webflow item ${fieldData.slug} agent field after create:`,
          JSON.stringify(createdItem.fieldData?.agent)
        );
        console.log(`✨ Created Webflow item ${fieldData.slug}`);
      }
    } catch (err) {
      errors += 1;
      console.error(`❌ Failed to sync item ${fieldData.slug}:`, err.message);
    }
  }

  console.log(
    `✅ Webflow properties sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
  );
  console.log(
    `ℹ️ Property reference map size: ${propertyReferenceMap.size}`
  );

  return {
    hasChanges: created > 0 || updated > 0,
    propertyReferenceMap
  };
}

export async function syncWebflow(mode = "all", options = {}) {
  const normalizedMode = mode || "all";
  const runComfort = normalizedMode === "all" || normalizedMode === "comfort";
  const runFacilities =
    normalizedMode === "all" ||
    normalizedMode === "facilities" ||
    normalizedMode === "comfort" ||
    normalizedMode === "properties";
  const runEnvironments =
    normalizedMode === "all" ||
    normalizedMode === "environments" ||
    normalizedMode === "comfort" ||
    normalizedMode === "properties";
  const runSupportCollections =
    normalizedMode === "all" || normalizedMode === "properties";
  const runAgents = normalizedMode === "all" || normalizedMode === "properties";
  const runProperties =
    normalizedMode === "all" || normalizedMode === "properties";
  const runProjects = normalizedMode === "all";
  const collectionsToPublish = new Set();

  let agentResult = {
    references: {
      byAirtableId: new Map(),
      byPersonId: new Map()
    },
    hasChanges: false
  };

  if (runAgents) {
    try {
      agentResult = await syncWebflowAgents();
      if (agentResult.hasChanges && WEBFLOW_AGENTS_COLLECTION_ID) {
        collectionsToPublish.add(WEBFLOW_AGENTS_COLLECTION_ID);
      }
    } catch (err) {
      console.error(
        "⚠️ Skipping Webflow agent sync due to error:",
        err.message || err
      );
    }
  }

  let airtablePropertyRecords = [];
  try {
    airtablePropertyRecords = await fetchAirtablePropertyRecords();
  } catch (err) {
    console.error(
      "⚠️ Unable to fetch Airtable properties:",
      err.message || err
    );
  }

  const noopReferences = { hasChanges: false, references: new Map() };
  const locationResult = runSupportCollections
    ? await syncWebflowLocations(airtablePropertyRecords)
    : noopReferences;
  if (locationResult.hasChanges && WEBFLOW_LOCATIONS_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_LOCATIONS_COLLECTION_ID);
  }

  const legalResult = runSupportCollections
    ? await syncWebflowLegals(airtablePropertyRecords)
    : noopReferences;
  if (legalResult.hasChanges && WEBFLOW_LEGALS_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_LEGALS_COLLECTION_ID);
  }

  const filesLinksResult = runSupportCollections
    ? await syncWebflowFilesAndLinks(airtablePropertyRecords)
    : noopReferences;
  if (filesLinksResult.hasChanges && WEBFLOW_FILES_LINKS_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_FILES_LINKS_COLLECTION_ID);
  }

  const layoutsInsideResult = runSupportCollections
    ? await syncWebflowLayoutsInside(airtablePropertyRecords)
    : noopReferences;
  if (layoutsInsideResult.hasChanges && WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_LAYOUTS_INSIDE_COLLECTION_ID);
  }

  const layoutsOutsideResult = runSupportCollections
    ? await syncWebflowLayoutsOutside(airtablePropertyRecords)
    : noopReferences;
  if (layoutsOutsideResult.hasChanges && WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_LAYOUTS_OUTSIDE_COLLECTION_ID);
  }

  const facilitiesResult = runFacilities
    ? await syncWebflowFacilities(airtablePropertyRecords)
    : { hasChanges: false };
  if (facilitiesResult.hasChanges && WEBFLOW_FACILITIES_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_FACILITIES_COLLECTION_ID);
  }

  const environmentsResult = runEnvironments
    ? await syncWebflowEnvironments(airtablePropertyRecords)
    : { hasChanges: false };
  if (environmentsResult.hasChanges && WEBFLOW_ENVIRONMENTS_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_ENVIRONMENTS_COLLECTION_ID);
  }

  const comfortResult = runComfort
    ? await syncWebflowComforts(
        airtablePropertyRecords,
        facilitiesResult.references || new Map()
      )
    : {
        hasChanges: false,
        references:
          (WEBFLOW_COMFORT_COLLECTION_ID
            ? await buildReferenceMapFromCollection(WEBFLOW_COMFORT_COLLECTION_ID)
            : new Map())
      };
  if (comfortResult.hasChanges && WEBFLOW_COMFORT_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_COMFORT_COLLECTION_ID);
  }

  const supportReferences = runSupportCollections
    ? {
        locations: locationResult.references || new Map(),
        legals: legalResult.references || new Map(),
        files: filesLinksResult.references || new Map(),
        layoutsInside: layoutsInsideResult.references || new Map(),
        layoutsOutside: layoutsOutsideResult.references || new Map(),
        comfort: comfortResult.references || new Map(),
        facilities: facilitiesResult.references || new Map(),
        environments: environmentsResult.references || new Map()
      }
    : {
        locations: new Map(),
        legals: new Map(),
        files: new Map(),
        layoutsInside: new Map(),
        layoutsOutside: new Map(),
        comfort: comfortResult.references || new Map(),
        facilities: facilitiesResult.references || new Map(),
        environments: environmentsResult.references || new Map()
      };

  const propertyResult = runProperties
    ? await syncWebflowProperties(
        agentResult.references,
        airtablePropertyRecords,
        supportReferences,
        { forcePropertyIds: options.forcePropertyIds || [] }
      )
    : { hasChanges: false, propertyReferenceMap: new Map() };
  if (propertyResult.hasChanges) {
    collectionsToPublish.add(WEBFLOW_PROPERTIES_COLLECTION_ID);
  }

  const projectResult = runProjects
    ? await syncWebflowProjects(
        airtablePropertyRecords,
        propertyResult.propertyReferenceMap
      )
    : { hasChanges: false };
  if (projectResult.hasChanges && WEBFLOW_PROJECTS_COLLECTION_ID) {
    collectionsToPublish.add(WEBFLOW_PROJECTS_COLLECTION_ID);
  }

  const anyChanges =
    agentResult.hasChanges ||
    locationResult.hasChanges ||
    legalResult.hasChanges ||
    filesLinksResult.hasChanges ||
    layoutsInsideResult.hasChanges ||
    layoutsOutsideResult.hasChanges ||
    comfortResult.hasChanges ||
    facilitiesResult.hasChanges ||
    environmentsResult.hasChanges ||
    projectResult.hasChanges ||
    propertyResult.hasChanges;

  if (collectionsToPublish.size > 0) {
    await publishWebflowSite(Array.from(collectionsToPublish));
  } else if (!anyChanges) {
    console.log("ℹ️ No Webflow items changed; skipping publish.");
  }
}

const directExecutionHref =
  process.argv[1] != null ? pathToFileURL(process.argv[1]).href : null;
const isDirectExecution = import.meta.url === directExecutionHref;

if (isDirectExecution) {
  const modeArg = process.argv[2] || "all";
  const forceArgRaw = process.argv[3] || "";
  const forcePropertyIds = forceArgRaw
    ? forceArgRaw
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
    : [];
  syncWebflow(modeArg, { forcePropertyIds }).catch(err => {
    console.error("❌ Fatal error during Webflow sync:", err);
    process.exit(1);
  });
}
