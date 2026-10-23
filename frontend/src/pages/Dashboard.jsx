import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History } from "lucide-react";
import axios from "axios";
import {
    Bug,
    Trophy,
    Users,
    Code2,
    ArrowUpRight,
    Zap,
    Target,
    ChevronRight,
    Terminal,
    LogOut,
    ShieldAlert,
    Settings,
    X,
    Play,
    RotateCcw,
    Clock3,
    Lock,
    FileSpreadsheet,
    FileText,
    Download,
    CheckCircle2
} from "lucide-react";
import {
    exportParticipantsToExcel,
    exportParticipantsToPDF,
    formatSubmissionTiming
} from "../utils/exportUtils";
import { getAuthToken, clearAuthSession } from "../utils/auth";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

const challenges = [
    {
        title: "BUG SNAP",
        description: "Find and fix small bugs in short code snippets.",
        icon: Bug,
        level: "QUICK CHALLENGES",
        color: "blue",
    },
    {
        title: "DEBUG ARENA",
        description: "Tackle complex programs and hunt multiple bugs.",
        icon: Code2,
        level: "ADVANCED CHALLENGES",
        color: "violet",
    },
];

function Dashboard() {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [teamSize, setTeamSize] = useState(null);
    const [teamName, setTeamName] = useState("");
    const [teamMessage, setTeamMessage] = useState("");
    const [team, setTeam] = useState(null);
    const [teamId, setTeamId] = useState("");
    const [eventMessage, setEventMessage] = useState("");
    const [registeringEvent, setRegisteringEvent] = useState(false);
    const [activeEvent, setActiveEvent] = useState(null);
    const [showChallenges, setShowChallenges] = useState(false);
    const [showTeam, setShowTeam] = useState(false);
    const [qualificationData, setQualificationData] = useState(null);
    const [updatingEvent, setUpdatingEvent] = useState(false);
    const [qualifyingScoreInput, setQualifyingScoreInput] = useState(15);
    const [organizerMsg, setOrganizerMsg] = useState("");
    const [participantTab, setParticipantTab] = useState("bug_snap"); // "bug_snap" | "debug_arena"
    const navigate = useNavigate();

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        setTeamMessage("");

        const trimmedName = teamName.trim();

        if (!trimmedName) {
            setTeamMessage("Please enter a team name.");
            return;
        }

        if (trimmedName.length < 2 || trimmedName.length > 50) {
            setTeamMessage("Team name must be between 2 and 50 characters.");
            return;
        }

        try {
            const token = getAuthToken();

            const response = await axios.post(
                `${API}/teams`,
                { name: trimmedName },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setTeamMessage(response.data.message || "Team created successfully!");
            setTeamName("");
            setTeam(response.data.team);
            setTeamSize(response.data.team?.members?.length ?? 1);
        } catch (error) {
            setTeamMessage(
                error.response?.data?.message ||
                "Unable to create team. Please try again."
            );
        }
    };


    const handleJoinTeam = async (e) => {
        e.preventDefault();
        setTeamMessage("");

        const trimmedTeamId = teamId.trim();

        if (!trimmedTeamId) {
            setTeamMessage("Please enter a Team ID.");
            return;
        }

        try {
            const token = getAuthToken();

            const response = await axios.post(
                `${API}/teams/join`,
                { teamId: trimmedTeamId },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setTeam(response.data.team);
            setTeamSize(response.data.team?.members?.length ?? 0);
            setTeamId("");
            setTeamMessage(response.data.message || "Joined team successfully!");
        } catch (error) {
            setTeamMessage(
                error.response?.data?.message ||
                "Unable to join team. Please try again."
            );
        }
    };


    const handleLeaveTeam = async () => {
        const confirmed = window.confirm(
            "Are you sure you want to leave this team?"
        );

        if (!confirmed) return;

        setTeamMessage("");

        try {
            const token = getAuthToken();

            const response = await axios.delete(
                `${API}/teams/leave`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setTeam(null);
            setTeamSize(0);
            setTeamMessage(
                response.data.message || "You left the team successfully."
            );
        } catch (error) {
            setTeamMessage(
                error.response?.data?.message ||
                "Unable to leave the team. Please try again."
            );
        }
    };


    const handleRegisterEvent = async () => {
        setEventMessage("");

        if (!team) {
            setEventMessage("Join a team before registering for an event.");
            return;
        }

        if (String(team.captain?._id) !== String(user?._id)) {
            setEventMessage("Only the team captain can register the team.");
            return;
        }

        if (team.members?.length < 2 || team.members?.length > 3) {
            setEventMessage("Your team must have 2–3 members to register.");
            return;
        }

        if (team.event) {
            setEventMessage("Your team is already registered for an event.");
            return;
        }

        setRegisteringEvent(true);

        try {
            const token = getAuthToken();
            const targetEventId = activeEvent?._id || "6ac7b4231b5feef1a79a0cb3";

            const response = await axios.post(
                `${API}/teams/register-event`,
                { eventId: targetEventId },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setTeam(response.data.team);
            setTeamMessage("");
            setEventMessage(
                response.data.message || "Team registered successfully!"
            );
        } catch (error) {
            setEventMessage(
                error.response?.data?.message ||
                "Unable to register your team. Please try again."
            );
        } finally {
            setRegisteringEvent(false);
        }
    };

    const handleUpdatePhase = async (newPhase) => {
        if (!activeEvent) return;
        setUpdatingEvent(true);
        setOrganizerMsg("");

        try {
            const token = getAuthToken();
            const response = await axios.put(
                `${API}/events/${activeEvent._id}`,
                { phase: newPhase },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setActiveEvent(response.data.event);
            setOrganizerMsg(`Event phase updated to ${newPhase.replace("_", " ").toUpperCase()}`);
            if (activeEvent?._id) fetchQualificationData(activeEvent._id);
        } catch (err) {
            setOrganizerMsg(err.response?.data?.message || "Failed to update event phase");
        } finally {
            setUpdatingEvent(false);
        }
    };

    const handleUpdateQualifyingScore = async (e) => {
        e.preventDefault();
        if (!activeEvent) return;
        setUpdatingEvent(true);
        setOrganizerMsg("");

        try {
            const token = getAuthToken();
            const response = await axios.put(
                `${API}/events/${activeEvent._id}`,
                { qualifyingScore: Number(qualifyingScoreInput) },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setActiveEvent(response.data.event);
            setOrganizerMsg(`Qualifying score updated to ${qualifyingScoreInput} points`);
            if (activeEvent?._id) fetchQualificationData(activeEvent._id);
        } catch (err) {
            setOrganizerMsg(err.response?.data?.message || "Failed to update qualifying score");
        } finally {
            setUpdatingEvent(false);
        }
    };

    const handleStartRound = async (phase, durationMinutes) => {
        if (!activeEvent) return;
        setUpdatingEvent(true);
        setOrganizerMsg("");

        try {
            const token = getAuthToken();
            // Clear any local round timer keys
            Object.keys(sessionStorage).forEach((k) => {
                if (k.includes("bugbattle_timer_") && k.includes(phase)) sessionStorage.removeItem(k);
            });
            Object.keys(localStorage).forEach((k) => {
                if (k.includes("bugbattle_timer_") && k.includes(phase)) localStorage.removeItem(k);
            });

            const response = await axios.post(
                `${API}/events/${activeEvent._id}/start-round`,
                { phase, durationMinutes },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            setActiveEvent(response.data.event);
            setOrganizerMsg(response.data.message || `Round ${phase} started successfully!`);
            if (activeEvent?._id) fetchQualificationData(activeEvent._id);
        } catch (err) {
            setOrganizerMsg(err.response?.data?.message || `Failed to start ${phase}`);
        } finally {
            setUpdatingEvent(false);
        }
    };

    const handleResetRound = async (phase) => {
        if (!activeEvent) return;
        const confirmMsg = phase === "all"
            ? "Are you sure you want to reset ALL rounds? This will clear all participant timers and return everyone to lobby."
            : `Are you sure you want to reset ${phase === "bug_snap" ? "BUG SNAP" : "DEBUG ARENA"}? This will reset participant timers.`;
        if (!window.confirm(confirmMsg)) return;

        setUpdatingEvent(true);
        setOrganizerMsg("");

        try {
            const token = getAuthToken();
            if (phase === "all") {
                Object.keys(sessionStorage).forEach((k) => {
                    if (k.includes("bugbattle_timer_")) sessionStorage.removeItem(k);
                });
                Object.keys(localStorage).forEach((k) => {
                    if (k.includes("bugbattle_timer_")) localStorage.removeItem(k);
                });
            } else {
                Object.keys(sessionStorage).forEach((k) => {
                    if (k.includes("bugbattle_timer_") && k.includes(phase)) sessionStorage.removeItem(k);
                });
                Object.keys(localStorage).forEach((k) => {
                    if (k.includes("bugbattle_timer_") && k.includes(phase)) localStorage.removeItem(k);
                });
            }

            const response = await axios.post(
                `${API}/events/${activeEvent._id}/reset-round`,
                { phase },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            setActiveEvent(response.data.event);
            setOrganizerMsg(response.data.message || `Round ${phase} reset successfully!`);
            if (activeEvent?._id) fetchQualificationData(activeEvent._id);
        } catch (err) {
            setOrganizerMsg(err.response?.data?.message || `Failed to reset ${phase}`);
        } finally {
            setUpdatingEvent(false);
        }
    };

    const fetchQualificationData = async (eventId) => {
        try {
            const token = getAuthToken();
            const response = await axios.get(
                `${API}/events/${eventId}/qualification`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setQualificationData(response.data);
            if (response.data.qualifyingScore) {
                setQualifyingScoreInput(response.data.qualifyingScore);
            }
        } catch (err) {
            console.warn("Could not fetch qualification data:", err);
        }
    };





    useEffect(() => {
        const fetchUser = async () => {
            const token = getAuthToken();

            if (!token) {
                window.location.href = "/login";
                return;
            }

            try {
                const response = await axios.get(
                    `${API}/auth/me`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );


                const userData = response.data.user || response.data;

                setUser({
                    ...userData,
                    _id: userData._id || userData.id,
                });
            } catch {
                clearAuthSession(true);
                window.location.href = "/login";
            } finally {
                setLoading(false);
            }
        };

        const fetchSubmissions = async () => {
            const token = getAuthToken();

            try {
                const response = await axios.get(
                    `${API}/submissions/my`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setSubmissions(response.data.submissions || []);
            } catch (error) {
                console.error("Failed to fetch submissions:", error);
            } finally {
                setStatsLoading(false);
            }
        };


        const fetchTeam = async () => {
            const token = getAuthToken();

            try {
                const response = await axios.get(
                    `${API}/teams/me`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setTeamSize(response.data.team.members.length);
                setTeam(response.data.team);
            } catch (error) {
                if (error.response?.status === 404) {
                    setTeamSize(0);
                } else {
                    console.error("Failed to fetch team:", error);
                    setTeamSize(null);
                }
            }
        };

        const fetchActiveEvent = async () => {
            const token = getAuthToken();

            try {
                const response = await axios.get(
                    `${API}/events`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const events = response.data.events || [];

                const event = events.find(
                    (item) => item.status === "live"
                );

                const chosenEvent = event || events[0] || null;
                setActiveEvent(chosenEvent);
                if (chosenEvent?._id) {
                    fetchQualificationData(chosenEvent._id);
                }
            } catch (error) {
                console.error("Failed to fetch events:", error);
                setActiveEvent(null);
            }
        };


        fetchUser();
        fetchSubmissions();
        fetchTeam();
        fetchActiveEvent();
    }, []);


    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
                <p className="text-slate-400">Loading your dashboard...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const challengesSolved = new Set(
        submissions
            .filter((submission) => submission.status === "accepted")
            .map((submission) => submission.question?._id)
            .filter(Boolean)
    ).size;


    const bestScoresByQuestion = submissions
        .filter(
            (submission) =>
                submission.status === "accepted" &&
                submission.question?._id
        )
        .reduce((scores, submission) => {
            const questionId = submission.question._id;
            const score = submission.score || 0;

            scores[questionId] = Math.max(
                scores[questionId] || 0,
                score
            );

            return scores;
        }, {});

    const totalPoints = Object.values(bestScoresByQuestion).reduce(
        (total, score) => total + score,
        0
    );





    const isOrganizer = user.role === "organizer";
    const myTeamData = qualificationData?.myTeam;
    const currentQualifyingScore = activeEvent?.qualifyingScore || 15;
    const isTeamQualified = myTeamData ? myTeamData.isQualified : false;
    const currentPhase1Score = myTeamData ? myTeamData.phase1Score : 0;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">

            <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
                    <a href="/" className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-600 p-2.5">
                            <Bug size={22} />
                        </div>
                        <span className="text-lg font-bold tracking-wide">
                            BUG <span className="text-blue-400">BATTLE</span>
                        </span>
                    </a>

                    <div className="flex items-center gap-3">
                        {/* Tab Account Badge */}
                        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-slate-400">Tab:</span>
                            <span className="font-semibold text-white max-w-[120px] truncate">{user?.name || "Account"}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${isOrganizer ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-blue-500/20 text-blue-300 border border-blue-500/30"}`}>
                                {isOrganizer ? "Organizer" : "Participant"}
                            </span>
                        </div>

                        <a
                            href="/login"
                            className="hidden md:inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
                            title="Open another account or switch in this tab"
                        >
                            Switch user
                        </a>


                        <button
                            onClick={() => {
                                clearAuthSession(true);
                                window.location.href = "/login";
                            }}
                            className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:border-red-500/50 hover:text-red-400"
                            title="Sign out from this tab only (other tabs stay active)"
                        >
                            <LogOut size={16} />
                            <span>Sign out</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
                <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-linear-to-br from-blue-950/70 via-slate-900 to-violet-950/40 p-7 sm:p-10 lg:p-14">
                    <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

                    <p className="text-slate-400">
                        Welcome back, {user.name}!
                    </p>

                    <div className="relative max-w-2xl">
                        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300">
                            {isOrganizer ? <Settings size={14} className="text-emerald-400" /> : <Zap size={14} />}
                            {isOrganizer ? "Organizer Command Center" : "Your arena awaits"}
                        </div>

                        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
                            {isOrganizer ? (
                                <>
                                    Event <span className="text-emerald-400">Command Center</span>
                                </>
                            ) : (
                                <>
                                    Ready to hunt some <span className="text-blue-400">bugs?</span>
                                </>
                            )}
                        </h1>

                        <p className="mt-5 max-w-xl leading-7 text-slate-400">
                            {isOrganizer
                                ? "Manage competition questions, control live event phases, set qualifying benchmarks, and monitor participants in real time."
                                : "Sharpen your debugging instincts, solve coding challenges, and prove your skills. Every bug fixed brings you one step closer to the top."}
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            {isOrganizer ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/manage-questions")}
                                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 active:scale-95"
                                    >
                                        <Bug size={18} />
                                        Manage Questions
                                        <ArrowUpRight size={18} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            document.getElementById("organizer-command-center")?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95"
                                    >
                                        <Users size={18} />
                                        Manage Participants & Teams
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            document.getElementById("organizer-command-center")?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                                    >
                                        <Settings size={18} />
                                        Phase Controls
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => navigate("/leaderboard")}
                                        className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-5 py-3 font-semibold text-violet-300 transition hover:border-violet-400 hover:bg-violet-500/20"
                                    >
                                        <Trophy size={18} />
                                        View Leaderboard
                                        <ArrowUpRight size={18} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!showChallenges) {
                                                setShowChallenges(true);
                                                setTimeout(() => {
                                                    document.getElementById("challenges-section")?.scrollIntoView({ behavior: "smooth" });
                                                }, 50);
                                            } else {
                                                setShowChallenges(false);
                                            }
                                        }}
                                        className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold transition ${showChallenges
                                            ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-400/50"
                                            : "bg-blue-600 text-white hover:bg-blue-500"
                                            }`}
                                    >
                                        Explore challenges
                                        <ArrowUpRight size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                                    >
                                        View overview
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!showTeam) {
                                                setShowTeam(true);
                                                setTimeout(() => {
                                                    document.getElementById("team-section")?.scrollIntoView({ behavior: "smooth" });
                                                }, 50);
                                            } else {
                                                setShowTeam(false);
                                            }
                                        }}
                                        className={`inline-flex items-center gap-2 rounded-xl border px-5 py-3 font-semibold transition ${showTeam
                                            ? "border-indigo-400 bg-indigo-500/25 text-indigo-200 shadow-lg shadow-indigo-500/20 ring-2 ring-indigo-400/40"
                                            : "border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:border-indigo-400 hover:bg-indigo-500/20"
                                            }`}
                                    >
                                        <Users size={18} />
                                        Team Management
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/submission-history")}
                                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/20"
                                    >
                                        <History size={18} />
                                        Submission History
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative mt-10 hidden justify-end lg:flex">
                        {isOrganizer ? (
                            <div className="absolute bottom-0 right-8 w-72 rounded-t-2xl border border-emerald-500/30 bg-slate-950/90 p-5 shadow-2xl backdrop-blur-md">
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Settings size={16} className="text-emerald-400" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wider">Event Monitor</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                        Active
                                    </span>
                                </div>
                                <div className="space-y-2 text-xs font-mono">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Live Phase:</span>
                                        <span className="font-bold text-white uppercase">{activeEvent?.phase || "None"}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Benchmark:</span>
                                        <span className="font-bold text-amber-300">{currentQualifyingScore} pts</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Teams:</span>
                                        <span className="font-bold text-blue-400">{qualificationData?.teams?.length || 0} registered</span>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-3 text-xs text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                                    Organizer Controls Online
                                </div>
                            </div>
                        ) : (
                            <div className="absolute bottom-0 right-8 w-64 rounded-t-2xl border border-slate-700 bg-slate-950/80 p-5 shadow-2xl">
                                <div className="mb-4 flex items-center gap-2">
                                    <Terminal size={16} className="text-blue-400" />
                                    <span className="text-xs text-slate-400">debug_session.js</span>
                                </div>
                                <div className="space-y-2 font-mono text-xs">
                                    <p className="text-slate-500">// challenge your logic</p>
                                    <p><span className="text-violet-400">function</span> <span className="text-blue-300">debug</span>() {"{"}</p>
                                    <p className="pl-4 text-slate-300">findTheBug();</p>
                                    <p className="pl-4 text-emerald-400">return "fixed";</p>
                                    <p>{"}"}</p>
                                </div>
                                <div className="mt-4 flex items-center gap-2 border-t border-slate-800 pt-3 text-xs text-emerald-400">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                    Ready to compile
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* YOUR OVERVIEW - Only for participants */}
                {!isOrganizer && (
                    <section id="overview" className="mt-10">
                        <div className="mb-5">
                            <h2 className="text-xl font-bold">Your overview</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Your competition statistics will appear here as you play.
                            </p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[
                                {
                                    label: "Challenges solved",
                                    value: statsLoading ? "..." : String(challengesSolved),
                                    icon: Target,
                                },
                                {
                                    label: "Total points",
                                    value: statsLoading ? "..." : String(totalPoints),
                                    icon: Trophy,
                                },
                                {
                                    label: "Team Members",
                                    value: teamSize === null ? "—" : String(teamSize),
                                    icon: Users,
                                },
                            ].map(({ label, value, icon: Icon }) => (
                                <div
                                    key={label}
                                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-400">{label}</span>
                                        <Icon size={19} className="text-slate-500" />
                                    </div>
                                    <p className="mt-5 text-3xl font-bold text-white">
                                        {value}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ORGANIZER COMMAND CENTER */}
                {isOrganizer && (
                    <section id="organizer-command-center" className="mt-8 rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-6 sm:p-8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-emerald-500/20 p-3 text-emerald-400 border border-emerald-500/30">
                                    <Settings size={24} />
                                </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">
                                            Organizer Command Center
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Control event phases, set qualifying benchmarks, and monitor participants
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => navigate("/manage-questions")}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-semibold transition"
                                    >
                                        <Bug size={15} />
                                        Manage Questions
                                    </button>
                                </div>
                            </div>

                            {organizerMsg && (
                                <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                                    {organizerMsg}
                                </div>
                            )}

                            {/* Live Round Launch Controls */}
                            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-slate-900/90 p-5 shadow-xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                            <Play size={16} className="text-emerald-400" />
                                            Live Round Launch & Synchronized Timers
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Starting a round unlocks challenges and triggers synchronized countdown timers across all participant machines.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={updatingEvent}
                                        onClick={() => handleResetRound("all")}
                                        className="rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 px-3.5 py-1.5 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
                                    >
                                        <RotateCcw size={13} />
                                        <span>Reset All Rounds</span>
                                    </button>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Round 1 Card */}
                                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400 border border-blue-500/20">
                                                    <Bug size={18} />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-white block">Phase 1: BUG SNAP</span>
                                                    <span className="text-[10px] text-slate-400">20 Minute Limit</span>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                activeEvent?.roundControl?.bug_snap?.isStarted
                                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                                    : "bg-slate-800 text-slate-400"
                                            }`}>
                                                {activeEvent?.roundControl?.bug_snap?.isStarted ? "● LIVE IN PROGRESS" : "NOT STARTED"}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!activeEvent?.roundControl?.bug_snap?.isStarted ? (
                                                <button
                                                    type="button"
                                                    disabled={updatingEvent}
                                                    onClick={() => handleStartRound("bug_snap", 20)}
                                                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-2 px-3 text-xs shadow-md shadow-blue-600/30 transition flex items-center justify-center gap-1.5"
                                                >
                                                    <Play size={14} fill="currentColor" />
                                                    <span>Start Bug Snap (20 Min)</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={updatingEvent}
                                                    onClick={() => handleResetRound("bug_snap")}
                                                    className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold py-2 px-3 text-xs transition flex items-center justify-center gap-1.5"
                                                >
                                                    <RotateCcw size={13} />
                                                    <span>Reset Bug Snap</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => navigate("/bugsnap")}
                                                className="rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900 text-slate-300 px-3 py-2 text-xs font-semibold transition"
                                                title="Open Bug Snap Page"
                                            >
                                                <ArrowUpRight size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Round 2 Card */}
                                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400 border border-violet-500/20">
                                                    <Code2 size={18} />
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-white block">Phase 2: DEBUG ARENA</span>
                                                    <span className="text-[10px] text-slate-400">30 Minute Limit</span>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                activeEvent?.roundControl?.debug_arena?.isStarted
                                                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                                    : "bg-slate-800 text-slate-400"
                                            }`}>
                                                {activeEvent?.roundControl?.debug_arena?.isStarted ? "● LIVE IN PROGRESS" : "NOT STARTED"}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!activeEvent?.roundControl?.debug_arena?.isStarted ? (
                                                <button
                                                    type="button"
                                                    disabled={updatingEvent}
                                                    onClick={() => handleStartRound("debug_arena", 30)}
                                                    className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold py-2 px-3 text-xs shadow-md shadow-violet-600/30 transition flex items-center justify-center gap-1.5"
                                                >
                                                    <Play size={14} fill="currentColor" />
                                                    <span>Start Arena (30 Min)</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={updatingEvent}
                                                    onClick={() => handleResetRound("debug_arena")}
                                                    className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold py-2 px-3 text-xs transition flex items-center justify-center gap-1.5"
                                                >
                                                    <RotateCcw size={13} />
                                                    <span>Reset Arena</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => navigate("/debug-arena")}
                                                className="rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900 text-slate-300 px-3 py-2 text-xs font-semibold transition"
                                                title="Open Debug Arena Page"
                                            >
                                                <ArrowUpRight size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Phase Switcher Controls */}
                            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                                        Active Event Phase Control
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {[
                                            { id: "not_started", label: "Not Started" },
                                            { id: "bug_snap", label: "Phase 1: Bug Snap" },
                                            { id: "debug_arena", label: "Phase 2: Arena" },
                                            { id: "completed", label: "Completed" },
                                        ].map((p) => {
                                            const isSelected = activeEvent?.phase === p.id;
                                            return (
                                                <button
                                                    key={p.id}
                                                    disabled={updatingEvent}
                                                    onClick={() => handleUpdatePhase(p.id)}
                                                    className={`rounded-xl px-3 py-2.5 text-xs font-bold transition border text-center ${isSelected
                                                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30"
                                                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                                        }`}
                                                >
                                                    {p.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-3 text-[11px] text-slate-500">
                                        Current live phase: <strong className="text-slate-300 uppercase">{activeEvent?.phase || "None"}</strong>
                                    </p>
                                </div>

                                {/* Qualifying Score Setting */}
                                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                                        Phase 1 Qualifying Benchmark
                                    </p>
                                    <form onSubmit={handleUpdateQualifyingScore} className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={qualifyingScoreInput}
                                                onChange={(e) => setQualifyingScoreInput(e.target.value)}
                                                className="w-full rounded-xl borderborder-slate-700 bg-slate-950 px-4 py-2.5 text-smtext-white outline-nonefocus:border-blue-500"
                                                placeholder="Score (e.g. 15)"
                                            />
                                            <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">
                                                pts
                                            </span>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={updatingEvent}
                                            className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 text-xs font-semibold transition shrink-0"
                                        >
                                            Update
                                        </button>
                                    </form>
                                    <p className="mt-3 text-[11px] text-slate-500">
                                        Teams must score at least <strong>{activeEvent?.qualifyingScore || 15} points</strong> in BUG SNAP to unlock DEBUG ARENA.
                                    </p>
                                </div>
                            </div>

                            {/* Participant List & Final Submissions Section (Bug Snap & Debug Arena) */}
                            {(() => {
                                const rawTeams = qualificationData?.teams || [];
                                if (rawTeams.length === 0) return null;

                                const sortTeamsDesc = (list, scoreKey, timeKey) => {
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

                                const bugSnapList = (qualificationData?.bugSnapParticipants && qualificationData.bugSnapParticipants.length > 0)
                                    ? qualificationData.bugSnapParticipants
                                    : sortTeamsDesc(rawTeams, "phase1Score", "bugSnapSubmittedAt").map((t, idx) => ({
                                        slNo: idx + 1,
                                        teamId: t.teamId,
                                        teamName: t.teamName,
                                        totalPoints: t.phase1Score ?? 0,
                                        submittedAt: t.bugSnapSubmittedAt,
                                        captain: t.captain,
                                        members: t.members
                                    }));

                                const debugArenaList = (qualificationData?.debugArenaParticipants && qualificationData.debugArenaParticipants.length > 0)
                                    ? qualificationData.debugArenaParticipants
                                    : sortTeamsDesc(rawTeams, "phase2Score", "debugArenaSubmittedAt").map((t, idx) => ({
                                        slNo: idx + 1,
                                        teamId: t.teamId,
                                        teamName: t.teamName,
                                        totalPoints: t.phase2Score ?? 0,
                                        submittedAt: t.debugArenaSubmittedAt,
                                        isQualified: t.isQualified,
                                        captain: t.captain,
                                        members: t.members
                                    }));

                                return (
                                    <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-md">
                                        {/* Header with Title and Download Buttons */}
                                        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-950/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                                                        Participant Rankings
                                                    </span>
                                                    <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                                                        {rawTeams.filter(t => t.isQualified).length} Qualified for Phase 2
                                                    </span>
                                                </div>
                                                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-wide">
                                                    Participate List & Final Submissions
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    Decreasing order based on total points and timing of final submission.
                                                </p>
                                            </div>

                                            {/* Download Option Buttons */}
                                            <div className="flex items-center flex-wrap gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => exportParticipantsToExcel({
                                                        eventName: activeEvent?.name || "Bug_Battle_2026",
                                                        bugSnapList,
                                                        debugArenaList
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 text-xs font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition"
                                                    title="Download Excel spreadsheet (.xlsx)"
                                                >
                                                    <FileSpreadsheet size={15} />
                                                    <span>Download Excel (.xlsx)</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => exportParticipantsToPDF({
                                                        eventName: activeEvent?.name || "Bug_Battle_2026",
                                                        bugSnapList,
                                                        debugArenaList
                                                    })}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2.5 text-xs font-bold shadow-lg shadow-rose-600/20 active:scale-95 transition"
                                                    title="Download PDF document (.pdf)"
                                                >
                                                    <FileText size={15} />
                                                    <span>Download PDF (.pdf)</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Phase Selector Tabs */}
                                        <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-5 sm:px-6 pt-3 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setParticipantTab("bug_snap")}
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 -mb-px ${
                                                    participantTab === "bug_snap"
                                                        ? "border-blue-500 text-blue-400 bg-slate-900/90 shadow-sm"
                                                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                                                }`}
                                            >
                                                <Bug size={14} />
                                                <span>Bug Snap (Phase 1)</span>
                                                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-300">
                                                    {bugSnapList.length}
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setParticipantTab("debug_arena")}
                                                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition border-b-2 -mb-px ${
                                                    participantTab === "debug_arena"
                                                        ? "border-violet-500 text-violet-400 bg-slate-900/90 shadow-sm"
                                                        : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                                                }`}
                                            >
                                                <Code2 size={14} />
                                                <span>Debug Arena (Phase 2)</span>
                                                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-mono text-violet-300">
                                                    {debugArenaList.length}
                                                </span>
                                            </button>
                                        </div>

                                        {/* Table Content */}
                                        <div className="overflow-x-auto">
                                            {participantTab === "bug_snap" ? (
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                                                            <th className="py-3 px-4 w-20 text-center">Sl. No</th>
                                                            <th className="py-3 px-4">Team Name</th>
                                                            <th className="py-3 px-4 w-36 text-center">Total points</th>
                                                            <th className="py-3 px-4 w-64">Timing of final submission</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/60 font-medium">
                                                        {bugSnapList.map((t, idx) => {
                                                            const isTop1 = idx === 0 && t.totalPoints > 0;
                                                            const isTop2 = idx === 1 && t.totalPoints > 0;
                                                            const isTop3 = idx === 2 && t.totalPoints > 0;

                                                            return (
                                                                <tr
                                                                    key={t.teamId || idx}
                                                                    className="hover:bg-slate-800/40 transition-colors"
                                                                >
                                                                    <td className="py-3.5 px-4 text-center">
                                                                        <span
                                                                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${
                                                                                isTop1
                                                                                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm"
                                                                                    : isTop2
                                                                                    ? "bg-slate-300/20 border border-slate-300/40 text-slate-200"
                                                                                    : isTop3
                                                                                    ? "bg-amber-700/20 border border-amber-700/40 text-amber-400"
                                                                                    : "bg-slate-800/70 text-slate-400"
                                                                            }`}
                                                                        >
                                                                            {t.slNo || idx + 1}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3.5 px-4">
                                                                        <div className="font-bold text-white text-sm">
                                                                            {t.teamName}
                                                                        </div>
                                                                        {t.captain && (
                                                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                                                Captain: {t.captain.name || t.captain.email} {t.members?.length ? `• ${t.members.length} members` : ""}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3.5 px-4 text-center">
                                                                        <span className="inline-block rounded-xl bg-blue-500/10 border border-blue-500/20 px-3.5 py-1 font-mono font-extrabold text-blue-300 text-sm">
                                                                            {t.totalPoints ?? 0}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3.5 px-4">
                                                                        {t.submittedAt ? (
                                                                            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                                                                                <Clock3 size={13} className="text-blue-400 shrink-0" />
                                                                                <span>{formatSubmissionTiming(t.submittedAt)}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-slate-500 font-mono text-[11px] italic">
                                                                                — No submission
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead>
                                                        <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                                                            <th className="py-3 px-4 w-20 text-center">Sl. No</th>
                                                            <th className="py-3 px-4">Team Name</th>
                                                            <th className="py-3 px-4 w-36 text-center">Total points</th>
                                                            <th className="py-3 px-4 w-64">Timing of final submission</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/60 font-medium">
                                                        {debugArenaList.map((t, idx) => {
                                                            const isTop1 = idx === 0 && t.totalPoints > 0;
                                                            const isTop2 = idx === 1 && t.totalPoints > 0;
                                                            const isTop3 = idx === 2 && t.totalPoints > 0;

                                                            return (
                                                                <tr
                                                                    key={t.teamId || idx}
                                                                    className="hover:bg-slate-800/40 transition-colors"
                                                                >
                                                                    <td className="py-3.5 px-4 text-center">
                                                                        <span
                                                                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${
                                                                                isTop1
                                                                                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm"
                                                                                    : isTop2
                                                                                    ? "bg-slate-300/20 border border-slate-300/40 text-slate-200"
                                                                                    : isTop3
                                                                                    ? "bg-amber-700/20 border border-amber-700/40 text-amber-400"
                                                                                    : "bg-slate-800/70 text-slate-400"
                                                                            }`}
                                                                        >
                                                                            {t.slNo || idx + 1}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3.5 px-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-white text-sm">
                                                                                {t.teamName}
                                                                            </span>
                                                                            {t.isQualified && (
                                                                                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                                                                    Phase 2 Qualified
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {t.captain && (
                                                                            <div className="text-[11px] text-slate-400 mt-0.5">
                                                                                Captain: {t.captain.name || t.captain.email} {t.members?.length ? `• ${t.members.length} members` : ""}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3.5 px-4 text-center">
                                                                        <span className="inline-block rounded-xl bg-violet-500/10 border border-violet-500/20 px-3.5 py-1 font-mono font-extrabold text-violet-300 text-sm">
                                                                            {t.totalPoints ?? 0}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3.5 px-4">
                                                                        {t.submittedAt ? (
                                                                            <div className="flex items-center gap-1.5 text-slate-300 font-mono text-xs">
                                                                                <Clock3 size={13} className="text-violet-400 shrink-0" />
                                                                                <span>{formatSubmissionTiming(t.submittedAt)}</span>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-slate-500 font-mono text-[11px] italic">
                                                                                — No submission
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Table Footer */}
                                        <div className="p-3.5 bg-slate-950/70 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <span>
                                                * Ranked in decreasing order by <strong>Total points</strong>. Ties are broken by <strong>Timing of final submission</strong> (earlier submission ranks higher).
                                            </span>
                                            <span className="text-slate-500 font-mono">
                                                {participantTab === "bug_snap" ? `Bug Snap: ${bugSnapList.length} teams` : `Debug Arena: ${debugArenaList.length} teams`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </section>
                    )}

                {/* Challenges Section - Only for participants */}
                {!isOrganizer && showChallenges && (
                    <section id="challenges-section" className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-sm animate-fadeIn">
                        <div className="mb-6 flex items-center justify-between gap-4 pb-5 border-b border-slate-800">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-white">Choose your challenge</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Select a mode to explore the debugging experience.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowChallenges(false)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                            >
                                <X size={15} />
                                <span>Close</span>
                            </button>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            {challenges.map(({ title, description, icon: Icon, level, color }) => {
                                const isSubmitted = title === "BUG SNAP"
                                    ? Boolean(team?.roundTimers?.bug_snap?.isSubmitted)
                                    : Boolean(team?.roundTimers?.debug_arena?.isSubmitted);

                                return (
                                    <div
                                        key={title}
                                        onClick={() => {
                                            if (title === "BUG SNAP") {
                                                navigate("/bugsnap");
                                            } else if (title === "DEBUG ARENA") {
                                                navigate("/debug-arena");
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                navigate(title === "BUG SNAP" ? "/bugsnap" : "/debug-arena");
                                            }
                                        }}
                                        className={`group cursor-pointer rounded-2xl border p-6 transition sm:p-8 ${
                                            isSubmitted
                                                ? "border-emerald-500/30 bg-slate-900/80 hover:border-emerald-500/50"
                                                : "border-slate-800 bg-slate-900/60 hover:-translate-y-1 hover:border-slate-600 hover:bg-slate-900"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div
                                                className={`rounded-xl p-3 ${
                                                    isSubmitted
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : color === "blue"
                                                        ? "bg-blue-500/10 text-blue-400"
                                                        : "bg-violet-500/10 text-violet-400"
                                                }`}
                                            >
                                                <Icon size={24} />
                                            </div>
                                            {isSubmitted ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold tracking-wider text-emerald-300">
                                                    <Lock size={11} />
                                                    SUBMITTED & LOCKED
                                                </span>
                                            ) : (
                                                <span className="rounded-full border border-slate-700 px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400">
                                                    {level}
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="mt-6 text-xl font-bold flex items-center gap-2">
                                            {title}
                                            {isSubmitted && (
                                                <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                    Team Submitted
                                                </span>
                                            )}
                                        </h3>
                                        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                                            {isSubmitted
                                                ? "Your team has already completed and submitted this challenge. Submissions are finalized."
                                                : description}
                                        </p>

                                        <div className="mt-7 flex items-center justify-between border-t border-slate-800 pt-5">
                                            <span className="text-xs text-slate-500">
                                                {title === "BUG SNAP" ? "Phase 1 Mode" : "Phase 2 Mode"}
                                            </span>
                                            <span
                                                className={`inline-flex items-center gap-2 text-sm font-semibold transition group-hover:gap-3 ${
                                                    isSubmitted
                                                        ? "text-emerald-400"
                                                        : color === "blue"
                                                        ? "text-blue-400"
                                                        : "text-violet-400"
                                                }`}
                                            >
                                                {isSubmitted
                                                    ? "View Submissions"
                                                    : title === "BUG SNAP"
                                                    ? "Start challenge"
                                                    : "Enter Arena"}
                                                <ChevronRight size={17} />
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Recent Submissions */}
                        <section className="mt-10">
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        Recent Submissions
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Track your latest coding attempts.
                                    </p>
                                </div>
                                <Terminal size={20} className="text-blue-400" />
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                                {statsLoading ? (
                                    <p className="p-6 text-sm text-slate-400">
                                        Loading submissions...
                                    </p>
                                ) : submissions.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Code2
                                            size={30}
                                            className="mx-auto mb-3 text-slate-500"
                                        />
                                        <p className="font-medium text-slate-300">
                                            No submissions yet
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Your coding attempts will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-800">
                                        {submissions.slice(0, 5).map((submission) => (
                                            <div
                                                key={submission._id}
                                                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-slate-200">
                                                        {submission.question?.title || "Coding challenge"}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {submission.language || "Unknown language"}
                                                        {" · "}
                                                        {submission.createdAt
                                                            ? new Date(submission.createdAt).toLocaleString()
                                                            : "Date unavailable"}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${submission.status === "accepted"
                                                            ? "bg-emerald-500/10 text-emerald-400"
                                                            : submission.status === "pending"
                                                                ? "bg-amber-500/10 text-amber-400"
                                                                : "bg-red-500/10 text-red-400"
                                                            }`}
                                                    >
                                                        {(submission.status || "unknown").replaceAll("_", " ")}
                                                    </span>
                                                    <span className="text-sm font-bold text-white">
                                                        {submission.score || 0} pts
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>
                    </section>
                )}
                {/* Team Management Section - Only for participants */}
                {!isOrganizer && showTeam && (
                    <section id="team-section" className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-sm animate-fadeIn">
                        <div className="mb-6 flex items-center justify-between gap-4 pb-5 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400 border border-indigo-500/20">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        Team Management
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-400">
                                        Create a team to prepare for BUG BATTLE events.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTeam(false)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition"
                            >
                                <X size={15} />
                                <span>Close</span>
                            </button>
                        </div>


                        {!team && (
                            <form
                                onSubmit={handleJoinTeam}
                                className="mt-6 max-w-xl border-t border-slate-800 pt-6"
                            >
                                <label
                                    htmlFor="teamId"
                                    className="mb-2 block text-sm font-medium text-slate-300"
                                >
                                    Have a Team ID?
                                </label>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        id="teamId"
                                        type="text"
                                        value={teamId}
                                        onChange={(e) => setTeamId(e.target.value)}
                                        placeholder="Paste the Team ID"
                                        required
                                        className="min-w-0 flex-1 rounded-xl borderborder-slate-700 bg-slate-950 px-4 py-3 text-smtext-white outline-none transition placeholder:text-slate-500focus:border-blue-500"
                                    />

                                    <button
                                        type="submit"
                                        className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-blue-500 hover:bg-blue-500/10"
                                    >
                                        Join Team
                                    </button>
                                </div>
                            </form>
                        )}


                        {!team && (
                            <form onSubmit={handleCreateTeam} className="max-w-xl">
                                <label
                                    htmlFor="teamName"
                                    className="mb-2 block text-sm font-medium text-slate-300"
                                >
                                    Team name
                                </label>

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        id="teamName"
                                        type="text"
                                        value={teamName}
                                        onChange={(e) => setTeamName(e.target.value)}
                                        placeholder="Enter your team name"
                                        minLength={2}
                                        maxLength={50}
                                        required
                                        className="min-w-0 flex-1 rounded-xl borderborder-slate-700 bg-slate-950 px-4 py-3 text-smtext-white outline-none transition placeholder:text-slate-500focus:border-blue-500"
                                    />

                                    <button
                                        type="submit"
                                        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                                    >
                                        Create Team
                                    </button>
                                </div>

                                {teamMessage && (
                                    <p
                                        role="status"
                                        className="mt-4 text-sm text-slate-300"
                                    >
                                        {teamMessage}
                                    </p>
                                )}
                            </form>
                        )}

                        {team && (
                            <div className="mt-8 border-t border-slate-800 pt-6">
                                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                                            Your team
                                        </p>
                                        <h3 className="mt-1 text-2xl font-bold text-white">
                                            {team.name}
                                        </h3>

                                        <div className="mt-2 flex flex-wrap items-center gap-3">
                                            <span className="text-xs text-slate-500">
                                                Team ID:
                                            </span>
                                            <code className="break-all text-xs text-slate-300">
                                                {team._id}
                                            </code>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(team._id);
                                                        setTeamMessage("Team ID copied successfully!");
                                                    } catch {
                                                        setTeamMessage("Unable to copy Team ID. Please copy it manually.");
                                                    }
                                                }}
                                                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-blue-400 transition hover:border-blue-500"
                                            >
                                                Copy ID
                                            </button>
                                        </div>

                                    </div>

                                    <span className="w-fit rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                                        {team.members?.length || 0} / 3 members
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {team.members?.map((member) => {
                                        const isCaptain =
                                            String(team.captain?._id) ===
                                            String(member._id);


                                        return (
                                            <div
                                                key={member._id}
                                                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-slate-200">
                                                        {member.name}
                                                    </p>
                                                    <p className="mt-1 truncate text-sm text-slate-500">
                                                        {member.email}
                                                    </p>
                                                </div>

                                                <span
                                                    className={`ml-3 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${isCaptain
                                                        ? "bg-blue-500/10 text-blue-400"
                                                        : "bg-slate-800 text-slate-300"
                                                        }`}
                                                >
                                                    {isCaptain ? "Captain" : "Member"}
                                                </span>
                                            </div>
                                        );
                                    })}

                                </div>

                                {String(team.captain?._id) !== String(user?._id) && (
                                    <button
                                        type="button"
                                        onClick={handleLeaveTeam}
                                        className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:border-red-500/60 hover:bg-red-500/20"
                                    >
                                        Leave Team
                                    </button>
                                )}

                                <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                                                Active Event
                                            </p>

                                            <h4 className="mt-1 text-lg font-bold text-white">
                                                {activeEvent?.name || "No Live Event"}
                                            </h4>

                                            <p className="mt-1 text-sm text-slate-400">
                                                Current phase:{" "}
                                                {activeEvent?.phase
                                                    ? activeEvent.phase
                                                        .split("_")
                                                        .map((word) => word.toUpperCase())
                                                        .join(" ")
                                                    : "Not available"}
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                Status: {activeEvent?.status || "No active event"}
                                            </p>

                                        </div>

                                        {team.event ? (
                                            <span className="w-fit rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400">
                                                Already Registered
                                            </span>
                                        ) : String(team.captain?._id) === String(user?._id) ? (
                                            <button
                                                type="button"
                                                onClick={handleRegisterEvent}
                                                disabled={registeringEvent || (team.members?.length || 0) < 2 || (team.members?.length || 0) > 3}
                                                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {registeringEvent ? "Registering..." : "Register for Event"}
                                            </button>
                                        ) : (
                                            <p className="text-sm text-slate-400">
                                                Only the captain can register.
                                            </p>
                                        )}
                                    </div>

                                    {eventMessage && (
                                        <p className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-300">
                                            {eventMessage}
                                        </p>
                                    )}

                                    {!team.event && (team.members?.length || 0) < 2 && (
                                        <p className="mt-3 text-xs text-amber-400">
                                            Add at least one more member before registering.
                                        </p>
                                    )}
                                </div>

                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}

export default Dashboard;
