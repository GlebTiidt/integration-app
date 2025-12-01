import { fetchZabunProperties } from "./fetchZabun.js";
import { sendToAirtable, removeFromAirtable } from "./upsertAirtable.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { pathToFileURL } from "url";
import { logError } from "./utils/errorLogger.js";

dotenv.config();

// ⚙️ Fetch full Zabun property payload by ID
async function fetchZabunPropertyById(propertyId) {
  const url = `https://public.api-cms.zabun.be/api/v1/property/${propertyId}`;
  const acceptLanguage = process.env.ZABUN_LANGUAGE || "nl";

  const headers = {
    "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
    "client_id": process.env.ZABUN_CLIENT_ID,
    "server_id": process.env.ZABUN_SERVER_ID,
    "api_key": process.env.ZABUN_API_KEY,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Language": acceptLanguage,
  };

  console.log(`🌐 Fetching full property data for ID ${propertyId}...`);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    const err = new Error(`Zabun API error: ${response.status} ${response.statusText}`);
    logError("fetchZabunPropertyById", err, { propertyId, status: response.status });
    throw err;
  }

  const data = await response.json();
  return data;
}

const DEFAULT_BATCH_LIMIT = 200;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_PROPERTY_DELAY_MS = 1000;

const batchLimit = parsePositiveInt(process.env.ZABUN_FETCH_LIMIT, DEFAULT_BATCH_LIMIT);
const batchOffsetStart = parseNonNegativeInt(process.env.ZABUN_FETCH_OFFSET, 0);
const syncIntervalMs = resolveIntervalMs();
const propertyDelayMs = parsePositiveInt(
  process.env.ZABUN_PROPERTY_DELAY_MS,
  DEFAULT_PROPERTY_DELAY_MS
);

const ALWAYS_SYNC_PROPERTY_IDS = new Set([4144406]);

function prioritizeProperties(properties) {
  if (!Array.isArray(properties) || properties.length === 0) return properties;

  const priority = [];
  const rest = [];

  for (const item of properties) {
    const propertyId =
      item?.property_id ??
      item?.propertyId ??
      item?.id ??
      item?.property?.id ??
      null;

    const numericId =
      propertyId != null && Number.isFinite(Number(propertyId))
        ? Number(propertyId)
        : null;

    if (numericId != null && ALWAYS_SYNC_PROPERTY_IDS.has(numericId)) {
      priority.push(item);
    } else {
      rest.push(item);
    }
  }

  if (priority.length === 0) return properties;
  if (priority.length === properties.length) return properties;
  return [...priority, ...rest];
}

let scheduledTimer = null;
let syncInProgress = false;

export async function runFullSyncCycle() {
  console.log(
    `🚀 Starting Zabun → Airtable sync cycle (batch size ${batchLimit}, offset start ${batchOffsetStart}).`
  );

  const cycleStart = Date.now();
  let offset = batchOffsetStart;
  let batchIndex = 0;
  let totalFetched = 0;
  let totalSynced = 0;
  let totalErrors = 0;
  let skippedWithoutId = 0;
  let skippedByStatus = 0;

  const globalSeenIds = new Set();
  const globalDuplicates = new Set();

  while (true) {
    batchIndex += 1;
    console.log(`\n📦 Batch ${batchIndex} — fetching limit ${batchLimit}, offset ${offset}`);

    const properties = await fetchZabunProperties(batchLimit, { offset });

    if (!Array.isArray(properties) || properties.length === 0) {
      console.log(`🔚 No more properties returned for batch ${batchIndex}.`);
      break;
    }

    const orderedProperties = prioritizeProperties(properties);

    totalFetched += orderedProperties.length;

    const batchIds = new Set();
    const batchDuplicates = new Set();

    for (const item of orderedProperties) {
      const propertyId =
        item?.property_id ??
        item?.propertyId ??
        item?.id ??
        item?.property?.id ??
        null;

      if (propertyId == null) {
        skippedWithoutId += 1;
        continue;
      }

      if (batchIds.has(propertyId)) {
        batchDuplicates.add(propertyId);
      }
      batchIds.add(propertyId);

      if (globalSeenIds.has(propertyId)) {
        globalDuplicates.add(propertyId);
      }
      globalSeenIds.add(propertyId);
    }

    console.log(
      `🧮 Batch ${batchIndex} unique IDs: ${batchIds.size} (duplicates inside batch: ${batchDuplicates.size}, global duplicates so far: ${globalDuplicates.size}).`
    );

    if (batchDuplicates.size > 0) {
      console.log(
        "🔁 Duplicate IDs sample inside batch:",
        Array.from(batchDuplicates).slice(0, 5)
      );
    }

    let batchSynced = 0;
    let batchErrors = 0;
    let batchSkippedByStatus = 0;

    for (const [index, item] of orderedProperties.entries()) {
      const propertyId =
        item?.property_id ??
        item?.propertyId ??
        item?.id ??
        item?.property?.id ??
        null;

      if (!propertyId) {
        continue;
      }

      console.log(
        `\n🏠 Processing property ${index + 1}/${orderedProperties.length} of batch ${batchIndex} — ID: ${propertyId}`
      );

      try {
        const fullProperty = await fetchZabunPropertyById(propertyId);
        if (!shouldSyncProperty(fullProperty)) {
          skippedByStatus += 1;
          batchSkippedByStatus += 1;
          console.log(
            `⏭️ Skipping property ${propertyId} due to publish/show/archived/deleted flags.`
          );
          try {
            const { removed } = await removeFromAirtable(propertyId);
            if (removed > 0) {
              console.log(
                `🧽 Removed property ${propertyId} from Airtable because it no longer meets sync criteria.`
              );
            }
          } catch (removeErr) {
            console.error(
              `❌ Failed to remove property ${propertyId} from Airtable:`,
              removeErr.message || removeErr
            );
            logError("removeFromAirtableFromIndex", removeErr, { propertyId });
          }
          continue;
        }
        await sendToAirtable(fullProperty);
        batchSynced += 1;
        console.log(`✅ Synced property ${propertyId} (${fullProperty.reference || "no-ref"})`);
      } catch (err) {
        batchErrors += 1;
        console.error(`❌ Error syncing property ${propertyId}:`, err.message || err);
        logError("sendToAirtable", err, {
          propertyId,
          batchIndex,
          batchPosition: index + 1
        });
      }

      await sleep(propertyDelayMs);
    }

    totalSynced += batchSynced;
    totalErrors += batchErrors;

    console.log(
      `📊 Batch ${batchIndex} processed: synced ${batchSynced}, errors ${batchErrors}, skipped missing ID ${skippedWithoutId}, skipped flags ${batchSkippedByStatus}.`
    );

    offset += properties.length;

    if (properties.length < batchLimit) {
      console.log("🏁 Batch returned fewer items than the limit; assuming last batch.");
      break;
    }
  }

  const durationMs = Date.now() - cycleStart;
  console.log("\n🎉 Sync cycle finished!");
  console.log(
    `📈 Totals — fetched: ${totalFetched}, synced: ${totalSynced}, errors: ${totalErrors}, missing IDs skipped: ${skippedWithoutId}, skipped by status: ${skippedByStatus}, runtime: ${formatDuration(durationMs)}.`
  );

  if (globalDuplicates.size > 0) {
    console.log(
      "🔁 Global duplicate IDs encountered during cycle:",
      Array.from(globalDuplicates).slice(0, 10)
    );
  }

  return {
    totalFetched,
    totalSynced,
    totalErrors,
    durationMs,
    skippedWithoutId,
    skippedByStatus
  };
}

export async function runScheduledSync() {
  if (syncInProgress) {
    console.warn("⚠️ Previous sync is still running. Skipping this trigger.");
    return;
  }

  syncInProgress = true;
  try {
    await runFullSyncCycle();
  } catch (err) {
    console.error("❌ Fatal error during sync cycle:", err);
    logError("runFullSyncCycle", err);
  } finally {
    syncInProgress = false;
    scheduleNextRun(syncIntervalMs);
  }
}

function scheduleNextRun(delayMs) {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
  }
  scheduledTimer = setTimeout(runScheduledSync, delayMs);
  console.log(`⏳ Next sync scheduled in ${formatDuration(delayMs)}.`);
}

function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (Number.isFinite(num) && num > 0) {
    return Math.floor(num);
  }
  return fallback;
}

function parseNonNegativeInt(value, fallback) {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0) {
    return Math.floor(num);
  }
  return fallback;
}

function resolveIntervalMs() {
  const msFromEnv = parsePositiveInt(process.env.ZABUN_SYNC_INTERVAL_MS, null);
  if (msFromEnv != null) return msFromEnv;

  const minutesFromEnv = parsePositiveInt(process.env.ZABUN_SYNC_INTERVAL_MINUTES, null);
  if (minutesFromEnv != null) return minutesFromEnv * 60 * 1000;

  return DEFAULT_INTERVAL_MS;
}

function normalizeFlag(value) {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "yes", "1", "y"].includes(normalized);
}

function shouldSyncProperty(property) {
  if (!property || typeof property !== "object") return false;
  const propertyId =
    property?.property_id ??
    property?.propertyId ??
    property?.id ??
    null;
  const normalizedId =
    propertyId != null && Number.isFinite(Number(propertyId))
      ? Number(propertyId)
      : null;

  if (propertyId != null) {
    if (normalizedId != null && ALWAYS_SYNC_PROPERTY_IDS.has(normalizedId)) {
      const publish = normalizeFlag(property.publish);
      const show = normalizeFlag(property.show);
      const archived = normalizeFlag(property.archived);
      const deleted = normalizeFlag(property.deleted);
      if (!(publish && show && !archived && !deleted)) {
        console.warn(
          `⚠️ Forcing sync for property ${normalizedId} despite failing publish/show/archived/deleted check.`
        );
      }
      return true;
    }
  }
  const publish = normalizeFlag(property.publish);
  const show = normalizeFlag(property.show);
  const archived = normalizeFlag(property.archived);
  const deleted = normalizeFlag(property.deleted);
  return publish && show && !archived && !deleted;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "unknown";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shutdownHandler() {
  console.log("👋 Gracefully stopping Zabun → Airtable sync scheduler...");
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
  }
  process.exit(0);
}

const directExecutionHref =
  process.argv[1] != null ? pathToFileURL(process.argv[1]).href : null;
const isDirectExecution = import.meta.url === directExecutionHref;

if (isDirectExecution) {
  process.on("SIGINT", shutdownHandler);
  process.on("SIGTERM", shutdownHandler);

  runScheduledSync().catch(err => {
    console.error("❌ Unable to start sync scheduler:", err);
    logError("runScheduledSync", err);
    process.exit(1);
  });
}
