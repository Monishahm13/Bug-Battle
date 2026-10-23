const Event = require("../models/Event");
const Team = require("../models/Team");
const Question = require("../models/Question");
const Submission = require("../models/Submission");
const User = require("../models/User");

const createEvent = async (req, res) => {
    try {
        const {
            name,
            description,
            startTime,
            endTime,
            qualifyingScore
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Event name is required"
            });
        }

        const event = await Event.create({
            name: name.trim(),
            description,
            organizer: req.user._id,
            startTime: startTime || null,
            endTime: endTime || null,
            qualifyingScore: qualifyingScore !== undefined ? Number(qualifyingScore) : 15,
            status: "draft",
            phase: "not_started"
        });

        const populatedEvent = await Event.findById(event._id)
            .populate("organizer", "name email");

        return res.status(201).json({
            message: "Event created successfully",
            event: populatedEvent
        });
    } catch (error) {
        console.error("Create event error:", error);

        return res.status(500).json({
            message: "Server error while creating event"
        });
    }
};

const getEvents = async (req, res) => {
    try {
        const events = await Event.find()
            .populate("organizer", "name email")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            events
        });
    } catch (error) {
        console.error("Get events error:", error);

        return res.status(500).json({
            message: "Server error while getting events"
        });
    }
};

const getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate("organizer", "name email");

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        return res.status(200).json({
            event
        });
    } catch (error) {
        console.error("Get event error:", error);

        return res.status(500).json({
            message: "Server error while getting event"
        });
    }
};

const updateEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        if (
            event.organizer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "Only the event organizer can update this event"
            });
        }

        const {
            name,
            description,
            startTime,
            endTime,
            status,
            phase,
            qualifyingScore
        } = req.body;

        if (name !== undefined) {
            event.name = name.trim();
        }

        if (description !== undefined) {
            event.description = description;
        }

        if (startTime !== undefined) {
            event.startTime = startTime;
        }

        if (endTime !== undefined) {
            event.endTime = endTime;
        }

        if (status !== undefined) {
            event.status = status;
        }

        if (phase !== undefined) {
            event.phase = phase;
        }

        if (qualifyingScore !== undefined) {
            event.qualifyingScore = Number(qualifyingScore);
        }

        await event.save();

        const updatedEvent = await Event.findById(event._id)
            .populate("organizer", "name email");

        return res.status(200).json({
            message: "Event updated successfully",
            event: updatedEvent
        });
    } catch (error) {
        console.error("Update event error:", error);

        return res.status(500).json({
            message: "Server error while updating event"
        });
    }
};

const getActiveEvent = async (req, res) => {
    try {
        let event = await Event.findOne({ status: "live" })
            .populate("organizer", "name email")
            .sort({ updatedAt: -1 });

        if (!event) {
            event = await Event.findOne()
                .populate("organizer", "name email")
                .sort({ createdAt: -1 });
        }

        if (!event) {
            return res.status(404).json({
                message: "No event found"
            });
        }

        return res.status(200).json({
            event
        });
    } catch (error) {
        console.error("Get active event error:", error);
        return res.status(500).json({
            message: "Server error while getting active event"
        });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        if (
            event.organizer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "Only the event organizer can delete this event"
            });
        }

        await Event.findByIdAndDelete(event._id);

        return res.status(200).json({
            message: "Event deleted successfully"
        });
    } catch (error) {
        console.error("Delete event error:", error);

        return res.status(500).json({
            message: "Server error while deleting event"
        });
    }
};

const getEventQualification = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findById(id);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        const teams = await Team.find({ event: event._id })
            .populate("captain", "name email")
            .populate("members", "name email");

        const allSubs = await Submission.find({
            event: event._id
        }).populate("question", "phase points").sort({ createdAt: -1 });

        const teamStats = teams.map((team) => {
            const teamSubs = allSubs.filter(
                (s) => s.team?.toString() === team._id.toString() && s.status === "accepted"
            );
            const teamAllSubs = allSubs.filter(
                (s) => s.team?.toString() === team._id.toString()
            );

            const solvedQIds = new Set();
            let phase1Score = 0;
            let phase2Score = 0;

            teamSubs.forEach((s) => {
                if (s.question) {
                    const qId = s.question._id.toString();
                    if (!solvedQIds.has(qId)) {
                        solvedQIds.add(qId);
                        if (s.question.phase === "debug_arena") {
                            phase2Score += s.score || 0;
                        } else {
                            phase1Score += s.score || 0;
                        }
                    }
                }
            });

            const isQualified = phase1Score >= (event.qualifyingScore || 15);

            // Bug Snap final submission timing
            const bugSnapSubs = teamAllSubs.filter(s => s.question?.phase !== "debug_arena");
            const bugSnapLastSubTime = bugSnapSubs.length > 0 ? bugSnapSubs[0].createdAt : null;
            const bugSnapSubmittedAt = team.roundTimers?.bug_snap?.submittedAt || bugSnapLastSubTime || null;
            const isBugSnapSubmitted = Boolean(team.roundTimers?.bug_snap?.isSubmitted || bugSnapSubmittedAt);

            // Debug Arena final submission timing
            const debugArenaSubs = teamAllSubs.filter(s => s.question?.phase === "debug_arena");
            const debugArenaLastSubTime = debugArenaSubs.length > 0 ? debugArenaSubs[0].createdAt : null;
            const debugArenaSubmittedAt = team.roundTimers?.debug_arena?.submittedAt || debugArenaLastSubTime || null;
            const isDebugArenaSubmitted = Boolean(team.roundTimers?.debug_arena?.isSubmitted || debugArenaSubmittedAt);

            return {
                teamId: team._id,
                teamName: team.name,
                captain: team.captain,
                members: team.members,
                phase1Score,
                phase2Score,
                totalScore: phase1Score + phase2Score,
                isQualified,
                bugSnapSubmittedAt,
                debugArenaSubmittedAt,
                isBugSnapSubmitted,
                isDebugArenaSubmitted
            };
        });

        // Sort helper: Decreasing order by points, then earlier submission timing
        const sortTeams = (list, scoreKey, timeKey) => {
            return list.slice().sort((a, b) => {
                const sA = Number(a[scoreKey]) || 0;
                const sB = Number(b[scoreKey]) || 0;
                if (sB !== sA) return sB - sA;

                const tA = a[timeKey] ? new Date(a[timeKey]).getTime() : null;
                const tB = b[timeKey] ? new Date(b[timeKey]).getTime() : null;
                if (tA && tB) return tA - tB;
                if (tA && !tB) return -1;
                if (!tA && tB) return 1;

                return (a.teamName || "").localeCompare(b.teamName || "");
            });
        };

        const bugSnapSorted = sortTeams(teamStats, "phase1Score", "bugSnapSubmittedAt");
        const bugSnapParticipants = bugSnapSorted.map((t, idx) => ({
            slNo: idx + 1,
            teamId: t.teamId,
            teamName: t.teamName,
            captain: t.captain,
            members: t.members,
            totalPoints: t.phase1Score,
            submittedAt: t.bugSnapSubmittedAt,
            isSubmitted: t.isBugSnapSubmitted
        }));

        const debugArenaSorted = sortTeams(teamStats, "phase2Score", "debugArenaSubmittedAt");
        const debugArenaParticipants = debugArenaSorted.map((t, idx) => ({
            slNo: idx + 1,
            teamId: t.teamId,
            teamName: t.teamName,
            captain: t.captain,
            members: t.members,
            totalPoints: t.phase2Score,
            submittedAt: t.debugArenaSubmittedAt,
            isSubmitted: t.isDebugArenaSubmitted,
            isQualified: t.isQualified
        }));

        let myTeamStat = null;
        if (req.user) {
            myTeamStat = teamStats.find(
                (t) =>
                    t.members?.some(
                        (m) => m._id.toString() === req.user._id.toString()
                    ) ||
                    (t.captain &&
                        t.captain._id.toString() === req.user._id.toString())
            ) || null;
        }

        return res.status(200).json({
            eventId: event._id,
            eventName: event.name,
            phase: event.phase,
            status: event.status,
            qualifyingScore: event.qualifyingScore || 15,
            myTeam: myTeamStat,
            teams: teamStats,
            bugSnapParticipants,
            debugArenaParticipants
        });
    } catch (error) {
        console.error("Get qualification error:", error);
        return res.status(500).json({
            message: "Server error while getting qualification status"
        });
    }
};

const startRound = async (req, res) => {
    try {
        const { id } = req.params;
        const { phase, durationMinutes } = req.body;

        if (!phase || !["bug_snap", "debug_arena"].includes(phase)) {
            return res.status(400).json({ message: "Invalid phase specified" });
        }

        let event = null;
        if (id === "active" || !id.match(/^[0-9a-fA-F]{24}$/)) {
            event = await Event.findOne({ status: "live" }) || await Event.findOne().sort({ createdAt: -1 });
        } else {
            event = await Event.findById(id);
        }

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        if (
            event.organizer.toString() !== req.user._id.toString() &&
            req.user.role !== "organizer"
        ) {
            return res.status(403).json({ message: "Only organizers can start the round" });
        }

        const duration = durationMinutes || (phase === "bug_snap" ? 20 : 30);
        const now = new Date();
        const endsAt = new Date(now.getTime() + duration * 60 * 1000);

        event.status = "live";
        event.phase = phase;

        // Ensure event endTime does not prematurely expire during active live competition
        if (!event.endTime || new Date(event.endTime) <= endsAt) {
            event.endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        }

        if (!event.roundControl) {
            event.roundControl = {};
        }

        event.roundControl[phase] = {
            isStarted: true,
            startedAt: now,
            durationMinutes: duration,
            endsAt: endsAt
        };

        await event.save();

        // Synchronize and reset team timers for this event so participants start fresh
        try {
            await Team.updateMany(
                { event: event._id },
                {
                    $set: {
                        [`roundTimers.${phase}`]: {
                            startedAt: now,
                            endedAt: endsAt,
                            durationMinutes: duration,
                            isSubmitted: false,
                            submittedAt: null
                        }
                    }
                }
            );
        } catch (teamErr) {
            console.warn("Could not sync team timers:", teamErr);
        }

        // Reset per-user final submission status for this phase so each participant starts fresh
        try {
            await User.updateMany(
                {},
                {
                    $set: {
                        [`roundStatus.${phase}`]: {
                            isSubmitted: false,
                            submittedAt: null
                        }
                    }
                }
            );
        } catch (uErr) {
            console.warn("Could not reset users roundStatus:", uErr);
        }

        const populatedEvent = await Event.findById(event._id).populate("organizer", "name email");

        return res.status(200).json({
            message: `Round ${phase === "bug_snap" ? "BUG SNAP (20 min)" : "DEBUG ARENA (30 min)"} started successfully`,
            event: populatedEvent
        });
    } catch (error) {
        console.error("Start round error:", error);
        return res.status(500).json({ message: "Server error while starting round" });
    }
};

const resetRound = async (req, res) => {
    try {
        const { id } = req.params;
        const { phase, clearSubmissions } = req.body;

        let event = null;
        if (id === "active" || !id.match(/^[0-9a-fA-F]{24}$/)) {
            event = await Event.findOne({ status: "live" }) || await Event.findOne().sort({ createdAt: -1 });
        } else {
            event = await Event.findById(id);
        }

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        if (
            event.organizer.toString() !== req.user._id.toString() &&
            req.user.role !== "organizer"
        ) {
            return res.status(403).json({ message: "Only organizers can reset the round" });
        }

        const phasesToReset = (!phase || phase === "all") ? ["bug_snap", "debug_arena"] : [phase];

        if (!event.roundControl) {
            event.roundControl = {};
        }

        phasesToReset.forEach((p) => {
            event.roundControl[p] = {
                isStarted: false,
                startedAt: null,
                endsAt: null,
                durationMinutes: p === "bug_snap" ? 20 : 30
            };
        });

        // If we reset the currently active phase, update phase
        if (phasesToReset.includes(event.phase)) {
            event.phase = "not_started";
        }

        await event.save();

        // Clear team timers for this event and phase
        try {
            const teamTimerUpdates = {};
            phasesToReset.forEach((p) => {
                teamTimerUpdates[`roundTimers.${p}`] = {
                    startedAt: null,
                    endedAt: null,
                    durationMinutes: p === "bug_snap" ? 20 : 30,
                    isSubmitted: false,
                    submittedAt: null
                };
            });

            await Team.updateMany(
                { event: event._id },
                { $set: teamTimerUpdates }
            );
        } catch (teamErr) {
            console.warn("Could not clear team timers:", teamErr);
        }

        // Reset individual per-user round status for all participants
        try {
            const userStatusUpdates = {};
            phasesToReset.forEach((p) => {
                userStatusUpdates[`roundStatus.${p}`] = {
                    isSubmitted: false,
                    submittedAt: null
                };
            });
            await User.updateMany({}, { $set: userStatusUpdates });
        } catch (uErr) {
            console.warn("Could not reset users roundStatus:", uErr);
        }

        // Optionally clear submissions if requested
        if (clearSubmissions) {
            try {
                const qQuery = { event: event._id };
                if (phase && phase !== "all") qQuery.phase = phase;
                const questions = await Question.find(qQuery).select("_id");
                const qIds = questions.map(q => q._id);
                await Submission.deleteMany({
                    event: event._id,
                    question: { $in: qIds }
                });
            } catch (subErr) {
                console.warn("Could not clear submissions:", subErr);
            }
        }

        const populatedEvent = await Event.findById(event._id).populate("organizer", "name email");

        return res.status(200).json({
            message: `Round ${phasesToReset.join(" & ")} reset successfully`,
            event: populatedEvent
        });
    } catch (error) {
        console.error("Reset round error:", error);
        return res.status(500).json({ message: "Server error while resetting round" });
    }
};

module.exports = {
    createEvent,
    getEvents,
    getEventById,
    getActiveEvent,
    updateEvent,
    deleteEvent,
    getEventQualification,
    startRound,
    resetRound
};