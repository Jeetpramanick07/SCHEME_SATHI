import { initDb, closeDb } from "../src/db/index.js";
import { CatalogueService } from "../src/modules/catalogue/service.js";
import { rulesCache } from "../src/services/cache.js";

async function verifyMultilingualSearch() {
  await initDb();
  rulesCache.invalidate();

  console.log("================ MULTILINGUAL SEARCH VERIFICATION ================");

  const queries = [
    { lang: "mr" as const, q: "शेतकरी", desc: "Marathi: 'शेतकरी' (Farmer)" },
    { lang: "mr" as const, q: "लाडकी", desc: "Marathi: 'लाडकी' (Beloved)" },
    { lang: "mr" as const, q: "बहीण", desc: "Marathi: 'बहीण' (Sister)" },
    { lang: "mr" as const, q: "घरकुल", desc: "Marathi: 'घरकुल' (Housing)" },
    { lang: "mr" as const, q: "पथविक्रेता", desc: "Marathi: 'पथविक्रेता' (Street Vendor)" },
    { lang: "mr" as const, q: "निवृत्तीवेतन", desc: "Marathi: 'निवृत्तीवेतन' (Pension)" },
    { lang: "hi" as const, q: "किसान", desc: "Hindi: 'किसान' (Farmer)" },
    { lang: "hi" as const, q: "सामाजिक सहायता", desc: "Hindi: 'सामाजिक सहायता' (Social Assistance)" },
    { lang: "hi" as const, q: "आवास", desc: "Hindi: 'आवास' (Housing)" },
    { lang: "hi" as const, q: "स्ट्रीट वेंडर", desc: "Hindi: 'स्ट्रीट वेंडर' (Street Vendor)" },
    { lang: "hi" as const, q: "स्वनिधि", desc: "Hindi: 'स्वनिधि' (SVANidhi)" },
    { lang: "hi" as const, q: "कल्याणकारी", desc: "Hindi: 'कल्याणकारी' (Welfare)" },
  ];

  let passedAll = true;

  for (const item of queries) {
    const res = await CatalogueService.listSchemes({
      q: item.q,
      lang: item.lang,
      limit: 10,
    });

    console.log(`\nQuery [${item.desc}]: ${res.total_count} matching schemes found`);
    if (res.total_count === 0) {
      console.log(` ✗ FAILED: Expected matches for '${item.q}'`);
      passedAll = false;
    } else {
      for (const scheme of res.items.slice(0, 3)) {
        console.log(`  ✓ [${scheme.scheme_id}] ${scheme.display_name} (Official: ${scheme.official_name})`);
      }
    }
  }

  console.log("\n==================================================================");
  console.log(`Multilingual Search Status: ${passedAll ? "PASS (100% Verified)" : "FAIL"}`);

  await closeDb();
  process.exit(passedAll ? 0 : 1);
}

verifyMultilingualSearch().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
