const fs = require("fs");
const path = require("path");

const sanitizeFileStem = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const extensionFromMime = (mime = "") => {
  const clean = String(mime || "").trim().toLowerCase();
  if (clean === "image/jpeg") return "jpg";
  const part = clean.split("/")[1] || "";
  return part.replace(/[^\w]/g, "") || "bin";
};

function parseMultipart(req, options) {
  return new Promise((resolve, reject) => {

    const boundary = req.headers["content-type"].split("boundary=")[1];
    let buffer = Buffer.alloc(0);
    let files = [];

    req.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);

      if (buffer.length > options.maxSize) {
        reject("File size exceeded");
        req.destroy();
      }
    });

    req.on("end", () => {

      const parts = buffer.toString("binary").split("--" + boundary);

      parts.forEach(part => {

        if (!part.includes("filename")) return;

        const mime = part.match(/Content-Type:(.*)/)?.[1]?.trim();
        if (!options.allowed.includes(mime)) return;

        const filename =
          Date.now() + "-" + Math.random().toString(36).slice(2);

        const extension = extensionFromMime(mime);

        // header আর body আলাদা করা - \r\n\r\n দিয়ে
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd === -1) return;
        let fileData = part.substring(headerEnd + 4);
        // trailing \r\n সরানো (boundary এর আগের part)
        if (fileData.endsWith("\r\n")) {
          fileData = fileData.slice(0, -2);
        }

        const rawDir = String(options.uploadDir || "").replace(/\\/g, "/").replace(/^\/+/, "");
        const relativeDir = rawDir.replace(/\/+$/, "");
        const absoluteDir = path.join(__dirname, "..", relativeDir);

        fs.mkdirSync(absoluteDir, { recursive: true });

        const generatedBaseName =
          typeof options.filenameFactory === "function"
            ? options.filenameFactory({
                index: files.length,
                mime,
                ext: extension,
                defaultName: filename,
              })
            : filename;
        const safeBaseName = sanitizeFileStem(generatedBaseName) || filename;
        const fileBuffer = Buffer.from(fileData, "binary");
        let savedFileName = "";
        let attempt = 0;

        while (attempt < 100) {
          const candidateBase = attempt === 0 ? safeBaseName : `${safeBaseName}_${attempt}`;
          const fileName = candidateBase.endsWith(`.${extension}`)
            ? candidateBase
            : `${candidateBase}.${extension}`;
          const savePath = path.join(absoluteDir, fileName);
          try {
            fs.writeFileSync(savePath, fileBuffer, { flag: "wx" });
            savedFileName = fileName;
            break;
          } catch (e) {
            if (e && e.code === "EEXIST") {
              attempt += 1;
              continue;
            }
            throw e;
          }
        }

        if (!savedFileName) {
          throw new Error("Failed to allocate unique filename");
        }

        files.push(path.posix.join(relativeDir, savedFileName));
      });

      resolve(files);
    });
  });
}

module.exports = parseMultipart;
