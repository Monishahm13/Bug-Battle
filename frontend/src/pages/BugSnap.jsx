import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Bug,
    LoaderCircle,
    Play,
    CheckCircle2,
    XCircle,
    Clock3,
    Lock,
    ShieldCheck,
    Terminal,
    Sparkles,
    AlertTriangle,
    Cpu
} from "lucide-react";
import RoundTimer from "../components/RoundTimer";
import ProctoredCodeViewer from "../components/ProctoredCodeViewer";
import { getAuthToken } from "../utils/auth";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

function BugSnap() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [activeEvent, setActiveEvent] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [codes, setCodes] = useState({});
    const [loading, setLoading] = useState(true);
    const [submittingId, setSubmittingId] = useState(null);
    const [testingId, setTestingId] = useState(null);
    const [results, setResults] = useState({});
    const [error, setError] = useState("");
    const [submissionHistory, setSubmissionHistory] = useState([]);

    // Timer & finality states
    const [isFinalSubmitted, setIsFinalSubmitted] = useState(false);
    const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
    const [autoSubmitStatus, setAutoSubmitStatus] = useState("");

    // Refs to access latest codes & results in callbacks without stale closures
    const codesRef = useRef(codes);
    codesRef.current = codes;
    const resultsRef = useRef(results);
    resultsRef.current = results;
    const questionsRef = useRef(questions);
    questionsRef.current = questions;

    useEffect(() => {
        const fetchQuestionsAndStatus = async () => {
            const token = getAuthToken();

            if (!token) {
                navigate("/login");
                return;
            }

            try {
                // 1. Fetch current user
                let currentUser = null;
                try {
                    const userRes = await axios.get(`${API}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    currentUser = userRes.data.user || userRes.data;
                    setUser(currentUser);
                } catch (e) {
                    console.warn("Could not fetch user info:", e);
                }

                // 2. Fetch live event
                const eventResponse = await axios.get(
                    `${API}/events`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const events = eventResponse.data.events || [];
                const isUserOrganizer = currentUser?.role === "organizer";

                const currentActiveEvent = events.find(
                    (event) =>
                        event.status === "live" &&
                        (event.phase === "bug_snap" || Boolean(event.roundControl?.bug_snap?.isStarted))
                ) || (isUserOrganizer ? (events.find((e) => e.status === "live") || events[0]) : null);

                if (!currentActiveEvent) {
                    setError("There is no live BUG SNAP event right now. Please wait for the organizer to launch the round.");
                    return;
                }

                setActiveEvent(currentActiveEvent);

                // Check if final submission already completed (participants only; organizers can always test)
                if (!isUserOrganizer) {
                    const currentUserId = currentUser?._id || currentUser?.id || "";
                    const localKey = `bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${currentActiveEvent._id}_bug_snap`;
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
                        const timerRes = await axios.get(`${API}/teams/timer/bug_snap`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (timerRes.data?.timer?.isSubmitted) {
                            setIsFinalSubmitted(true);
                        }
                    } catch { }
                }

                // 3. Fetch questions
                const questionResponse = await axios.get(
                    `${API}/questions/event/${currentActiveEvent._id}?phase=bug_snap`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                const rawQuestions = questionResponse.data.questions || [];
                const loadedQuestions = rawQuestions.filter(
                    (q) => !q.phase || q.phase === "bug_snap"
                );

                setQuestions(loadedQuestions);

                const initialCodes = {};
                loadedQuestions.forEach((question) => {
                    initialCodes[question._id] = question.buggyCode;
                });

                setCodes(initialCodes);
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                    "Unable to load challenges. Please try again."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchQuestionsAndStatus();
    }, [navigate]);

    const fetchSubmissionHistory = useCallback(async () => {
        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await axios.get(
                `${API}/submissions/my`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const subs = response.data.submissions || response.data || [];
            setSubmissionHistory(subs);

            // Populate accepted questions in results
            const acceptedResults = {};
            subs.forEach((s) => {
                if (s.status === "accepted" && s.question?._id) {
                    acceptedResults[s.question._id] = {
                        status: "accepted",
                        score: s.score,
                        executionTime: s.executionTime,
                        message: s.judgeMessage || "Accepted",
                        compileOutput: s.compileOutput || "",
                        stdout: s.stdout || "",
                        submission: s
                    };
                }
            });
            setResults((prev) => ({ ...prev, ...acceptedResults }));
        } catch (error) {
            console.error("Failed to fetch submission history:", error);
        }
    }, []);

    useEffect(() => {
        fetchSubmissionHistory();
    }, [fetchSubmissionHistory]);

    // Test run code through the respective compiler without saving final submission
    const handleRunTest = async (question) => {
        if (isFinalSubmitted) {
            alert("This round has concluded and testing is locked.");
            return;
        }

        const token = getAuthToken();
        if (!token) {
            navigate("/login");
            return;
        }

        const code = codes[question._id] || "";
        if (!code.trim()) {
            setResults((previous) => ({
                ...previous,
                [question._id]: {
                    status: "error",
                    message: "Please enter your code before running test.",
                },
            }));
            return;
        }

        setTestingId(question._id);

        try {
            const response = await axios.post(
                `${API}/submissions/run`,
                {
                    questionId: question._id,
                    language: question.language,
                    code,
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const data = response.data;
            setResults((previous) => ({
                ...previous,
                [question._id]: {
                    status: data.status,
                    score: data.isMatch ? question.points : 0,
                    executionTime: data.executionTime,
                    message: data.judgeMessage,
                    compileOutput: data.compileOutput || "",
                    stdout: data.stdout || "",
                    isTestRun: true
                }
            }));
        } catch (err) {
            setResults((previous) => ({
                ...previous,
                [question._id]: {
                    status: "error",
                    message: err.response?.data?.message || "Compiler test failed. Please try again.",
                    compileOutput: err.response?.data?.compileOutput || "",
                    stdout: "",
                    isTestRun: true
                }
            }));
        } finally {
            setTestingId(null);
        }
    };

    // Manual single question submit
    const handleSubmit = async (question) => {
        if (isFinalSubmitted) {
            alert("This round has concluded and final submissions are locked.");
            return;
        }

        const token = getAuthToken();

        if (!token) {
            navigate("/login");
            return;
        }

        const code = codes[question._id] || "";

        if (!code.trim()) {
            setResults((previous) => ({
                ...previous,
                [question._id]: {
                    status: "error",
                    message: "Please enter your solution before submitting.",
                },
            }));
            return;
        }

        setSubmittingId(question._id);

        try {
            const response = await axios.post(
                `${API}/submissions`,
                {
                    questionId: question._id,
                    language: question.language,
                    code,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const submission = response.data.submission;
            setSubmissionHistory((previous) => [
                submission,
                ...previous,
            ]);

            setResults((previous) => ({
                ...previous,
                [question._id]: {
                    status: submission.status,
                    score: submission.score,
                    executionTime: submission.executionTime,
                    message:
                        submission.judgeMessage ||
                        response.data.message ||
                        "Submission processed.",
                    compileOutput: submission.compileOutput || "",
                    stdout: submission.stdout || "",
                    isTestRun: false
                },
            }));
        } catch (err) {
            setResults((previous) => ({
                ...previous,
                [question._id]: {
                    status: "error",
                    message:
                        err.response?.data?.message ||
                        "Unable to submit your solution. Please try again.",
                },
            }));
        } finally {
            setSubmittingId(null);
        }
    };

    // Automatic submission of all questions when 20 min timer ends or early final submit
    const handleAutoSubmitAll = useCallback(async () => {
        const token = getAuthToken();
        if (!token) return;

        setIsAutoSubmitting(true);
        const currentQuestions = questionsRef.current;
        const currentCodes = codesRef.current;
        const currentResults = resultsRef.current;

        for (let i = 0; i < currentQuestions.length; i++) {
            const question = currentQuestions[i];

            // If already solved and accepted, skip to prevent overwriting
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
                        code: codeToSubmit,
                    },
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const submission = response.data.submission;
                if (submission) {
                    setResults((prev) => ({
                        ...prev,
                        [question._id]: {
                            status: submission.status,
                            score: submission.score,
                            executionTime: submission.executionTime,
                            message:
                                submission.judgeMessage ||
                                response.data.message ||
                                "Auto-submission processed.",
                        },
                    }));
                }
            } catch (err) {
                console.warn(`Auto-submit error for question ${question._id}:`, err);
                setResults((prev) => ({
                    ...prev,
                    [question._id]: {
                        status: "system_error",
                        score: 0,
                        message:
                            err.response?.data?.message ||
                            "Final auto-submission processed.",
                    },
                }));
            }
        }

        setAutoSubmitStatus("Finalizing round records...");

        // Refresh submission history
        await fetchSubmissionHistory();

        // Mark final in server team timer
        try {
            await axios.post(
                `${API}/teams/timer/finish`,
                { phase: "bug_snap" },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) {
            console.warn("Could not mark server timer finished:", e);
        }

        // Mark final in scoped tab/storage
        if (activeEvent?._id) {
            const currentUserId = user?._id || user?.id || "";
            const localKey = `bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${activeEvent._id}_bug_snap`;
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
    }, [activeEvent, fetchSubmissionHistory, user]);

    // Organizer reset timer handler
    const handleResetTimer = async () => {
        const token = getAuthToken();
        if (!token) return;

        if (activeEvent?._id) {
            const currentUserId = user?._id || user?.id || "";
            sessionStorage.removeItem(`bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${activeEvent._id}_bug_snap`);
            localStorage.removeItem(`bugbattle_timer_${currentUserId ? currentUserId + "_" : ""}${activeEvent._id}_bug_snap`);
            localStorage.removeItem(`bugbattle_timer_${activeEvent._id}_bug_snap`);
        }

        try {
            await axios.post(
                `${API}/teams/timer/reset`,
                { phase: "bug_snap" },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (e) {
            console.warn("Failed to reset server timer:", e);
        }

        setIsFinalSubmitted(false);
        window.location.reload();
    };

    const getCompilerBadge = (lang) => {
        const l = (lang || "").toLowerCase().trim();
        if (l === "c") return { label: "C", tag: "GCC 13.3", icon: "⚙️" };
        if (l === "cpp" || l === "c++") return { label: "C++", tag: "G++ 13.3", icon: "⚡" };
        if (l === "python" || l === "py") return { label: "Python", tag: "Python 3", icon: "🐍" };
        if (l === "java") return { label: "Java", tag: "OpenJDK 21", icon: "☕" };
        if (l === "javascript" || l === "js") return { label: "JavaScript", tag: "Node.js 22", icon: "🌐" };
        return { label: lang, tag: "Native Compiler", icon: "💻" };
    };

    const getStatusStyle = (status) => {
        if (status === "accepted") {
            return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
        }

        if (status === "wrong_answer") {
            return "border-red-500/40 bg-red-500/15 text-red-300";
        }

        if (status === "compile_error") {
            return "border-rose-500/30 bg-rose-500/10 text-rose-300";
        }

        if (status === "time_limit") {
            return "border-orange-500/30 bg-orange-500/10 text-orange-300";
        }

        if (status === "runtime_error" || status === "error" || status === "system_error") {
            return "border-red-500/30 bg-red-500/10 text-red-300";
        }

        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    };

    const isOrganizer = user?.role === "organizer";

    return (
        <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8">
            <div className="mx-auto max-w-6xl">
                {/* Back Link */}
                <button
                    onClick={() => navigate("/dashboard")}
                    className="mb-6 inline-flex items-center gap-2 text-sm text-blue-400 transition hover:text-blue-300"
                >
                    <ArrowLeft size={18} />
                    Back to dashboard
                </button>

                {/* Page Title Header */}
                <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-400 shadow-lg shadow-blue-500/10">
                            <Bug size={30} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                                    BUG SNAP
                                </h1>
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-0.5 text-xs font-bold text-blue-400">
                                    PHASE 1 • 20 MIN
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-400">
                                Find the bug, fix the code, and submit your solution before time runs out.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 20 Minute Countdown HUD Timer */}
                {!loading && questions.length > 0 && (
                    <RoundTimer
                        phase="bug_snap"
                        phaseName="BUG SNAP"
                        durationMinutes={activeEvent?.roundControl?.bug_snap?.durationMinutes || 20}
                        eventId={activeEvent?._id || "active"}
                        userId={user?._id || user?.id || ""}
                        userName={user?.name || user?.email || ""}
                        isRoundStarted={isOrganizer ? true : Boolean(activeEvent?.roundControl?.bug_snap?.isStarted || activeEvent?.phase === "bug_snap")}
                        serverStartedAt={activeEvent?.roundControl?.bug_snap?.startedAt}
                        serverEndsAt={activeEvent?.roundControl?.bug_snap?.endsAt}
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
                                    A team member or captain has submitted BUG SNAP for your team. All solutions are permanently recorded and locked. No team member can restart or resubmit this challenge.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Questions Body */}
                {loading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <LoaderCircle className="animate-spin mr-3 text-blue-400" size={24} />
                        Loading challenges and starting timer...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">
                        {error}
                    </div>
                ) : questions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-slate-400 text-center">
                        No active questions are available for this event yet.
                    </div>
                ) : (
                    <div className="space-y-8">
                        {questions.map((question, index) => {
                            const result = results[question._id];
                            const isSubmitting = submittingId === question._id;
                            const isTesting = testingId === question._id;
                            const isAccepted = result?.status === "accepted";
                            const compilerInfo = getCompilerBadge(question.language);

                            return (
                                <article
                                    key={question._id}
                                    className={`overflow-hidden rounded-3xl border transition-all ${isAccepted
                                        ? "border-emerald-500/40 bg-emerald-950/10"
                                        : "border-slate-800 bg-slate-900/60"
                                        } shadow-xl shadow-black/10`}
                                >
                                    <div className="border-b border-slate-800 p-6 sm:p-8">
                                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <span className="rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-400">
                                                    CHALLENGE {index + 1}
                                                </span>
                                                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">
                                                    {question.difficulty}
                                                </span>
                                                {isAccepted && (
                                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                                                        ✓ Right Answer (Solved)
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300">
                                                {isAccepted ? "1/1 Solved" : "1 Bug"}
                                            </span>
                                        </div>

                                        <h2 className="text-2xl font-bold">
                                            {question.title}
                                        </h2>

                                        <p className="mt-3 leading-7 text-slate-400 select-none">
                                            {question.description}
                                        </p>
                                    </div>

                                    <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
                                        <section className="select-none">
                                            <div className="mb-3 flex items-center justify-between">
                                                <h3 className="text-sm font-semibold text-slate-200">
                                                    Buggy code (Protected View)
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-855 px-2.5 py-1 text-xs font-medium text-slate-300">
                                                        <span>{compilerInfo.icon}</span>
                                                        <span className="font-mono">{compilerInfo.tag}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            <ProctoredCodeViewer
                                                code={question.buggyCode}
                                                language={question.language}
                                                minHeight={240}
                                            />

                                            <p className="mt-3 text-xs leading-5 text-slate-500">
                                                Identify the error in the code and write your corrected version in the editor.
                                            </p>
                                        </section>

                                        <section>
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-semibold text-slate-200">
                                                        Your solution
                                                    </h3>
                                                    <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
                                                        <span>{compilerInfo.icon}</span>
                                                        <span>{compilerInfo.tag}</span>
                                                    </span>
                                                </div>
                                                <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-400 uppercase font-mono font-semibold">
                                                    {question.language}
                                                </span>
                                            </div>

                                            <textarea
                                                value={codes[question._id] || ""}
                                                readOnly={isFinalSubmitted}
                                                onChange={(event) => {
                                                    if (isFinalSubmitted) return;
                                                    setCodes((previous) => ({
                                                        ...previous,
                                                        [question._id]: event.target.value,
                                                    }));
                                                }}
                                                onPaste={(e) => {
                                                    if (!isOrganizer) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onCopy={(e) => e.preventDefault()}
                                                onCut={(e) => e.preventDefault()}
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                spellCheck={false}
                                                aria-label={`Code editor for ${question.title}`}
                                                className={`min-h-64 w-full resize-y rounded-xl border font-mono text-sm leading-6 p-4 outline-none transition ${isFinalSubmitted
                                                    ? "border-slate-800 bg-slate-950/80 text-slate-400 cursor-not-allowed"
                                                    : "border-slate-700 bg-slate-950 text-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                                    }`}
                                                placeholder={
                                                    isFinalSubmitted
                                                        ? "Round ended. Submissions are finalized."
                                                        : "Write your corrected code here..."
                                                }
                                            />

                                            {/* Action Buttons: Test Code & Submit Solution */}
                                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRunTest(question)}
                                                    disabled={isTesting || isSubmitting || isFinalSubmitted}
                                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-850 hover:bg-slate-800 hover:border-slate-600 px-4 py-3 text-sm font-semibold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {isTesting ? (
                                                        <>
                                                            <LoaderCircle size={16} className="animate-spin text-blue-400" />
                                                            Compiling & Testing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Terminal size={16} className="text-blue-400" />
                                                            Test Code ({compilerInfo.tag})
                                                        </>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => handleSubmit(question)}
                                                    disabled={isSubmitting || isTesting || isFinalSubmitted || isAccepted}
                                                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed ${isFinalSubmitted
                                                        ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-75"
                                                        : isAccepted
                                                            ? "bg-emerald-600/40 text-emerald-300 cursor-not-allowed"
                                                            : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95"
                                                        }`}
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <LoaderCircle
                                                                size={16}
                                                                className="animate-spin"
                                                            />
                                                            Evaluating with Compiler...
                                                        </>
                                                    ) : isFinalSubmitted ? (
                                                        <>
                                                            <Lock size={16} />
                                                            Round Finalized
                                                        </>
                                                    ) : isAccepted ? (
                                                        <>
                                                            <CheckCircle2 size={16} />
                                                            Right Answer (Solved)
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play size={16} />
                                                            Submit solution
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </section>
                                    </div>

                                    {/* Evaluation Result & Compiler Output Terminal */}
                                    {result && (
                                        <div className="border-t border-slate-800 p-6 sm:px-8">
                                            <div
                                                className={`rounded-2xl border p-5 ${getStatusStyle(result.status)}`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2.5 font-semibold">
                                                        {result.status === "accepted" ? (
                                                            <>
                                                                <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                                                                <span className="font-extrabold text-emerald-300 text-sm sm:text-base tracking-wide">
                                                                    ✓ RIGHT ANSWER (CORRECT)
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <XCircle size={22} className="text-red-400 shrink-0" />
                                                                <span className="font-extrabold text-red-300 text-sm sm:text-base tracking-wide">
                                                                    ✗ WRONG ANSWER (INCORRECT)
                                                                </span>
                                                            </>
                                                        )}
                                                        {result.isTestRun && (
                                                            <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                                                Test Run Only
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {!result.isTestRun && (
                                                            <span className={`font-bold text-xs uppercase tracking-wider px-2 py-0.5 rounded ${result.status === "accepted" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                                                {result.status === "accepted" ? "1/1 Debugged" : "0/1 Debugged"}
                                                            </span>
                                                        )}
                                                        {result.executionTime != null && (
                                                            <span className="flex items-center gap-1.5 text-xs opacity-75 font-mono">
                                                                <Clock3 size={13} />
                                                                {result.executionTime}s
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="mt-2.5 wrap-break-words text-sm leading-6 opacity-95 font-medium">
                                                    {result.message}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* Submission History */}
                <section className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white">
                            Submission History
                        </h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Review your evaluations and recorded scores for this tournament.
                        </p>
                    </div>

                    {submissionHistory.length === 0 ? (
                        <p className="text-sm text-slate-400">
                            No previous submissions found.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {submissionHistory.map((submission) => (
                                <div
                                    key={submission._id}
                                    className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center"
                                >
                                    <div>
                                        <p className="font-medium text-white">
                                            {submission.question?.title || "Bug Snap Challenge"}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {submission.createdAt
                                                ? new Date(submission.createdAt).toLocaleString()
                                                : "Submission date unavailable"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getStatusStyle(
                                                submission.status
                                            )}`}
                                        >
                                            {submission.status?.replaceAll("_", " ") || "Unknown"}
                                        </span>

                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${submission.status === "accepted" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400"}`}>
                                            {submission.status === "accepted" ? "1/1 Solved" : "0/1 Solved"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}

export default BugSnap;
