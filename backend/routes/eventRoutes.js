const express = require("express");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const {
    createEvent,
    getEvents,
    getActiveEvent,
    getEventById,
    updateEvent,
    deleteEvent,
    getEventQualification,
    startRound,
    resetRound
} = require("../controllers/eventController");

const router = express.Router();

router.get("/", protect, getEvents);

router.get("/active", protect, getActiveEvent);

router.get("/:id/qualification", protect, getEventQualification);

router.get("/:id", protect, getEventById);

router.post(
    "/:id/start-round",
    protect,
    allowRoles("organizer"),
    startRound
);

router.post(
    "/:id/reset-round",
    protect,
    allowRoles("organizer"),
    resetRound
);

router.post(
    "/",
    protect,
    allowRoles("organizer"),
    createEvent
);

router.put(
    "/:id",
    protect,
    allowRoles("organizer"),
    updateEvent
);

router.delete(
    "/:id",
    protect,
    allowRoles("organizer"),
    deleteEvent
);

module.exports = router;