const http = require("http");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const parseMultipart = require("./utils/multipartParser");

/* ensure upload folders exist */
[
  "uploads/images/single",
  "uploads/images/multiple",
  "uploads/videos"
].forEach((dir) => fs.mkdirSync(path.join(__dirname, dir), { recursive: true }));

const server = http.createServer(async (req, res) => {

  /* ================= CORS SETUP ================= */
  res.setHeader("Access-Control-Allow-Origin", "*");
  // production এ চাইলে:
  // res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  /* ============================================== */

  /* serve static uploaded files */
  if (req.method === "GET" && req.url.startsWith("/uploads")) {
    const cleanReqPath = String(req.url || "")
      .split("?")[0]
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    const filePath = path.join(__dirname, cleanReqPath);
    const uploadsRoot = path.join(__dirname, "uploads");

    if (!filePath.startsWith(uploadsRoot)) {
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

    /* SINGLE IMAGE */
    if (req.method === "POST" && req.url === "/upload/image") {
      const files = await parseMultipart(req, {
        uploadDir: "uploads/images/single",
        maxSize: config.LIMITS.IMAGE,
        allowed: config.ALLOWED_IMAGES
      });

      return send(res, files);
    }

    /* MULTIPLE IMAGES */
    if (req.method === "POST" && req.url === "/upload/images") {
      const files = await parseMultipart(req, {
        uploadDir: "uploads/images/multiple",
        maxSize: config.LIMITS.IMAGE * 5,
        allowed: config.ALLOWED_IMAGES
      });

      return send(res, files);
    }

    /* SINGLE VIDEO */
    if (req.method === "POST" && req.url === "/upload/video") {
      const files = await parseMultipart(req, {
        uploadDir: "uploads/videos",
        maxSize: config.LIMITS.VIDEO,
        allowed: config.ALLOWED_VIDEOS
      });

      return send(res, files);
    }

    res.writeHead(404);
    res.end("Route not found");

  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: false,
      error: err.toString()
    }));
  }
});

/* response helper */
function send(res, files) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    success: true,
    urls: files.map((f) => {
      const normalized = String(f || "")
        .replace(/\\/g, "/")
        .replace(/^\.?\//, "");
      return `${config.BASE_URL}/${normalized}`;
    })
  }));
}

server.listen(config.PORT, () => {
  console.log(`✅ Server running on ${config.BASE_URL}`);
});





// const http = require("http");
// const fs = require("fs");
// const path = require("path");
// const config = require("./config");
// const parseMultipart = require("./utils/multipartParser");

// [
//   "uploads/images/single",
//   "uploads/images/multiple",
//   "uploads/videos"
// ].forEach(dir => fs.mkdirSync(dir, { recursive: true }));

// const server = http.createServer(async (req, res) => {

//   /* serve static files */
//   if (req.method === "GET" && req.url.startsWith("/uploads")) {
//     const filePath = path.join(__dirname, req.url);
//     if (fs.existsSync(filePath)) {
//       return fs.createReadStream(filePath).pipe(res);
//     }
//     res.writeHead(404);
//     return res.end("File not found");
//   }

//   try {

//     /* SINGLE IMAGE */
//     if (req.method === "POST" && req.url === "/upload/image") {
//       const files = await parseMultipart(req, {
//         uploadDir: "uploads/images/single",
//         maxSize: config.LIMITS.IMAGE,
//         allowed: config.ALLOWED_IMAGES
//       });

//       return send(res, files);
//     }

//     /* MULTIPLE IMAGE */
//     if (req.method === "POST" && req.url === "/upload/images") {
//       const files = await parseMultipart(req, {
//         uploadDir: "uploads/images/multiple",
//         maxSize: config.LIMITS.IMAGE * 5,
//         allowed: config.ALLOWED_IMAGES
//       });

//       return send(res, files);
//     }

//     /* SINGLE VIDEO */
//     if (req.method === "POST" && req.url === "/upload/video") {
//       const files = await parseMultipart(req, {
//         uploadDir: "uploads/videos",
//         maxSize: config.LIMITS.VIDEO,
//         allowed: config.ALLOWED_VIDEOS
//       });

//       return send(res, files);
//     }

//     res.writeHead(404);
//     res.end("Route not found");

//   } catch (err) {
//     res.writeHead(400);
//     res.end(JSON.stringify({ success: false, error: err }));
//   }
// });

// function send(res, files) {
//   res.writeHead(200, { "Content-Type": "application/json" });
//   res.end(JSON.stringify({
//     success: true,
//     urls: files.map(f => `${config.BASE_URL}/${f}`)
//   }));
// }

// server.listen(config.PORT, () =>
//   console.log(`Production server running on ${config.BASE_URL}`)
// );
