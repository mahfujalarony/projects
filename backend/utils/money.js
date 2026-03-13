const toMoney2 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
};

const addMoney2 = (a, b) => {
  const n = Number(a || 0) + Number(b || 0);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
};

const subMoney2 = (a, b) => {
  const n = Number(a || 0) - Number(b || 0);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(2);
};

module.exports = {
  toMoney2,
  addMoney2,
  subMoney2,
};
