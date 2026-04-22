import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const dataPath = path.join(projectRoot, "data", "cards.json");
const snapshotDir = path.join(projectRoot, "data", "snapshots");

function isActive(expireDate) {
  if (!expireDate) return true;
  const now = new Date();
  return new Date(`${expireDate}T23:59:59`) >= now;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeFileName(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 120);
}

async function fetchSnapshot(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; offer-bot/1.0)"
      }
    });
    if (!response.ok) {
      return { ok: false, status: response.status, text: "" };
    }
    const html = await response.text();
    return { ok: true, status: response.status, text: stripHtml(html) };
  } catch (error) {
    return { ok: false, status: "network_error", text: String(error) };
  }
}

async function run() {
  const raw = await readFile(dataPath, "utf8");
  const data = JSON.parse(raw);
  await mkdir(snapshotDir, { recursive: true });

  for (const card of data.cards) {
    card.benefits = (card.benefits || []).filter((benefit) => isActive(benefit.expiresAt));
    card.merchantRewards = (card.merchantRewards || []).filter((rule) => isActive(rule.expiresAt));

    const results = [];
    for (const sourceUrl of card.sourceUrls || []) {
      const result = await fetchSnapshot(sourceUrl);
      results.push(result.ok);
      const outputName = sanitizeFileName(sourceUrl) + ".txt";
      const outputPath = path.join(snapshotDir, outputName);
      const meta = `url=${sourceUrl}\nstatus=${result.status}\nfetchedAt=${new Date().toISOString()}\n\n`;
      await writeFile(outputPath, meta + result.text, "utf8");
    }

    card.sourceStatus = results.length > 0 && results.every(Boolean) ? "official" : "partial";
    card.lastCrawledAt = new Date().toISOString();
  }

  data.generatedAt = new Date().toISOString().slice(0, 10);
  await writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
  console.log("offers updated");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
