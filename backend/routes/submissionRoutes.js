const express = require("express");

const protect = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");

const {
    createSubmission,
    runCodeOnly,
    getMySubmissions,
    getQuestionSubmissions,
    getSubmissionDetails,
    getLeaderboard
} = require("../controllers/submissionController");

const router = express.Router();

router.post(
    "/run",
    protect,
    runCodeOnly
);

router.post(
    "/",
    protect,
    createSubmission
);

router.get(
    "/my",
    protect,
    getMySubmissions
);

router.get(
    "/question/:questionId",
    protect,
    getQuestionSubmissions
);

router.get("/leaderboard/:eventId", protect, allowRoles("organizer"), getLeaderboard);

router.get(
    "/:submissionId",
    protect,
    getSubmissionDetails
);

module.exports = router;