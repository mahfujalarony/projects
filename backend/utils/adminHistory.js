const AppSetting = require("../models/AppSetting");

const ADMIN_HISTORY_KEY = "adminHistoryLogs";
const MAX_LOGS = 500;

const parseHistoryValue = (value) => {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const normalizeLimit = (limit) => {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.min(Math.round(n), MAX_LOGS);
};

const appendAdminHistory = async (message, options = {}) => {
  const text = String(message || "").trim();
  if (!text) return null;

  const transaction = options.transaction;
  const meta = options.meta && typeof options.meta === "object" ? options.meta : null;

  const findOpts = { transaction };
  if (transaction?.LOCK?.UPDATE) {
    findOpts.lock = transaction.LOCK.UPDATE;
  }

  const row = await AppSetting.findByPk(ADMIN_HISTORY_KEY, findOpts);
  const logs = parseHistoryValue(row?.value);

  logs.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    message: text,
    createdAt: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  });

  const next = logs.slice(-MAX_LOGS);
  const payload = JSON.stringify(next);

  if (row) {
    row.value = payload;
    await row.save({ transaction });
  } else {
    await AppSetting.create(
      {
        key: ADMIN_HISTORY_KEY,
        value: payload,
      },
      { transaction }
    );
  }

  return next[next.length - 1] || null;
};

const getAdminHistory = async (options = {}) => {
  const row = await AppSetting.findByPk(ADMIN_HISTORY_KEY);
  const logs = parseHistoryValue(row?.value);
  const limit = normalizeLimit(options.limit);
  return logs.slice(-limit).reverse();
};

module.exports = {
  appendAdminHistory,
  getAdminHistory,
};
