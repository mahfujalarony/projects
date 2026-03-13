// controllers/orderController.js
const { Op } = require("sequelize");
const sequelize = require("../config/db");
const OrderItem = require("../models/Order"); 
const MerchentStore = require("../models/MerchentStore");
const User = require("../models/Authentication");
const ProductDailyStat = require("../models/ProductDailyStat");
const Notification = require("../models/Notification");
const AppSetting = require("../models/AppSetting");
const { addMoney2, subMoney2, toMoney2 } = require("../utils/money");
const crypto = require("crypto");
const { appendAdminHistory } = require("../utils/adminHistory");

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


    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized (userId missing)" });
    }

    const deliveryCharge = Number(dcInput || 0);

    if (!addressId) {
      await t.rollback();
      return res.status(400).json({ message: "addressId is required" });
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
      if (!Number.isFinite(qty) || qty <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid quantity in items" });
      }
    }

    const sellerCommissionPercent = await getSellerCommissionPercent(t);

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

      if (!p.merchantId) {
        await t.rollback();
        return res.status(400).json({ message: `Product ${p.id} missing merchant` });
      }

      const qty = Number(it.quantity);
      if (Number(p.stock) < qty) {
        await t.rollback();
        return res.status(400).json({
          message: `Not enough stock for ${p.name}. Available: ${p.stock}`,
        });
      }
    }

    // ✅ group items by merchant (server-side)
    const merchantGroupMap = new Map(); // merchantId -> items
    const merchantOrder = [];
    for (const it of items) {
      const p = productMap.get(String(it.productId));
      const mid = Number(p?.merchantId);
      if (!Number.isFinite(mid) || mid <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid merchant for product" });
      }
      if (!merchantGroupMap.has(mid)) {
        merchantGroupMap.set(mid, []);
        merchantOrder.push(mid);
      }
      merchantGroupMap.get(mid).push(it);
    }

    // ✅ total calculate (server-side price)
    let productsTotalAll = 0;
    const merchantTotals = new Map(); // merchantId -> { productsTotal, merchantBonus, projectedSettlement, adminPortion }

    for (const mid of merchantOrder) {
      const list = merchantGroupMap.get(mid);
      const rawProductsTotal = list.reduce((sum, it) => {
        const p = productMap.get(String(it.productId));
        const price = Number(p?.price);
        const qty = Number(it.quantity);
        if (!Number.isFinite(price)) return sum;
        return sum + price * qty;
      }, 0);
      const productsTotal = Number(toMoney2(rawProductsTotal) || 0);
      const halfPart = Number((productsTotal * 0.5).toFixed(2));
      const merchantBonus = Number(((halfPart * sellerCommissionPercent) / 100).toFixed(2));
      const projectedSettlement = Number((halfPart + merchantBonus).toFixed(2));
      const adminPortion = Number((productsTotal - projectedSettlement).toFixed(2));
      merchantTotals.set(mid, { productsTotal, merchantBonus, projectedSettlement, adminPortion });
      productsTotalAll += productsTotal;
    }

    const orderTotal = Number(toMoney2(productsTotalAll + deliveryCharge) || 0);

    let user = null;

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

      const nextUserBalance = subMoney2(currentBalance, orderTotal);
      if (!nextUserBalance) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid balance calculation" });
      }
      user.balance = nextUserBalance;
      await user.save({ transaction: t });
    }
    // UPDATE stock + soldCount + ProductDailyStat (same transaction)
    const statDate = getBDDateString();

    for (const it of items) {
      const p = productMap.get(String(it.productId));
      const qty = Number(it.quantity);
      const price = Number(p?.price);
      if (!Number.isFinite(price)) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid product price" });
      }

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

    const checkoutGroupId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `og_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`;

    // order items create
    let deliveryApplied = false;
    const rowsToCreate = items.map((it) => {
      const p = productMap.get(String(it.productId));
      const price = Number(p?.price);
      const qty = Number(it.quantity);
      const lineTotal = price * qty;
      const lineHalfPart = Number((lineTotal * 0.5).toFixed(2));
      const lineMerchantBonus = Number(((lineHalfPart * sellerCommissionPercent) / 100).toFixed(2));
      const mid = Number(p?.merchantId);
      const orderGroupId = `${checkoutGroupId}:${mid}`;
      const deliveryForLine = !deliveryApplied ? deliveryCharge : 0;
      deliveryApplied = true;
      return {
        userId,
        addressId,
        matchMerchantId: mid,
        orderGroupId,
        paymentMethod,
        paymentStatus,
        productId: it.productId, 
        name: it.name,
        price,
        quantity: qty,
        imageUrl: it.imageUrl || null,
        status: "pending",
        deliveryCharge: deliveryForLine,
        commissionPercent: sellerCommissionPercent,
        commissionAmount: lineMerchantBonus,
      };
    });

    const created = await OrderItem.bulkCreate(rowsToCreate, {
      transaction: t,
      returning: true,
    });

    // Summary notifications (avoid per-item spam)
    const orderItemIds = created.map((x) => x.id);
    const primaryOrderId = orderItemIds[0] || null;
    const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
    const notifications = [];

    for (const mid of merchantOrder) {
      const totals = merchantTotals.get(mid);
      const list = merchantGroupMap.get(mid) || [];
      const mQty = list.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
      const merchantMessage = `New order #${primaryOrderId} received (${list.length} item(s), qty ${mQty}). Settlement on delivery: ${totals?.projectedSettlement || 0} (50% base return + ${sellerCommissionPercent}% bonus on remaining half).`;
      notifications.push({
        userId: mid,
        type: "order",
        title: "New order received",
        message: merchantMessage,
        meta: {
          orderId: primaryOrderId,
          orderItemIds,
          productsTotal: totals?.productsTotal || 0,
          commissionPercent: sellerCommissionPercent,
          projectedMerchantBonus: totals?.merchantBonus || 0,
          projectedSettlement: totals?.projectedSettlement || 0,
          projectedAdminPortion: totals?.adminPortion || 0,
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

    await appendAdminHistory(
      `New checkout order placed by user #${userId}. Order #${primaryOrderId}, item(s): ${items.length}, qty: ${totalQty}, total: ${Number(
        orderTotal || 0
      ).toFixed(2)}.`,
      {
        transaction: t,
        meta: {
          type: "order_placed",
          userId,
          orderId: primaryOrderId,
          orderItemIds,
          merchantIds: merchantOrder,
          itemCount: items.length,
          totalQuantity: totalQty,
          orderTotal: Number(orderTotal || 0),
          paymentMethod,
          paymentStatus,
        },
      }
    );

    await t.commit();

    return res.status(201).json({
      message: "Order placed successfully",
      items: created,
      total: orderTotal,
      balanceAfter: Number(user.balance),
      statDate,
    });
  } catch (err) {
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
      const nextUserBalance = addMoney2(currentBalance, refundAmount);
      if (!nextUserBalance) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid balance calculation" });
      }
      user.balance = nextUserBalance;
      await user.save({ transaction: t });
      balanceAfter = Number(user.balance);
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
            reversedAmount: 0,
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
    await t.rollback();
    return res.status(500).json({ ok: false, message: err?.message || "Server error" });
  }
};



