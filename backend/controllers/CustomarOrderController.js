// controllers/orderController.js
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const OrderItem = require("../models/Order"); 
const MerchentStore = require("../models/MerchentStore");
const User = require("../models/Authentication");
const ProductDailyStat = require("../models/ProductDailyStat");
const Notification = require("../models/Notification");
const AppSetting = require("../models/AppSetting");

// BD date string helper (Asia/Dhaka)
const getBDDateString = () => {
  const now = new Date();
  const bd = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
  return bd.toISOString().slice(0, 10); // YYYY-MM-DD
};

function isValidPaymentMethod(v) {
  return String(v || "").toLowerCase() === "balance";
}
function isValidPaymentStatus(v) {
  return v === "paid";
}

async function getSellerCommissionPercent(transaction) {
  const row = await AppSetting.findByPk("sellerCommission", { transaction });
  if (!row) return 0;

  try {
    const parsed = JSON.parse(row.value);
    const n = Number(parsed);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_) {
    const n = Number(row.value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}



exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const rows = await OrderItem.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      data: {
        count: rows.length,
        orders: rows,
      },
    });
  } catch (err) {
    console.error("GET MY ORDERS ERROR:", err);
    return res.status(500).json({ message: err?.message || "Server error" });
  }
};

exports.createCustomerOrder = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const userId = req.user?.id || req.userId; 

    const {
      addressId,
      matchMerchantId,
      paymentMethod = "balance",
      paymentStatus = "paid",
      items,
      deliveryCharge: dcInput,
    } = req.body;

    // ✅ Debug Log: Check if deliveryCharge is received
    console.log("createCustomerOrder Payload:", { userId, itemsCount: items?.length, deliveryCharge: dcInput });

    // basic validations
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized (userId missing)" });
    }

    const deliveryCharge = Number(dcInput || 0);

    if (!addressId || !matchMerchantId) {
      await t.rollback();
      return res.status(400).json({ message: "addressId and matchMerchantId are required" });
    }

    if (!isValidPaymentMethod(paymentMethod)) {
      await t.rollback();
      return res.status(400).json({ message: "Only balance payment is allowed" });
    }

    if (!isValidPaymentStatus(paymentStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "Cash on delivery is disabled. Use balance payment." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "items must be a non-empty array" });
    }

    for (const it of items) {
      if (!it.productId || !it.name) {
        await t.rollback();
        return res.status(400).json({ message: "Each item must have productId and name" });
      }
      const qty = Number(it.quantity);
      const price = Number(it.price);

      if (!Number.isFinite(qty) || qty <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid quantity in items" });
      }
      if (!Number.isFinite(price) || price < 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid price in items" });
      }
    }

    // total calculate
    const productsTotal = items.reduce(
      (sum, it) => sum + Number(it.price) * Number(it.quantity),
      0
    );
    const orderTotal = productsTotal + deliveryCharge;
    const sellerCommissionPercent = await getSellerCommissionPercent(t);
    const commissionAmount = Number(
      ((productsTotal * sellerCommissionPercent) / 100).toFixed(2)
    );
    const merchantCreditTotal = Number((productsTotal + commissionAmount).toFixed(2));

    let user = null;
    let merchant = null;

    // online paid হলে balance lock + deduct
    {
      user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });

      if (!user) {
        await t.rollback();
        return res.status(404).json({ message: "User not found" });
      }

      const currentBalance = Number(user.balance || 0);

      if (currentBalance < orderTotal) {
        await t.rollback();
        return res.status(400).json({
          message: "Insufficient balance",
          balance: currentBalance,
          required: orderTotal,
        });
      }

      user.balance = currentBalance - orderTotal;
      await user.save({ transaction: t });

      // Credit Merchant with product total + configured commission amount.
      merchant = await User.findByPk(matchMerchantId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (merchant) {
        merchant.balance = Number(merchant.balance || 0) + merchantCreditTotal;
        await merchant.save({ transaction: t });
      }

      // ✅ Credit Admin (Add delivery charge to admin)
      if (deliveryCharge > 0) {
        const admin = await User.findOne({ where: { role: "admin" }, transaction: t, lock: t.LOCK.UPDATE });
        if (admin) {
          admin.balance = Number(admin.balance || 0) + deliveryCharge;
          await admin.save({ transaction: t });
        }
      }
    }

    // products lock
    const productIds = items.map((x) => x.productId);

    const products = await MerchentStore.findAll({
      where: { id: productIds },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const productMap = new Map(products.map((p) => [String(p.id), p]));

    // validate merchant + stock
    for (const it of items) {
      const p = productMap.get(String(it.productId));
      if (!p) {
        await t.rollback();
        return res.status(404).json({ message: `Product not found: ${it.productId}` });
      }

      if (String(p.merchantId) !== String(matchMerchantId)) {
        await t.rollback();
        return res.status(400).json({
          message: `Product ${p.id} does not belong to merchant ${matchMerchantId}`,
        });
      }

      const qty = Number(it.quantity);
      if (Number(p.stock) < qty) {
        await t.rollback();
        return res.status(400).json({
          message: `Not enough stock for ${p.name}. Available: ${p.stock}`,
        });
      }
    }

    // ✅ UPDATE stock + soldCount + ProductDailyStat (same transaction)
    const statDate = getBDDateString();

    for (const it of items) {
      const p = productMap.get(String(it.productId));
      const qty = Number(it.quantity);
      const price = Number(it.price);

      // stock & soldCount
      p.stock = Number(p.stock) - qty;
      p.soldCount = Number(p.soldCount || 0) + qty;
      await p.save({ transaction: t });

      // ProductDailyStat update
      const [row] = await ProductDailyStat.findOrCreate({
        where: { productId: p.id, statDate },
        defaults: {
          productId: p.id,
          statDate,
          views: 0,
          addToCart: 0,
          purchases: 0,
          soldQty: 0,
          revenue: 0,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // increment multiple columns
      await row.increment(
        { purchases: 1, soldQty: qty, revenue: price * qty },
        { transaction: t }
      );
    }

    // order items create
    const rowsToCreate = items.map((it, idx) => ({
      userId,
      addressId,
      matchMerchantId,
      paymentMethod,
      paymentStatus,
      productId: it.productId, 
      name: it.name,
      price: it.price,
      quantity: it.quantity,
      imageUrl: it.imageUrl || null,
      status: "pending",
      deliveryCharge: idx === 0 ? deliveryCharge : 0, // Assign delivery charge to first item
    }));

    const created = await OrderItem.bulkCreate(rowsToCreate, {
      transaction: t,
      returning: true,
    });

    // Summary notifications (avoid per-item spam)
    const orderItemIds = created.map((x) => x.id);
    const primaryOrderId = orderItemIds[0] || null;
    const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const notifications = [];

    if (!merchant) {
      merchant = await User.findByPk(matchMerchantId, { transaction: t });
    }

    if (merchant) {
      const merchantMessage = `New order #${primaryOrderId} received (${items.length} item(s), qty ${totalQty}). Credited ${merchantCreditTotal} including ${commissionAmount} commission.`;

      notifications.push({
        userId: matchMerchantId,
        type: "order",
        title: "New order received",
        message: merchantMessage,
        meta: {
          orderId: primaryOrderId,
          orderItemIds,
          productsTotal,
          commissionPercent: sellerCommissionPercent,
          commissionAmount,
          creditedAmount: merchantCreditTotal,
          paymentStatus,
          route: "/merchant/my-orders",
        },
      });
    }

    notifications.push({
      userId,
      type: "order",
      title: "Order placed successfully",
      message: `Your order #${primaryOrderId} has been placed with ${items.length} item(s).`,
      meta: {
        orderId: primaryOrderId,
        orderItemIds,
        total: orderTotal,
        paymentStatus,
        route: "/orders",
      },
    });

    if (notifications.length) {
      await Notification.bulkCreate(notifications, { transaction: t });
    }

    await t.commit();

    return res.status(201).json({
      message: "Order placed successfully",
      items: created,
      total: orderTotal,
      balanceAfter: Number(user.balance),
      statDate,
    });
  } catch (err) {
    console.error("createCustomerOrder error:", err);
    await t.rollback();
    return res.status(500).json({ message: err.message || "Failed to place order" });
  }
};


exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const {
      status,         
      paymentStatus,   // paid
      paymentMethod,
      search,          // name / order id / productId
      page = 1,
      limit = 10,
      sort = "desc",   // asc/desc
    } = req.query;

    const where = { userId };

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (search && search.trim()) {
      const s = search.trim();
      where[Op.or] = [
        { name: { [Op.like]: `%${s}%` } },
        // id search
        ...(Number.isNaN(Number(s)) ? [] : [{ id: Number(s) }, { productId: Number(s) }]),
      ];
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    const { rows, count } = await OrderItem.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [["createdAt", sort.toLowerCase() === "asc" ? "ASC" : "DESC"]],
    });

    return res.json({
      ok: true,
      data: rows,
      total: count,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(count / limitNum)),
    });
  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({ ok: false, message: "Server error" });
  }
};



exports.cancelMyOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const userId = req.user?.id || req.userId; // ✅ auth থেকে নেবে
    const { id } = req.params; // orderItem id

    if (!userId) {
      await t.rollback();
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    // ✅ lock order row
    const item = await OrderItem.findOne({
      where: { id, userId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!item) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: "Order not found" });
    }

    // ✅ if already cancelled -> no double refund
    if (item.status === "cancelled") {
      await t.commit();
      return res.json({ ok: true, message: "Already cancelled", data: item });
    }

    // ✅ only pending can cancel
    if (item.status !== "pending") {
      await t.rollback();
      return res.status(409).json({
        ok: false,
        message: `You can cancel only while status is pending. Current: ${item.status}`,
        allowed: ["pending"],
      });
    }


    const isPaid = item.paymentStatus === "paid";
    const itemPriceTotal = Number(item.price) * Number(item.quantity);
    const itemDelivery = Number(item.deliveryCharge || 0);
    const refundAmount = itemPriceTotal + itemDelivery;

    let balanceAfter;

    const sellerCommissionPercent = await getSellerCommissionPercent(t);
    const commissionForItem = Number(
      ((itemPriceTotal * sellerCommissionPercent) / 100).toFixed(2)
    );
    const merchantDebitTotal = Number((itemPriceTotal + commissionForItem).toFixed(2));

    if (isPaid && refundAmount > 0) {
      // ✅ lock user row
      const user = await User.findByPk(userId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!user) {
        await t.rollback();
        return res.status(404).json({ ok: false, message: "User not found" });
      }

      const currentBalance = Number(user.balance || 0);
      user.balance = currentBalance + refundAmount;
      await user.save({ transaction: t });
      balanceAfter = Number(user.balance);

      // Reverse merchant credit: product amount + configured commission.
      if (itemPriceTotal > 0) {
        const merchant = await User.findByPk(item.matchMerchantId, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (merchant) {
          merchant.balance = Number(merchant.balance || 0) - merchantDebitTotal;
          await merchant.save({ transaction: t });
        }
      }

      // ✅ Deduct from Admin (Reverse delivery charge)
      if (itemDelivery > 0) {
        const admin = await User.findOne({ where: { role: "admin" }, transaction: t, lock: t.LOCK.UPDATE });
        if (admin) {
          admin.balance = Number(admin.balance || 0) - itemDelivery;
          await admin.save({ transaction: t });
        }
      }
    }


    const product = await MerchentStore.findByPk(item.productId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (product) {
      product.stock = Number(product.stock || 0) + Number(item.quantity || 0);

      // soldCount reverse (optional)
      product.soldCount = Math.max(
        0,
        Number(product.soldCount || 0) - Number(item.quantity || 0)
      );

      await product.save({ transaction: t });
    }

    // ✅ finally cancel
    item.status = "cancelled";
    await item.save({ transaction: t });

    await Notification.bulkCreate(
      [
        {
          userId,
          type: "order",
          title: "Order cancelled",
          message: isPaid
            ? `Your order #${item.id} has been cancelled and ${refundAmount} refunded.`
            : `Your order #${item.id} has been cancelled.`,
          meta: {
            orderId: item.id,
            refundedAmount: isPaid ? refundAmount : 0,
            route: "/orders",
          },
        },
        {
          userId: item.matchMerchantId,
          type: "order",
          title: "Order cancelled by customer",
          message: `Order #${item.id} has been cancelled by customer.`,
          meta: {
            orderId: item.id,
            reversedAmount: isPaid ? merchantDebitTotal : 0,
            route: "/merchant/my-orders",
          },
        },
      ],
      { transaction: t }
    );

    await t.commit();

    return res.json({
      ok: true,
      message: isPaid ? "Order cancelled & refunded" : "Order cancelled",
      data: item,
      refunded: isPaid ? refundAmount : 0,
      balanceAfter,
    });
  } catch (err) {
    console.error("cancelMyOrder error:", err);
    await t.rollback();
    return res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
};
