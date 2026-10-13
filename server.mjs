import { createServer as createHttpServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createDemoTransfers } from "./src/activity.js";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".glb": "model/gltf-binary",
};

function isOrigin(value) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.hostname.includes("*") &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export function createServer({
  env = process.env,
  distDir = fileURLToPath(new URL("./dist", import.meta.url)),
} = {}) {
  const apiOnly = env.API_ONLY === "true";
  const allowedOrigins = new Set(
    env.ALLOWED_ORIGINS?.trim()
      ? env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : [],
  );
  if ([...allowedOrigins].some((origin) => !isOrigin(origin)))
    throw new Error(
      "ALLOWED_ORIGINS must contain comma-separated HTTP(S) origins without paths, trailing slashes, credentials, or wildcards",
    );
  function demo(notice) {
    return {
      mode: "demo",
      coverage: "sample",
      updatedAt: new Date().toISOString(),
      transfers: createDemoTransfers(),
      notice,
      dailyCount: null,
    };
  }

  async function activity() {
    return demo(
      "Relay World is discontinued. This illustrative demo uses sample transfers only and does not connect to Relay's API.",
    );
  }

  return createHttpServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    let pathname;
    let requestUrl;
    try {
      requestUrl = new URL(req.url, "http://localhost");
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
      res.writeHead(400).end("Invalid URL");
      return;
    }
    if (pathname === "/api/activity") {
      res.setHeader("Vary", "Origin");
      const origin = req.headers.origin;
      const serverOrigin = `${req.socket.encrypted ? "https" : "http"}://${req.headers.host}`;
      if (
        origin !== undefined &&
        (!isOrigin(origin) ||
          (!allowedOrigins.has(origin) && origin !== serverOrigin))
      ) {
        res.writeHead(403).end("Origin not allowed");
        return;
      }
      if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
      if (req.method === "OPTIONS") {
        res.setHeader(
          "Vary",
          "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        );
        const method = req.headers["access-control-request-method"];
        const headers = req.headers["access-control-request-headers"];
        if (
          !origin ||
          !["GET", "HEAD"].includes(method) ||
          (headers && headers.toLowerCase().trim() !== "accept")
        ) {
          res.writeHead(403).end("Preflight not allowed");
          return;
        }
        res.writeHead(204, {
          "Access-Control-Allow-Methods": "GET, HEAD",
          ...(headers ? { "Access-Control-Allow-Headers": "Accept" } : {}),
        });
        res.end();
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        res
          .writeHead(405, { Allow: "GET, HEAD, OPTIONS" })
          .end("Method not allowed");
        return;
      }
      const parameters = requestUrl.searchParams.getAll("tracked");
      const ids = parameters.length ? parameters[0].split(",") : [];
      if (
        parameters.length > 1 ||
        ids.length > 12 ||
        ids.some((id) => !/^0x[a-fA-F0-9]{64}$/.test(id))
      ) {
        res.writeHead(400, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            error:
              "tracked must contain at most 12 comma-separated Relay request IDs (0x followed by 64 hexadecimal characters).",
          }),
        );
        return;
      }
      const data = await activity();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(req.method === "HEAD" ? undefined : JSON.stringify(data));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
      return;
    }
    if (pathname === "/healthz") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        req.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }),
      );
      return;
    }
    if (apiOnly || pathname.startsWith("/api/")) {
      res.writeHead(404).end("Not found");
      return;
    }
    try {
      const root = await realpath(distDir);
      const file = await realpath(
        resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`),
      );
      if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      const body = req.method === "HEAD" ? undefined : await readFile(file);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT ?? 4174);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535");
  createServer().listen(port, process.env.HOST ?? "127.0.0.1", () => {
    console.log(
      `Relay City server: http://${process.env.HOST ?? "127.0.0.1"}:${port}`,
    );
  });
}
