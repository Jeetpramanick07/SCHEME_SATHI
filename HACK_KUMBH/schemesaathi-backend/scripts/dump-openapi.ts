import { buildServer } from "../src/server.js";
import { initDb, closeDb } from "../src/db/index.js";
import fs from "fs";

async function dump() {
  await initDb();
  const server = await buildServer();
  await server.ready();

  const injectRes = await server.inject({
    method: "GET",
    url: "/docs/json",
  });

  const spec = JSON.parse(injectRes.body);
  fs.writeFileSync("openapi.json", JSON.stringify(spec, null, 2));
  console.log("Successfully dumped openapi.json. Path count:", Object.keys(spec.paths || {}).length);

  await server.close();
  await closeDb();
}

dump().catch((err) => {
  console.error("Failed to dump openapi:", err);
  process.exit(1);
});
