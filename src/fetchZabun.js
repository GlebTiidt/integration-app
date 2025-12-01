import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_PAGE_SIZE = 100;
const MAX_ITERATIONS = 500;

const DEFAULT_SORT_FIELD = process.env.ZABUN_SORT || "MOST_RECENT";
const DEFAULT_SORT_ORDER = process.env.ZABUN_SORT_ORDER || "ASC";
const FILTER_FULL_TEXT = process.env.ZABUN_FILTER_FULL_TEXT;
const FILTER_UPDATED_SINCE = process.env.ZABUN_FILTER_UPDATED_SINCE;

export async function fetchZabunProperties(limit = 200, options = {}) {
  const { offset = 0 } = options;
  const baseUrl = "https://public.api-cms.zabun.be/api/v1/property/search";
  const acceptLanguage = process.env.ZABUN_LANGUAGE || "nl";

  const headers = {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    "client_id": process.env.ZABUN_CLIENT_ID,
    "server_id": process.env.ZABUN_SERVER_ID,
    "api_key": process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Language": acceptLanguage
  };

  const pageSize = Math.min(limit > 0 ? limit : DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE);
  const targetCount = limit > 0 ? limit : undefined;
  const startOffset = Math.max(offset, 0);

  let currentPage = Math.floor(startOffset / pageSize);
  let iterations = 0;
  let totalFetchedFromApi = 0;
  let totalAvailable = null;
  let firstPage = true;
  let firstPageSkipCount = startOffset % pageSize;
  let metaLoggedOnce = false;

  const collected = [];
  const seenIds = new Set();

  console.log(
    `🌐 Fetching Zabun properties with page size ${pageSize}, start offset ${startOffset}, target ${targetCount ?? "unbounded"
    }.`
  );

  while ((targetCount === undefined || collected.length < targetCount) && iterations < MAX_ITERATIONS) {
    console.log(`📄 Requesting page ${currentPage} (size ${pageSize})...`);

    const { items, meta, raw, headersSnapshot } = await fetchPropertiesPage(
      baseUrl,
      headers,
      currentPage,
      pageSize
    );

    if (!metaLoggedOnce) {
      if (headersSnapshot && Object.keys(headersSnapshot).length) {
        console.log("📬 Pagination headers:", headersSnapshot);
      }
      if (meta.debug) {
        console.log("📖 Pagination meta payload:", meta.debug);
      }
      metaLoggedOnce = true;
    }

    if (meta.totalItems != null) {
      totalAvailable = meta.totalItems;
    }

    if (!Array.isArray(items) || items.length === 0) {
      if (iterations === 0) {
        console.warn("⚠️ Zabun search returned no records. Raw payload:");
        console.warn(JSON.stringify(raw, null, 2));
      } else {
        console.warn(`⚠️ Page ${currentPage} returned 0 records. Stopping pagination.`);
      }
      break;
    }

    const firstItemId = getPropertyId(items[0]);
    if (firstItemId != null) {
      console.log(`🔹 First property ID on page ${currentPage}: ${firstItemId}`);
    }

    totalFetchedFromApi += items.length;

    const collectedBefore = collected.length;
    const seenIdsBefore = seenIds.size;

    const startIndex = firstPage ? Math.min(firstPageSkipCount, items.length) : 0;

    for (let i = startIndex; i < items.length; i += 1) {
      const item = items[i];
      const propertyId = getPropertyId(item);
      if (propertyId == null) continue;
      if (seenIds.has(propertyId)) continue;

      seenIds.add(propertyId);
      collected.push(item);

      if (targetCount !== undefined && collected.length >= targetCount) {
        break;
      }
    }

    firstPage = false;
    firstPageSkipCount = 0;

    const uniqueAdded = seenIds.size - seenIdsBefore;
    const collectedAdded = collected.length - collectedBefore;

    console.log(
      `➕ Added ${uniqueAdded} new unique IDs, ${collectedAdded} items collected this page (total collected: ${collected.length}).`
    );

    if (uniqueAdded === 0 && collectedAdded === 0) {
      console.warn("⚠️ No new unique properties collected on this page. Stopping pagination.");
      break;
    }

    if (targetCount !== undefined && collected.length >= targetCount) {
      break;
    }

    if (items.length < pageSize) {
      console.log("🏁 Last page detected (received fewer items than page size).");
      break;
    }

    if (totalAvailable != null && startOffset + collected.length >= totalAvailable) {
      console.log("🏁 Reached total available items reported by API.");
      break;
    }

    iterations += 1;
    currentPage += 1;
  }

  const limitLabel = limit > 0 ? `limit ${limit}` : "no limit";
  console.log(
    `📦 Received ${collected.length} properties from Zabun (${limitLabel}, offset ${startOffset}, API fetched ${totalFetchedFromApi}, unique IDs ${seenIds.size}${totalAvailable != null ? `, total available ${totalAvailable}` : ""
    }).`
  );

  return targetCount !== undefined ? collected.slice(0, targetCount) : collected;
}

async function fetchPropertiesPage(baseUrl, headers, page, size) {
  const payload = buildSearchPayload(page, size);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Zabun API error: ${response.status} ${response.statusText} — ${text || "empty body"}`
    );
  }

  const headersSnapshot = Object.fromEntries(response.headers.entries());
  const result = await response.json();
  const items = normalizePropertiesPayload(result);
  const meta = extractPaginationMeta(result, page, size);

  return { items, meta, raw: result, headersSnapshot };
}

function buildSearchPayload(page, size) {
  const payload = {
    paging: {
      page,
      size
    }
  };

  const filtering = {};
  if (FILTER_FULL_TEXT) filtering.full_text = FILTER_FULL_TEXT;
  if (FILTER_UPDATED_SINCE) filtering.updated_since = FILTER_UPDATED_SINCE;
  if (Object.keys(filtering).length) {
    payload.filtering = filtering;
  }

  const sorting = {};
  if (DEFAULT_SORT_FIELD) sorting.sort = DEFAULT_SORT_FIELD;
  if (DEFAULT_SORT_ORDER) sorting.order = DEFAULT_SORT_ORDER;
  if (Object.keys(sorting).length) {
    payload.sorting = sorting;
  }

  return payload;
}

function normalizePropertiesPayload(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.results)) return result.results;
  if (Array.isArray(result?.properties)) return result.properties;
  if (Array.isArray(result?.records)) return result.records;
  return [];
}

function extractPaginationMeta(result, requestedPage, requestedSize) {
  const pagingSources = [
    result?.paging,
    result?.pagination,
    result?.meta?.paging,
    result?.meta?.pagination,
    result?.meta
  ].filter(Boolean);

  const meta = {
    currentPage: requestedPage,
    pageSize: requestedSize,
    totalPages: null,
    totalItems: null,
    debug: null
  };

  for (const source of pagingSources) {
    if (!source || typeof source !== "object") continue;

    meta.currentPage ??= toNumber(source.page ?? source.current_page ?? source.currentPage);
    meta.pageSize ??= toNumber(source.size ?? source.per_page ?? source.page_size ?? source.pageSize);
    meta.totalItems ??= toNumber(
      source.total ??
        source.total_items ??
        source.totalItems ??
        source.total_count ??
        source.totalCount
    );
    meta.totalPages ??= toNumber(
      source.total_pages ??
        source.totalPages ??
        source.last_page ??
        source.lastPage
    );

    if (!meta.debug) {
      meta.debug = sanitizeDebugSample(source);
    }
  }

  if (!meta.totalPages && meta.totalItems != null && meta.pageSize) {
    meta.totalPages = Math.ceil(meta.totalItems / meta.pageSize);
  }

  if (meta.currentPage == null) {
    meta.currentPage = requestedPage;
  }

  if (!meta.debug) {
    meta.debug = { requestedPage, requestedSize };
  }

  return meta;
}

function sanitizeDebugSample(source) {
  const sample = {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (
      typeof value === "number" ||
      typeof value === "string" ||
      value === null
    ) {
      sample[key] = value;
    }
  }
  return Object.keys(sample).length ? sample : null;
}

function getPropertyId(item) {
  if (!item || typeof item !== "object") return null;
  return (
    item.property_id ??
    item.propertyId ??
    item.id ??
    item.property?.id ??
    null
  );
}

function toNumber(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
