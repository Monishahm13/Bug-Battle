import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    Bug,
    Code2,
    Plus,
    CheckCircle2,
    AlertCircle,
    LoaderCircle,
    Trash2,
    Sparkles,
    ShieldAlert
} from "lucide-react";
import { getAuthToken } from "../utils/auth";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

const initialForm = {
    eventId: "",
    title: "",
    description: "",
    language: "javascript",
    buggyCode: "",
    expectedOutput: "",
    difficulty: "easy",
    explanation: "",
    phase: "bug_snap",
    errorCount: 1,
    errorTypes: ["syntax"],
    isTieBreaker: false
};

const ERROR_TYPE_OPTIONS = [
    { id: "syntax", label: "Syntax" },
    { id: "logical", label: "Logical" },
    { id: "runtime", label: "Runtime" },
    { id: "loop", label: "Loop" },
    { id: "condition", label: "Condition" },
    { id: "function", label: "Function" },
    { id: "input_output", label: "Input / Output" }
];

function ManageQuestions() {
    const navigate = useNavigate();

    const [events, setEvents] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("");
    const [existingQuestions, setExistingQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [filterPhase, setFilterPhase] = useState("all");
    const [deleteStatus, setDeleteStatus] = useState({ id: null, message: "", type: "" });

    const fetchQuestions = async (eventId) => {
        if (!eventId) return;
        setLoadingQuestions(true);
        try {
            const token = getAuthToken();
            const res = await axios.get(`${API}/questions/event/${eventId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setExistingQuestions(res.data.questions || []);
        } catch (err) {
            console.warn("Failed to load questions:", err);
        } finally {
            setLoadingQuestions(false);
        }
    };

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const token = getAuthToken();

                const response = await axios.get(`${API}/events`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                const availableEvents = response.data.events || [];
                setEvents(availableEvents);

                const liveEvent = availableEvents.find(
                    (event) => event.status === "live"
                ) || availableEvents[0];

                if (liveEvent) {
                    setForm((previous) => ({
                        ...previous,
                        eventId: liveEvent._id,
                    }));
                    fetchQuestions(liveEvent._id);
                }
            } catch (error) {
                setMessage(
                    error.response?.data?.message ||
                    "Unable to load events. Please try again."
                );
                setMessageType("error");
            } finally {
                setLoadingEvents(false);
            }
        };

        fetchEvents();
    }, []);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;

        if (type === "checkbox") {
            setForm((prev) => ({
                ...prev,
                [name]: checked
            }));
            return;
        }

        setForm((previous) => {
            const updated = {
                ...previous,
                [name]: value,
            };

            // Auto-adjust default errorCount & difficulty if phase changes
            if (name === "phase") {
                if (value === "debug_arena") {
                    updated.errorCount = 10;
                    updated.difficulty = "hard";
                    updated.errorTypes = ["syntax", "logical", "loop", "runtime"];
                } else {
                    updated.errorCount = 1;
                    updated.difficulty = "easy";
                    updated.errorTypes = ["syntax"];
                }
            }

            return updated;
        });

        if (name === "eventId") {
            fetchQuestions(value);
        }
    };

    const toggleErrorType = (typeId) => {
        setForm((prev) => {
            const current = prev.errorTypes || [];
            const exists = current.includes(typeId);
            const next = exists
                ? current.filter((t) => t !== typeId)
                : [...current, typeId];
            return {
                ...prev,
                errorTypes: next
            };
        });
    };

    const handleDeleteQuestion = async (qId) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;

        setDeleteStatus({ id: qId, message: "Deleting question...", type: "info" });
        try {
            const token = getAuthToken();
            const res = await axios.delete(`${API}/questions/${qId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const msg = res.data.message || "Question deleted successfully!";
            setMessage(msg);
            setMessageType("success");
            setDeleteStatus({ id: null, message: msg, type: "success" });
            setExistingQuestions((prev) => prev.filter((q) => q._id !== qId));
            if (form.eventId) fetchQuestions(form.eventId);
        } catch (err) {
            const errMsg = err.response?.data?.message || "Failed to delete question";
            setMessage(errMsg);
            setMessageType("error");
            setDeleteStatus({ id: null, message: errMsg, type: "error" });
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage("");
        setMessageType("");

        if (!form.eventId) {
            setMessage("Please select an event.");
            setMessageType("error");
            return;
        }

        setSaving(true);

        try {
            const token = getAuthToken();

            const payload = {
                ...form,
                errorCount: Number(form.errorCount) || (form.phase === "debug_arena" ? 10 : 1)
            };

            const response = await axios.post(
                `${API}/questions`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            setMessage(
                `${response.data.message || "Question created successfully!"} (Phase: ${form.phase.replace("_", " ").toUpperCase()}, Points: ${response.data.question.points})`
            );
            setMessageType("success");

            setForm((previous) => ({
                ...initialForm,
                eventId: previous.eventId,
                phase: previous.phase
            }));

            fetchQuestions(form.eventId);
        } catch (error) {
            setMessage(
                error.response?.data?.message ||
                "Unable to create question. Please check your details."
            );
            setMessageType("error");
        } finally {
            setSaving(false);
        }
    };

    const inputClass =
        "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

    const labelClass =
        "mb-2 block text-sm font-medium text-slate-300";

    const filteredQuestions = existingQuestions.filter((q) => {
        if (filterPhase === "all") return true;
        if (filterPhase === "bug_snap") return !q.phase || q.phase === "bug_snap";
        return q.phase === filterPhase;
    });

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800 bg-slate-950/90 sticky top-0 z-20 backdrop-blur-md">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20">
                            <Bug size={22} />
                        </div>
                        <div>
                            <h1 className="font-bold text-base sm:text-lg">
                                BUG <span className="text-blue-400">BATTLE</span>
                            </h1>
                            <p className="text-xs text-slate-500">
                                Organizer Workspace · Question Management
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate("/debug-arena")}
                            className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs font-semibold text-violet-300 hover:border-violet-500/60 transition hidden sm:inline"
                        >
                            Preview Arena
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/dashboard")}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium transition hover:border-blue-500"
                        >
                            <ArrowLeft size={16} />
                            Dashboard
                        </button>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
                <div className="mb-8">
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                        <Code2 size={14} />
                        PHASE 1 & PHASE 2 CHALLENGE BUILDER
                    </div>

                    <h2 className="text-3xl font-extrabold sm:text-4xl text-white">
                        Create a Competition Challenge
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                        Configure questions for <strong>Phase 1 (BUG SNAP)</strong> (short 2-5 line snippets with fundamental errors) or <strong>Phase 2 (DEBUG ARENA)</strong> (complex programs with 10–15 intentional errors).
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-8 shadow-xl"
                >
                    {/* Event Select */}
                    <div>
                        <label htmlFor="eventId" className={labelClass}>
                            Select Event <span className="text-red-400">*</span>
                        </label>

                        {loadingEvents ? (
                            <p className="flex items-center gap-2 text-sm text-slate-400">
                                <LoaderCircle size={16} className="animate-spin" />
                                Loading events...
                            </p>
                        ) : (
                            <select
                                id="eventId"
                                name="eventId"
                                value={form.eventId}
                                onChange={handleChange}
                                required
                                className={inputClass}
                            >
                                <option value="">Select an event</option>
                                {events.map((event) => (
                                    <option key={event._id} value={event._id}>
                                        {event.name} — Phase: {event.phase} ({event.status})
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Phase Selector (Phase 1 vs Phase 2) */}
                    <div>
                        <label className={labelClass}>
                            Competition Phase <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label
                                className={`cursor-pointer rounded-xl border p-4 transition flex items-start gap-3 ${
                                    form.phase === "bug_snap"
                                        ? "border-blue-500 bg-blue-500/10 text-white"
                                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="phase"
                                    value="bug_snap"
                                    checked={form.phase === "bug_snap"}
                                    onChange={handleChange}
                                    className="mt-1"
                                />
                                <div>
                                    <p className="font-bold text-sm text-white">Phase 1: BUG SNAP</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Short snippets (approx 2–5 lines), single simple bug. Evaluates fundamentals.
                                    </p>
                                </div>
                            </label>

                            <label
                                className={`cursor-pointer rounded-xl border p-4 transition flex items-start gap-3 ${
                                    form.phase === "debug_arena"
                                        ? "border-violet-500 bg-violet-500/10 text-white"
                                        : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="phase"
                                    value="debug_arena"
                                    checked={form.phase === "debug_arena"}
                                    onChange={handleChange}
                                    className="mt-1"
                                />
                                <div>
                                    <p className="font-bold text-sm text-white">Phase 2: DEBUG ARENA</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Complex program with 10–15 intentional bugs. For qualified teams only.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Question Title */}
                    <div>
                        <label htmlFor="title" className={labelClass}>
                            Question Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            id="title"
                            name="title"
                            value={form.title}
                            onChange={handleChange}
                            minLength={3}
                            maxLength={150}
                            required
                            placeholder={
                                form.phase === "debug_arena"
                                    ? "Example: Multi-Threaded Order Processing Engine"
                                    : "Example: Fix the loop addition bug"
                            }
                            className={inputClass}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className={labelClass}>
                            Question Description <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            rows={3}
                            maxLength={1000}
                            required
                            placeholder="Explain the program objective and what errors to inspect."
                            className={inputClass}
                        />
                    </div>

                    {/* Language & Difficulty & Points */}
                    <div className="grid gap-6 sm:grid-cols-3">
                        <div>
                            <label htmlFor="language" className={labelClass}>
                                Language <span className="text-red-400">*</span>
                            </label>
                            <select
                                id="language"
                                name="language"
                                value={form.language}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="cpp">C++</option>
                                <option value="c">C</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="difficulty" className={labelClass}>
                                Difficulty & Points <span className="text-red-400">*</span>
                            </label>
                            <select
                                id="difficulty"
                                name="difficulty"
                                value={form.difficulty}
                                onChange={handleChange}
                                className={inputClass}
                            >
                                <option value="easy">Easy — 5 points (Syntax/Basic)</option>
                                <option value="medium">Medium — 10 points (Logical/Loop)</option>
                                <option value="hard">Hard — 15 points (Runtime/Algorithm)</option>
                                <option value="extreme">Extreme — 20 points (Multi Hidden Bugs)</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="errorCount" className={labelClass}>
                                Intentional Errors Count
                            </label>
                            <input
                                id="errorCount"
                                name="errorCount"
                                type="number"
                                min={1}
                                max={25}
                                value={form.errorCount}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="1 for Phase 1, 10-15 for Phase 2"
                            />
                        </div>
                    </div>

                    {/* Error Types Checklist (PDF section 3 & 4) */}
                    <div>
                        <label className={labelClass}>
                            Error Categories in this Program (as per Roadmap)
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {ERROR_TYPE_OPTIONS.map((opt) => {
                                const selected = form.errorTypes.includes(opt.id);
                                return (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => toggleErrorType(opt.id)}
                                        className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition border ${
                                            selected
                                                ? "bg-violet-600 border-violet-500 text-white"
                                                : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                                        }`}
                                    >
                                        {selected ? "✓ " : "+ "} {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Buggy Code Textarea */}
                    <div>
                        <label htmlFor="buggyCode" className={labelClass}>
                            Buggy Source Code <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="buggyCode"
                            name="buggyCode"
                            value={form.buggyCode}
                            onChange={handleChange}
                            rows={form.phase === "debug_arena" ? 14 : 7}
                            required
                            spellCheck={false}
                            placeholder="// Paste the code containing the bugs here..."
                            className={`${inputClass} font-mono leading-6 text-xs sm:text-sm`}
                        />
                    </div>

                    {/* Expected Output */}
                    <div>
                        <label htmlFor="expectedOutput" className={labelClass}>
                            Expected Output (Standard Output) <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="expectedOutput"
                            name="expectedOutput"
                            value={form.expectedOutput}
                            onChange={handleChange}
                            rows={3}
                            required
                            spellCheck={false}
                            placeholder="Enter the exact standard output expected after bugs are fixed..."
                            className={`${inputClass} font-mono`}
                        />
                    </div>

                    {/* Explanation */}
                    <div>
                        <label htmlFor="explanation" className={labelClass}>
                            Organizer Solution Explanation (Internal Only)
                        </label>
                        <textarea
                            id="explanation"
                            name="explanation"
                            value={form.explanation}
                            onChange={handleChange}
                            rows={3}
                            maxLength={2000}
                            placeholder="Explain where the bugs were located and how to solve them..."
                            className={inputClass}
                        />
                    </div>

                    {/* Tie-breaker checkbox */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
                        <input
                            id="isTieBreaker"
                            name="isTieBreaker"
                            type="checkbox"
                            checked={form.isTieBreaker}
                            onChange={handleChange}
                            className="h-4 w-4 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="isTieBreaker" className="text-xs text-amber-200 cursor-pointer">
                            <strong className="font-bold">Mark as Tie-Breaker Question:</strong> In case of a tie between top teams, organizers may use this challenge to resolve the winner (PDF Section 5).
                        </label>
                    </div>

                    {message && (
                        <div
                            role="status"
                            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                                messageType === "success"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : "border-red-500/30 bg-red-500/10 text-red-300"
                            }`}
                        >
                            {messageType === "success" ? (
                                <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
                            ) : (
                                <AlertCircle size={19} className="mt-0.5 shrink-0" />
                            )}
                            <span>{message}</span>
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-800 pt-6 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={() => navigate("/dashboard")}
                            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold transition hover:border-slate-500"
                        >
                            Back to Dashboard
                        </button>

                        <button
                            type="submit"
                            disabled={saving || loadingEvents || events.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-white"
                        >
                            {saving ? (
                                <LoaderCircle size={17} className="animate-spin" />
                            ) : (
                                <Plus size={18} />
                            )}
                            {saving ? "Creating challenge..." : "Publish Challenge"}
                        </button>
                    </div>
                </form>

                {/* Existing Questions List */}
                <div className="mt-14">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-white">Published Questions ({filteredQuestions.length})</h3>
                            <p className="text-xs text-slate-400">Review, filter, or remove challenges for this event</p>
                        </div>

                        <div className="flex items-center gap-2">
                            {["all", "bug_snap", "debug_arena"].map((ph) => (
                                <button
                                    key={ph}
                                    type="button"
                                    onClick={() => setFilterPhase(ph)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
                                        filterPhase === ph
                                            ? "bg-blue-600 border-blue-500 text-white"
                                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                    }`}
                                >
                                    {ph === "all" ? "All Phases" : ph === "bug_snap" ? "Phase 1: Bug Snap" : "Phase 2: Arena"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {deleteStatus.message && (
                        <div
                            className={`mb-4 flex items-center justify-between rounded-xl border p-3.5 text-xs sm:text-sm animate-fadeIn ${
                                deleteStatus.type === "success"
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : deleteStatus.type === "info"
                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                    : "border-red-500/30 bg-red-500/10 text-red-300"
                            }`}
                        >
                            <span>{deleteStatus.message}</span>
                            <button
                                type="button"
                                onClick={() => setDeleteStatus({ id: null, message: "", type: "" })}
                                className="text-slate-400 hover:text-white font-bold ml-2 text-xs"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {loadingQuestions ? (
                        <div className="text-center py-10 text-slate-500">
                            <LoaderCircle size={20} className="animate-spin mx-auto mb-2" />
                            Loading challenges...
                        </div>
                    ) : filteredQuestions.length === 0 ? (
                        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400 text-sm">
                            No challenges found for this filter.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredQuestions.map((q) => (
                                <div
                                    key={q._id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700"
                                >
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                                                q.phase === "debug_arena"
                                                    ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                            }`}>
                                                {q.phase === "debug_arena" ? "Phase 2: Arena" : "Phase 1: Bug Snap"}
                                            </span>
                                            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 uppercase">
                                                {q.language}
                                            </span>
                                            <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
                                                {q.points} pts ({q.difficulty})
                                            </span>
                                            {q.isTieBreaker && (
                                                <span className="rounded-md bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                                    ⚡ Tie-Breaker
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-white text-sm">{q.title}</h4>
                                        <p className="text-xs text-slate-400 line-clamp-1">{q.description}</p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={deleteStatus.id === q._id}
                                        onClick={() => handleDeleteQuestion(q._id)}
                                        className="shrink-0 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-red-400 hover:bg-red-500/20 hover:border-red-500/60 transition disabled:opacity-50"
                                        title="Delete Question"
                                    >
                                        {deleteStatus.id === q._id ? (
                                            <LoaderCircle size={16} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export default ManageQuestions;
