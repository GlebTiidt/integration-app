import fetch from "node-fetch";
import dotenv from "dotenv";

// 🧭 Import all vocabularies
import { decodeCountry } from "./dicts/countries.js";
import { decodeCity } from "./dicts/cities.js";
import { decodeStatus } from "./dicts/statuses.js";
import { decodeTransaction } from "./dicts/transactions.js";
import { decodeType, getTypeHeadTypeId } from "./dicts/types.js";
import { decodeEnvironments } from "./dicts/environments.js";
import { decodeFacilities } from "./dicts/facilities.js";
import { summarizeLayouts } from "./dicts/layouts.js";
import { summarizeTechnicals } from "./dicts/technicals.js";
import { decodeBuildingType } from "./dicts/building_types.js";
import { decodeCondition } from "./dicts/conditions.js";
import { decodeVideoType } from "./dicts/videos.js";
import { decodeFileType } from "./dicts/files.js";
import { decodeSticker } from "./dicts/stickers.js";
import { decodeTownPlanning } from "./dicts/town_plannings.js";
import { decodeTownPlanningViolation } from "./dicts/town_planning_violations.js";
import { decodeBuildingLicense } from "./dicts/building_licenses.js";
import { decodeRenovationObligation } from "./dicts/renovation_obligations.js";
import { decodeHeritage } from "./dicts/heritage.js";
import { decodeHeadType } from "./dicts/head_types.js";
import { decodeBuildingObligation } from "./dicts/building_obligations.js";
import { decodeGardenDirection } from "./dicts/garden_directions.js";
import { decodeFloodingSensitivity } from "./dicts/flooding_sensitivities.js";
import { decodeFloodingZone } from "./dicts/flooding_zones.js";
import { decodeState } from "./dicts/states.js";
import { logError } from "./utils/errorLogger.js";

dotenv.config({ path: ".env" });

const agentRecordIdCache = new Map();
const REQUIRED_AIRTABLE_FIELDS = [
  "name",
  "slug",
  "external_id",
  "company_id",
  "price",
  "street",
  "city",
  "zip",
  "country",
  "transaction",
  "type"
];

function resolveHeadTypeId(property, fallbackHeadTypeId = null) {
  const candidates = [
    property?.head_type_id,
    property?.headTypeId,
    property?.head_type,
    property?.headType,
    property?.general_type,
    property?.generalType,
    property?.type?.head_type_id,
    property?.type?.headTypeId,
    property?.type?.head_type,
    property?.type?.headType,
    property?.type?.general_type,
    property?.type?.generalType
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
      const objectResult = normalize(
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
      if (objectResult != null) return objectResult;

      if (value.type) {
        const typeResult = normalize(
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
        if (typeResult != null) return typeResult;
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
  if (fallbackHeadTypeId != null) return fallbackHeadTypeId;
  return null;
}

async function resolveAgentRecordId(personId) {
  if (!personId) return null;
  const cacheKey = String(personId);
  if (agentRecordIdCache.has(cacheKey)) {
    return agentRecordIdCache.get(cacheKey);
  }

  const baseId = process.env.AIRTABLE_BASE_ID;
  const agentTable = process.env.AIRTABLE_AGENTS_TABLE_NAME;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !agentTable || !token) {
    agentRecordIdCache.set(cacheKey, null);
    return null;
  }

  const apiUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    agentTable
  )}`;
  const filterFormula = `person_id=${personId}`;
  const url = `${apiUrl}?filterByFormula=${encodeURIComponent(
    filterFormula
  )}&maxRecords=1`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(
        `⚠️ Unable to lookup agent record for person_id ${personId}: ${response.status} ${response.statusText} ${text}`
      );
      agentRecordIdCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    const recordId = data.records?.[0]?.id ?? null;
    if (!recordId) {
      console.warn(
        `⚠️ No Airtable agent record found for person_id ${personId}.`
      );
    }
    agentRecordIdCache.set(cacheKey, recordId);
    return recordId;
  } catch (err) {
    console.warn(
      `⚠️ Exception during agent lookup for person_id ${personId}:`,
      err.message || err
    );
    agentRecordIdCache.set(cacheKey, null);
    return null;
  }
}

// 🧩 Safe date formatting
function cleanDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

function logMissingAirtableFields(propertyId, fields) {
  const missing = [];
  for (const fieldKey of REQUIRED_AIRTABLE_FIELDS) {
    const value = fields[fieldKey];
    const isMissing =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);

    if (isMissing) {
      missing.push(fieldKey);
    }
  }

  if (missing.length) {
    const message = `Missing Airtable fields for property ${propertyId}: ${missing.join(
      ", "
    )}`;
    console.warn(`⚠️ ${message}`);
    logError("AirtableMissingFields", new Error(message), {
      propertyId,
      missingFields: missing
    });
  }
}

// ✅ Universal helper to convert YES/NO → boolean
function toBool(value) {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  const normalized = String(value).trim().toUpperCase();
  return normalized === "YES" || normalized === "TRUE" || normalized === "1";
}

const NA_VALUE = "N/A";

function sanitizeDecodedString(value) {
  if (value == null) return NA_VALUE;
  if (typeof value === "number") {
    return sanitizeDecodedString(String(value));
  }
  if (typeof value !== "string") return NA_VALUE;
  const trimmed = value.trim();
  if (!trimmed) return NA_VALUE;
  const lower = trimmed.toLowerCase();
  if (
    lower === "unknown" ||
    lower.startsWith("unknown ") ||
    lower === "n/a" ||
    lower === "na" ||
    trimmed === "—" ||
    trimmed === "-"
  ) {
    return NA_VALUE;
  }
  return trimmed;
}

function extractLabel(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return value.name || value.label || value.value || "";
  }
  return "";
}

function sanitizeDecodedList(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .map(item => sanitizeDecodedString(extractLabel(item)))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function resolveFirstNonEmptyString(values) {
  if (!Array.isArray(values)) return "";
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    } else if (value && typeof value === "object") {
      const candidate = resolveFirstNonEmptyString([
        value.value,
        value.label,
        value.name,
        value.code,
        value.slug,
        value.id
      ]);
      if (candidate) return candidate;
    }
  }
  return "";
}

function hasNonEmptyString(value) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (value && typeof value === "object") {
    return (
      hasNonEmptyString(value.value) ||
      hasNonEmptyString(value.label) ||
      hasNonEmptyString(value.name) ||
      hasNonEmptyString(value.code) ||
      hasNonEmptyString(value.slug) ||
      hasNonEmptyString(value.id)
    );
  }
  return false;
}

function deriveEpcLabelFromValue(epcValueRaw) {
  if (epcValueRaw == null) return "N/A";

  const value = typeof epcValueRaw === "number" ? epcValueRaw : Number(epcValueRaw);
  if (!Number.isFinite(value)) return "N/A";

  if (value <= 0) return "epc_A+";
  if (value <= 100) return "epc_A";
  if (value <= 200) return "epc_B";
  if (value <= 300) return "epc_C";
  if (value <= 400) return "epc_D";
  if (value <= 500) return "epc_E";
  return "epc_F";
}

function extractRichTextField(value, visited = new Set()) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return "";

  if (visited.has(value)) return "";
  visited.add(value);

  if (Array.isArray(value)) {
    return value
      .map(item => extractRichTextField(item, visited))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  const preferredOrder = ["value", "html", "text", "content", "en", "nl", "fr", "de"];
  for (const key of preferredOrder) {
    if (value[key]) {
      const result = extractRichTextField(value[key], visited);
      if (result) return result;
    }
  }

  const fallback = Object.values(value)
    .map(item => extractRichTextField(item, visited))
    .filter(Boolean)
    .join("\n")
    .trim();
  return fallback;
}

// 🚀 Main synchronization function Zabun → Airtable
export async function sendToAirtable(property) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME;
  const token = process.env.AIRTABLE_TOKEN;
  const apiUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

  const name = `property-${property.property_id}`;
  const slug = name;
  const address = property.address || {};

  // 🌍 Parallel loading of dictionary values
  const [
    countryName,
    cityData,
    stateData,
    constructionStatus,
    transaction,
    typeNameRaw,
    buildingType,
    condition,
    environmentsData,
    facilitiesData,
    layoutSummary,
    technicalSummary,
    stickerName,
    townPlanningValue,
    townPlanningViolationValue,
    buildingLicenseValue,
    renovationObligationValue,
    heritageValue,
    typeHeadTypeId,
    buildingObligationValue,
    gardenDirectionValue,
    floodingSensitivityValue,
    floodingZoneValue
  ] = await Promise.all([
    decodeCountry(address.country_geo_id).catch(() => NA_VALUE),
    decodeCity(address.city_geo_id, address.country_geo_id).catch(() => ({ name: NA_VALUE, zip: "" })),
    decodeState(address.state_geo_id, address.country_geo_id).catch(() => NA_VALUE),
    decodeStatus(property.status_id).catch(() => NA_VALUE),
    decodeTransaction(property.transaction_id).catch(() => NA_VALUE),
    decodeType(property.type_id).catch(() => NA_VALUE),
    decodeBuildingType(property.building_type_id).catch(() => NA_VALUE),
    decodeCondition(property.condition_id).catch(() => NA_VALUE),
    decodeEnvironments(property.environments).catch(() => []),
    decodeFacilities(property.facilities).catch(() => []),
    summarizeLayouts(property.layouts).catch(() => ({})),
    summarizeTechnicals(property.technicals).catch(() => ({})),
    decodeSticker(property.sticker_id).catch(() => NA_VALUE),
    decodeTownPlanning(property.town_planning_id).catch(() => NA_VALUE),
    decodeTownPlanningViolation(property.town_planning_violation_id).catch(() => NA_VALUE),
    decodeBuildingLicense(property.building_license_id).catch(() => NA_VALUE),
    decodeRenovationObligation(property.renovation_obligation_id).catch(() => NA_VALUE),
    decodeHeritage(property.heritage_inventoried_id).catch(() => NA_VALUE),
    getTypeHeadTypeId(property.type_id).catch(() => null),
    decodeBuildingObligation(property.building_obligation_id).catch(() => NA_VALUE),
    decodeGardenDirection(property.direction_garden_id).catch(() => NA_VALUE),
    decodeFloodingSensitivity(property.o_level_flooding_sensitivity_id).catch(() => NA_VALUE),
    decodeFloodingZone(property.o_level_flooding_zone_id).catch(() => NA_VALUE)
  ]);

  const headTypeId = resolveHeadTypeId(property, typeHeadTypeId);
  let headTypeName = NA_VALUE;
  if (headTypeId != null) {
    if (typeof headTypeId === "number") {
      headTypeName = await decodeHeadType(headTypeId).catch(() => NA_VALUE);
    } else if (typeof headTypeId === "string" && headTypeId.trim()) {
      headTypeName = headTypeId.trim();
    }
  }

  const cityNameRaw =
    typeof cityData === "string"
      ? cityData
      : cityData?.name ?? NA_VALUE;
  const cityName = sanitizeDecodedString(cityNameRaw);
  const zipFromCity =
    typeof cityData === "string"
      ? ""
      : cityData?.zip || "";
  const stateName = sanitizeDecodedString(stateData);
  const stateValue = stateName === NA_VALUE ? null : stateName;

  // 🌿 Transform multi-select values
  const environments = sanitizeDecodedList(environmentsData);
  const facilities = sanitizeDecodedList(facilitiesData);

  // 🖼️ Photos — merge links into a single string
  const photo_gallery = Array.isArray(property.photos)
    ? property.photos.map(p => p.url).filter(Boolean).join(", ")
    : "";

  // 🎥 Video — split by type (Video / Virtual Tour)
  let video_link = "";
  let virtual_tour_link = "";
  const decodedVideos = Array.isArray(property.videos)
    ? await Promise.all(
        property.videos.map(async v => ({
          ...v,
          typeName: sanitizeDecodedString(
            await decodeVideoType(v.type_id).catch(() => NA_VALUE)
          )
        }))
      )
    : [];

  for (const v of decodedVideos) {
    if (v.typeName === "Video") video_link = v.url;
    if (v.typeName === "Virtual Tour") virtual_tour_link = v.url;
  }

  // 📄 Files — collect links by type using the dictionary
  const filesMap = {
    1: "file_plan",
    2: "file_book_of_expenses",
    3: "file_pamphlet",
    29: "file_asbestos",
    45: "file_epc",
    102: "file_water_sensitivity",
    103: "file_estimation",
    104: "file_elektra_keuring"
  };

  const fileFields = {};
  const decodedFiles = Array.isArray(property.files)
    ? await Promise.all(
        property.files.map(async file => ({
          ...file,
          typeName: sanitizeDecodedString(
            await decodeFileType(file.type_id).catch(() => NA_VALUE)
          )
        }))
      )
    : [];

  for (const f of decodedFiles) {
    const fieldName = filesMap[f.type_id];
    if (fieldName && f.url) {
      fileFields[fieldName] = f.url;
    }
  }

  // 🧱 Logging helpers
  console.log("🧱 Layout summary fetched:", layoutSummary);
  console.log("⚙️ Technical summary fetched:", technicalSummary);
  console.log("🖼️ Photo gallery links count:", property.photos?.length || 0);
  console.log("🎥 Video fields:", { video_link, virtual_tour_link });
  console.log(
    "📄 File fields:",
    Object.keys(fileFields),
    "decoded:",
    decodedFiles.map(f => `${f.typeName} (#${f.type_id})`).join(", ")
  );

  const country = sanitizeDecodedString(countryName);
  const constructionStatusValue = sanitizeDecodedString(constructionStatus);
  const transactionValue = sanitizeDecodedString(transaction);
  const typeValue = sanitizeDecodedString(typeNameRaw);
  const buildingTypeValue = sanitizeDecodedString(buildingType);
  const headTypeValue = sanitizeDecodedString(headTypeName);
  if (headTypeValue === NA_VALUE) {
    console.warn(
      `⚠️ Unable to resolve head type for property ${property.property_id}. raw id: ${headTypeId}`
    );
  }
  const conditionValue = sanitizeDecodedString(condition);
  const stickerValue = sanitizeDecodedString(stickerName);
  const townPlanningText = sanitizeDecodedString(townPlanningValue);
  const townPlanningViolationText = sanitizeDecodedString(townPlanningViolationValue);
  const buildingPermitText = sanitizeDecodedString(buildingLicenseValue);
  const renovationObligationText = sanitizeDecodedString(renovationObligationValue);
  const preEmptionRightValue = sanitizeDecodedString(property.presale_right_ynu);
  const allocationLicenseBool = toBool(property.allocation_license_ynu);
  const heritageText = sanitizeDecodedString(heritageValue);
  const buildingObligationText = sanitizeDecodedString(buildingObligationValue);
  const directionGardenText = sanitizeDecodedString(gardenDirectionValue);
  const floodingSensitivityText = sanitizeDecodedString(floodingSensitivityValue);
  const floodingZoneText = sanitizeDecodedString(floodingZoneValue);
  const descriptionShort = extractRichTextField(property.description_short);
  const descriptionFull = extractRichTextField(property.description);
  const hasEnergyLabel = hasNonEmptyString(property.energy?.custom_epc_label);
  const rawCustomEpcLabel = resolveFirstNonEmptyString([
    hasEnergyLabel ? property.energy.custom_epc_label : null,
    property.custom_epc_label,
    property.custom_epc_label,
    property.customEpcLabel,
    property.custom_epc_label_label,
    property.custom_epc_label?.label,
    property.custom_epc_label?.value,
    property.energy?.custom_epc_label,
    property.energy?.customEpcLabel,
    property.energy?.custom_epc_label?.label,
    property.energy?.custom_epc_label?.value
  ]);
  const customEpcLabelSanitized = rawCustomEpcLabel
    ? sanitizeDecodedString(rawCustomEpcLabel)
    : "";
  const computedEpcLabel = deriveEpcLabelFromValue(property.epc_value);
  const customEpcLabel =
    customEpcLabelSanitized && customEpcLabelSanitized !== NA_VALUE
      ? customEpcLabelSanitized
      : computedEpcLabel;
  const customEpcLabelSharedValue =
    typeof property.custom_epc_label_shared === "string"
      ? property.custom_epc_label_shared
      : (property.custom_epc_label_shared && typeof property.custom_epc_label_shared === "object"
          ? property.custom_epc_label_shared.label ??
            property.custom_epc_label_shared.value ??
            ""
          : "");
  const customEpcLabelShared = customEpcLabelSharedValue
    ? sanitizeDecodedString(customEpcLabelSharedValue)
    : "";
  const gScore = property.flooding_parcel_score
    ? String(property.flooding_parcel_score)
    : "N/A";
  const pScore = property.flooding_building_score
    ? String(property.flooding_building_score)
    : "N/A";
  const addressNumberRaw = address.number ?? "";
  const boxRaw = address.box ?? "";
  const numberValue =
    addressNumberRaw && String(addressNumberRaw).trim()
      ? String(addressNumberRaw).trim()
      : "";
  const boxValueRaw =
    boxRaw && String(boxRaw).trim() ? String(boxRaw).trim() : null;
  const hasBoxValue = Boolean(boxValueRaw);
  console.log("🔖 custom_epc_label sources:", {
    property: property.custom_epc_label,
    energy: property.energy?.custom_epc_label,
    epc_value: property.epc_value,
    computed: computedEpcLabel,
    resolved: customEpcLabel
  });

  const responsibleSalesrepId =
    property.responsible_salesrep_person_id ??
    property.responsible_salesrep_personId ??
    property.responsibleSalesrepPersonId ??
    null;
  const linkedAgentRecordId = await resolveAgentRecordId(responsibleSalesrepId);

  const childPropertyIds = Array.isArray(property.child_properties)
    ? property.child_properties
        .map(child => {
          if (child && typeof child === "object") {
            return (
              child.property_id ??
              child.id ??
              child.external_id ??
              null
            );
          }
          return child;
        })
        .filter(id => id != null)
        .map(id => Number.isFinite(Number(id)) ? Number(id) : String(id))
    : [];

  // 📦 Build Airtable fields payload
  const fields = {
    // 🔑 Основные данные
    name,
    slug,
    external_id: Number(property.property_id),
    is_project: property.is_project,
    photo_url: property.photo_url,
    photo_gallery,
    video_link,
    virtual_tour_link,
    ...fileFields,
    creation: cleanDate(property.creation),
    available_date: cleanDate(property.available_date),
    changed: cleanDate(property.changed),
    office_autoid: property.office_autoid,
    responsible_salesrep_person_id: property.responsible_salesrep_person_id,
    company_id: property.company_id,
    investment: Boolean(property.investment),
    child_properties: childPropertyIds.length
      ? JSON.stringify(childPropertyIds)
      : "[]",
    price: property.price,
    price_visible: property.price_visible,
    reference: property.reference,
    area_build: property.area_build,
    area_ground: property.area_ground,
    sticker: stickerValue,
    description_short: descriptionShort,
    description_full: descriptionFull,
    available: extractRichTextField(property.available),

    // ✅ Булевые флаги
    publish: Boolean(property.publish),
    show: Boolean(property.show),
    elevator: Boolean(property.elevator),
    archived: Boolean(property.archived),
    deleted: Boolean(property.deleted),
    equity: Boolean(property.equity),
    exclusive: Boolean(property.exclusive),
    holiday_residence: Boolean(property.holiday_residence),
    energy_house: Boolean(property.low_energy_house),
    main_residence: Boolean(property.main_residence),
    passive_house: Boolean(property.passive_house),
    student_residence: Boolean(property.student_residence),
    development: Boolean(property.development),

    // 🏗️ Строительство и состояние
    construction_year: property.construction_year || null,
    renovation_year: property.renovation_year || null,
    building_type: buildingTypeValue,
    head_type: headTypeValue === NA_VALUE ? null : headTypeValue,
    condition: conditionValue,

    // 🧠 Энергетика и документы
    epc_value: property.epc_value || null,
    epc_value_shared: property.epc_value_shared ?? null,
    epc_value_total: property.epc_value_total ?? null,
    epc_value_total_shared: property.epc_value_total_shared ?? null,
    epc_reference: property.epc_reference || "",
    epc_reference_shared: property.epc_reference_shared || "",
    epb_reference: property.epb_reference || "",
    epb_reference_shared: property.epb_reference_shared || "",
    custom_epc_label: customEpcLabel,
    custom_epc_label_shared: customEpcLabelShared,
    certificate_asbuilt_ynu: toBool(property.certificate_asbuilt_ynu),
    certificate_ep_ynu: toBool(property.certificate_ep_ynu),
    heritage: heritageText,
    flooding_parcel_score: gScore,
    flooding_building_score: pScore,
    heritage_protected_ynu: toBool(property.heritage_protected_ynu),
    certificate_electricity_ynu: toBool(property.certificate_electricity_ynu),
    certificate_ep_shared_ynu: toBool(property.certificate_ep_shared_ynu),
    presale_right_ynu: toBool(property.presale_right_ynu),
    access_for_disabled: toBool(
      property.access_for_disabled ?? property.access_for_disabled_ynu
    ),
    epc_date: cleanDate(property.epc_date),
    epc_date_expire: cleanDate(property.epc_date_expire),
    epc_date_shared: cleanDate(property.epc_date_shared),
    building_license: buildingPermitText,
    building_obligation: buildingObligationText,

    // 💰 Финансы
    non_indexed_ki: property.non_indexed_ki || null,
    indexed_ki: property.indexed_ki || null,
    furniture_value: property.furniture_value ?? null,
    furniture_ynu: toBool(property.furniture_ynu),
    co2: property.co2 ?? null,
    co2_shared: property.co2_shared ?? null,

    // 🐶 Прочие
    pets_allowed_ynu: toBool(property.pets_allowed_ynu),
    allocation_license_ynu: allocationLicenseBool,
    direction_garden: directionGardenText,

    // 🏢 Этажность
    floor: property.floor ?? null,
    floors_total: property.floors_total ?? null,

    // 🌍 Словари
    construction_status: constructionStatusValue,
    transaction: transactionValue,
    type: typeValue,
    environments,
    facilities,

    // 🏠 Адрес
    street: address.street || "",
    number: numberValue,
    zip: address.zip || address.city_geo?.zip || zipFromCity || "",
    latitude: address.latitude || null,
    longitude: address.longitude || null,
    city: cityName,
    state_geo_id: address.state_geo_id,
    state: stateValue,
    country,
    urban_designation: townPlanningText,
    urban_violation: townPlanningViolationText,
    building_permit: buildingPermitText,
    town_planning: townPlanningText,
    town_planning_violation: townPlanningViolationText,
    pre_emption_right: preEmptionRightValue,
    renovation_obligation: renovationObligationText,
    o_level_flooding_sensitivity: floodingSensitivityText === NA_VALUE ? "" : floodingSensitivityText,
    o_level_flooding_zone: floodingZoneText === NA_VALUE ? "" : floodingZoneText,
    water_sensitive_open_space_area: property.water_sensitive_open_space_area ?? null,
    water_sensitive_open_space_area_expire: cleanDate(property.water_sensitive_open_space_area_expire),
    width_ground: property.width_ground ?? null,
    depth_ground: property.depth_ground ?? null,
    depth_house: property.depth_house ?? null,
    width_house: property.width_house ?? null,

    // 🧩 Layout + Technical поля
    ...layoutSummary,
    ...technicalSummary
  };

  if (hasBoxValue) {
    fields.box = boxValueRaw;
  }

  if (linkedAgentRecordId) {
    fields.agent = [linkedAgentRecordId];
  }

  logMissingAirtableFields(property.property_id, fields);

  try {
    console.log(`🔍 Checking if record ${fields.external_id} exists in Airtable...`);

    const checkUrl = `${apiUrl}?filterByFormula={external_id}=${fields.external_id}`;
    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!checkRes.ok) {
      const text = await checkRes.text();
      throw new Error(
        `Airtable query failed: ${checkRes.status} ${checkRes.statusText} — ${text}`
      );
    }

    const checkData = await checkRes.json();
    const existingRecord = checkData.records?.[0];

    if (existingRecord) {
      const recordId = existingRecord.id;
      console.log(`🌀 Updating existing record (${recordId})...`);

      const updateRes = await fetch(`${apiUrl}/${recordId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ fields })
      });

      const updateResult = await updateRes.json();

      if (updateRes.ok) {
        console.log(`✅ Updated record in Airtable: ${fields.external_id}`);
        console.log(`📊 Layout fields synced:`, Object.keys(layoutSummary));
        console.log(`⚙️ Technical fields synced:`, Object.keys(technicalSummary));
      } else {
        console.error("❌ Update error:", updateResult);
        logError("AirtableUpdate", new Error("Failed to update property in Airtable"), {
          propertyId: fields.external_id,
          airtableResponse: updateResult
        });
      }
    } else {
      console.log("➕ Creating new record...");

      const createRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ records: [{ fields }] })
      });

      const createResult = await createRes.json();

      if (createRes.ok) {
        console.log(`✅ Created new record in Airtable: ${fields.external_id}`);
        console.log(`📊 Layout fields synced:`, Object.keys(layoutSummary));
        console.log(`⚙️ Technical fields synced:`, Object.keys(technicalSummary));
      } else {
        console.error("❌ Create error:", createResult);
        logError("AirtableCreate", new Error("Failed to create property in Airtable"), {
          propertyId: fields.external_id,
          airtableResponse: createResult
        });
      }
    }
  } catch (err) {
    console.error("❌ Error during sync:", err.message || err);
    logError("sendToAirtableCatch", err, {
      propertyId: property?.property_id ?? null
    });
  }
}

export async function removeFromAirtable(propertyId) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !table || !token) {
    throw new Error("Missing Airtable configuration for property removal.");
  }

  if (propertyId == null) {
    console.warn("⚠️ removeFromAirtable called without propertyId.");
    return { removed: 0 };
  }

  const normalizedId = Number(propertyId);
  const externalIdFilter = Number.isFinite(normalizedId)
    ? normalizedId
    : String(propertyId);

  const apiUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    table
  )}`;

  try {
    const listUrl = `${apiUrl}?filterByFormula=${encodeURIComponent(
      `{external_id}=${externalIdFilter}`
    )}&maxRecords=10`;

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listRes.ok) {
      const text = await listRes.text().catch(() => "");
      throw new Error(
        `Airtable list query failed: ${listRes.status} ${listRes.statusText} — ${text}`
      );
    }

    const listData = await listRes.json();
    const records = Array.isArray(listData.records) ? listData.records : [];

    if (!records.length) {
      console.log(
        `ℹ️ No Airtable record found for property ${externalIdFilter} to delete.`
      );
      return { removed: 0 };
    }

    let removed = 0;
    for (const record of records) {
      const deleteRes = await fetch(`${apiUrl}/${record.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!deleteRes.ok) {
        const text = await deleteRes.text().catch(() => "");
        console.error(
          `❌ Failed to delete Airtable record ${record.id} for property ${externalIdFilter}: ${deleteRes.status} ${deleteRes.statusText} — ${text}`
        );
        logError("AirtableDelete", new Error("Failed to delete Airtable record"), {
          propertyId: externalIdFilter,
          airtableRecordId: record.id,
          status: deleteRes.status,
          statusText: deleteRes.statusText
        });
        continue;
      }

      removed += 1;
      console.log(
        `🧹 Deleted Airtable record ${record.id} for property ${externalIdFilter}.`
      );
    }

    return { removed };
  } catch (err) {
    console.error(
      `❌ Error removing property ${externalIdFilter} from Airtable:`,
      err.message || err
    );
    logError("removeFromAirtable", err, { propertyId: externalIdFilter });
    return { removed: 0, error: err };
  }
}
