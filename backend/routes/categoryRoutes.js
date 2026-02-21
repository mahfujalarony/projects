const router = require("express").Router();
const c = require("../controllers/categoryController");

router.get("/", c.getCategories);
router.post("/", c.createCategory);
router.put("/:id", c.updateCategory);
router.delete("/:id", c.deleteCategory);

module.exports = router;
