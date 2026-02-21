const ProductDailyStat = require("../models/ProductDailyStat");
const MerchentStore = require("../models/MerchentStore");

// BD date string helper
const getBDDateString = () => {
  // Asia/Dhaka offset handling (simple safe)
  const now = new Date();
  const bd = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return bd.toISOString().slice(0, 10); // YYYY-MM-DD
};

const ensureProduct = async (productId) => {
  const p = await MerchentStore.findByPk(productId);
  if (!p) {
    const err = new Error("Product not found");
    err.statusCode = 404;
    throw err;
  }
  return p;
};

// 1) View increment
exports.trackView = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await ensureProduct(productId);

    const statDate = getBDDateString();

    const [row] = await ProductDailyStat.findOrCreate({
      where: { productId, statDate },
      defaults: { productId, statDate, views: 0, addToCart: 0, purchases: 0, soldQty: 0, revenue: 0 },
    });

    await row.increment("views", { by: 1 });

    res.json({ success: true, message: "view tracked" });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  }
};

// 2) Add-to-cart increment
exports.trackAddToCart = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    await ensureProduct(productId);

    const statDate = getBDDateString();

    const [row] = await ProductDailyStat.findOrCreate({
      where: { productId, statDate },
      defaults: { productId, statDate },
    });

    await row.increment("addToCart", { by: 1 });

    res.json({ success: true, message: "add-to-cart tracked" });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  }
};
