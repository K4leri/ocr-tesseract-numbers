import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createWorker } from "tesseract.js";
import { parseAndProcessImage } from "./colorSetup";
import { promises as fs } from "fs";

const app = new Hono();
const cache: Record<string, string> = {};

app.post("/recognize", async (c) => {
  const b64 = await c.req.text();
  if (cache[b64]) {
    console.log(`return from cache ${cache[b64]} - ${b64}`);
    return c.text(cache[b64]);
  }

  const worker = await createWorker("eng");
  await worker.setParameters({ tessedit_char_whitelist: "0123456789" });

  const buffer = await parseAndProcessImage(Buffer.from(b64, "base64"));
  const uint8Array = new Uint8Array(buffer);
  await fs.writeFile("./output.png", uint8Array);

  const ret = await worker.recognize(buffer);
  console.log(ret);
  const text = ret.data.text.trim();
  await worker.terminate();

  cache[b64] = text;
  return c.text(text);
});

app.post("/recognizewords", async (c) => {
  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789",
  });
  const b64 = await c.req.text();
  const preBuffer = Buffer.from(b64, "base64");
  parseAndProcessImage(preBuffer);

  const buffer = Buffer.from(b64, "base64");
  const ret = await worker.recognize(buffer);
  console.log(ret);
  const text = ret.data.text.trim();
  await worker.terminate();
  return c.text(text);
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
