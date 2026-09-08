// Fetch the current Booksy rating for the salon and refresh content/data.json.
// Safe by design: on ANY failure (network, blocked, page structure changed) it
// leaves data.json untouched, so the site keeps showing the last known rating.

const BOOKSY_URL = "https://booksy.com/pl-pl/265397_gabinet-masazu-tina_masaz_9954_niepolomice";
const DATA_PATH = new URL("../content/data.json", import.meta.url);

async function fetchRating() {
  const res = await fetch(BOOKSY_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "pl-PL,pl;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Booksy responded with HTTP ${res.status}`);
  const html = await res.text();

  const blocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, json] of blocks) {
    try {
      const data = JSON.parse(json);
      const agg = data.aggregateRating;
      if (agg && agg.ratingValue != null && agg.reviewCount != null) {
        return {
          value: Number(agg.ratingValue).toFixed(1),
          count: parseInt(agg.reviewCount, 10),
        };
      }
    } catch {
      // not valid/relevant JSON-LD, keep looking
    }
  }
  throw new Error("No aggregateRating found in Booksy page (page structure may have changed)");
}

async function main() {
  let fresh;
  try {
    fresh = await fetchRating();
  } catch (err) {
    console.log(`Could not refresh Booksy rating, keeping last known value. Reason: ${err.message}`);
    return; // exit 0 — data.json stays as-is
  }

  const fs = await import("node:fs/promises");
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);

  const current = data.rating || {};
  if (String(current.value) === String(fresh.value) && Number(current.count) === Number(fresh.count)) {
    console.log(`Rating unchanged (${fresh.value} / ${fresh.count} opinii) — nothing to commit.`);
    return;
  }

  data.rating = fresh;
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Rating updated: ${current.value ?? "?"}/${current.count ?? "?"} -> ${fresh.value}/${fresh.count}`);
}

main();
