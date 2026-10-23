import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Trophy,
    Medal,
    RefreshCw,
    LoaderCircle,
    AlertCircle,
    Sparkles,
    ShieldAlert,
    FileSpreadsheet,
    FileText
} from "lucide-react";
import {
    exportParticipantsToExcel,
    exportParticipantsToPDF
} from "../utils/exportUtils";
import { getAuthToken, getAuthUser } from "../utils/auth";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

function Leaderboard() {
    const navigate = useNavigate();

    const [isOrganizer, setIsOrganizer] = useState(() => getAuthUser()?.role === "organizer");
    const [leaderboard, setLeaderboard] = useState([]);
    const [qualificationData, setQualificationData] = useState(null);
    const [eventName, setEventName] = useState("BUG BATTLE 2026");
    const [eventData, setEventData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const fetchLeaderboard = async (isRefresh = false) => {
        const token = getAuthToken();

        if (!token) {
            navigate("/login");
            return;
        }

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            // Verify organizer role
            const userRes = await axios.get(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = userRes.data.user || userRes.data;
            if (userData.role !== "organizer") {
                setIsOrganizer(false);
                setLoading(false);
                return;
            }
            setIsOrganizer(true);

            // First get active event dynamically
            const eventRes = await axios.get(`${API}/events/active`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const activeEvent = eventRes.data.event;
            if (!activeEvent) {
                setError("No event is active.");
                setLoading(false);
                return;
            }

            setEventData(activeEvent);
            setEventName(activeEvent.name || "BUG BATTLE 2026");

            // Fetch leaderboard for this active event
            const response = await axios.get(
                `${API}/submissions/leaderboard/${activeEvent._id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setLeaderboard(response.data.leaderboard || []);

            // Also fetch participant qualification data for Excel / PDF exports
            try {
                const qualRes = await axios.get(`${API}/events/${activeEvent._id}/qualification`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setQualificationData(qualRes.data);
            } catch (qualErr) {
                console.error("Error loading qualification for exports:", qualErr);
            }
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load leaderboard. Please try again."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const getRankStyle = (index) => {
        if (index === 0) {
            return "border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-md shadow-amber-400/10";
        }

        if (index === 1) {
            return "border-slate-400/40 bg-slate-400/10 text-slate-300";
        }

        if (index === 2) {
            return "border-orange-500/40 bg-orange-500/10 text-orange-300";
        }

        return "border-slate-800 bg-slate-900 text-slate-400";
    };

    const winner = leaderboard[0];

    if (!loading && !isOrganizer) {
        return (
            <main className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100 sm:px-8 flex items-center justify-center">
                <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-center backdrop-blur-md shadow-2xl">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <ShieldAlert size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Organizer Only</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        The tournament leaderboard is only visible to event organizers.
                    </p>
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-600/20"
                    >
                        <ArrowLeft size={16} />
                        Back to Dashboard
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">

            <div className="mx-auto max-w-5xl">
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="inline-flex items-center gap-2 text-sm text-blue-400 transition hover:text-blue-300"
                    >
                        <ArrowLeft size={18} />
                        Back to dashboard
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate("/debug-arena")}
                            className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-300 hover:border-violet-500/60 transition"
                        >
                            Phase 2: Arena
                        </button>
                        <button
                            onClick={() => navigate("/bugsnap")}
                            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 hover:border-blue-500/60 transition"
                        >
                            Phase 1: Bug Snap
                        </button>
                    </div>
                </div>

                {/* Banner */}
                <section className="mb-8 overflow-hidden rounded-3xl border border-slate-800 bg-linear-to-br from-blue-950/70 via-slate-900 to-slate-900 p-7 sm:p-10 shadow-2xl relative">
                    <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-amber-500/10 blur-3xl" />

                    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center relative">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
                                <Trophy size={14} />
                                OFFICIAL COMPETITION STANDINGS
                            </div>

                            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                                Leaderboard & Awards
                            </h1>

                            <p className="mt-2 text-slate-400 text-sm">
                                {eventName} · Live rankings across Phase 1 (Bug Snap) and Phase 2 (Debug Arena).
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    const bugSnapList = qualificationData?.bugSnapParticipants || [];
                                    const debugArenaList = qualificationData?.debugArenaParticipants || [];
                                    exportParticipantsToExcel({
                                        eventName: eventName || "Bug_Battle_2026",
                                        bugSnapList,
                                        debugArenaList
                                    });
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-3 text-xs font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition"
                                title="Download Excel spreadsheet (.xlsx)"
                            >
                                <FileSpreadsheet size={15} />
                                <span>Download Excel (.xlsx)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    const bugSnapList = qualificationData?.bugSnapParticipants || [];
                                    const debugArenaList = qualificationData?.debugArenaParticipants || [];
                                    exportParticipantsToPDF({
                                        eventName: eventName || "Bug_Battle_2026",
                                        bugSnapList,
                                        debugArenaList
                                    });
                                }}
                                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-3 text-xs font-bold shadow-lg shadow-rose-600/20 active:scale-95 transition"
                                title="Download PDF document (.pdf)"
                            >
                                <FileText size={15} />
                                <span>Download PDF (.pdf)</span>
                            </button>

                            <button
                                onClick={() => fetchLeaderboard(true)}
                                disabled={loading || refreshing}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-3 text-sm font-semibold transition hover:border-blue-500 disabled:opacity-50"
                            >
                                {refreshing ? (
                                    <LoaderCircle size={17} className="animate-spin text-blue-400" />
                                ) : (
                                    <RefreshCw size={17} />
                                )}
                                Refresh Scores
                            </button>
                        </div>
                    </div>
                </section>

                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
                        <LoaderCircle size={24} className="animate-spin text-blue-400" />
                        Calculating team rankings and scores...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                        <div className="flex items-center gap-2 font-semibold">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                        <button
                            onClick={() => fetchLeaderboard()}
                            className="mt-4 rounded-xl bg-red-500/20 px-4 py-2 text-sm font-semibold hover:bg-red-500/30 transition"
                        >
                            Try again
                        </button>
                    </div>
                ) : leaderboard.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
                        <Trophy size={36} className="mx-auto text-slate-500 mb-3" />
                        <h2 className="text-lg font-bold text-slate-300">No rankings yet</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Team rankings will appear here as soon as challenges are submitted.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* 1st Place Champion Spotlight (BUG SLAYER 2026) */}
                        {winner && winner.score > 0 && (
                            <div className="mb-8 rounded-3xl border-2 border-amber-400/50 bg-linear-to-r from-amber-950/40 via-slate-900 to-amber-950/20 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 border-2 border-amber-400/60 text-amber-300 shadow-lg">
                                            <Trophy size={32} />
                                        </div>
                                        <div>
                                            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-0.5 text-xs font-black text-amber-300 uppercase tracking-wider">
                                                <Sparkles size={13} />
                                                TOURNAMENT CHAMPION • BUG SLAYER 2026
                                            </div>
                                            <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">
                                                {winner.teamName}
                                            </h2>
                                            <p className="text-xs text-slate-400 mt-1">
                                                Phase 1: {winner.phase1Score} pts • Phase 2: {winner.phase2Score} pts • Bugs Fixed: {winner.bugsFixedCount}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="text-3xl sm:text-4xl font-black text-amber-300">
                                            {winner.score} <span className="text-sm font-semibold text-slate-400">pts</span>
                                        </p>
                                        <p className="text-xs text-emerald-400 font-bold">1st Place Distinction</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Top 3 Podium Cards */}
                        <div className="mb-8 grid gap-5 sm:grid-cols-3">
                            {leaderboard.slice(0, 3).map((team, index) => {
                                const isFirst = index === 0;
                                const isSecond = index === 1;
                                const isThird = index === 2;

                                return (
                                    <div
                                        key={team.teamId}
                                        className={`rounded-2xl border p-6 transition ${isFirst
                                                ? "border-amber-400/40 bg-amber-400/5 sm:-translate-y-1 shadow-lg shadow-amber-400/5"
                                                : isSecond
                                                    ? "border-slate-500/40 bg-slate-900/80"
                                                    : "border-orange-500/40 bg-slate-900/80"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                {team.prizeTitle || `Rank #${index + 1}`}
                                            </span>

                                            {isFirst ? (
                                                <Trophy size={24} className="text-amber-300" />
                                            ) : (
                                                <Medal
                                                    size={24}
                                                    className={isSecond ? "text-slate-300" : "text-orange-400"}
                                                />
                                            )}
                                        </div>

                                        <h3 className="mt-4 text-xl font-bold text-white truncate">
                                            {team.teamName}
                                        </h3>

                                        <div className="mt-3 flex items-baseline gap-2">
                                            <span className="text-3xl font-extrabold text-blue-400">
                                                {team.score}
                                            </span>
                                            <span className="text-xs font-semibold text-slate-400">
                                                total points
                                            </span>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400">
                                            <span>P1: {team.phase1Score} | P2: {team.phase2Score}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Full Leaderboard Table */}
                        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                            <div className="border-b border-slate-800 px-6 py-5 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-white text-base">
                                        All Ranked Teams
                                    </h2>
                                    <p className="mt-0.5 text-xs text-slate-400">
                                        Rankings determined by total points, Phase 2 score, and bugs resolved
                                    </p>
                                </div>
                                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 font-semibold">
                                    {leaderboard.length} Participating Teams
                                </span>
                            </div>

                            <div className="divide-y divide-slate-800">
                                {leaderboard.map((team, index) => (
                                    <div
                                        key={team.teamId}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 transition hover:bg-slate-800/40"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${getRankStyle(
                                                    index
                                                )}`}
                                            >
                                                {index === 0 ? (
                                                    <Trophy size={18} />
                                                ) : index === 1 || index === 2 ? (
                                                    <Medal size={18} />
                                                ) : (
                                                    `#${index + 1}`
                                                )}
                                            </div>

                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white text-base">
                                                        {team.teamName}
                                                    </p>
                                                    {team.rank === 1 && (
                                                        <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                                            BUG SLAYER
                                                        </span>
                                                    )}
                                                    {team.isQualified && (
                                                        <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                                            Qualified
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    Phase 1: <strong className="text-slate-300">{team.phase1Score} pts</strong>
                                                    {" • "}
                                                    Phase 2: <strong className="text-slate-300">{team.phase2Score} pts</strong>
                                                    {" • "}
                                                    Bugs Fixed: {team.bugsFixedCount}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-xl font-black text-blue-400">
                                                {team.score}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-semibold">
                                                points
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}

export default Leaderboard;
