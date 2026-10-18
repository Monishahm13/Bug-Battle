
import { useEffect, useState } from "react";
import axios from "axios";
import {
    ArrowLeft,
    History,
    CheckCircle2,
    XCircle,
    Clock3,
    AlertTriangle,
    LoaderCircle,
    Code2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAuthToken } from "../utils/auth";
import { API_BASE_URL } from "../config/api";

function SubmissionHistory() {
    const navigate = useNavigate();

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState("");

    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
                const token = getAuthToken();

                const response = await axios.get(
                    `${API_BASE_URL}/submissions/my`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                setSubmissions(response.data.submissions || []);
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                    "Unable to load submission history."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchSubmissions();
    }, []);


    const fetchSubmissionDetails = async (submissionId) => {
        setDetailsLoading(true);
        setDetailsError("");
        setSelectedSubmission(null);

        try {
            const token = getAuthToken();

            const response = await axios.get(
                `${API_BASE_URL}/submissions/${submissionId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setSelectedSubmission(response.data.submission);
        } catch (err) {
            setDetailsError(
                err.response?.data?.message ||
                "Unable to load submission details."
            );
        } finally {
            setDetailsLoading(false);
        }
    };


    const getStatusStyle = (status) => {
        switch (status) {
            case "accepted":
                return {
                    label: "Accepted",
                    className:
                        "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                    icon: CheckCircle2
                };

            case "wrong_answer":
                return {
                    label: "Wrong Answer",
                    className:
                        "border border-red-500/30 bg-red-500/10 text-red-400",
                    icon: XCircle
                };

            case "pending":
                return {
                    label: "Pending",
                    className:
                        "border border-amber-500/30 bg-amber-500/10 text-amber-400",
                    icon: Clock3
                };

            default:
                return {
                    label: (status || "Unknown")
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (letter) =>
                            letter.toUpperCase()
                        ),
                    className:
                        "border border-slate-500/30 bg-slate-500/10 text-slate-300",
                    icon: AlertTriangle
                };
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
            <div className="mx-auto max-w-6xl">
                <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <div className="mb-8 flex flex-wrap items-center gap-4">
                    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
                        <History size={30} className="text-violet-400" />
                    </div>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Submission History
                        </h1>
                        <p className="mt-2 text-slate-400">
                            Review your previous BUG SNAP attempts.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex min-h-64 items-center justify-center gap-3 text-slate-400">
                        <LoaderCircle className="animate-spin" size={22} />
                        Loading submissions...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-red-300">
                        {error}
                    </div>
                ) : submissions.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-center">
                        <Code2
                            size={42}
                            className="mx-auto mb-4 text-slate-500"
                        />
                        <h2 className="text-xl font-semibold">
                            No submissions yet
                        </h2>
                        <p className="mt-2 text-slate-400">
                            Your coding attempts will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-5 grid gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                                <p className="text-sm text-slate-400">
                                    Total Attempts
                                </p>
                                <p className="mt-2 text-3xl font-bold">
                                    {submissions.length}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                                <p className="text-sm text-slate-400">
                                    Accepted
                                </p>
                                <p className="mt-2 text-3xl font-bold text-emerald-400">
                                    {submissions.filter(
                                        (item) => item.status === "accepted"
                                    ).length}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                                <p className="text-sm text-slate-400">
                                    Total Points Earned
                                </p>
                                <p className="mt-2 text-3xl font-bold text-violet-400">
                                    {submissions.reduce(
                                        (total, item) =>
                                            total + (Number(item.score) || 0),
                                        0
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                            <div className="border-b border-slate-800 px-5 py-4">
                                <h2 className="font-semibold">
                                    Recent Attempts
                                </h2>
                            </div>

                            <div className="divide-y divide-slate-800">
                                {submissions.map((submission) => {
                                    const status = getStatusStyle(
                                        submission.status
                                    );
                                    const StatusIcon = status.icon;

                                    return (
                                        <div
                                            key={submission._id}
                                            className="flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="min-w-0">
                                                <h3 className="truncate font-semibold">
                                                    {submission.question?.title ||
                                                        "Coding Challenge"}
                                                </h3>

                                                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                                                    <span className="capitalize">
                                                        {submission.language}
                                                    </span>

                                                    <span>
                                                        {submission.createdAt
                                                            ? new Date(
                                                                submission.createdAt
                                                            ).toLocaleString()
                                                            : "Time unavailable"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-3">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                                                >
                                                    <StatusIcon size={14} />
                                                    {status.label}
                                                </span>

                                                <span className="min-w-16 text-right font-bold text-violet-300">
                                                    {Number(submission.score) || 0} pts
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default SubmissionHistory;
