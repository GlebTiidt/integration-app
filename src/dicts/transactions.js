import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let cachedTransactions = null;

/**
 * Декодирует transaction_id в название типа сделки (например "For sale", "Sold", "For rent")
 * @param {number} transactionId - ID из Zabun property.transaction_id
 * @returns {Promise<string>} Название сделки
 */
export async function decodeTransaction(transactionId) {
  if (!transactionId) return "—";

  // ✅ Кэшируем словарь, чтобы не дергать API на каждую запись
  if (!cachedTransactions) {
    console.log("📥 Fetching property transactions from Zabun...");
    const res = await fetch("https://public.api-cms.zabun.be/api/v1/property/transactions", {
      headers: {
        "X-CLIENT-ID": process.env.ZABUN_X_CLIENT_ID,
        "client_id": process.env.ZABUN_CLIENT_ID,
        "server_id": process.env.ZABUN_SERVER_ID,
        "api_key": process.env.ZABUN_API_KEY,
        "Accept": "application/json",
        "Accept-Language": "nl",
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      console.error(`❌ Failed to fetch transactions: ${res.status} ${res.statusText}`);
      return "—";
    }

    cachedTransactions = await res.json();

    if (!Array.isArray(cachedTransactions)) {
      console.error("❌ Invalid response format for property transactions");
      return "—";
    }
  }

  // 🔍 Ищем совпадение по ID
  const match = cachedTransactions.find(t => t.id === transactionId);

  if (!match) {
    console.warn(`⚠️ Transaction not found for ID ${transactionId}`);
    return String(transactionId); // временно возвращаем ID
  }

  // 🏷️ Возвращаем английское имя
  return match.name?.nl ?? match.name?.en ?? "—";
}
