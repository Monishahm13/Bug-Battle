import React from "react";
import { ShieldAlert, X, CheckCircle2, AlertTriangle } from "lucide-react";

export default function RulesModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const rules = [
        "Strict Tab-Lock Proctoring: Do not switch tabs, minimize, or leave the contest window. Doing so will immediately auto-submit your test and permanently close the round.",
        "Only organizer-provided systems and software may be used.",
        "Mobile phones must be kept away during the competition.",
        "Internet, Google and online resources are strictly not allowed.",
        "ChatGPT, Gemini, Copilot and all AI/code-assistant tools are strictly prohibited.",
        "USB drives and external files are not allowed.",
        "Teams may communicate only within their own team (2–3 members).",
        "Any unfair practice may lead to immediate disqualification.",
        "Organizers' decision will be final in all matters."
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-red-500/10 p-2.5 text-red-400">
                            <ShieldAlert size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">BUG BATTLE 2026 Rules</h3>
                            <p className="text-xs text-slate-400">Official Competition & Anti-Cheat Guidelines</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-slate-700 hover:border-slate-500 p-2 text-slate-400 hover:text-white transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    {/* Event Motto Box */}
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-red-400">
                            Official Event Motto
                        </p>
                        <p className="mt-1 text-xl font-extrabold tracking-wide text-white">
                            NO AI. NO GOOGLE. JUST CODE.
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                            FIND IT. FIX IT. BEAT YOUR OPPONENT.
                        </p>
                    </div>

                    <div className="space-y-3 pt-2">
                        {rules.map((rule, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 text-sm text-slate-300"
                            >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                                    {idx + 1}
                                </span>
                                <span>{rule}</span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 text-xs text-amber-300">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
                        <div>
                            <strong className="font-semibold">Qualification Warning:</strong>
                            <p className="mt-0.5 text-slate-400">
                                Phase 1 (BUG SNAP) requires meeting the minimum qualifying score to unlock Phase 2 (DEBUG ARENA). Unfair practice results in permanent team disqualification.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 text-sm font-semibold transition"
                    >
                        I Understand the Rules
                    </button>
                </div>
            </div>
        </div>
    );
}
