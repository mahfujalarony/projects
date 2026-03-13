// controllers/adminOrderController.js
const { Op } = require("sequelize");
const OrderItem = require("./../models/Order");
const Address = require("./../models/Address");
const User = require("./../models/Authentication");
const Notification = require("./../models/Notification");
const sequelize = require("../config/db");
const MerchentStore = require("../models/MerchentStore");
const AppSetting = require("../models/AppSetting");
const { addMoney2 } = require("../utils/money");
const { appendAdminHistory } = require("../utils/adminHistory");

const STATUS_FLOW = ["pending", "processing", "shipped", "delivered"];
const TERMINAL = new Set(["delivered", "cancelled"]);

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

function getAllowedNextStatuses(currentStatus) {
  if (TERMINAL.has(currentStatus)) return [];

  const idx = STATUS_FLOW.indexOf(currentStatus);
  const next = [];

  // forward only: only immediate next step
  if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
    next.push(STATUS_FLOW[idx + 1]);
  }

  // cancel policy
  if (currentStatus === "pending" || currentStatus === "processing") {
    next.push("cancelled");
  }

  return next;
}

// GET /api/admin/orders
exports.getAdminOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      q = "",
      status,
      userId,
      merchantId,
      paymentMethod,
      sort = "createdAt",
      order = "DESC",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);

    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (merchantId) where.matchMerchantId = merchantId;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    if (q && q.trim()) {
      const s = q.trim();
      where[Op.or] = [
        ...(Number.isFinite(Number(s)) ? [{ id: Number(s) }] : []),
        { name: { [Op.like]: `%${s}%` } },
      ];
    }

    const offset = (pageNum - 1) * limitNum;

    // whitelist sort fields
    const SORT_FIELDS = new Set(["createdAt", "updatedAt", "id", "price", "quantity", "status"]);
    const safeSort = SORT_FIELDS.has(sort) ? sort : "createdAt";
    const safeOrder = String(order).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const result = await OrderItem.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [[safeSort, safeOrder]],
    });

    return res.json({
      rows: result.rows,
      count: result.count,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// address
exports.getAdminOrderDetails = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const order = await OrderItem.findByPk(id, {
      include: [
        { model: Address }, // no alias -> easier
        { model: User, attributes: ["id", "name", "email", "imageUrl", "role"] },
      ],
    });

    if (!order) return res.status(404).json({ message: "Order not found" });

    return res.json({
      order,
      address: order.Address || null,
      user: order.User || { id: order.userId },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Server error" });
  }
};

// PATCH /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const { status: nextStatus } = body;
    const hasTrackingPayload =
      Object.prototype.hasOwnProperty.call(body, "trackingNumber") ||
      Object.prototype.hasOwnProperty.call(body, "trackingNote");
    const trackingNumber = String(body.trackingNumber || "").trim();
    const trackingNote = String(body.trackingNote || "").trim();

    if (!Number.isFinite(id)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid order id" });
    }

    const ALL_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!nextStatus || !ALL_STATUSES.includes(nextStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid status" });
    }

    const orderItem = await OrderItem.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = orderItem.status;
    const actorId = req.user?.id || req.userId || null;

    // terminal lock
    if (TERMINAL.has(currentStatus)) {
      await t.rollback();
      return res.status(409).json({
        message: `Order is locked. Current status: ${currentStatus}`,
      });
    }

    // forward-only validation
    const allowed = getAllowedNextStatuses(currentStatus);
    if (!allowed.includes(nextStatus)) {
      await t.rollback();
      return res.status(409).json({
        message: `Invalid status transition: ${currentStatus} -> ${nextStatus}`,
        allowedNext: allowed,
      });
    }

    // ✅ Handle Cancellation Logic (Refund + Stock)
    if (nextStatus === "cancelled") {
      const isPaid = orderItem.paymentStatus === "paid";
      const itemPriceTotal = Number(orderItem.price) * Number(orderItem.quantity);
      const itemDelivery = Number(orderItem.deliveryCharge || 0);
      const refundAmount = itemPriceTotal + itemDelivery;

      if (isPaid && refundAmount > 0) {
        // 1. Refund User
        const user = await User.findByPk(orderItem.userId, { transaction: t, lock: t.LOCK.UPDATE });
        if (user) {
          const nextUserBalance = addMoney2(user.balance, refundAmount);
          if (!nextUserBalance) throw new Error("Invalid user balance calculation");
          user.balance = nextUserBalance;
          await user.save({ transaction: t });
        }

      }

      // 4. Restore Stock
      const product = await MerchentStore.findByPk(orderItem.productId, { transaction: t, lock: t.LOCK.UPDATE });
      if (product) {
        product.stock = Number(product.stock || 0) + Number(orderItem.quantity || 0);
        product.soldCount = Math.max(0, Number(product.soldCount || 0) - Number(orderItem.quantity || 0));
        await product.save({ transaction: t });
      }
    }

    if (nextStatus === "delivered") {
      const itemPriceTotal = Number(orderItem.price) * Number(orderItem.quantity);
      const halfPart = Number((itemPriceTotal * 0.5).toFixed(2));
      const merchantRate =
        Number(orderItem.commissionPercent || 0) > 0
          ? Number(orderItem.commissionPercent || 0)
          : await getSellerCommissionPercent(t);
      const merchantBonus = Number(((halfPart * merchantRate) / 100).toFixed(2));
      const merchantCreditTotal = Number((halfPart + merchantBonus).toFixed(2));
      const adminPortion = Number((itemPriceTotal - merchantCreditTotal).toFixed(2));

      const merchant = await User.findByPk(orderItem.matchMerchantId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (merchant && merchantCreditTotal > 0) {
        const nextMerchantBalance = addMoney2(merchant.balance, merchantCreditTotal);
        if (!nextMerchantBalance) throw new Error("Invalid merchant balance calculation");
        merchant.balance = nextMerchantBalance;
        await merchant.save({ transaction: t });
      }

      orderItem.commissionPercent = merchantRate;
      orderItem.commissionAmount = merchantBonus;

      await appendAdminHistory(
        `Order #${orderItem.id} delivered. Merchant #${orderItem.matchMerchantId} settlement ${merchantCreditTotal.toFixed(
          2
        )} (base 50%: ${halfPart.toFixed(2)}, bonus ${merchantRate}%: ${merchantBonus.toFixed(
          2
        )}). Admin share (log only): ${adminPortion.toFixed(2)}.`,
        {
          transaction: t,
          meta: {
            type: "order_delivered_settlement",
            orderId: orderItem.id,
            merchantId: orderItem.matchMerchantId,
            itemPriceTotal: Number(itemPriceTotal.toFixed(2)),
            baseReturn: halfPart,
            merchantRate,
            merchantBonus,
            merchantSettlement: merchantCreditTotal,
            adminPortion,
          },
        }
      );
    }

    orderItem.status = nextStatus;
    if (hasTrackingPayload) {
      orderItem.trackingNumber = trackingNumber || null;
      orderItem.trackingNote = trackingNote || null;
    }
    await orderItem.save({ transaction: t });

    await appendAdminHistory(
      `Order status changed. Order #${orderItem.id}: ${currentStatus} -> ${nextStatus} by admin #${actorId || "unknown"}.`,
      {
        transaction: t,
        meta: {
          type: "order_status_updated",
          actorId,
          orderId: orderItem.id,
          oldStatus: currentStatus,
          newStatus: nextStatus,
          trackingNumber: orderItem.trackingNumber || null,
          trackingNote: orderItem.trackingNote || null,
          userId: orderItem.userId,
          merchantId: orderItem.matchMerchantId,
        },
      }
    );

    const trackingSuffix =
      orderItem.trackingNumber && (nextStatus === "processing" || nextStatus === "shipped")
        ? ` Tracking: ${orderItem.trackingNumber}.`
        : "";

    const notifications = [
      {
        userId: orderItem.userId,
        type: "order",
        title: `Order ${nextStatus}`,
        message: `Your order #${orderItem.id} has been updated to ${nextStatus}.${trackingSuffix}`,
        meta: {
          orderId: orderItem.id,
          status: nextStatus,
          trackingNumber: orderItem.trackingNumber || null,
          trackingNote: orderItem.trackingNote || null,
          route: "/orders",
        },
      },
      {
        userId: orderItem.matchMerchantId,
        type: "order",
        title: `Order ${nextStatus}`,
        message: `Order #${orderItem.id} status has been updated to ${nextStatus}.`,
        meta: {
          orderId: orderItem.id,
          status: nextStatus,
          trackingNumber: orderItem.trackingNumber || null,
          trackingNote: orderItem.trackingNote || null,
          route: "/merchant/my-orders",
        },
      },
    ];

    if (nextStatus === "cancelled") {
      notifications[1].title = "Order cancelled by admin";
      notifications[1].message = `Order #${orderItem.id} was cancelled by admin.`;
    }

    await Notification.bulkCreate(notifications, { transaction: t });

    await t.commit();
    return res.json(orderItem);
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ message: "Failed to update status" });
  }
};
