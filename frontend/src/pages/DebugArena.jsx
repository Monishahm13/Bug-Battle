import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Code2,
    Play,
    CheckCircle2,
    XCircle,
    LoaderCircle,
    AlertTriangle,
    ShieldAlert,
    Trophy,
    RefreshCw,
    Sparkles,
    CheckSquare,
    Square,
    Terminal,
    Lock,
    ShieldCheck
} from "lucide-react";
import RulesModal from "../components/RulesModal";
import RoundTimer from "../components/RoundTimer";
import { getAuthToken } from "../utils/auth";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

function DebugArena() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [activeEvent, setActiveEvent] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [codes, setCodes] = useState({});
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState(null);
    const [results, setResults] = useState({});
    const [error, setError] = useState("");
    const [qualificationData, setQualificationData] = useState(null);
    const [checkedBugs, setCheckedBugs] = useState({});
    const [showRules, setShowRules] = useState(false);
    const [submissionHistory, setSubmissionHistory] = useState([]);

    // Timer & final submission state
    const [isFinalSubmitted, setIsFinalSubmitted] = useState(false);
    const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
    const [autoSubmitStatus, setAutoSubmitStatus] = useState("");

    // Refs to access latest state in auto-submit callback without stale closures
    const codesRef = useRef(codes);
    codesRef.current = codes;
    const resultsRef = useRef(results);
    resultsRef.current = results;
    const questionsRef = useRef(questions);
    questionsRef.current = questions;

    const fetchArenaData = async () => {
        const token = getAuthToken();

        if (!token) {
            navigate("/login");
            return;
        }

        setError("");
        setLoading(true);

        try {
            // 1. Get current user
            const meRes = await axios.get(`${API}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = meRes.data.user || meRes.data;
            setUser(userData);

            // 2. Get active event
            const eventRes = await axios.get(`${API}/events/active`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const event = eventRes.data.event;
            setActiveEvent(event);

            if (!event) {
                setError("No event is currently active.");
                setLoading(false);
                return;
            }

            // Check if final submission already recorded in scoped user storage
            const currentUserId = userData?._id || userData?.id || "";
            const localKey = `bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${event._id}_debug_arena`;
            const savedLocal = sessionStorage.getItem(localKey) || localStorage.getItem(localKey);
            if (savedLocal) {
                try {
                    const parsed = JSON.parse(savedLocal);
                    if (parsed.isFinalSubmitted) {
                        setIsFinalSubmitted(true);
                    }
                } catch { }
            }

            // Check server team timer for finality
            try {
                const timerRes = await axios.get(`${API}/teams/timer/debug_arena`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (timerRes.data?.timer?.isSubmitted) {
                    setIsFinalSubmitted(true);
                }
            } catch { }

            // 3. Get qualification status
            try {
                const qualRes = await axios.get(`${API}/events/${event._id}/qualification`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setQualificationData(qualRes.data);
            } catch (qErr) {
                console.warn("Could not fetch qualification data:", qErr);
            }

            // 4. Get questions for debug_arena
            const qRes = await axios.get(
                `${API}/questions/event/${event._id}?phase=debug_arena`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const loadedQuestions = qRes.data.questions || [];
            setQuestions(loadedQuestions);

            const initialCodes = {};
            loadedQuestions.forEach((q) => {
                initialCodes[q._id] = q.buggyCode;
            });
            setCodes(initialCodes);

            // 5. Get recent submissions
            const subRes = await axios.get(`${API}/submissions/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const subs = subRes.data.submissions || [];
            setSubmissionHistory(subs);

            // Populate accepted results
            const initialResults = {};
            subs.forEach((sub) => {
                if (sub.status === "accepted" && sub.question?._id) {
                    initialResults[sub.question._id] = sub;
                }
            });
            setResults(initialResults);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Failed to load DEBUG ARENA. Please check event status."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchArenaData();
    }, [navigate]);

    const handleCodeChange = (questionId, newCode) => {
        if (isFinalSubmitted) return;
        setCodes((prev) => ({
            ...prev,
            [questionId]: newCode
        }));
    };

    const handleResetCode = (question) => {
        if (isFinalSubmitted) return;
        setCodes((prev) => ({
            ...prev,
            [question._id]: question.buggyCode
        }));
    };

    const toggleBugCheck = (questionId, bugIndex) => {
        if (isFinalSubmitted) return;
        const key = `${questionId}_${bugIndex}`;
        setCheckedBugs((prev) => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSubmit = async (question) => {
        if (isFinalSubmitted) {
            alert("This round has concluded and final submissions are locked.");
            return;
        }

        const token = getAuthToken();
        const currentCode = codes[question._id];

        if (!currentCode || !currentCode.trim()) {
            alert("Code cannot be empty.");
            return;
        }

        setSubmittingId(question._id);

        try {
            const response = await axios.post(
                `${API}/submissions`,
                {
                    questionId: question._id,
                    language: question.language,
                    code: currentCode
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const submission = response.data.submission;
            setResults((prev) => ({
                ...prev,
                [question._id]: submission
            }));

            // Refresh submissions history
            const historyRes = await axios.get(`${API}/submissions/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSubmissionHistory(historyRes.data.submissions || []);
        } catch (err) {
            const msg =
                err.response?.data?.message ||
                "Execution failed. Please check Judge0 or server connection.";
            setResults((prev) => ({
                ...prev,
                [question._id]: {
                    status: "system_error",
                    judgeMessage: msg,
                    score: 0
                }
            }));
        } finally {
            setSubmittingId(null);
        }
    };

    // Automatic submission of all questions when 30 min timer ends or early final submit
    const handleAutoSubmitAll = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;

        setIsAutoSubmitting(true);
        const currentQuestions = questionsRef.current;
        const currentCodes = codesRef.current;
        const currentResults = resultsRef.current;

        for (let i = 0; i < currentQuestions.length; i++) {
            const question = currentQuestions[i];

            // If already accepted, skip
            if (currentResults[question._id]?.status === "accepted") {
                continue;
            }

            setAutoSubmitStatus(
                `Evaluating Challenge ${i + 1} of ${currentQuestions.length}: "${question.title}"...`
            );

            const codeToSubmit = currentCodes[question._id] || question.buggyCode;

            try {
                const response = await axios.post(
                    `${API}/submissions`,
                    {
                        questionId: question._id,
                        language: question.language,
                        code: codeToSubmit
                    },
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );

                const submission = response.data.submission;
                if (submission) {
                    setResults((prev) => ({
                        ...prev,
                        [question._id]: submission
                    }));
                }
            } catch (err) {
                console.warn(`Auto-submit error for Arena question ${question._id}:`, err);
                setResults((prev) => ({
                    ...prev,
                    [question._id]: {
                        status: "system_error",
                        judgeMessage: err.response?.data?.message || "Final auto-submission processed.",
                        score: 0
                    }
                }));
            }
        }

        setAutoSubmitStatus("Finalizing round records...");

        // Refresh submission history
        try {
            const historyRes = await axios.get(`${API}/submissions/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSubmissionHistory(historyRes.data.submissions || []);
        } catch (e) {
            console.error("Failed to refresh history:", e);
        }

        // Mark final in server team timer
        try {
            await axios.post(
                `${API}/teams/timer/finish`,
                { phase: "debug_arena" },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) {
            console.warn("Could not mark server timer finished:", e);
        }

        // Mark final in scoped tab/storage
        if (activeEvent?._id) {
            const currentUserId = user?._id || user?.id || "";
            const localKey = `bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${activeEvent._id}_debug_arena`;
            const existing = sessionStorage.getItem(localKey) || localStorage.getItem(localKey);
            let parsed = {};
            try { parsed = JSON.parse(existing) || {}; } catch { }
            const updatedPayload = JSON.stringify({
                ...parsed,
                isFinalSubmitted: true,
                endsAt: Date.now()
            });
            sessionStorage.setItem(localKey, updatedPayload);
            localStorage.setItem(localKey, updatedPayload);
        }

        setIsFinalSubmitted(true);
        setIsAutoSubmitting(false);
    }, [activeEvent, user]);

    // Organizer reset timer handler
    const handleResetTimer = async () => {
        const token = getAuthToken();
        if (!token) return;

        if (activeEvent?._id) {
            const currentUserId = user?._id || user?.id || "";
            sessionStorage.removeItem(`bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${activeEvent._id}_debug_arena`);
            localStorage.removeItem(`bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${activeEvent._id}_debug_arena`);
            localStorage.removeItem(`bugbattle_timer_${activeEvent._id}_debug_arena`);
        }

        try {
            await axios.post(
                `${API}/teams/timer/reset`,
                { phase: "debug_arena" },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) {
            console.warn("Failed to reset server timer:", e);
        }

        setIsFinalSubmitted(false);
        window.location.reload();
    };

    const isOrganizer = user?.role === "organizer";
    const myTeam = qualificationData?.myTeam;
    const qualifyingScore = activeEvent?.qualifyingScore || 15;
    const isQualified = myTeam ? myTeam.isQualified : false;
    const phase1Score = myTeam ? myTeam.phase1Score : 0;
    const isPhase2Live = activeEvent?.status === "live" && activeEvent?.phase === "debug_arena";
    const canAccessChallenges = (isPhase2Live || isOrganizer) && (isQualified || isOrganizer);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} />

            {/* Header */}
            <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
                        >
                            <ArrowLeft size={16} />
                            Dashboard
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="rounded-xl bg-violet-600/20 p-2 text-violet-400 border border-violet-500/30">
                                <Code2 size={20} />
                            </div>
                            <div>
                                <span className="font-bold text-base sm:text-lg tracking-wide">
                                    DEBUG <span className="text-violet-400">ARENA</span>
                                </span>
                                <span className="ml-2.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                                    PHASE 2 • 30 MIN
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowRules(true)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:border-red-500/60"
                        >
                            <ShieldAlert size={14} />
                            <span className="hidden sm:inline">Event Rules</span>
                        </button>

                        <button
                            onClick={() => navigate("/leaderboard")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:border-blue-500"
                        >
                            <Trophy size={14} className="text-amber-400" />
                            <span className="hidden sm:inline">Leaderboard</span>
                        </button>

                        <button
                            onClick={fetchArenaData}
                            className="rounded-xl border border-slate-800 p-2 text-slate-400 hover:text-white hover:border-slate-600 transition"
                            title="Refresh"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
                {/* Banner */}
                <div className="relative overflow-hidden rounded-3xl border border-violet-500/30 bg-linear-to-br from-violet-950/60 via-slate-900 to-slate-950 p-6 sm:p-10 mb-8 shadow-2xl">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3.5 py-1 text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">
                                <Sparkles size={13} />
                                Comprehensive Multi-Bug Programs
                            </div>
                            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                                Phase 2: Debug Arena
                            </h1>
                            <p className="mt-2 text-sm sm:text-base text-slate-400 leading-relaxed">
                                Qualified teams receive larger codebases with 10–15 intentional bugs across syntax, logic, loops, runtime, and I/O. You have <strong>30 minutes</strong> to resolve all bugs.
                            </p>
                        </div>

                        {/* Status Card */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shrink-0 min-w-65">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Team Qualification Status
                            </p>
                            <div className="mt-2 flex items-center gap-2.5">
                                {isQualified || isOrganizer ? (
                                    <>
                                        <CheckCircle2 className="text-emerald-400" size={22} />
                                        <span className="font-bold text-emerald-400 text-base">
                                            {isOrganizer ? "Organizer Access" : "Qualified for Phase 2"}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="text-amber-400" size={22} />
                                        <span className="font-bold text-amber-400 text-base">
                                            Qualification Required
                                        </span>
                                    </>
                                )}
                            </div>

                            <div className="mt-3 text-xs text-slate-400 space-y-1 border-t border-slate-800 pt-3">
                                <div className="flex justify-between">
                                    <span>Phase 1 Score:</span>
                                    <strong className="text-white">{phase1Score} pts</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>Min Qualifying Score:</span>
                                    <strong className="text-violet-400">{qualifyingScore} pts</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>Current Event Phase:</span>
                                    <strong className="text-slate-300 uppercase">
                                        {activeEvent?.phase ? activeEvent.phase.replace("_", " ") : "Not Started"}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 30-Minute Round Countdown HUD Timer */}
                {!loading && canAccessChallenges && questions.length > 0 && (
                    <RoundTimer
                        phase="debug_arena"
                        phaseName="DEBUG ARENA"
                        durationMinutes={30}
                        eventId={activeEvent?._id || "active"}
                        userId={user?._id || user?.id || ""}
                        userName={user?.name || user?.email || ""}
                        isQuestionsLoaded={questions.length > 0}
                        isFinalSubmitted={isFinalSubmitted}
                        onTimeUp={handleAutoSubmitAll}
                        onFinalSubmitEarly={handleAutoSubmitAll}
                        isAutoSubmitting={isAutoSubmitting}
                        autoSubmitStatus={autoSubmitStatus}
                        isOrganizer={isOrganizer}
                        onResetTimer={handleResetTimer}
                    />
                )}

                {/* Locked Banner if final submission complete */}
                {isFinalSubmitted && (
                    <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-200 shadow-lg shadow-emerald-500/5">
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={24} className="text-emerald-400 shrink-0" />
                            <div>
                                <h3 className="font-bold text-base text-white">
                                    Challenge Concluded — Team Submission Locked
                                </h3>
                                <p className="text-xs sm:text-sm text-emerald-300/90 mt-0.5">
                                    A team member or captain has submitted DEBUG ARENA for your team. All solutions are permanently recorded and locked. No team member can restart or resubmit this challenge.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex min-h-75 items-center justify-center">
                        <div className="text-center text-slate-400">
                            <LoaderCircle size={32} className="mx-auto mb-3 animate-spin text-violet-400" />
                            <p>Loading DEBUG ARENA challenges...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
                        <AlertTriangle className="mx-auto mb-2 text-red-400" size={28} />
                        <p className="font-semibold">{error}</p>
                    </div>
                ) : !isPhase2Live && !isOrganizer ? (
                    /* Phase Gate Notice */
                    <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center max-w-2xl mx-auto my-12">
                        <Lock className="mx-auto mb-4 text-amber-400" size={48} />
                        <h2 className="text-2xl font-bold text-white">DEBUG ARENA is Locked</h2>
                        <p className="mt-3 text-slate-300 text-sm leading-relaxed">
                            {activeEvent?.phase === "bug_snap"
                                ? "Phase 1 (BUG SNAP) is currently in progress. Organizers will unlock Phase 2 (DEBUG ARENA) once Phase 1 concludes."
                                : "The event is currently not in Phase 2 (DEBUG ARENA)."}
                        </p>

                        {!isQualified && (
                            <div className="mt-5 rounded-2xl bg-slate-900/80 border border-slate-800 p-4 text-left max-w-md mx-auto text-xs text-slate-300">
                                <p className="font-bold text-amber-400 mb-1">Qualification Checklist:</p>
                                <p>• Minimum score required in Phase 1: <strong>{qualifyingScore} points</strong></p>
                                <p>• Your team's current Phase 1 score: <strong>{phase1Score} points</strong></p>
                            </div>
                        )}

                        <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <button
                                onClick={() => navigate("/bugsnap")}
                                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 font-semibold text-sm transition"
                            >
                                Go to Phase 1 (BUG SNAP)
                            </button>
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 px-5 py-2.5 font-semibold text-sm transition"
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                ) : !isQualified && !isOrganizer ? (
                    /* Did not meet qualification score */
                    <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-8 text-center max-w-2xl mx-auto my-12">
                        <Lock className="mx-auto mb-4 text-red-400" size={48} />
                        <h2 className="text-2xl font-bold text-white">Phase 2 Qualification Required</h2>
                        <p className="mt-3 text-slate-300 text-sm leading-relaxed">
                            According to the tournament rules, only teams reaching the minimum qualifying score of <strong>{qualifyingScore} points</strong> in Phase 1 (BUG SNAP) advance to Phase 2 (DEBUG ARENA).
                        </p>
                        <p className="mt-2 text-xs text-red-300 font-semibold">
                            Your team earned {phase1Score} / {qualifyingScore} points in Phase 1.
                        </p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button
                                onClick={() => navigate("/dashboard")}
                                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center">
                        <Code2 className="mx-auto mb-3 text-slate-500" size={36} />
                        <h3 className="text-lg font-bold text-slate-300">No Phase 2 Challenges Available Yet</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            The organizing committee has not published Debug Arena questions yet.
                        </p>
                        {isOrganizer && (
                            <button
                                onClick={() => navigate("/manage-questions")}
                                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition"
                            >
                                Add Debug Arena Questions
                            </button>
                        )}
                    </div>
                ) : (
                    /* Questions Grid / List */
                    <div className="space-y-8">
                        {questions.map((question, qIdx) => {
                            const result = results[question._id];
                            const isAccepted = result?.status === "accepted";
                            const isSubmitting = submittingId === question._id;

                            // Mock bug checklist based on errorCount
                            const errorCount = question.errorCount || 10;
                            const bugList = Array.from({ length: Math.min(errorCount, 15) }, (_, i) => ({
                                id: i + 1,
                                label: `Bug #${i + 1} (${question.errorTypes?.[i % (question.errorTypes?.length || 1)] || "Syntax/Logic"})`
                            }));

                            return (
                                <article
                                    key={question._id}
                                    className={`rounded-3xl border transition-all ${isAccepted
                                        ? "border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-500/5"
                                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                                        } p-6 sm:p-8`}
                                >
                                    {/* Question Header */}
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pb-6 border-b border-slate-800">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-xs font-bold text-violet-400 uppercase">
                                                    Challenge #{qIdx + 1}
                                                </span>
                                                <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 uppercase">
                                                    {question.language}
                                                </span>
                                                <span className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-400 uppercase">
                                                    {question.difficulty} — {question.points} pts
                                                </span>
                                                <span className="rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400">
                                                    🐛 {errorCount} Intentional Bugs
                                                </span>
                                                {question.isTieBreaker && (
                                                    <span className="rounded-lg bg-amber-400/20 border border-amber-400/40 px-2.5 py-1 text-xs font-black text-amber-300 animate-pulse">
                                                        ⚡ TIE-BREAKER QUESTION
                                                    </span>
                                                )}
                                            </div>

                                            <h2 className="text-xl sm:text-2xl font-bold text-white">
                                                {question.title}
                                            </h2>
                                            <p className="mt-2 text-sm text-slate-400 leading-relaxed max-w-3xl">
                                                {question.description}
                                            </p>
                                        </div>

                                        <div className="shrink-0 flex items-center gap-3">
                                            {isAccepted ? (
                                                <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-emerald-400 text-sm font-bold">
                                                    <CheckCircle2 size={18} />
                                                    Solved (+{question.points} pts)
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleResetCode(question)}
                                                    disabled={isFinalSubmitted}
                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition disabled:opacity-50"
                                                >
                                                    <RefreshCw size={14} />
                                                    Reset Original Code
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bug Tracker Checklist */}
                                    <div className="my-6 rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 sm:p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                                Bug Hunting Progress ({Object.keys(checkedBugs).filter(k => k.startsWith(question._id) && checkedBugs[k]).length}/{bugList.length} Identified)
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                Click to mark bugs you've located & fixed
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                                            {bugList.map((bug) => {
                                                const isChecked = Boolean(checkedBugs[`${question._id}_${bug.id}`]);
                                                return (
                                                    <button
                                                        key={bug.id}
                                                        type="button"
                                                        disabled={isFinalSubmitted}
                                                        onClick={() => toggleBugCheck(question._id, bug.id)}
                                                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left transition border ${isChecked
                                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                                                            } ${isFinalSubmitted ? "opacity-75 cursor-default" : ""}`}
                                                    >
                                                        {isChecked ? (
                                                            <CheckSquare size={14} className="text-emerald-400 shrink-0" />
                                                        ) : (
                                                            <Square size={14} className="text-slate-500 shrink-0" />
                                                        )}
                                                        <span className="truncate">{bug.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Code Editor */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                                            <span className="font-mono flex items-center gap-1.5">
                                                <Terminal size={14} className="text-violet-400" />
                                                Interactive Debugger Workspace ({question.language})
                                            </span>
                                            <span>
                                                {isFinalSubmitted
                                                    ? "Submissions locked • Round ended"
                                                    : "Type fixes directly into the code"}
                                            </span>
                                        </div>

                                        <div className="relative rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden focus-within:border-violet-500/80">
                                            <textarea
                                                rows={14}
                                                spellCheck={false}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                readOnly={isFinalSubmitted}
                                                value={codes[question._id] ?? ""}
                                                onChange={(e) => handleCodeChange(question._id, e.target.value)}
                                                onPaste={(e) => {
                                                    if (!isOrganizer) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onCopy={(e) => e.preventDefault()}
                                                onCut={(e) => e.preventDefault()}
                                                className={`w-full bg-transparent p-4 sm:p-5 font-mono text-xs sm:text-sm leading-6 outline-none resize-y selection:bg-violet-500/30 ${isFinalSubmitted
                                                    ? "text-slate-400 cursor-not-allowed bg-slate-950/80"
                                                    : "text-slate-200"
                                                    }`}
                                                placeholder={
                                                    isFinalSubmitted
                                                        ? "// Round finalized. Code editing is locked."
                                                        : "// Inspect and fix the bugs in this program..."
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Execution Result Box */}
                                    {result && (
                                        <div
                                            className={`mt-5 rounded-2xl border p-4 sm:p-5 text-sm ${isAccepted
                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                                : result.status === "pending"
                                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                                                    : "border-red-500/40 bg-red-500/10 text-red-200"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 font-bold mb-1">
                                                {isAccepted ? (
                                                    <CheckCircle2 size={18} className="text-emerald-400" />
                                                ) : (
                                                    <XCircle size={18} className="text-red-400" />
                                                )}
                                                <span className="uppercase tracking-wide">
                                                    Status: {result.status?.replace("_", " ") || "Evaluated"}
                                                </span>
                                                <span className="ml-auto text-xs font-mono">
                                                    Score: {result.score || 0} pts
                                                </span>
                                            </div>

                                            {result.judgeMessage && (
                                                <pre className="mt-2 rounded-xl bg-slate-950/80 p-3 font-mono text-xs overflow-x-auto text-slate-300 border border-slate-800/80 max-h-40">
                                                    {result.judgeMessage}
                                                </pre>
                                            )}
                                        </div>
                                    )}

                                    {/* Action Footer */}
                                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-5">
                                        <div className="text-xs text-slate-500">
                                            Phase 2 rules: Multi-bug programs evaluated via Judge0 test suite.
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isSubmitting || isAccepted || isFinalSubmitted}
                                            onClick={() => handleSubmit(question)}
                                            className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed ${isFinalSubmitted
                                                ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-75"
                                                : isAccepted
                                                    ? "bg-emerald-600/50 opacity-80"
                                                    : "bg-violet-600 hover:bg-violet-500 active:scale-95 shadow-lg shadow-violet-600/20"
                                                }`}
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <LoaderCircle size={16} className="animate-spin" />
                                                    Evaluating in Judge0...
                                                </>
                                            ) : isFinalSubmitted ? (
                                                <>
                                                    <Lock size={16} />
                                                    Round Finalized
                                                </>
                                            ) : isAccepted ? (
                                                <>
                                                    <CheckCircle2 size={16} />
                                                    All Bugs Resolved
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={16} />
                                                    Compile & Submit Solution
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

export default DebugArena;
