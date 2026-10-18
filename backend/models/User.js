const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            minlength: 6
        },

        role: {
            type: String,
            enum: ["participant", "organizer"],
            default: "participant"
        },

        roundStatus: {
            bug_snap: {
                isSubmitted: { type: Boolean, default: false },
                submittedAt: { type: Date, default: null }
            },
            debug_arena: {
                isSubmitted: { type: Boolean, default: false },
                submittedAt: { type: Date, default: null }
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);