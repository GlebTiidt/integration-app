import fetch from "node-fetch";
import dotenv from "dotenv";
import { decodeAgentStatus } from "./dicts/agent_statuses.js";
import { decodeAgentProfile } from "./dicts/agent_profiles.js";
import { decodeAgentTitle } from "./dicts/agent_titles.js";
import { decodeAgentJobTitle } from "./dicts/agent_job_titles.js";

dotenv.config();

function cleanDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function normalizeString(value) {
  if (value == null) return "";
  if (typeof value !== "string") return String(value);
  return value.trim();
}

function normalizeCountryCode(value) {
  const trimmed = normalizeString(value);
  return trimmed.replace(/^\+/, "");
}

function normalizePhoneNumber(value) {
  return normalizeString(value);
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "yes", "1"].includes(normalized);
}

function resolveJobTitleId(agent) {
  return (
    agent.job_title_id ??
    agent.jobTitleId ??
    agent.job_title?.id ??
    null
  );
}

export async function upsertAgentToAirtable(agent) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_AGENTS_TABLE_NAME;
  const token = process.env.AIRTABLE_TOKEN;

  if (!baseId || !table || !token) {
    throw new Error("Missing Airtable configuration for agents sync.");
  }

  const personId = agent?.person_id;
  if (!personId) {
    console.warn("⚠️ Skipping agent without person_id:", agent);
    return { status: "skipped" };
  }

  const apiUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    table
  )}`;

  const statusLabelPromise = decodeAgentStatus(agent.status_id).catch(
    () => ""
  );
  const profileLabelPromise = decodeAgentProfile(agent.profile_id).catch(
    () => ""
  );
  const titleLabelPromise = decodeAgentTitle(agent.title_id).catch(
    () => ""
  );
  const jobTitleId = resolveJobTitleId(agent);
  const jobTitleLabelPromise = decodeAgentJobTitle(jobTitleId).catch(
    () => ""
  );

  const [statusLabel, profileLabel, titleLabel, jobTitleLabel] =
    await Promise.all([
      statusLabelPromise,
      profileLabelPromise,
      titleLabelPromise,
      jobTitleLabelPromise
    ]);

  const safeStatus = statusLabel && statusLabel !== "—" ? statusLabel : "";
  const safeProfile = profileLabel && profileLabel !== "—" ? profileLabel : "";
  const safeTitle = titleLabel && titleLabel !== "—" ? titleLabel : "";
  const safeJobTitle =
    jobTitleLabel && jobTitleLabel !== "—" ? jobTitleLabel : "";

  const fields = {
    person_id: Number(personId),
    active: toBoolean(agent.active),
    creation: cleanDate(agent.creation),
    full_name: normalizeString(agent.full_name),
    first_name: normalizeString(agent.first_name),
    last_name: normalizeString(agent.last_name),
    status: safeStatus,
    profile: safeProfile,
    title: safeTitle,
    job_title: safeJobTitle,
    working_email: normalizeString(agent.email),
    home_email: normalizeString(agent.home_email),
    direct_phone_cc: normalizeCountryCode(agent.direct_phone_cc),
    direct_phone: normalizePhoneNumber(agent.direct_phone),
    mobile_phone_cc: normalizeCountryCode(agent.mobile_phone_cc),
    mobile_phone: normalizePhoneNumber(agent.mobile_phone),
    home_phone_cc: normalizeCountryCode(agent.home_phone_cc),
    home_phone: normalizePhoneNumber(agent.home_phone)
  };

  console.log(`🔍 Checking if agent ${fields.person_id} exists in Airtable...`);

  const filterFormula = `person_id=${fields.person_id}`;
  const checkUrl = `${apiUrl}?filterByFormula=${encodeURIComponent(
    filterFormula
  )}&maxRecords=1`;

  const checkResponse = await fetch(checkUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!checkResponse.ok) {
    const text = await checkResponse.text();
    throw new Error(
      `Airtable agents lookup failed: ${checkResponse.status} ${checkResponse.statusText} — ${text}`
    );
  }

  const checkData = await checkResponse.json();
  const existingRecord = checkData.records?.[0];

  if (existingRecord) {
    const recordId = existingRecord.id;
    const updateRes = await fetch(`${apiUrl}/${recordId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields })
    });

    const updateJson = await updateRes.json().catch(() => ({}));

    if (!updateRes.ok) {
      console.error(
        `❌ Failed to update agent ${fields.person_id}:`,
        updateJson
      );
      return { status: "error", error: updateJson };
    }

    console.log(`🛠️ Updated agent ${fields.person_id} in Airtable.`);
    return { status: "updated" };
  }

  const createRes = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ records: [{ fields }] })
  });

  const createJson = await createRes.json().catch(() => ({}));

  if (!createRes.ok) {
    console.error(`❌ Failed to create agent ${fields.person_id}:`, createJson);
    return { status: "error", error: createJson };
  }

  console.log(`✨ Created agent ${fields.person_id} in Airtable.`);
  return { status: "created" };
}
