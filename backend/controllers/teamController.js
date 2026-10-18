const Team = require("../models/Team");
const User = require("../models/User");

const createTeam = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: "Team name is required"
            });
        }

        const existingTeam = await Team.findOne({
            name: name.trim()
        });

        if (existingTeam) {
            return res.status(409).json({
                message: "A team with this name already exists"
            });
        }

        const alreadyInTeam = await Team.findOne({
            members: req.user._id
        });

        if (alreadyInTeam) {
            return res.status(400).json({
                message: "You are already a member of a team"
            });
        }

        const team = await Team.create({
            name: name.trim(),
            captain: req.user._id,
            members: [req.user._id]
        });

        const populatedTeam = await Team.findById(team._id)
            .populate("captain", "name email")
            .populate("members", "name email");

        return res.status(201).json({
            message: "Team created successfully",
            team: populatedTeam
        });
    } catch (error) {
        console.error("Create team error:", error);

        return res.status(500).json({
            message: "Server error while creating team"
        });
    }
};

const joinTeam = async (req, res) => {
    try {
        const { teamId } = req.body;

        if (!teamId) {
            return res.status(400).json({
                message: "Team ID is required"
            });
        }

        const team = await Team.findById(teamId);

        if (!team) {
            return res.status(404).json({
                message: "Team not found"
            });
        }

        const alreadyInTeam = await Team.findOne({
            members: req.user._id
        });

        if (alreadyInTeam) {
            return res.status(400).json({
                message: "You are already a member of a team"
            });
        }

        if (team.members.length >= 3) {
            return res.status(400).json({
                message: "Team already has the maximum of 3 members"
            });
        }

        team.members.push(req.user._id);

        await team.save();

        const populatedTeam = await Team.findById(team._id)
            .populate("captain", "name email")
            .populate("members", "name email");

        return res.status(200).json({
            message: "Joined team successfully",
            team: populatedTeam
        });
    } catch (error) {
        console.error("Join team error:", error);

        return res.status(500).json({
            message: "Server error while joining team"
        });
    }
};

const getMyTeam = async (req, res) => {
    try {
        const team = await Team.findOne({
            members: req.user._id
        })
            .populate("captain", "name email")
            .populate("members", "name email");

        if (!team) {
            return res.status(404).json({
                message: "You are not currently part of a team"
            });
        }

        return res.status(200).json({
            team
        });
    } catch (error) {
        console.error("Get team error:", error);

        return res.status(500).json({
            message: "Server error while getting team"
        });
    }
};

const leaveTeam = async (req, res) => {
    try {
        const team = await Team.findOne({
            members: req.user._id
        });

        if (!team) {
            return res.status(404).json({
                message: "You are not part of a team"
            });
        }

        if (team.captain.toString() === req.user._id.toString()) {
            return res.status(400).json({
                message: "Team captain cannot leave the team. Delete the team or transfer captain later."
            });
        }

        team.members = team.members.filter(
            (memberId) =>
                memberId.toString() !== req.user._id.toString()
        );

        await team.save();

        return res.status(200).json({
            message: "You left the team successfully"
        });
    } catch (error) {
        console.error("Leave team error:", error);

        return res.status(500).json({
            message: "Server error while leaving team"
        });
    }
};

const registerTeamForEvent = async (req, res) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            return res.status(400).json({
                message: "Event ID is required"
            });
        }

        const Event = require("../models/Event");

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({
                message: "Event not found"
            });
        }

        if (event.status === "completed") {
            return res.status(400).json({
                message: "This event has already been completed"
            });
        }

        const team = await Team.findOne({
            captain: req.user._id
        });

        if (!team) {
            return res.status(404).json({
                message: "You are not the captain of a team"
            });
        }

        if (team.event) {
            return res.status(400).json({
                message: "Your team is already registered for an event"
            });
        }

        if (team.members.length < 2) {
            return res.status(400).json({
                message: "A team must have at least 2 members"
            });
        }

        if (team.members.length > 3) {
            return res.status(400).json({
                message: "A team cannot have more than 3 members"
            });
        }

        team.event = event._id;

        await team.save();

        const populatedTeam = await Team.findById(team._id)
            .populate("captain", "name email")
            .populate("members", "name email")
            .populate("event", "name status phase");

        return res.status(200).json({
            message: "Team registered for event successfully",
            team: populatedTeam
        });
    } catch (error) {
        console.error("Register team for event error:", error);

        return res.status(500).json({
            message: "Server error while registering team for event"
        });
    }
};

const startPhaseTimer = async (req, res) => {
    try {
        const { phase } = req.body;
        if (!phase || !["bug_snap", "debug_arena"].includes(phase)) {
            return res.status(400).json({ message: "Invalid phase specified" });
        }

        const team = await Team.findOne({ members: req.user._id }).populate("members", "name email roundStatus");
        if (!team) {
            return res.status(404).json({ message: "You are not part of any team" });
        }

        const durationMinutes = phase === "bug_snap" ? 20 : 30;

        if (!team.roundTimers) {
            team.roundTimers = {};
        }
        if (!team.roundTimers[phase]) {
            team.roundTimers[phase] = {};
        }

        const currentTimer = team.roundTimers[phase];

        // CRITICAL CHECK: If this challenge was already submitted by ANY team member or captain, reject restarting!
        const anyMemberSubmitted = team.members?.some(
            (m) => m?.roundStatus?.[phase]?.isSubmitted
        );
        if (currentTimer.isSubmitted || anyMemberSubmitted) {
            if (!currentTimer.isSubmitted) {
                currentTimer.isSubmitted = true;
                await team.save();
            }
            return res.status(400).json({
                message: "This challenge has already been completed and submitted for your team. It cannot be restarted.",
                isSubmitted: true,
                timer: currentTimer
            });
        }

        // If timer is already running, return existing state
        if (currentTimer.startedAt) {
            return res.status(200).json({
                message: "Timer already running",
                timer: currentTimer
            });
        }

        // Start timer now
        const now = new Date();
        const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

        team.roundTimers[phase] = {
            startedAt: now,
            startedBy: req.user._id,
            endedAt: endsAt,
            durationMinutes,
            isSubmitted: false,
            submittedAt: null,
            submittedBy: null
        };

        await team.save();

        return res.status(200).json({
            message: "Timer started successfully",
            timer: team.roundTimers[phase]
        });
    } catch (error) {
        console.error("Start timer error:", error);
        return res.status(500).json({ message: "Server error while starting timer" });
    }
};

const getPhaseTimer = async (req, res) => {
    try {
        const { phase } = req.params;
        if (!phase || !["bug_snap", "debug_arena"].includes(phase)) {
            return res.status(400).json({ message: "Invalid phase specified" });
        }

        const team = await Team.findOne({ members: req.user._id }).populate("members", "name email roundStatus");
        if (!team) {
            return res.status(404).json({ message: "You are not part of any team" });
        }

        const teamTimer = team.roundTimers?.[phase] || {
            startedAt: null,
            startedBy: null,
            endedAt: null,
            durationMinutes: phase === "bug_snap" ? 20 : 30,
            isSubmitted: false,
            submittedAt: null,
            submittedBy: null
        };

        // Check team-level or any member's submission status
        const anyMemberSubmitted = team.members?.some(
            (m) => m?.roundStatus?.[phase]?.isSubmitted
        );
        const isTeamSubmitted = Boolean(teamTimer.isSubmitted || anyMemberSubmitted);

        // Ensure team record reflects submission if any member submitted
        if (isTeamSubmitted && !teamTimer.isSubmitted) {
            if (!team.roundTimers) team.roundTimers = {};
            if (!team.roundTimers[phase]) team.roundTimers[phase] = {};
            team.roundTimers[phase].isSubmitted = true;
            if (!team.roundTimers[phase].submittedAt) {
                team.roundTimers[phase].submittedAt = new Date();
            }
            await team.save();
        }

        return res.status(200).json({
            timer: {
                startedAt: teamTimer.startedAt,
                startedBy: teamTimer.startedBy,
                endedAt: teamTimer.endedAt,
                durationMinutes: teamTimer.durationMinutes || (phase === "bug_snap" ? 20 : 30),
                isSubmitted: isTeamSubmitted, // Team-wide lock!
                submittedAt: teamTimer.submittedAt,
                submittedBy: teamTimer.submittedBy
            }
        });
    } catch (error) {
        console.error("Get timer error:", error);
        return res.status(500).json({ message: "Server error while fetching timer" });
    }
};

const finishPhaseTimer = async (req, res) => {
    try {
        const { phase } = req.body;
        if (!phase || !["bug_snap", "debug_arena"].includes(phase)) {
            return res.status(400).json({ message: "Invalid phase specified" });
        }

        const team = await Team.findOne({ members: req.user._id });
        if (!team) {
            return res.status(404).json({ message: "You are not part of any team" });
        }

        const now = new Date();

        if (!team.roundTimers) team.roundTimers = {};
        if (!team.roundTimers[phase]) {
            team.roundTimers[phase] = {
                durationMinutes: phase === "bug_snap" ? 20 : 30
            };
        }

        // Lock for the ENTIRE TEAM (all members + captain)
        team.roundTimers[phase].isSubmitted = true;
        team.roundTimers[phase].submittedAt = now;
        team.roundTimers[phase].submittedBy = req.user._id;
        team.roundTimers[phase].endedAt = now;

        await team.save();

        // Mark final submission for ALL members in this team
        await User.updateMany(
            { _id: { $in: team.members } },
            {
                $set: {
                    [`roundStatus.${phase}`]: {
                        isSubmitted: true,
                        submittedAt: now
                    }
                }
            }
        );

        return res.status(200).json({
            message: "Challenge submission recorded and permanently locked for your entire team",
            timer: {
                startedAt: team.roundTimers[phase].startedAt,
                startedBy: team.roundTimers[phase].startedBy,
                endedAt: team.roundTimers[phase].endedAt,
                durationMinutes: team.roundTimers[phase].durationMinutes || (phase === "bug_snap" ? 20 : 30),
                isSubmitted: true,
                submittedAt: now,
                submittedBy: req.user._id
            }
        });
    } catch (error) {
        console.error("Finish timer error:", error);
        return res.status(500).json({ message: "Server error while finalizing timer" });
    }
};

const resetPhaseTimer = async (req, res) => {
    try {
        const { phase, teamId } = req.body;
        if (!phase || !["bug_snap", "debug_arena"].includes(phase)) {
            return res.status(400).json({ message: "Invalid phase specified" });
        }

        let query = {};
        if (teamId) {
            query._id = teamId;
        } else {
            query.members = req.user._id;
        }

        const team = await Team.findOne(query);
        if (team && team.members) {
            // Reset for all members in the team
            await User.updateMany(
                { _id: { $in: team.members } },
                {
                    $set: {
                        [`roundStatus.${phase}`]: {
                            isSubmitted: false,
                            submittedAt: null
                        }
                    }
                }
            );

            if (team.roundTimers && team.roundTimers[phase]) {
                team.roundTimers[phase].isSubmitted = false;
                team.roundTimers[phase].submittedAt = null;
                await team.save();
            }
        } else {
            await User.findByIdAndUpdate(req.user._id, {
                $set: {
                    [`roundStatus.${phase}`]: {
                        isSubmitted: false,
                        submittedAt: null
                    }
                }
            });
        }

        return res.status(200).json({
            message: "Timer reset successfully",
            timer: {
                isSubmitted: false,
                submittedAt: null
            }
        });
    } catch (error) {
        console.error("Reset timer error:", error);
        return res.status(500).json({ message: "Server error while resetting timer" });
    }
};

module.exports = {
    createTeam,
    joinTeam,
    getMyTeam,
    leaveTeam,
    registerTeamForEvent,
    startPhaseTimer,
    getPhaseTimer,
    finishPhaseTimer,
    resetPhaseTimer
};