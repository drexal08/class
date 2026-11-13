/**
 * Proves that the object-storage bucket works end to end.
 *
 * Uploads a small text file with the Files SDK, lists the bucket, reads the
 * file back and prints its contents. The credentials are the AWS-standard
 * variables `neon env pull` writes into `.env` (`AWS_ACCESS_KEY_ID`,
 * `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`).
 *
 * Usage: npm run storage:test
 */

import "dotenv/config";

import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

const BUCKET = process.env.S3_BUCKET ?? "uploads";
const KEY = `tests/hello-${Date.now()}.txt`;
const BODY = [
  "Hello from LMS Core!",
  "",
  `bucket: ${BUCKET}`,
  `key: ${KEY}`,
  `uploaded: ${new Date().toISOString()}`,
].join("\n");

async function main() {
  const files = new Files({ adapter: neon({ bucket: BUCKET }) });

  console.log(`Uploading ${KEY} to bucket "${BUCKET}"…`);
  const uploaded = await files.upload(KEY, BODY, { contentType: "text/plain" });
  console.log(
    `Uploaded ${uploaded.key} (${uploaded.size} bytes, ${uploaded.contentType})`,
  );

  console.log("\nBucket contents:");
  const listing = await files.list();
  if (listing.items.length === 0) console.log("(empty)");
  for (const item of listing.items) {
    console.log(`- ${item.key} (${item.size} bytes, ${item.contentType})`);
  }

  console.log(`\nReading ${KEY} back…`);
  const file = await files.download(KEY);
  console.log("Contents:");
  console.log(await file.text());
  console.log(
    `\nRemove it with: neon bucket object delete uploads/${KEY}`,
  );
}

main().catch((error) => {
  console.error("Object storage test failed:", error);
  process.exitCode = 1;
});
