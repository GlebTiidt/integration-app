import dotenv from "dotenv";
import { fetchZabunAgents } from "./fetchZabunAgents.js";
import { upsertAgentToAirtable } from "./upsertAirtableAgents.js";

dotenv.config();

async function syncAgents() {
  try {
    const agents = await fetchZabunAgents();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const agent of agents) {
      try {
        const result = await upsertAgentToAirtable(agent);
        if (result.status === "created") created += 1;
        else if (result.status === "updated") updated += 1;
        else if (result.status === "skipped") skipped += 1;
        else if (result.status === "error") errors += 1;
      } catch (err) {
        errors += 1;
        console.error(
          `❌ Unexpected error syncing agent ${agent?.person_id}:`,
          err
        );
      }
    }

    console.log(
      `✅ Agents sync complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}.`
    );
  } catch (err) {
    console.error("❌ Fatal error during agents sync:", err);
    process.exit(1);
  }
}

syncAgents();
