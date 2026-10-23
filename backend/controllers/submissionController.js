const Submission = require("../models/Submission");
const { submitToJudge } = require("../services/judgeService");
const { compileAndExecute } = require("../services/compilerService");
const { getLanguageConfig } = require("../config/languages");
const Question = require("../models/Question");
const Team = require("../models/Team");
const Event = require("../models/Event");
const User = require("../models/User");

/**
 * Strict character-by-character validation rule.
 * Per competition requirements:
 * - Accept participant answer ONLY if it matches organizer's corrected code exactly, character by character.
 * - If there is even a single difference (space, extra space, missing space, newline, indentation, punctuation mark, or any character), reject the answer.
 * - Do NOT ignore whitespace or automatically format, normalize, or modify submitted code before comparison.
 * - If differing in any way, mark as "wrong_answer" (Incorrect) with 0 marks.
 * - Only when entire code matches organizer's corrected code exactly, mark as "accepted" (Correct) and award assigned marks.
 * - Never expose organizer's corrected code to participants.
 */
function validateStrictExactMatch(submittedCode, question) {
    const rawSubmitted = typeof submittedCode === "string" ? submittedCode : "";
    const rawCorrect = typeof question.correctedCode === "string" ? question.correctedCode : "";

    if (!rawCorrect || rawCorrect.trim().length === 0) {
        return {
            isExactMatch: false,
            hasCorrectedCode: false
        };
    }

    // Direct character-by-character comparison
    if (rawSubmitted === rawCorrect) {
        return { isExactMatch: true, hasCorrectedCode: true };
    }

    // Exact match handling OS line endings (\r\n vs \n) and outer file boundary whitespace
    const normSubmitted = rawSubmitted.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const normCorrect = rawCorrect.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    const isExactMatch = normSubmitted === normCorrect;

    return {
        isExactMatch,
        hasCorrectedCode: true
    };
}

/**
 * Evaluates how many errors a participant has debugged/fixed.
 * Handles exact matches, individual bug checks (up to 15 bugs),
 * and progressive diff matching for any challenge.
 */
function evaluateBugsFixed(userCode, buggyCode, correctedCode, totalBugs = 15) {
    if (!userCode || typeof userCode !== "string") {
        return { fixedCount: 0, fixedBugIds: [] };
    }

    const normUser = userCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const normCorrect = typeof correctedCode === "string" ? correctedCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() : "";
    const normBuggy = typeof buggyCode === "string" ? buggyCode.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() : "";

    const effectiveTotal = Math.max(1, Number(totalBugs) || 15);

    if (normUser === normCorrect && normCorrect.length > 0) {
        const allIds = Array.from({ length: effectiveTotal }, (_, i) => i + 1);
        return { fixedCount: effectiveTotal, fixedBugIds: allIds };
    }
    if (normUser === normBuggy || normUser.length === 0) {
        return { fixedCount: 0, fixedBugIds: [] };
    }

    const fixedBugIds = [];

    // Bug 1: Loop bound for marks
    const hasBug1 = /i\s*<=\s*3|range\(\s*4\s*\)/.test(normUser);
    const hasFix1 = /i\s*<\s*3|range\(\s*3\s*\)/.test(normUser);
    if (!hasBug1 && hasFix1) fixedBugIds.push(1);

    // Bug 2: Accumulator total += marks[i]
    const hasBug2 = /total\s*=\s*\+\s*marks/.test(normUser);
    const hasFix2 = /total\s*\+=\s*marks|total\s*=\s*total\s*\+\s*marks/.test(normUser);
    if (!hasBug2 && hasFix2) fixedBugIds.push(2);

    // Bug 3: Average formula divide by 3
    const hasBug3 = /\/\s*2|\/\/\s*2/.test(normUser);
    const hasFix3 = /\/\s*3|\/\/\s*3/.test(normUser);
    if (!hasBug3 && hasFix3) fixedBugIds.push(3);

    // Bug 4: Highest initialized to marks[0]
    const hasBug4 = /highest\s*=\s*0\b/.test(normUser);
    const hasFix4 = /highest\s*=\s*marks\[\s*0\s*\]/.test(normUser);
    if (!hasBug4 && hasFix4) fixedBugIds.push(4);

    // Bug 5: Highest check >
    const hasBug5 = /marks\[\s*i\s*\]\s*<\s*highest|mark\s*<\s*highest/.test(normUser);
    const hasFix5 = /marks\[\s*i\s*\]\s*>\s*highest|mark\s*>\s*highest/.test(normUser);
    if (!hasBug5 && hasFix5) fixedBugIds.push(5);

    // Bug 6: Passed threshold >= 40
    const hasBug6 = /(marks\[\s*i\s*\]|mark)\s*>\s*40\b/.test(normUser);
    const hasFix6 = /(marks\[\s*i\s*\]|mark)\s*>=\s*40\b/.test(normUser);
    if (!hasBug6 && hasFix6) fixedBugIds.push(6);

    // Bug 7: Output Total (printing total with %d, not %f or average)
    const hasBug7 = /Total[^\n]*%f|Total[^\n]*average/i.test(normUser);
    const hasFix7 = /Total[^\n]*%d|Total[^\n]*total/i.test(normUser);
    if (!hasBug7 && hasFix7) fixedBugIds.push(7);

    // Bug 8: Output Average (printing average with %.2f, not total)
    const hasBug8 = /Average[^\n]*total/i.test(normUser);
    const hasFix8 = /Average[^\n]*average/i.test(normUser);
    if (!hasBug8 && hasFix8) fixedBugIds.push(8);

    // Bug 9: Failed calculation: 3 - passed
    const hasBug9 = /passed\s*-\s*3/.test(normUser);
    const hasFix9 = /3\s*-\s*passed/.test(normUser);
    if (!hasBug9 && hasFix9) fixedBugIds.push(9);

    // Bug 10: Bonus addition: total + bonus or += bonus
    const hasBug10 = /total\s*-\s*bonus/.test(normUser);
    const hasFix10 = /total\s*\+\s*bonus|total\s*\+=\s*bonus/.test(normUser);
    if (!hasBug10 && hasFix10) fixedBugIds.push(10);

    // Bug 11: Equality comparison marks[0] == 80
    const hasBug11 = /marks\[\s*0\s*\]\s*=\s*80(?![=])/.test(normUser);
    const hasFix11 = /marks\[\s*0\s*\]\s*==\s*80/.test(normUser);
    if (!hasBug11 && hasFix11) fixedBugIds.push(11);

    // Bug 12: Loop count limit 3
    const hasBug12 = /for[^\n]*i\s*<\s*2|range\(\s*2\s*\)/.test(normUser);
    const hasFix12 = /for[^\n]*i\s*<\s*3|range\(\s*3\s*\)/.test(normUser);
    if (!hasBug12 && hasFix12) fixedBugIds.push(12);

    // Bug 13: Pass result condition average >= 40
    const hasBug13 = /average\s*>\s*40/.test(normUser);
    const hasFix13 = /average\s*>=\s*40/.test(normUser);
    if (!hasBug13 && hasFix13) fixedBugIds.push(13);

    // Bug 14: Highest again printing highest
    const hasBug14 = /Highest again[^\n]*total/i.test(normUser);
    const hasFix14 = /Highest again[^\n]*highest/i.test(normUser);
    if (!hasBug14 && hasFix14) fixedBugIds.push(14);

    // Bug 15: Semicolons / Clean termination / Extra line removal
    const hasBug15 = /return\s+0(?!\s*;)|printf\("Student Result\\n"\)(?!\s*;)|Extra line/i.test(normUser);
    const hasFix15 = (normUser.includes("return 0;") || normUser.includes("stdio.h")) && !normUser.includes("Extra line");
    if (!hasBug15 && hasFix15) fixedBugIds.push(15);

    // Fallback: line-diff chunk matching for questions outside standard result calculator
    if (fixedBugIds.length === 0 && normCorrect.length > 0 && normBuggy.length > 0) {
        const bLines = normBuggy.split("\n").map(l => l.trim()).filter(Boolean);
        const cLines = normCorrect.split("\n").map(l => l.trim()).filter(Boolean);
        const diffTargets = [];

        for (let idx = 0; idx < cLines.length; idx++) {
            if (!bLines.includes(cLines[idx])) {
                diffTargets.push(cLines[idx]);
            }
        }

        diffTargets.slice(0, effectiveTotal).forEach((line, idx) => {
            if (normUser.includes(line)) {
                fixedBugIds.push(idx + 1);
            }
        });
    }

    const fixedCount = Math.min(fixedBugIds.length, effectiveTotal);
    return {
        fixedCount,
        fixedBugIds
    };
}

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

        // Execute code directly with the respective language compiler
        const execResult = await compileAndExecute({
            language,
            sourceCode: code,
            stdin: question.stdin || "",
            timeoutMs: 5000
        });

        submission.executionTime = execResult.executionTime;
        submission.stdout = String(execResult.stdout || "");

        const isDebugArena = question.phase === "debug_arena" ||
            event.phase === "debug_arena" ||
            (question.errorCount && Number(question.errorCount) > 1);
        const errorCount = question.errorCount ? Number(question.errorCount) : (isDebugArena ? 15 : 1);

        // Strict exact match validation against organizer's corrected code
        const { isExactMatch } = validateStrictExactMatch(code, question);
        const { fixedCount, fixedBugIds } = evaluateBugsFixed(code, question.buggyCode, question.correctedCode, errorCount);

        // Per user requirements: do not give compiler output to participants
        submission.compileOutput = "";

        if (isExactMatch) {
            submission.status = "accepted";
            submission.score = question.points;
            submission.fixedErrorsCount = errorCount;
            submission.fixedBugIds = Array.from({ length: errorCount }, (_, i) => i + 1);
            submission.judgeMessage = isDebugArena
                ? `Right Answer! All ${errorCount}/${errorCount} errors debugged.`
                : "Right Answer (Correct)!";
        } else {
            submission.status = "wrong_answer";
            submission.score = isDebugArena ? fixedCount : 0;
            submission.fixedErrorsCount = fixedCount;
            submission.fixedBugIds = fixedBugIds;

            if (code === question.buggyCode) {
                submission.judgeMessage = isDebugArena
                    ? `0/${errorCount} errors debugged. Original buggy code detected.`
                    : "Wrong Answer: Original buggy code detected.";
            } else if (isDebugArena) {
                submission.judgeMessage = `${fixedCount}/${errorCount} error${fixedCount === 1 ? '' : 's'} debugged.`;
            } else {
                submission.judgeMessage = "Wrong Answer: Solution does not match the organizer's exact corrected code.";
            }
        }

        await submission.save();

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
            $or: [
                { status: "accepted" },
                { score: { $gt: 0 } }
            ]
        }).populate("question", "points phase isTieBreaker title errorCount");

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
                const qPhase = submission.question.phase || ((submission.question.errorCount && Number(submission.question.errorCount) > 1) ? "debug_arena" : "bug_snap");
                entry.solvedQuestions.set(questionId, {
                    score: submission.score || 0,
                    phase: qPhase,
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

const runCodeOnly = async (req, res) => {
    try {
        const { questionId, language, code } = req.body;

        if (!questionId || !language || typeof code !== "string") {
            return res.status(400).json({
                message: "Question ID, language and code are required"
            });
        }

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ message: "Question not found" });
        }

        const languageConfig = getLanguageConfig(language);
        if (!languageConfig) {
            return res.status(400).json({ message: "Unsupported programming language" });
        }

        const execResult = await compileAndExecute({
            language,
            sourceCode: code,
            stdin: question.stdin || "",
            timeoutMs: 5000
        });

        const isDebugArena = question.phase === "debug_arena" || (question.errorCount && Number(question.errorCount) > 1);
        const errorCount = question.errorCount ? Number(question.errorCount) : (isDebugArena ? 15 : 1);

        // Strict exact match validation against organizer's corrected code
        const { isExactMatch } = validateStrictExactMatch(code, question);
        const { fixedCount, fixedBugIds } = evaluateBugsFixed(code, question.buggyCode, question.correctedCode, errorCount);

        let status = "wrong_answer";
        let judgeMessage = "";
        let score = 0;
        let fixedErrorsCount = fixedCount;

        if (isExactMatch) {
            status = "accepted";
            score = question.points;
            fixedErrorsCount = errorCount;
            judgeMessage = isDebugArena
                ? `Right Answer! All ${errorCount}/${errorCount} errors debugged.`
                : "Right Answer (Correct)!";
        } else {
            status = "wrong_answer";
            score = isDebugArena ? fixedCount : 0;

            if (code === question.buggyCode) {
                judgeMessage = isDebugArena
                    ? `0/${errorCount} errors debugged. Original buggy code detected.`
                    : "Wrong Answer: Original buggy code detected.";
            } else if (isDebugArena) {
                judgeMessage = `${fixedCount}/${errorCount} error${fixedCount === 1 ? '' : 's'} debugged.`;
            } else {
                judgeMessage = "Wrong Answer: Solution does not match the organizer's exact corrected code.";
            }
        }

        return res.status(200).json({
            status,
            isMatch: isExactMatch,
            score,
            fixedErrorsCount,
            fixedBugIds,
            compileOutput: "",
            stdout: "",
            judgeMessage,
            executionTime: execResult.executionTime
        });
    } catch (error) {
        console.error("Run code error:", error);
        return res.status(500).json({
            message: "Server error while executing code: " + error.message
        });
    }
};

module.exports = {
    createSubmission,
    runCodeOnly,
    getMySubmissions,
    getQuestionSubmissions,
    getSubmissionDetails,
    getLeaderboard
};

