const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const parseMultipart = require("./utils/multipartParser");

/* ensure upload folder exists */
["public"].forEach((dir) =>
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true })
);

const toSafeSegment = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "uncategorized";
  const cleaned = raw
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "uncategorized";
};

const toPositiveInt = (value, fallback = 0) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const toSafeScope = (value) => {
  const s = toSafeSegment(value || "misc");
  return s === "uncategorized" ? "misc" : s;
};

const safeFileStem = (value) =>
  String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getNextNumericCounter = (absoluteDir) => {
  try {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    let max = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const base = path.parse(entry.name).name;
      const num = Number.parseInt(base, 10);
      if (Number.isFinite(num) && num > max) max = num;
    }
    return max + 1;
  } catch {
    return 1;
  }
};

const escapeRegExp = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getNextPrefixedCounter = (absoluteDir, prefix) => {
  const safePrefix = safeFileStem(prefix);
  if (!safePrefix) return 1;
  const matcher = new RegExp(`^${escapeRegExp(safePrefix)}_(\\d+)$`);
  try {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    let max = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const base = path.parse(entry.name).name;
      const m = base.match(matcher);
      if (!m) continue;
      const num = Number.parseInt(m[1], 10);
      if (Number.isFinite(num) && num > max) max = num;
    }
    return max + 1;
  } catch {
    return 1;
  }
};

const extFromContentType = (contentType = "") => {
  const t = String(contentType || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  return "jpg";
};

const resolveUploadOptions = (fullUrl) => {
  const scope = String(fullUrl.searchParams.get("scope") || "").toLowerCase();
  const subCategory = toSafeSegment(
    fullUrl.searchParams.get("subcategory") || fullUrl.searchParams.get("subCategory")
  );
  const folder = toSafeSegment(fullUrl.searchParams.get("folder") || "");
  const fileNameBase = safeFileStem(fullUrl.searchParams.get("name") || "");
  const entityId = toPositiveInt(
    fullUrl.searchParams.get("entityId") || fullUrl.searchParams.get("id"),
    0
  );
  const productId = toPositiveInt(fullUrl.searchParams.get("productId"), 0);
  const startCount = Math.max(
    0,
    Number.parseInt(fullUrl.searchParams.get("startCount") || "0", 10) || 0
  );

  const parseOptions = {
    uploadDir: "public/misc",
    maxSize: config.LIMITS.IMAGE,
    allowed: config.ALLOWED_IMAGES,
  };

  if (scope === "product") {
    parseOptions.uploadDir = `public/products/${subCategory}`;
    if (productId > 0) {
      parseOptions.filenameFactory = ({ index }) => `${productId}_${startCount + index + 1}`;
    }
  } else if (scope) {
    const safeScope = toSafeScope(scope);
    parseOptions.uploadDir =
      folder && folder !== "uncategorized" ? `public/${safeScope}/${folder}` : `public/${safeScope}`;
    if (
      safeScope === "profiles" ||
      safeScope === "offers" ||
      safeScope === "logo" ||
      safeScope === "stories"
    ) {
      const absoluteScopeDir = path.join(__dirname, parseOptions.uploadDir);
      fs.mkdirSync(absoluteScopeDir, { recursive: true });
      const nextCounter = getNextNumericCounter(absoluteScopeDir);
      parseOptions.filenameFactory = ({ index }) => `${nextCounter + index}`;
    } else if (safeScope === "merchant" || safeScope === "wallets") {
      const absoluteScopeDir = path.join(__dirname, parseOptions.uploadDir);
      fs.mkdirSync(absoluteScopeDir, { recursive: true });
      const baseName = fileNameBase || (safeScope === "wallets" ? "wallet" : "merchant");
      const scopedBaseName = entityId > 0 ? `${baseName}_${entityId}` : baseName;
      const nextCounter = getNextPrefixedCounter(absoluteScopeDir, scopedBaseName);
      parseOptions.filenameFactory = ({ index }) => `${scopedBaseName}_${nextCounter + index}`;
    } else if (entityId > 0) {
      parseOptions.filenameFactory = ({ index }) => `${entityId}__${startCount + index + 1}`;
    }
  }

  return parseOptions;
};

const downloadRemoteImage = (url, redirectsLeft = 3) =>
  new Promise((resolve, reject) => {
    if (!/^https?:\/\//i.test(url || "")) return reject(new Error("Invalid URL"));
    const lib = String(url).startsWith("https://") ? https : http;
    const req = lib.get(url, (resp) => {
      if (
        resp.statusCode &&
        resp.statusCode >= 300 &&
        resp.statusCode < 400 &&
        resp.headers.location &&
        redirectsLeft > 0
      ) {
        return resolve(downloadRemoteImage(resp.headers.location, redirectsLeft - 1));
      }
      if (resp.statusCode !== 200) return reject(new Error(`Remote fetch failed (${resp.statusCode})`));

      const chunks = [];
      let total = 0;
      const maxBytes = config.LIMITS.IMAGE;
      resp.on("data", (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy(new Error("Image too large"));
          return;
        }
        chunks.push(chunk);
      });
      resp.on("end", () =>
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: String(resp.headers["content-type"] || "").toLowerCase(),
        })
      );
      resp.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(12000, () => req.destroy(new Error("Remote fetch timeout")));
  });

const resolveDeletablePath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname || "";
    } catch {
      return null;
    }
  }

  const rel = String(pathname)
    .split("?")[0]
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!rel.startsWith("public/")) return null;

  const full = path.resolve(__dirname, rel);
  const publicRoot = path.resolve(__dirname, "public");
  if (!full.startsWith(publicRoot)) return null;

  return { rel, full };
};

const server = http.createServer(async (req, res) => {
  /* CORS */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* serve static uploaded files */
  if (
    req.method === "GET" &&
    req.url.startsWith("/public")
  ) {
    const cleanReqPath = String(req.url || "")
      .split("?")[0]
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    const filePath = path.join(__dirname, cleanReqPath);
    const publicRoot = path.join(__dirname, "public");

    if (!filePath.startsWith(publicRoot)) {
      res.writeHead(400);
      return res.end("Invalid path");
    }

    if (fs.existsSync(filePath)) {
      return fs.createReadStream(filePath).pipe(res);
    }
    res.writeHead(404);
    return res.end("File not found");
  }

  try {
    if (req.method === "POST" && req.url.startsWith("/upload/image/url")) {
      const fullUrl = new URL(req.url, config.BASE_URL);
      const uploadOptions = resolveUploadOptions(fullUrl);

      let rawBody = "";
      await new Promise((resolve, reject) => {
        req.on("data", (chunk) => {
          rawBody += chunk.toString("utf8");
          if (rawBody.length > 2 * 1024 * 1024) reject(new Error("Payload too large"));
        });
        req.on("end", resolve);
        req.on("error", reject);
      });

      let payload = {};
      try {
        payload = JSON.parse(rawBody || "{}");
      } catch {
        throw new Error("Invalid JSON body");
      }

      const remoteUrl = String(payload.url || "").trim();
      if (!remoteUrl) throw new Error("url is required");

      const remote = await downloadRemoteImage(remoteUrl);
      if (!remote.contentType.startsWith("image/")) throw new Error("Only image URL is allowed");
      if (!config.ALLOWED_IMAGES.includes(remote.contentType.split(";")[0])) {
        throw new Error("Unsupported image type");
      }

      const relativeDir = String(uploadOptions.uploadDir || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
      const absoluteDir = path.join(__dirname, relativeDir);
      fs.mkdirSync(absoluteDir, { recursive: true });

      const ext = extFromContentType(remote.contentType);
      const defaultBase = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const generated =
        typeof uploadOptions.filenameFactory === "function"
          ? uploadOptions.filenameFactory({ index: 0, mime: remote.contentType, ext, defaultName: defaultBase })
          : defaultBase;
      const safeBase = safeFileStem(generated) || defaultBase;
      const fileName = safeBase.endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`;

      const savePath = path.join(absoluteDir, fileName);
      fs.writeFileSync(savePath, remote.buffer);
      return send(res, [path.posix.join(relativeDir, fileName)]);
    }

    if (req.method === "POST" && req.url.startsWith("/upload/delete")) {
      let rawBody = "";
      await new Promise((resolve, reject) => {
        req.on("data", (chunk) => {
          rawBody += chunk.toString("utf8");
          if (rawBody.length > 512 * 1024) reject(new Error("Payload too large"));
        });
        req.on("end", resolve);
        req.on("error", reject);
      });

      let payload = {};
      try {
        payload = JSON.parse(rawBody || "{}");
      } catch {
        throw new Error("Invalid JSON body");
      }

      const target = resolveDeletablePath(payload.path || payload.url);
      if (!target) throw new Error("Invalid file path");

      try {
        fs.unlinkSync(target.full);
      } catch (err) {
        if (!err || err.code !== "ENOENT") throw err;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          success: true,
          path: `/${target.rel.replace(/^\/+/, "")}`,
        })
      );
    }

    /* single image only */
    if (req.method === "POST" && req.url.startsWith("/upload/image")) {
      const fullUrl = new URL(req.url, config.BASE_URL);
      const parseOptions = resolveUploadOptions(fullUrl);

      const files = await parseMultipart(req, parseOptions);

      return send(res, files);
    }

    res.writeHead(404);
    return res.end("Route not found");
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        success: false,
        error: err.toString(),
      })
    );
  }
});

function send(res, files) {
  const normalizedPaths = files.map((f) => {
    const normalized = String(f || "")
      .replace(/\\/g, "/")
      .replace(/^\.?\//, "");
    return `/${normalized.replace(/^\/+/, "")}`;
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: true,
      urls: normalizedPaths.map((p) => `${config.BASE_URL}${p}`),
      paths: normalizedPaths,
    })
  );
}

server.listen(config.PORT, () => {
  console.log(`Server running on ${config.BASE_URL}`);
});
