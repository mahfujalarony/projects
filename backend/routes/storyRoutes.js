const router = require("express").Router();
const protect = require("../middleware/Middleware");

const {
  createStory,
  getStoryFeed,
  getMyStories,
  updateStory,
  deleteStory,
} = require("../controllers/storyController");


router.get("/", getStoryFeed);
router.post("/", protect, createStory);

//  Merchant own stories
router.get("/me", protect, getMyStories);
router.patch("/:id", protect, updateStory);
router.delete("/:id", protect, deleteStory);

module.exports = router;
