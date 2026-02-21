const router = require("express").Router();
const subCategoryController = require("../controllers/subCategoryController");


router.post("/", subCategoryController.createSubCategory);
router.get("/", subCategoryController.getSubCategories);
router.patch("/:id", subCategoryController.updateSubCategory);
router.delete("/:id", subCategoryController.deleteSubCategory);

module.exports = router;
