/**
 * Proves that the object-storage bucket works end to end.
 *
 * Uploads a small text file with the Files SDK, lists the bucket, reads the
 * file back, prints its contents and checks that a browser could do the same
 * (CORS preflight + a cross-origin read). The test object is removed
 * afterwards, so the bucket is left as it was found.
 *
 * The credentials are the AWS-standard variables `neon env pull` writes into
 * `.env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`,
 * `AWS_REGION`).
 *
 * Usage: npm run storage:test
 */

import "dotenv/config";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";

const BUCKET = process.env.S3_BUCKET ?? "uploads";
const KEY = `tests/hello-${Date.now()}.txt`;
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const BODY = [
  "Hello from LMS Core!",
  "",
  `bucket: ${BUCKET}`,
  `key: ${KEY}`,
  `uploaded: ${new Date().toISOString()}`,
].join("\n");

function corsHeaders(response: Response): string[] {
  return [...response.headers]
    .filter(([name]) => /^(access-control|vary)/i.test(name))
    .map(([name, value]) => `${name}: ${value}`);
}

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

  // The app hands the browser a presigned URL, so the upload request goes
  // straight to the bucket. Check that a browser is actually allowed to do
  // that: the preflight the browser sends before the PUT, and a read.
  const client = new S3Client({
    region: process.env.S3_REGION ?? process.env.AWS_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT ?? process.env.AWS_ENDPOINT_URL_S3,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      ContentType: "text/plain",
    }),
    { expiresIn: 300 },
  );

  console.log(`\nCORS preflight from ${ORIGIN}…`);
  const preflight = await fetch(uploadUrl, {
    method: "OPTIONS",
    headers: {
      Origin: ORIGIN,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  console.log(`status: ${preflight.status}`);
  for (const header of corsHeaders(preflight)) console.log(`  ${header}`);

  console.log(`\nCross-origin read from ${ORIGIN}…`);
  const readUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: KEY }),
    { expiresIn: 300 },
  );
  const read = await fetch(readUrl, { headers: { Origin: ORIGIN } });
  console.log(`status: ${read.status}`);
  for (const header of corsHeaders(read)) console.log(`  ${header}`);

  console.log("\nRemoving the test object…");
  await files.delete(KEY);
  const after = await files.list();
  console.log(
    after.items.length === 0
      ? "Bucket is empty again."
      : `Bucket still holds ${after.items.length} object(s).`,
  );
}

main().catch((error) => {
  console.error("Object storage test failed:", error);
  process.exitCode = 1;
});
