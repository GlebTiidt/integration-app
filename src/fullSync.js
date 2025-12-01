import dotenv from "dotenv";
import { runFullSyncCycle } from "./index.js";
import { syncWebflow } from "./webflowSync.js";
import { fetchZabunAgents } from "./fetchZabunAgents.js";
import { upsertAgentToAirtable } from "./upsertAirtableAgents.js";

dotenv.config();

async function runCompleteSync() {
  console.log("🔁 Starting full integration pipeline (Zabun → Airtable → Webflow)...");

  const zabunSummary = await runFullSyncCycle();
  console.log(
    `📥 Zabun → Airtable phase complete: fetched ${zabunSummary.totalFetched}, synced ${zabunSummary.totalSynced}, errors ${zabunSummary.totalErrors}, skipped missing ID ${zabunSummary.skippedWithoutId}, skipped flags ${zabunSummary.skippedByStatus}.`
  );

  console.log("🧑‍💼 Starting Zabun → Airtable agents sync...");
  const agents = await fetchZabunAgents();
  let agentsCreated = 0;
  let agentsUpdated = 0;
  let agentsSkipped = 0;
  let agentsErrors = 0;

  for (const agent of agents) {
    try {
      const result = await upsertAgentToAirtable(agent);
      if (result.status === "created") agentsCreated += 1;
      else if (result.status === "updated") agentsUpdated += 1;
      else if (result.status === "skipped") agentsSkipped += 1;
      else if (result.status === "error") agentsErrors += 1;
    } catch (err) {
      agentsErrors += 1;
      console.error(
        `❌ Unexpected error during full sync agents step for ${agent?.person_id}:`,
        err
      );
    }
  }

  console.log(
    `📇 Agents phase complete: created ${agentsCreated}, updated ${agentsUpdated}, skipped ${agentsSkipped}, errors ${agentsErrors}.`
  );

  console.log("🌐 Starting Airtable → Webflow phase...");
  await syncWebflow();

  console.log("🎉 Full pipeline finished.");
}

runCompleteSync().catch(err => {
  console.error("❌ Full pipeline failed:", err);
  process.exit(1);
});
