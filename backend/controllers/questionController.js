const Question = require("../models/Question");
const Event = require("../models/Event");

const difficultyPoints = {
    easy: 5,
    medium: 10,
    hard: 15,
    extreme: 20
};

const createQuestion = async (req, res) => {
    try {
        const {
            eventId,
            title,
            description,
            language,
            buggyCode,
            expectedOutput,
            difficulty,
            explanation,
            phase,
            errorCount,
            errorTypes,
            isTieBreaker,
            active
        } = req.body;

        if (
            !eventId ||
            !title ||
            !description ||
            !language ||
            !buggyCode ||
            !expectedOutput ||
            !difficulty
        ) {
            return res.status(400).json({
                message: "All required question fields must be provided"
            });
        }

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        const isOrganizer = req.user.role === "organizer" || (event.organizer && event.organizer.toString() === req.user._id.toString());
        if (!isOrganizer) {
            return res.status(403).json({
                message: "Only organizers can create questions"
            });
        }

        if (!difficultyPoints[difficulty]) {
            return res.status(400).json({
                message: "Invalid difficulty"
            });
        }

        const question = await Question.create({
            event: eventId,
            title: title.trim(),
            description: description.trim(),
            language,
            buggyCode,
            expectedOutput,
            difficulty,
            points: difficultyPoints[difficulty],
            explanation: explanation || "",
            phase: phase === "debug_arena" ? "debug_arena" : "bug_snap",
            errorCount: errorCount ? Number(errorCount) : (phase === "debug_arena" ? 10 : 1),
            errorTypes: Array.isArray(errorTypes) ? errorTypes : [],
            isTieBreaker: Boolean(isTieBreaker),
            active: active !== undefined ? active : true
        });

        const populatedQuestion = await Question.findById(question._id)
            .populate("event", "name status phase");

        return res.status(201).json({
            message: "Question created successfully",
            question: populatedQuestion
        });
    } catch (error) {
        console.error("Create question error:", error);

        return res.status(400).json({
            message: error.message || "Server error while creating question"
        });
    }
};

const getQuestionsByEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { phase } = req.query;

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        const isOrganizer = req.user && (
            req.user.role === "organizer" ||
            (event.organizer && event.organizer.toString() === req.user._id.toString())
        );

        // If not organizer and phase is requested, ensure organizer has actually started the round
        if (!isOrganizer && phase) {
            const roundState = event.roundControl?.[phase];
            if (!roundState || !roundState.isStarted) {
                return res.status(200).json({
                    isStarted: false,
                    message: `Round ${phase === "bug_snap" ? "BUG SNAP" : "DEBUG ARENA"} has not been started by the organizer yet.`,
                    questions: []
                });
            }
        }

        const query = { event: eventId };
        if (!isOrganizer) {
            query.active = true;
        }

        if (phase) {
            if (phase === "bug_snap") {
                query.$or = [{ phase: "bug_snap" }, { phase: { $exists: false } }, { phase: null }];
            } else {
                query.phase = phase;
            }
        }

        let queryBuilder = Question.find(query).sort({ isTieBreaker: 1, createdAt: 1 });
        if (!isOrganizer) {
            queryBuilder = queryBuilder.select("-expectedOutput -explanation");
        }

        const questions = await queryBuilder;

        return res.status(200).json({
            isStarted: true,
            questions
        });
    } catch (error) {
        console.error("Get questions error:", error);

        return res.status(500).json({
            message: "Server error while getting questions"
        });
    }
};

const getQuestionById = async (req, res) => {
    try {
        const question = await Question.findOne({
            _id: req.params.id,
            active: true
        })
            .select("-expectedOutput -explanation")
            .populate("event", "name status phase");

        if (!question) {
            return res.status(404).json({
                message: "Question not found"
            });
        }

        return res.status(200).json({
            question
        });
    } catch (error) {
        console.error("Get question error:", error);

        return res.status(500).json({
            message: "Server error while getting question"
        });
    }
};

const updateQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({
                message: "Question not found"
            });
        }

        const event = question.event ? await Event.findById(question.event) : null;
        const isOrganizer = req.user.role === "organizer" || (event && event.organizer && event.organizer.toString() === req.user._id.toString());

        if (!isOrganizer) {
            return res.status(403).json({
                message: "Only organizers can update this question"
            });
        }

        const {
            title,
            description,
            language,
            buggyCode,
            expectedOutput,
            difficulty,
            explanation,
            active
        } = req.body;

        if (title !== undefined) {
            question.title = title.trim();
        }

        if (description !== undefined) {
            question.description = description.trim();
        }

        if (language !== undefined) {
            question.language = language;
        }

        if (buggyCode !== undefined) {
            question.buggyCode = buggyCode;
        }

        if (expectedOutput !== undefined) {
            question.expectedOutput = expectedOutput;
        }

        if (difficulty !== undefined) {
            if (!difficultyPoints[difficulty]) {
                return res.status(400).json({
                    message: "Invalid difficulty"
                });
            }

            question.difficulty = difficulty;
            question.points = difficultyPoints[difficulty];
        }

        if (explanation !== undefined) {
            question.explanation = explanation;
        }

        if (active !== undefined) {
            question.active = active;
        }

        await question.save();

        const updatedQuestion = await Question.findById(question._id)
            .populate("event", "name status phase");

        return res.status(200).json({
            message: "Question updated successfully",
            question: updatedQuestion
        });
    } catch (error) {
        console.error("Update question error:", error);

        return res.status(400).json({
            message: error.message || "Server error while updating question"
        });
    }
};

const deleteQuestion = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({
                message: "Question not found"
            });
        }

        const event = question.event ? await Event.findById(question.event) : null;
        const isOrganizer = req.user.role === "organizer" || (event && event.organizer && event.organizer.toString() === req.user._id.toString());

        if (!isOrganizer) {
            return res.status(403).json({
                message: "Only organizers can delete this question"
            });
        }

        // Clean up associated submissions
        const Submission = require("../models/Submission");
        await Submission.deleteMany({ question: question._id });

        await Question.findByIdAndDelete(question._id);

        return res.status(200).json({
            message: "Question deleted successfully"
        });
    } catch (error) {
        console.error("Delete question error:", error);

        return res.status(500).json({
            message: error.message || "Server error while deleting question"
        });
    }
};

module.exports = {
    createQuestion,
    getQuestionsByEvent,
    getQuestionById,
    updateQuestion,
    deleteQuestion
};