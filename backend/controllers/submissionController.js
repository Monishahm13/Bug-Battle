const Submission = require("../models/Submission");
const { submitToJudge } = require("../services/judgeService");
const { getLanguageConfig } = require("../config/languages");
const Question = require("../models/Question");
const Team = require("../models/Team");
const Event = require("../models/Event");
const User = require("../models/User");


const createSubmission = async (req, res) => {
    let submission;

    try {
        const { questionId, language, code } = req.body;

        if (
            !questionId ||
            !language ||
            typeof code !== "string" ||
            !code.trim()
        ) {
            return res.status(400).json({
                message: "Question ID, language and non-empty code are required"
            });
        }

        const languageConfig = getLanguageConfig(language);

        if (!languageConfig) {
            return res.status(400).json({
                message: "Unsupported programming language"
            });
        }

        const question = await Question.findById(questionId);

        if (!question) {
            return res.status(404).json({
                message: "Question not found"
            });
        }

        if (!question.active) {
            return res.status(400).json({
                message: "This question is not active"
            });
        }

        if (question.language !== language.toLowerCase()) {
            return res.status(400).json({
                message: "The selected language does not match this question"
            });
        }

        const event = await Event.findById(question.event);

        if (!event) {
            return res.status(404).json({
                message: "Associated event not found"
            });
        }

        if (event.status === "completed") {
            return res.status(400).json({
                message: "The event has already ended"
            });
        }

        if (event.status !== "live") {
            return res.status(400).json({
                message: "The event is not currently live"
            });
        }

        const now = new Date();
        const qPhase = question.phase || "bug_snap";
        const roundState = event.roundControl?.[qPhase];

        // Only enforce static schedule calendar bounds if round is not actively controlled
        if (!roundState?.isStarted) {
            if (event.startTime && now < new Date(event.startTime)) {
                return res.status(400).json({
                    message: "The event has not started yet"
                });
            }

            if (event.endTime && now > new Date(event.endTime)) {
                return res.status(400).json({
                    message: "The event has already ended"
                });
            }
        }

        const team = await Team.findOne({
            members: req.user._id,
            event: event._id
        });

        if (!team) {
            return res.status(403).json({
                message: "You are not part of a team registered for this event"
            });
        }

        if (event.phase !== qPhase && !question.isTieBreaker) {
            return res.status(400).json({
                message: `This challenge is for ${qPhase === "debug_arena" ? "Phase 2 (DEBUG ARENA)" : "Phase 1 (BUG SNAP)"}, but the event is currently in ${event.phase.replace("_", " ").toUpperCase()}`
            });
        }

        // Enforce Phase 2 qualification check according to rules
        if (qPhase === "debug_arena") {
            const bugSnapQuestions = await Question.find({
                event: event._id,
                phase: "bug_snap"
            }).select("_id");
            const bugSnapIds = bugSnapQuestions.map((q) => q._id);

            const acceptedP1 = await Submission.find({
                team: team._id,
                event: event._id,
                question: { $in: bugSnapIds },
                status: "accepted"
            });

            const uniqueP1Scores = new Map();
            acceptedP1.forEach((s) => {
                const qId = s.question.toString();
                uniqueP1Scores.set(
                    qId,
                    Math.max(uniqueP1Scores.get(qId) || 0, s.score || 0)
                );
            });

            const phase1Total = Array.from(uniqueP1Scores.values()).reduce(
                (sum, sc) => sum + sc,
                0
            );
            const qualifyingScore = event.qualifyingScore || 15;

            if (phase1Total < qualifyingScore) {
                return res.status(403).json({
                    message: `Your team does not qualify for Phase 2 (DEBUG ARENA). Required: ${qualifyingScore} pts in Phase 1 (BUG SNAP). Your current score: ${phase1Total} pts.`
                });
            }
        }

        // Check if the team or any team member has already finalized the round submission
        const teamTimer = team.roundTimers?.[qPhase];
        const submittingUser = await User.findById(req.user._id);
        if (teamTimer?.isSubmitted || submittingUser?.roundStatus?.[qPhase]?.isSubmitted) {
            return res.status(400).json({
                message: `Your team has already completed and submitted ${qPhase === "debug_arena" ? "DEBUG ARENA" : "BUG SNAP"}. No further submissions or attempts are allowed.`
            });
        }

        const alreadyAccepted = await Submission.findOne({
            team: team._id,
            event: event._id,
            question: question._id,
            status: "accepted"
        });

        if (alreadyAccepted) {
            return res.status(400).json({
                message: "Your team has already solved this question."
            });
        }

        // Save the submission before executing it.
        submission = await Submission.create({
            team: team._id,
            user: req.user._id,
            event: event._id,
            question: question._id,
            language: language.toLowerCase(),
            code,
            status: "pending"
        });

        try {
            const result = await submitToJudge({
                sourceCode: code,
                languageId: languageConfig.judge0LanguageId,
                expectedOutput: question.expectedOutput
            });

            const statusId = result.status?.id;
            const description = result.status?.description || "";

            let status = "system_error";

            if (statusId === 3) {
                status = "accepted";
            } else if (statusId === 4) {
                status = "wrong_answer";
            } else if (statusId === 5 || statusId === 6) {
                status = "time_limit";
            } else if (statusId === 7) {
                status = "system_error";
            } else if (statusId === 8) {
                status = "runtime_error";
            } else if ([9, 10, 11, 12, 13, 14].includes(statusId)) {
                status = "system_error";
            }

            const outputMessage =
                result.stderr ||
                result.compile_output ||
                result.message ||
                description;

            submission.status = status;
            submission.score =
                status === "accepted" ? question.points : 0;
            submission.executionTime =
                result.time != null ? Number(result.time) : null;
            submission.judgeMessage = String(outputMessage || description || "");

            await submission.save();
        } catch (judgeError) {
            console.error("Judge0 execution error:", judgeError.message);

            submission.status = "system_error";
            submission.score = 0;
            submission.judgeMessage =
                "Code execution service is unavailable. Please try again.";

            await submission.save();
        }

        const populatedSubmission = await Submission.findById(submission._id)
            .populate("team", "name")
            .populate("user", "name email")
            .populate("question", "title difficulty points");

        return res.status(201).json({
            message: "Submission processed",
            submission: populatedSubmission
        });
    } catch (error) {
        console.error("Create submission error:", error);

        return res.status(500).json({
            message: "Server error while creating submission"
        });
    }
};


const getMySubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find({
            user: req.user._id
        })
            .populate("team", "name")
            .populate("event", "name phase status")
            .populate("question", "title difficulty points")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            submissions
        });
    } catch (error) {
        console.error("Get submissions error:", error);

        return res.status(500).json({
            message: "Server error while getting submissions"
        });
    }
};

const getQuestionSubmissions = async (req, res) => {
    try {
        const question = await Question.findById(
            req.params.questionId
        );

        if (!question) {
            return res.status(404).json({
                message: "Question not found"
            });
        }

        const team = await Team.findOne({
            members: req.user._id,
            event: question.event
        });

        if (!team) {
            return res.status(403).json({
                message: "You are not part of a team for this event"
            });
        }

        const submissions = await Submission.find({
            question: question._id,
            team: team._id
        })
            .select(
                "-code"
            )
            .populate("user", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            submissions
        });
    } catch (error) {
        console.error(
            "Get question submissions error:",
            error
        );

        return res.status(500).json({
            message: "Server error while getting question submissions"
        });
    }
};


const getSubmissionDetails = async (req, res) => {
    try {
        const submission = await Submission.findById(
            req.params.submissionId
        );

        if (!submission) {
            return res.status(404).json({
                message: "Submission not found"
            });
        }

        // Allow access only to a member of the submission's team.
        const team = await Team.findOne({
            _id: submission.team,
            members: req.user._id,
            event: submission.event
        });

        if (!team) {
            return res.status(403).json({
                message: "You are not authorized to view this submission"
            });
        }

        const populatedSubmission = await Submission.findById(
            submission._id
        )
            .populate("team", "name")
            .populate("user", "name")
            .populate("event", "name")
            .populate("question", "title difficulty points");

        return res.status(200).json({
            submission: populatedSubmission
        });
    } catch (error) {
        console.error("Get submission details error:", error);

        return res.status(500).json({
            message: "Server error while getting submission details"
        });
    }
};



const getLeaderboard = async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        const teams = await Team.find({
            event: event._id
        }).select("name");

        const submissions = await Submission.find({
            event: event._id,
            status: "accepted"
        }).populate("question", "points phase isTieBreaker title");

        const teamScores = new Map();

        teams.forEach((team) => {
            teamScores.set(team._id.toString(), {
                teamId: team._id,
                teamName: team.name,
                solvedQuestions: new Map()
            });
        });

        submissions.forEach((submission) => {
            if (!submission.question) return;

            const teamId = submission.team.toString();
            const entry = teamScores.get(teamId);

            if (!entry) return;

            const questionId = submission.question._id.toString();
            const existing = entry.solvedQuestions.get(questionId);

            if (!existing || submission.score > existing.score) {
                entry.solvedQuestions.set(questionId, {
                    score: submission.score || 0,
                    phase: submission.question.phase || "bug_snap",
                    isTieBreaker: Boolean(submission.question.isTieBreaker)
                });
            }
        });

        const qualifyingScore = event.qualifyingScore || 15;

        const leaderboard = Array.from(teamScores.values())
            .map((team) => {
                let phase1Score = 0;
                let phase2Score = 0;
                let tieBreakerScore = 0;
                let bugsFixedCount = 0;

                team.solvedQuestions.forEach((q) => {
                    bugsFixedCount += 1;
                    if (q.isTieBreaker) {
                        tieBreakerScore += q.score;
                    }
                    if (q.phase === "debug_arena") {
                        phase2Score += q.score;
                    } else {
                        phase1Score += q.score;
                    }
                });

                const totalScore = phase1Score + phase2Score + tieBreakerScore;

                return {
                    teamId: team.teamId,
                    teamName: team.teamName,
                    score: totalScore,
                    phase1Score,
                    phase2Score,
                    tieBreakerScore,
                    bugsFixedCount,
                    isQualified: phase1Score >= qualifyingScore
                };
            })
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if (b.phase2Score !== a.phase2Score) return b.phase2Score - a.phase2Score;
                if (b.tieBreakerScore !== a.tieBreakerScore) return b.tieBreakerScore - a.tieBreakerScore;
                return b.bugsFixedCount - a.bugsFixedCount;
            })
            .map((entry, index) => {
                const rank = index + 1;
                let prizeTitle = "Participant";
                let certificateType = "participation";

                if (rank === 1 && entry.score > 0) {
                    prizeTitle = "BUG SLAYER 2026";
                    certificateType = "merit_winner";
                } else if (rank === 2 && entry.score > 0) {
                    prizeTitle = "Runner-Up";
                    certificateType = "merit_runner_up";
                } else if (rank === 3 && entry.score > 0) {
                    prizeTitle = "Second Runner-Up";
                    certificateType = "merit_second_runner_up";
                }

                return {
                    ...entry,
                    rank,
                    prizeTitle,
                    certificateType
                };
            });

        return res.status(200).json({
            event: {
                id: event._id,
                name: event.name,
                status: event.status,
                phase: event.phase,
                qualifyingScore
            },
            leaderboard
        });
    } catch (error) {
        console.error("Get leaderboard error:", error);

        return res.status(500).json({
            message: "Server error while getting leaderboard"
        });
    }
};



module.exports = {
    createSubmission,
    getMySubmissions,
    getQuestionSubmissions,
    getSubmissionDetails,
    getLeaderboard
};
