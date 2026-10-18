import React, { useRef } from "react";
import { Award, Trophy, X, Printer, ShieldCheck, Sparkles } from "lucide-react";

export default function CertificateModal({
    isOpen,
    onClose,
    teamName = "Participant Team",
    participantName = "",
    rank = 0,
    score = 0,
    eventName = "BUG BATTLE 2026",
    isMerit = false,
    prizeTitle = "Participant"
}) {
    const certificateRef = useRef(null);

    if (!isOpen) return null;

    const isWinner = rank === 1;
    const isRunnerUp = rank === 2;
    const isSecondRunnerUp = rank === 3;

    const certTitle = isWinner
        ? "CERTIFICATE OF EXCELLENCE"
        : isRunnerUp || isSecondRunnerUp
        ? "CERTIFICATE OF MERIT"
        : "CERTIFICATE OF PARTICIPATION";

    const badgeLabel = isWinner
        ? "BUG SLAYER 2026 — 1ST PLACE"
        : isRunnerUp
        ? "1ST RUNNER-UP"
        : isSecondRunnerUp
        ? "2ND RUNNER-UP"
        : "OFFICIAL PARTICIPANT";

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-4xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8">
                {/* Header Controls */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 print:hidden">
                    <div className="flex items-center gap-2">
                        <Award className="text-amber-400" size={24} />
                        <h3 className="text-lg font-bold text-white">Official Event Certificate</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-sm font-semibold transition"
                        >
                            <Printer size={16} />
                            Print / Save PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded-xl border border-slate-700 hover:border-slate-500 p-2 text-slate-400 hover:text-white transition"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Printable Certificate Frame */}
                <div
                    ref={certificateRef}
                    className={`mt-6 relative overflow-hidden rounded-xl p-8 sm:p-12 text-center border-4 ${
                        isWinner
                            ? "border-amber-400/80 bg-linear-to-b from-amber-950/30 via-slate-950 to-slate-950 text-amber-100"
                            : isRunnerUp
                            ? "border-slate-300/80 bg-linear-to-b from-slate-800/40 via-slate-950 to-slate-950 text-slate-100"
                            : isSecondRunnerUp
                            ? "border-amber-700/80 bg-linear-to-b from-amber-950/20 via-slate-950 to-slate-950 text-amber-200"
                            : "border-blue-500/50 bg-linear-to-b from-blue-950/20 via-slate-950 to-slate-950 text-slate-100"
                    } shadow-2xl print:border-4 print:m-0 print:p-8`}
                >
                    {/* Decorative Corner Ornaments */}
                    <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-amber-400/60" />
                    <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-amber-400/60" />
                    <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-amber-400/60" />
                    <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-amber-400/60" />

                    {/* Logo & Event Title */}
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-amber-300 uppercase">
                        <Sparkles size={14} />
                        {eventName}
                        <Sparkles size={14} />
                    </div>

                    <h1 className="text-3xl sm:text-5xl font-black tracking-wider uppercase text-white font-serif">
                        {certTitle}
                    </h1>

                    <p className="mt-2 text-xs sm:text-sm tracking-widest uppercase text-slate-400">
                        FIND IT. FIX IT. BEAT YOUR OPPONENT. • NO AI. NO GOOGLE. JUST CODE.
                    </p>

                    <div className="my-6 mx-auto w-32 h-0.5 bg-linear-to-r from-transparent via-amber-400 to-transparent" />

                    <p className="text-sm sm:text-base text-slate-300">
                        This is proudly presented to
                    </p>

                    <div className="my-4">
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-wide underline decoration-amber-400/40 underline-offset-8">
                            {teamName}
                        </h2>
                        {participantName && (
                            <p className="mt-2 text-sm text-slate-400 font-medium">
                                Member: {participantName}
                            </p>
                        )}
                    </div>

                    <p className="max-w-xl mx-auto text-xs sm:text-sm leading-relaxed text-slate-300">
                        {isWinner ? (
                            <>
                                for demonstrating superior algorithmic debugging mastery, exceptional problem-solving speed, and achieving the highest score to be crowned{" "}
                                <strong className="text-amber-300 font-bold">BUG SLAYER 2026</strong> in the official Bug Battle competitive offline debugging championship.
                            </>
                        ) : isRunnerUp || isSecondRunnerUp ? (
                            <>
                                for outstanding debugging proficiency, perseverance, and achieving distinction as{" "}
                                <strong className="text-slate-200 font-bold">{prizeTitle}</strong> with an impressive total score of {score} points.
                            </>
                        ) : (
                            <>
                                for successfully participating in Bug Battle 2026, demonstrating commendable programming fundamentals, analytical prowess, and competitive offline code debugging.
                            </>
                        )}
                    </p>

                    {/* Badge / Achievement Box */}
                    <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-6 py-3 shadow-inner">
                        <Trophy className={isWinner ? "text-amber-400" : "text-blue-400"} size={24} />
                        <div className="text-left">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                Award Category
                            </p>
                            <p className="text-sm font-black text-white">{badgeLabel}</p>
                        </div>
                        {score > 0 && (
                            <div className="ml-4 pl-4 border-l border-slate-800 text-left">
                                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                                    Score
                                </p>
                                <p className="text-sm font-bold text-amber-300">{score} pts</p>
                            </div>
                        )}
                    </div>

                    {/* Footer Verification & Signatures */}
                    <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="text-emerald-400" size={20} />
                            <div className="text-left">
                                <p className="font-semibold text-slate-300">Verified Offline Execution</p>
                                <p className="text-[11px] text-slate-500">Bug Battle Technical Committee</p>
                            </div>
                        </div>

                        <div className="text-center sm:text-right">
                            <div className="w-40 border-b border-slate-600 pb-1 mb-1 font-serif italic text-sm text-slate-200">
                                Organizing Lead
                            </div>
                            <p className="text-[11px] text-slate-500">BUG BATTLE 2026</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
