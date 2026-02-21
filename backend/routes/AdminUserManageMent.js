// routes/adminUsers.js
const router = require("express").Router();
const protect = require("../middleware/Middleware"); 
const {
  adminGetUsers,
  adminGetUserById,
  adminUpdateUser,
  getSubAdminPermissions,
  setSubAdminPermissions,
  getSubAdminOwnPermissions,
} = require("../controllers/adminUserController");

const {
  getAdminProducts,
  getAdminProductById,
  updateAdminProduct,
  deleteAdminProduct,
  getProductFilters,
  getAdminStats
} = require("../controllers/AdminController");

const requireAdminOrSubAdminPermission = require("../middleware/requireAdminOrSubAdminPermission");

const adminOnly = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "admin") return res.status(403).json({ ok: false, message: "Admin only" });
  next();
};




router.get("/users", protect, adminOnly, adminGetUsers);
router.get("/users/:id", protect, adminOnly, adminGetUserById);
router.patch("/users/:id", protect, adminOnly, adminUpdateUser);

//  Sub-Admin Permission Routes
router.get("/subadmin-permissions/:id", protect, adminOnly, getSubAdminPermissions);
router.post("/subadmin-permissions/:id", protect, adminOnly, setSubAdminPermissions);

//  Sub-Admin fetching their OWN permissions
router.get("/subadmin/me/permissions", protect, requireAdminOrSubAdminPermission(), getSubAdminOwnPermissions);

//  Product Management Routes
router.get("/products", protect, requireAdminOrSubAdminPermission(), getAdminProducts);
router.get("/products/filters", protect, requireAdminOrSubAdminPermission(), getProductFilters);
router.get("/products/:id", protect, requireAdminOrSubAdminPermission(), getAdminProductById);
router.patch("/products/:id", protect, requireAdminOrSubAdminPermission(), updateAdminProduct);
router.delete("/products/:id", protect, requireAdminOrSubAdminPermission(), deleteAdminProduct);

//  Dashboard Stats
router.get("/stats", protect, requireAdminOrSubAdminPermission(), getAdminStats);

module.exports = router;
