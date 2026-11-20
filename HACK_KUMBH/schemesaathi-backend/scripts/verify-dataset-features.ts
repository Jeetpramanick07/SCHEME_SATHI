import { initDb, closeDb } from "../src/db/index.js";
import { buildServer } from "../src/server.js";

async function main() {
  await initDb();
  const app = await buildServer();

  console.log("==========================================================================");
  console.log("            DATASET EXPANSION, FAQS & NGO DASHBOARD VERIFICATION          ");
  console.log("==========================================================================\n");

  // 1. Test FAQ search
  console.log("1. Testing Global FAQ Search (GET /api/v1/faqs?q=pension&limit=3)...");
  const faqRes = await app.inject({
    method: "GET",
    url: "/api/v1/faqs?q=pension&limit=3",
    headers: { "x-api-key": "citizen-secret-key" },
  });
  const faqData = faqRes.json();
  console.log(`   Found ${faqData.count} FAQs matching 'pension':`);
  for (const item of faqData.items) {
    console.log(`   • [${item.scheme_id}] Q: "${item.question.substring(0, 80)}..."`);
    console.log(`     A: "${item.answer.substring(0, 100)}..."\n`);
  }

  // 2. Test Scheme-specific FAQs
  console.log("2. Testing Scheme-Specific FAQs (GET /api/v1/schemes/CENT-MOHFW-PMJAY-002/faqs)...");
  const schemeFaqRes = await app.inject({
    method: "GET",
    url: "/api/v1/schemes/CENT-MOHFW-PMJAY-002/faqs",
    headers: { "x-api-key": "citizen-secret-key" },
  });
  const schemeFaqData = schemeFaqRes.json();
  console.log(`   Retrieved ${schemeFaqData.count} FAQs for Ayushman Bharat PM-JAY:`);
  for (const item of schemeFaqData.faqs.slice(0, 2)) {
    console.log(`   • Q: "${item.question}"`);
    console.log(`     A: "${item.answer.substring(0, 100)}..."\n`);
  }

  // 3. Test District Coverage
  console.log("3. Testing Vidarbha District Coverage (GET /api/v1/admin/district-coverage)...");
  const covRes = await app.inject({
    method: "GET",
    url: "/api/v1/admin/district-coverage",
    headers: { "x-api-key": "admin-secret-key" },
  });
  const covData = covRes.json();
  console.log(`   Region: ${covData.region} | Total Mappings: ${covData.total_mapped_schemes}`);
  console.log("   District Scheme Breakdown:");
  for (const d of covData.districts.slice(0, 5)) {
    console.log(`   • ${d.district} (${d.district_id}): ${d.total_schemes} schemes (Online: ${d.online_count}, Offline: ${d.offline_count})`);
  }

  // 4. Test Under-Served Areas
  console.log("\n4. Testing Under-Served Areas Ranking (GET /api/v1/admin/under-served-areas)...");
  const underRes = await app.inject({
    method: "GET",
    url: "/api/v1/admin/under-served-areas",
    headers: { "x-api-key": "admin-secret-key" },
  });
  const underData = underRes.json();
  console.log("   Top Districts Ranked by Offline Friction:");
  for (const d of underData.districts_ranked_by_friction.slice(0, 4)) {
    console.log(`   • ${d.district}: ${d.offline_friction_percentage}% Offline Friction | Friction Level: ${d.friction_level}`);
    console.log(`     Recommended Action: "${d.recommended_ngo_intervention}"`);
  }

  console.log("\n==========================================================================");
  console.log("                         VERIFICATION COMPLETED SUCCESSFULLY              ");
  console.log("==========================================================================");

  await app.close();
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
