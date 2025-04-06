import { strict as assertStrict } from "node:assert";
import process from "node:process";

let WORKER_URL = process.env.WORKER_URL;

interface FileEntry {
  type: string;
  name: string;
  path: string;
}

interface ApiError {
  path: string;
  status: number;
  message: string;
  timestamp: string;
}

async function verifyDeploy() {
  if (WORKER_URL == null || WORKER_URL.trim() === "") {
    throw new Error("WORKER_URL environment variable is required");
  }

  console.log("🔍 Verifying deployment...");

  // ensure that the worker url starts with https://
  if (!WORKER_URL.startsWith("https://")) {
    WORKER_URL = `https://${WORKER_URL}`;
  }

  // Test 1: List files from /proxy endpoint
  console.log("\n📁 Testing /proxy endpoint...");
  const proxyRes = await fetch(`${WORKER_URL}/proxy`);
  assertStrict.equal(proxyRes.status, 200, "Proxy endpoint should return 200");

  const proxyData = await proxyRes.json() as FileEntry[];
  assertStrict.ok(Array.isArray(proxyData), "Response should be an array");
  assertStrict.ok(proxyData.length > 0, "Response should not be empty");
  assertStrict.ok(proxyData[0].type, "First entry should have a type");
  assertStrict.ok(proxyData[0].name, "First entry should have a name");
  assertStrict.ok(proxyData[0].path, "First entry should have a path");

  // Test 2: Handle 404 for non-existent paths
  console.log("\n❌ Testing 404 handling...");
  const notFoundRes = await fetch(`${WORKER_URL}/proxy/non-existent-path`);
  assertStrict.equal(notFoundRes.status, 404, "Non-existent path should return 404");

  const notFoundError = await notFoundRes.json() as ApiError;
  assertStrict.ok(notFoundError.path, "Error should have a path");
  assertStrict.equal(notFoundError.status, 404, "Error status should be 404");
  assertStrict.equal(notFoundError.message, "Not Found", "Error message should be \"Not Found\"");
  assertStrict.ok(notFoundError.timestamp, "Error should have a timestamp");

  // Test 3: Proxy a specific file
  console.log("\n📄 Testing file proxy...");
  const fileRes = await fetch(`${WORKER_URL}/proxy/emoji/15.1/emoji-test.txt`);
  assertStrict.equal(fileRes.status, 200, "File proxy should return 200");
  assertStrict.ok(fileRes.headers.get("content-type")?.includes("text/plain"), "Content type should be text/plain");

  // Test 4: List directory contents
  console.log("\n📂 Testing directory listing...");
  const dirRes = await fetch(`${WORKER_URL}/proxy/emoji/15.1`);
  assertStrict.equal(dirRes.status, 200, "Directory listing should return 200");

  const dirData = await dirRes.json() as FileEntry[];
  assertStrict.ok(Array.isArray(dirData), "Directory response should be an array");
  assertStrict.ok(dirData.length > 0, "Directory response should not be empty");
  assertStrict.ok(dirData[0].type, "First entry should have a type");
  assertStrict.ok(dirData[0].name, "First entry should have a name");
  assertStrict.ok(dirData[0].path, "First entry should have a path");

  // Test 5: Handle server errors
  console.log("\n⚠️ Testing error handling...");
  const errorRes = await fetch(`${WORKER_URL}/proxy/invalid-path/`);
  assertStrict.equal(errorRes.status, 500, "Invalid path should return 500");

  const error = await errorRes.json() as ApiError;
  assertStrict.ok(error.path, "Error should have a path");
  assertStrict.equal(error.status, 500, "Error status should be 500");
  assertStrict.equal(error.message, "Internal server error", "Error message should be \"Internal server error\"");
  assertStrict.ok(error.timestamp, "Error should have a timestamp");

  console.log("\n✅ All tests passed!");
}

verifyDeploy().catch((error) => {
  console.error("\n❌ Verification failed:", error);
  process.exit(1);
});
