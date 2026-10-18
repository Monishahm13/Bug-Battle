const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50
        },

        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            default: null
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        roundTimers: {
            bug_snap: {
                startedAt: { type: Date, default: null },
                startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
                endedAt: { type: Date, default: null },
                durationMinutes: { type: Number, default: 20 },
                isSubmitted: { type: Boolean, default: false },
                submittedAt: { type: Date, default: null },
                submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
            },
            debug_arena: {
                startedAt: { type: Date, default: null },
                startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
                endedAt: { type: Date, default: null },
                durationMinutes: { type: Number, default: 30 },
                isSubmitted: { type: Boolean, default: false },
                submittedAt: { type: Date, default: null },
                submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Team", teamSchema);