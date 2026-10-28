import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import SwaggerParser from "@apidevtools/swagger-parser";
import { createOpenApiDocument } from "./spec";

const path = fileURLToPath(new URL("../../../../docs/openapi.yaml", import.meta.url));
const text = stringify(createOpenApiDocument());
await SwaggerParser.validate(JSON.parse(JSON.stringify(createOpenApiDocument())));
if (process.argv.includes("--check")) {
  if (await readFile(path, "utf8") !== text) {
    throw new Error("docs/openapi.yaml is stale. Run pnpm api:generate.");
  }
  console.log("PASS: OpenAPI structure and generated Zod contracts are current.");
} else {
  await writeFile(path, text);
  console.log("Generated docs/openapi.yaml from shared Zod contracts.");
}
