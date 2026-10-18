const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
    createTeam,
    joinTeam,
    getMyTeam,
    leaveTeam,
    registerTeamForEvent,
    startPhaseTimer,
    getPhaseTimer,
    finishPhaseTimer,
    resetPhaseTimer
} = require("../controllers/teamController");

const router = express.Router();

router.post("/", protect, createTeam);

router.post("/join", protect, joinTeam);

router.get("/me", protect, getMyTeam);

router.delete("/leave", protect, leaveTeam);

router.post(
    "/register-event",
    protect,
    registerTeamForEvent
);

router.post("/timer/start", protect, startPhaseTimer);
router.get("/timer/:phase", protect, getPhaseTimer);
router.post("/timer/finish", protect, finishPhaseTimer);
router.post("/timer/reset", protect, resetPhaseTimer);

module.exports = router;