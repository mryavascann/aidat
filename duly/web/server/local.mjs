// Serve only the built application; local keys/source are never HTTP resources.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import bank from "./bank.mjs";
import relay from "./relay.mjs";
import settle from "./settle.mjs";
import dues from "./dues.mjs";
const root = resolve(import.meta.dirname, "../dist");
if (!process.env.DULY_BANK_SECRET)
  process.env.DULY_BANK_SECRET = (
    await readFile(new URL("../../.duly-bank-v3-key", import.meta.url), "utf8")
  ).trim();
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".json": "application/json",
};
createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/api/bank") return bank(req, res);
    if (path === "/api/relay") return relay(req, res);
    if (path === "/api/settle") return settle(req, res);
    if (path === "/api/dues") return dues(req, res);
    const file = resolve(
      root,
      "." + decodeURIComponent(path === "/" ? "/index.html" : path),
    );
    if (!file.startsWith(root + "/") || !(await stat(file)).isFile())
      throw new Error("Not found");
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
}).listen(Number(process.env.DULY_PORT ?? 5174), "127.0.0.1", () =>
  console.log("Duly V3: http://127.0.0.1:" + (process.env.DULY_PORT ?? 5174)),
);
