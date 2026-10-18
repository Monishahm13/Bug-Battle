const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 100
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000
        },

        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        status: {
            type: String,
            enum: ["draft", "upcoming", "live", "completed"],
            default: "draft"
        },

        phase: {
            type: String,
            enum: ["not_started", "bug_snap", "debug_arena", "completed"],
            default: "not_started"
        },

        startTime: {
            type: Date,
            default: null
        },

        endTime: {
            type: Date,
            default: null
        },

        qualifyingScore: {
            type: Number,
            default: 15
        },

        roundControl: {
            bug_snap: {
                isStarted: { type: Boolean, default: false },
                startedAt: { type: Date, default: null },
                durationMinutes: { type: Number, default: 20 },
                endsAt: { type: Date, default: null }
            },
            debug_arena: {
                isStarted: { type: Boolean, default: false },
                startedAt: { type: Date, default: null },
                durationMinutes: { type: Number, default: 30 },
                endsAt: { type: Date, default: null }
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Event", eventSchema);