const express = require("express");

const protect = require("../middleware/authMiddleware");

const {
    createSubmission,
    getMySubmissions,
    getQuestionSubmissions,
    getSubmissionDetails,
    getLeaderboard
} = require("../controllers/submissionController");

const router = express.Router();

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

router.get("/leaderboard/:eventId", protect, getLeaderboard);

router.get(
    "/:submissionId",
    protect,
    getSubmissionDetails
);

module.exports = router;