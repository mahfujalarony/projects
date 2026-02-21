const router = require("express").Router();
const { createCustomerOrder, getMyOrders, cancelMyOrder  } = require("../controllers/CustomarOrderController");
const protect = require("../middleware/Middleware");


router.post("/", protect, createCustomerOrder);
router.get("/my", protect, getMyOrders);
router.get("/my-orders", protect, getMyOrders);
router.patch("/my-orders/:id/cancel",  protect, cancelMyOrder);


module.exports = router;
