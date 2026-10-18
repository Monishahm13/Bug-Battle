const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema(
    {
        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true
        },

        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Question",
            required: true
        },

        language: {
            type: String,
            required: true
        },

        code: {
            type: String,
            required: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "accepted",
                "wrong_answer",
                "runtime_error",
                "compile_error",
                "time_limit",
                "system_error"
            ],
            default: "pending"
        },

        score: {
            type: Number,
            default: 0
        },

        executionTime: {
            type: Number,
            default: null
        },

        judgeMessage: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Submission", submissionSchema);