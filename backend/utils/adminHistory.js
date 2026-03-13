const { Op } = require("sequelize");
const AppSetting = require("../models/AppSetting");
const AdminHistory = require("../models/AdminHistory");

const ADMIN_HISTORY_KEY = "adminHistoryLogs";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;
const HISTORY_RETENTION_DAYS = Math.max(1, Number(process.env.ADMIN_HISTORY_RETENTION_DAYS || 15));
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let legacyMigrationPromise = null;
let cleanupRunning = false;
let lastCleanupAt = 0;

const parseHistoryValue = (value) => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const clampInt = (v, d, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.min(Math.max(Math.floor(n), min), max);
};

const normalizeDate = (v) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
};

const escapeLike = (v) => String(v).replace(/[\\%_]/g, "\\$&");
const getRetentionCutoffDate = () => new Date(Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

const migrateLegacyHistoryOnce = async () => {
  if (legacyMigrationPromise) return legacyMigrationPromise;

  legacyMigrationPromise = (async () => {
    const existing = await AdminHistory.count();
    if (existing > 0) return;

    const row = await AppSetting.findByPk(ADMIN_HISTORY_KEY);
    const logs = parseHistoryValue(row?.value);
    if (!logs.length) return;

    await AdminHistory.bulkCreate(
      logs
        .filter((x) => String(x?.message || "").trim())
        .map((x) => {
          const at = normalizeDate(x?.createdAt);
          return {
            message: String(x.message).trim(),
            meta: x?.meta && typeof x.meta === "object" ? x.meta : null,
            createdAt: at,
            updatedAt: at,
          };
        })
    );
  })().catch(() => null);

  return legacyMigrationPromise;
};

const cleanupOldAdminHistory = async ({ force = false } = {}) => {
  if (cleanupRunning) return 0;
  const now = Date.now();
  if (!force && now - lastCleanupAt < CLEANUP_INTERVAL_MS) return 0;

  cleanupRunning = true;
  try {
    const cutoff = getRetentionCutoffDate();
    const deleted = await AdminHistory.destroy({
      where: {
        createdAt: { [Op.lt]: cutoff },
      },
    });
    lastCleanupAt = now;
    return Number(deleted || 0);
  } finally {
    cleanupRunning = false;
  }
};

const appendAdminHistory = async (message, options = {}) => {
  // Opportunistic background cleanup for retention policy.
  cleanupOldAdminHistory().catch(() => null);

  const text = String(message || "").trim();
  if (!text) return null;

  const transaction = options.transaction;
  const meta = options.meta && typeof options.meta === "object" ? options.meta : null;

  const row = await AdminHistory.create(
    {
      message: text,
      ...(meta ? { meta } : {}),
    },
    { transaction }
  );

  return row;
};

const getAdminHistory = async (options = {}) => {
  await migrateLegacyHistoryOnce();
  await cleanupOldAdminHistory();

  const page = clampInt(options.page || 1, 1, 1, 1000000);
  const limit = clampInt(options.limit || DEFAULT_LIMIT, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const q = String(options.q || "").trim();

  const where = {};
  if (q) {
    const exactId = Number(q);
    const msgLike = `%${escapeLike(q)}%`;
    where[Op.or] = [
      { message: { [Op.like]: msgLike } },
      ...(Number.isFinite(exactId) ? [{ id: exactId }] : []),
    ];
  }

  const { count, rows } = await AdminHistory.findAndCountAll({
    where,
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    rows,
    page,
    limit,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
  };
};

module.exports = {
  appendAdminHistory,
  getAdminHistory,
  cleanupOldAdminHistory,
  getAdminHistoryRetentionDays: () => HISTORY_RETENTION_DAYS,
};
