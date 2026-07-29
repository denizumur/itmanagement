import { expect, type Download } from "@playwright/test";

export async function expectXlsxDownload(download: Download) {
  const suggestedFilename = download.suggestedFilename();
  expect(suggestedFilename).toMatch(/\.xlsx$/i);

  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream!
      .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      .on("end", resolve)
      .on("error", reject);
  });

  const fileBuffer = Buffer.concat(chunks);
  expect(fileBuffer.length).toBeGreaterThan(0);
  expect(fileBuffer.subarray(0, 2).toString("utf8")).toBe("PK");
}
