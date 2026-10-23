const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000
        },

        language: {
            type: String,
            enum: ["javascript", "python", "java", "cpp", "c"],
            required: true
        },

        buggyCode: {
            type: String,
            required: true
        },

        correctedCode: {
            type: String,
            default: ""
        },

        expectedOutput: {
            type: String,
            required: true
        },

        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard", "extreme"],
            required: true
        },

        points: {
            type: Number,
            enum: [5, 10, 15, 20],
            required: true
        },

        explanation: {
            type: String,
            default: ""
        },

        phase: {
            type: String,
            enum: ["bug_snap", "debug_arena"],
            default: "bug_snap"
        },

        errorCount: {
            type: Number,
            default: 1
        },

        errorTypes: {
            type: [String],
            default: []
        },

        isTieBreaker: {
            type: Boolean,
            default: false
        },

        active: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Question", questionSchema);