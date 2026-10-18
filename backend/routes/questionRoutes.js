const express = require("express");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const {
    createQuestion,
    getQuestionsByEvent,
    getQuestionById,
    updateQuestion,
    deleteQuestion
} = require("../controllers/questionController");

const router = express.Router();

router.get(
    "/event/:eventId",
    protect,
    getQuestionsByEvent
);

router.get(
    "/:id",
    protect,
    getQuestionById
);

router.post(
    "/",
    protect,
    allowRoles("organizer"),
    createQuestion
);

router.put(
    "/:id",
    protect,
    allowRoles("organizer"),
    updateQuestion
);

router.delete(
    "/:id",
    protect,
    allowRoles("organizer"),
    deleteQuestion
);

module.exports = router;