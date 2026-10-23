import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import {
    AlertTriangle,
    CheckCircle2,
    Lock,
    Send,
    RotateCcw,
    LoaderCircle,
    Flame,
    Timer as TimerIcon,
    ShieldAlert,
    Maximize2,
    ShieldX,
    LogOut,
    Users,
    ToggleLeft,
    ToggleRight
} from "lucide-react";
import { API_BASE_URL } from "../config/api";

const API = API_BASE_URL;

// Subtle Web Audio chime for milestones
const playAlertTone = (freq = 440, type = "sine", duration = 0.3) => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch {
        // Audio might be blocked by browser policy until interaction
    }
};

export default function RoundTimer({
    phase = "bug_snap",
    phaseName = "BUG SNAP",
    durationMinutes = 20,
    eventId = "default",
    userId = "",
    userName = "",
    isRoundStarted = true,
    serverStartedAt = null,
    serverEndsAt = null,
    isQuestionsLoaded = false,
    isFinalSubmitted = false,
    onTimeUp,
    onFinalSubmitEarly,
    isAutoSubmitting = false,
    autoSubmitStatus = "",
    isOrganizer = false,
    onResetTimer
}) {
    const totalSeconds = durationMinutes * 60;
    const [timeLeft, setTimeLeft] = useState(totalSeconds);
    const [timerStarted, setTimerStarted] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showTimeUpModal, setShowTimeUpModal] = useState(false);
    const [modalFinalized, setModalFinalized] = useState(false);
    const [isTabViolation, setIsTabViolation] = useState(false);
    const [violationReason, setViolationReason] = useState("External assistant / Copilot / Focus lost");
    const [exitCountdown, setExitCountdown] = useState(3);

    // Multi-Tab Mode: Organizers can toggle for management testing, but PARTICIPANTS have Strict Proctoring permanently enforced
    const [isMultiTabMode, setIsMultiTabMode] = useState(() => {
        if (!isOrganizer) return false; // Never exempt participants
        const saved = localStorage.getItem("bugbattle_multitab_mode");
        return saved === "true";
    });

    const [isFullscreen, setIsFullscreen] = useState(() => {
        return Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    });

    const hasTriggeredTimeUp = useRef(false);
    const tabViolationTriggeredRef = useRef(false);
    const timerIntervalRef = useRef(null);
    const exitIntervalRef = useRef(null);
    const warned5Min = useRef(false);
    const warned1Min = useRef(false);
    const initialInnerWidthRef = useRef(window.innerWidth);
    const wasInFullscreenRef = useRef(Boolean(document.fullscreenElement));

    const userPrefix = userId ? `${userId}_` : "";
    const storageKey = `bugbattle_timer_${userPrefix}${eventId}_${phase}`;

    // Format MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(Math.max(0, seconds) / 60);
        const secs = Math.max(0, seconds) % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    // Calculate percent remaining
    const percentRemaining = Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100));

    // Toggle multi-tab mode (Organizer only)
    const toggleMultiTabMode = () => {
        if (!isOrganizer) return;
        const next = !isMultiTabMode;
        setIsMultiTabMode(next);
        localStorage.setItem("bugbattle_multitab_mode", String(next));
    };

    // Request fullscreen helper
    const enterFullscreen = async () => {
        try {
            const elem = document.documentElement;
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
            setIsFullscreen(true);
            wasInFullscreenRef.current = true;
            initialInnerWidthRef.current = window.innerWidth;
        } catch (err) {
            console.warn("Fullscreen request error:", err);
        }
    };

    // Immediate forced exit to dashboard
    const forceExitToDashboard = useCallback(() => {
        if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen?.();
            }
        } catch { }
        window.location.replace("/dashboard");
    }, []);

    // Handle timer expiration normally
    const handleTimeExpired = useCallback(async () => {
        if (hasTriggeredTimeUp.current) return;
        hasTriggeredTimeUp.current = true;

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        setTimeLeft(0);
        setShowTimeUpModal(true);
        playAlertTone(587.33, "triangle", 0.6); // Alert chime

        if (onTimeUp) {
            await onTimeUp();
        }
        setModalFinalized(true);
    }, [onTimeUp]);

    // Handle tab-switch / external assistant violation (Strict proctoring - participants only)
    const handleTabViolation = useCallback(async (reason = "Loss of window focus / External tool or Copilot opened") => {
        if (isOrganizer) return; // Organizers are exempted
        if (!timerStarted || isFinalSubmitted || hasTriggeredTimeUp.current || tabViolationTriggeredRef.current) {
            return;
        }

        tabViolationTriggeredRef.current = true;
        hasTriggeredTimeUp.current = true;
        setIsTabViolation(true);
        setViolationReason(reason);
        setShowTimeUpModal(true);

        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        setTimeLeft(0);
        playAlertTone(330, "sawtooth", 0.8); // Security alert sound

        // 1. Submit all participant code immediately to backend evaluation
        if (onTimeUp) {
            try {
                await onTimeUp();
            } catch (err) {
                console.error("Auto-submission error during tab violation:", err);
            }
        }
        setModalFinalized(true);

        // 2. Countdown begins ONLY after Judge0 evaluations are submitted & saved
        let count = 10;
        setExitCountdown(10);
        if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
        exitIntervalRef.current = setInterval(() => {
            count -= 1;
            setExitCountdown(count);
            if (count <= 0) {
                clearInterval(exitIntervalRef.current);
                forceExitToDashboard();
            }
        }, 1000);
    }, [isOrganizer, timerStarted, isFinalSubmitted, onTimeUp, forceExitToDashboard]);

    // Strict Proctoring Listeners: Unconditionally active for all participants during the round
    useEffect(() => {
        if (isOrganizer || !timerStarted || isFinalSubmitted) return;

        // 1. Fullscreen change listener
        const onFullscreenChange = () => {
            const currentlyFullscreen = Boolean(
                document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement
            );
            setIsFullscreen(currentlyFullscreen);

            // If user previously entered fullscreen and exits, trigger submission
            if (!currentlyFullscreen && timerStarted && !isFinalSubmitted && wasInFullscreenRef.current) {
                handleTabViolation("Exited Fullscreen Proctoring Mode");
            } else if (currentlyFullscreen) {
                wasInFullscreenRef.current = true;
                initialInnerWidthRef.current = window.innerWidth;
            }
        };

        // 2. Window Blur listener (Catches switching to another window, clicking Edge/Chrome Copilot sidebar, Alt+Tab, etc.)
        let blurTimeout = null;
        const onWindowBlur = () => {
            blurTimeout = setTimeout(() => {
                if (!document.hasFocus() && timerStarted && !isFinalSubmitted) {
                    handleTabViolation("Loss of Window Focus — Switched to another app or activated Microsoft Copilot / AI Assistant");
                }
            }, 100);
        };

        const onWindowFocus = () => {
            if (blurTimeout) clearTimeout(blurTimeout);
        };

        // 3. Document visibility change (Catches tab switching or minimizing window immediately)
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden" && timerStarted && !isFinalSubmitted) {
                handleTabViolation("Switched browser tabs or minimized test window");
            }
        };

        // 4. Window Resize listener (Edge sidebar dock / split-screen detection in same tab)
        const onResize = () => {
            if (initialInnerWidthRef.current && (initialInnerWidthRef.current - window.innerWidth > 140) && timerStarted && !isFinalSubmitted) {
                handleTabViolation("Browser Sidebar / Microsoft Copilot panel opened in same window");
            }
        };

        // 5. Keydown listener: Block Copilot, AI shortcuts, DevTools, new tab shortcuts
        const onKeyDown = (e) => {
            // Block Copilot shortcuts: Ctrl+Shift+. or Ctrl+Shift+Y
            if (e.ctrlKey && e.shiftKey && (e.key === "." || e.code === "Period" || e.key === "Y" || e.key === "y")) {
                e.preventDefault();
                e.stopPropagation();
                handleTabViolation("Attempted to launch Microsoft Copilot / AI Assistant (Ctrl+Shift+.)");
                return;
            }

            // Block DevTools: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U (view source)
            if (
                e.key === "F12" ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
                ((e.ctrlKey || e.metaKey) && (e.key === "U" || e.key === "u"))
            ) {
                e.preventDefault();
                e.stopPropagation();
                handleTabViolation("Attempted to open Developer Tools / Page Source");
                return;
            }

            // Block Tab switching / New Tab / New Window shortcuts: Ctrl+T, Ctrl+N, Ctrl+W, Ctrl+Tab
            if ((e.ctrlKey || e.metaKey) && ["t", "T", "n", "N", "w", "W", "Tab"].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                handleTabViolation("Attempted to switch or open new browser tab");
                return;
            }

            if (e.key === "F11") {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const onContextMenu = (e) => e.preventDefault();
        const onCopyCut = (e) => e.preventDefault();

        const onBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = "Leaving this page will automatically submit and permanently close your test session!";
            return e.returnValue;
        };

        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);
        window.addEventListener("blur", onWindowBlur);
        window.addEventListener("focus", onWindowFocus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("resize", onResize);
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("contextmenu", onContextMenu);
        window.addEventListener("copy", onCopyCut);
        window.addEventListener("cut", onCopyCut);
        window.addEventListener("beforeunload", onBeforeUnload);

        return () => {
            if (blurTimeout) clearTimeout(blurTimeout);
            document.removeEventListener("fullscreenchange", onFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
            window.removeEventListener("blur", onWindowBlur);
            window.removeEventListener("focus", onWindowFocus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("contextmenu", onContextMenu);
            window.removeEventListener("copy", onCopyCut);
            window.removeEventListener("cut", onCopyCut);
            window.removeEventListener("beforeunload", onBeforeUnload);
            if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
        };
    }, [isOrganizer, timerStarted, isFinalSubmitted, handleTabViolation]);

    // Initialize or load timer from backend / storage
    useEffect(() => {
        if (!isQuestionsLoaded || !isRoundStarted) return;
        if (isFinalSubmitted) {
            setTimeLeft(0);
            return;
        }

        const initTimer = async () => {
            const token = sessionStorage.getItem("bugBattleToken") || localStorage.getItem("bugBattleToken");
            let serverTimerStartedAt = serverStartedAt ? new Date(serverStartedAt).getTime() : null;
            let serverTimerEndsAt = serverEndsAt ? new Date(serverEndsAt).getTime() : null;
            let serverSubmitted = false;

            // Try to sync with team timer on backend
            if (token) {
                try {
                    const res = await axios.get(`${API}/teams/timer/${phase}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const timer = res.data?.timer;
                    if (timer) {
                        if (timer.isSubmitted) {
                            serverSubmitted = true;
                        } else if (timer.startedAt) {
                            serverTimerStartedAt = new Date(timer.startedAt).getTime();
                            serverTimerEndsAt = new Date(timer.endedAt).getTime();
                        } else if (!isOrganizer) {
                            // First team member or captain starting the challenge: start timer on server for entire team
                            try {
                                const startRes = await axios.post(
                                    `${API}/teams/timer/start`,
                                    { phase },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                                const startedTimer = startRes.data?.timer;
                                if (startedTimer?.startedAt) {
                                    serverTimerStartedAt = new Date(startedTimer.startedAt).getTime();
                                    serverTimerEndsAt = new Date(startedTimer.endedAt).getTime();
                                }
                            } catch (startErr) {
                                if (startErr.response?.data?.isSubmitted) {
                                    serverSubmitted = true;
                                }
                            }
                        }
                    }
                } catch {
                    // Fall back
                }
            }

            if (serverSubmitted && !isOrganizer) {
                setTimeLeft(0);
                hasTriggeredTimeUp.current = true;
                onTimeUp?.();
                return;
            }

            const now = Date.now();
            let endsAtMs = null;

            // Check isolated storage
            const localData = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    // If server started a new round, invalidate older storage
                    if (serverTimerStartedAt && parsed.startedAt && parsed.startedAt < serverTimerStartedAt - 5000) {
                        sessionStorage.removeItem(storageKey);
                        localStorage.removeItem(storageKey);
                    } else {
                        if (parsed.isFinalSubmitted && !isOrganizer) {
                            setTimeLeft(0);
                            hasTriggeredTimeUp.current = true;
                            onTimeUp?.();
                            return;
                        }
                        if (parsed.endsAt) {
                            endsAtMs = parsed.endsAt;
                        }
                    }
                } catch { }
            }

            if (serverTimerEndsAt) {
                endsAtMs = serverTimerEndsAt;
            } else if (!endsAtMs) {
                endsAtMs = now + totalSeconds * 1000;
                const payload = JSON.stringify({
                    startedAt: serverTimerStartedAt || now,
                    endsAt: endsAtMs,
                    durationMinutes,
                    isFinalSubmitted: false
                });
                sessionStorage.setItem(storageKey, payload);
                localStorage.setItem(storageKey, payload);
            }

            // Calculate remaining seconds
            let diffSeconds = Math.max(0, Math.floor((endsAtMs - now) / 1000));

            // If time is up: organizers previewing/testing get an automatic fresh countdown so they are never locked out
            if (diffSeconds <= 0) {
                if (isOrganizer) {
                    endsAtMs = now + totalSeconds * 1000;
                    diffSeconds = totalSeconds;
                    const organizerPayload = JSON.stringify({
                        startedAt: now,
                        endsAt: endsAtMs,
                        durationMinutes,
                        isFinalSubmitted: false
                    });
                    sessionStorage.setItem(storageKey, organizerPayload);
                    localStorage.setItem(storageKey, organizerPayload);
                } else {
                    setTimeLeft(0);
                    handleTimeExpired();
                    return;
                }
            }

            setTimeLeft(diffSeconds);
            setTimerStarted(true);

            // Start countdown interval
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

            timerIntervalRef.current = setInterval(() => {
                const currentNow = Date.now();
                const remaining = Math.max(0, Math.floor((endsAtMs - currentNow) / 1000));
                setTimeLeft(remaining);

                if (remaining <= 300 && !warned5Min.current) {
                    warned5Min.current = true;
                    playAlertTone(440, "sine", 0.3);
                }
                if (remaining <= 60 && !warned1Min.current) {
                    warned1Min.current = true;
                    playAlertTone(523.25, "triangle", 0.4);
                }

                // Periodic team sync: if a teammate or captain submits elsewhere, immediately lock here
                if (remaining % 5 === 0 && token) {
                    axios.get(`${API}/teams/timer/${phase}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).then((res) => {
                        if (res.data?.timer?.isSubmitted) {
                            clearInterval(timerIntervalRef.current);
                            setTimeLeft(0);
                            hasTriggeredTimeUp.current = true;
                            onTimeUp?.();
                        }
                    }).catch(() => { });
                }

                if (remaining <= 0) {
                    clearInterval(timerIntervalRef.current);
                    handleTimeExpired();
                }
            }, 1000);
        };

        initTimer();

        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, [isQuestionsLoaded, isRoundStarted, serverStartedAt, serverEndsAt, isFinalSubmitted, phase, storageKey, totalSeconds, durationMinutes, handleTimeExpired]);

    // Handle manual early final submission
    const handleConfirmFinalSubmit = async () => {
        setShowConfirmModal(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setTimeLeft(0);
        setShowTimeUpModal(true);

        if (onFinalSubmitEarly) {
            await onFinalSubmitEarly();
        }
        setModalFinalized(true);
    };

    // Color theme based on urgency
    const isCritical = timeLeft <= 60 && !isFinalSubmitted;
    const isWarning = timeLeft <= 300 && !isCritical && !isFinalSubmitted;

    const timerBadgeColor = isFinalSubmitted
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : isCritical
            ? "border-red-500/50 bg-red-500/15 text-red-400 animate-pulse shadow-lg shadow-red-500/20"
            : isWarning
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-md shadow-amber-500/10"
                : "border-blue-500/30 bg-blue-500/10 text-blue-300";

    const progressBarColor = isFinalSubmitted
        ? "bg-emerald-500"
        : isCritical
            ? "bg-gradient-to-r from-red-600 to-rose-500 animate-pulse"
            : isWarning
                ? "bg-gradient-to-r from-amber-500 to-orange-500"
                : "bg-gradient-to-r from-blue-500 to-indigo-500";

    return (
        <>
            {/* Sticky HUD Bar */}
            <div className="sticky top-0 z-40 mb-6 rounded-2xl border border-slate-800/90 bg-slate-950/85 backdrop-blur-xl p-4 sm:p-5 shadow-2xl transition-all">
                {/* Status & Mode Control Bar */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 px-3.5 py-2 text-xs">
                    {/* Active Tab User Badge */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-slate-200">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="font-semibold text-white">
                                {userName || (isOrganizer ? "Organizer" : "Participant")}
                            </span>
                            <span className="rounded bg-slate-700 px-1 py-0.5 text-[9px] font-bold uppercase text-slate-300">
                                {isOrganizer ? "Organizer" : "Contestant"}
                            </span>
                        </div>

                        {/* Mode Description */}
                        <span className="hidden sm:inline text-[11px] font-medium">
                            {isOrganizer ? (
                                <span className="text-slate-400">
                                    Organizer Management Session — Unrestricted multi-tab testing active.
                                </span>
                            ) : (
                                <span className="text-amber-400/95 flex items-center gap-1">
                                    <ShieldAlert size={12} className="text-amber-400 shrink-0" />
                                    Strict Event Proctoring: Switching tabs or opening AI assistants (Copilot) will automatically submit your round.
                                </span>
                            )}
                        </span>
                    </div>

                    {/* Mode Controls */}
                    <div className="flex items-center gap-2">
                        {/* Organizer Only: Multi-tab toggle */}
                        {isOrganizer && (
                            <button
                                type="button"
                                onClick={toggleMultiTabMode}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition border ${isMultiTabMode
                                        ? "border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
                                        : "border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
                                    }`}
                                title="Toggle between Multi-Tab Testing Mode and Strict Competition Tab-Lock"
                            >
                                {isMultiTabMode ? (
                                    <>
                                        <Users size={13} className="text-blue-400" />
                                        <span>Mode: Multi-Tab Testing</span>
                                        <ToggleRight size={15} className="text-blue-400" />
                                    </>
                                ) : (
                                    <>
                                        <ShieldAlert size={13} className="text-red-400 animate-pulse" />
                                        <span>Mode: Strict Tab-Lock</span>
                                        <ToggleLeft size={15} className="text-red-400" />
                                    </>
                                )}
                            </button>
                        )}

                        {/* Fullscreen Button for Participants */}
                        {!isFullscreen && !isOrganizer && !isFinalSubmitted && (
                            <button
                                type="button"
                                onClick={enterFullscreen}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider transition shadow-md shadow-blue-600/30 active:scale-95 animate-pulse"
                            >
                                <Maximize2 size={12} /> Enter Fullscreen
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    {/* Mode and Status Info */}
                    <div className="flex items-center gap-3.5">
                        <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${timerBadgeColor} transition`}
                        >
                            {isFinalSubmitted ? (
                                <Lock size={22} className="text-emerald-400" />
                            ) : isCritical ? (
                                <Flame size={24} className="text-red-400 animate-bounce" />
                            ) : (
                                <TimerIcon size={22} className={isWarning ? "text-amber-400" : "text-blue-400"} />
                            )}
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    {phaseName} • {durationMinutes} MIN LIMIT
                                </span>
                                {isFinalSubmitted ? (
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                                        SUBMITTED & FINAL
                                    </span>
                                ) : isCritical ? (
                                    <span className="rounded-full border border-red-500/40 bg-red-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-red-300 animate-pulse">
                                        🚨 FINAL MINUTE
                                    </span>
                                ) : isWarning ? (
                                    <span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                                        ⚠️ HURRY UP
                                    </span>
                                ) : (
                                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                                        LIVE COUNTDOWN
                                    </span>
                                )}
                            </div>

                            <p className="mt-0.5 text-xs text-slate-400">
                                {isFinalSubmitted
                                    ? "This round has concluded. Your submissions are recorded and locked."
                                    : isMultiTabMode
                                        ? "Solutions auto-submit when the timer hits 00:00. Tab switching is permitted in multi-tab mode."
                                        : "Solutions auto-submit and lock permanently when the timer hits 00:00 or upon focus violation."}
                            </p>
                        </div>
                    </div>

                    {/* Timer Clock and Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0">
                        {/* Countdown Display */}
                        <div
                            className={`flex items-baseline gap-1 rounded-2xl border px-4 py-2 font-mono ${timerBadgeColor}`}
                        >
                            <span className="text-2xl sm:text-3xl font-black tracking-tight">
                                {formatTime(timeLeft)}
                            </span>
                            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
                                REMAINING
                            </span>
                        </div>

                        {/* Actions */}
                        {!isFinalSubmitted && (
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(true)}
                                disabled={isAutoSubmitting}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-600 hover:bg-blue-500 active:scale-95 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition disabled:opacity-50"
                                title="Finish and lock your final submission now"
                            >
                                <Send size={14} />
                                <span className="hidden md:inline">Final Submit</span>
                            </button>
                        )}

                        {/* Organizer Reset for testing */}
                        {isOrganizer && onResetTimer && (
                            <button
                                type="button"
                                onClick={onResetTimer}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
                                title="Reset timer for testing (Organizer only)"
                            >
                                <RotateCcw size={13} />
                                <span className="hidden sm:inline">Reset</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                    <div
                        className={`h-full transition-all duration-1000 ease-linear ${progressBarColor}`}
                        style={{ width: `${isFinalSubmitted ? 100 : percentRemaining}%` }}
                    />
                </div>
            </div>

            {/* MANDATORY FULLSCREEN PROCTORING GATE (Only in Strict Lock Mode) */}
            {!isFullscreen && !isOrganizer && timerStarted && !isFinalSubmitted && !isMultiTabMode && !showTimeUpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-4 animate-fadeIn">
                    <div className="w-full max-w-lg rounded-3xl border border-blue-500/30 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/40 bg-blue-500/15 text-blue-400 animate-pulse">
                            <Maximize2 size={32} />
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                            Security Proctoring Enforced
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                            Fullscreen Mode Required
                        </h2>
                        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
                            To ensure contest fairness, unauthorized browser sidebars, external windows, and AI assistants (including <strong>Microsoft Copilot</strong>) must be hidden during this round.
                        </p>

                        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                            <button
                                type="button"
                                onClick={enterFullscreen}
                                className="w-full flex-1 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 py-3.5 px-6 font-bold text-sm text-white shadow-xl shadow-blue-600/30 transition flex items-center justify-center gap-2"
                            >
                                <Maximize2 size={16} />
                                Enter Fullscreen & Begin
                            </button>
                            <button
                                type="button"
                                onClick={toggleMultiTabMode}
                                className="w-full sm:w-auto rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 py-3.5 px-4 font-semibold text-xs text-slate-300 transition"
                            >
                                Switch to Multi-Tab Testing Mode
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Early Final Submit Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
                    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-2.5 text-blue-400">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Finalize & Submit Round?</h3>
                                <p className="text-xs text-slate-400">This action cannot be undone.</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-300 leading-relaxed mb-6">
                            All your current code for this round will be submitted and judged immediately. Once finalized, you
                            will <strong>not be able to edit solutions or re-submit</strong> for this phase.
                        </p>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmFinalSubmit}
                                className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition active:scale-95"
                            >
                                Yes, Finalize & Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Time Up or Proctoring Violation Modal */}
            {showTimeUpModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-fadeIn">
                    <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-slate-100 text-center">
                        {isAutoSubmitting ? (
                            <>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                                    <LoaderCircle size={32} className="animate-spin" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white">
                                    {isTabViolation ? "🚨 Security Violation Detected!" : "⏰ Time Has Expired!"}
                                </h3>
                                <p className="mt-2 text-sm text-slate-300">
                                    {isTabViolation
                                        ? "You navigated away, opened an external assistant, or left fullscreen. Automatically submitting all solutions and closing your test session..."
                                        : "Submitting your code automatically to the evaluation engine..."}
                                </p>
                                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-blue-300 font-mono">
                                    {autoSubmitStatus || "Evaluating challenge solutions in Judge0..."}
                                </div>
                                <p className="mt-4 text-xs text-slate-500">
                                    Please do not close or reload the browser window while evaluation is in progress.
                                </p>
                            </>
                        ) : isTabViolation ? (
                            <>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/15 text-red-400 animate-pulse">
                                    <ShieldX size={36} />
                                </div>
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400 uppercase tracking-wider mb-2">
                                    Security Violation
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-white">
                                    🚨 External Tool / Focus Violation — Test Terminated
                                </h3>
                                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                                    An unauthorized window switch, Copilot assistant opening, or fullscreen exit was detected. Your solutions have been automatically submitted and this session has ended.
                                </p>

                                <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-950/40 p-4 text-xs text-red-300 text-left space-y-1.5">
                                    <p className="font-bold text-white mb-1">Session Closed & Terminated:</p>
                                    <p>• <strong>Reason:</strong> {violationReason}</p>
                                    <p>• <strong>Action:</strong> Automated Judge0 evaluation recorded</p>
                                    <p>• <strong>Status:</strong> Code editing permanently locked</p>
                                </div>

                                <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-amber-300 animate-pulse">
                                    Exiting test session automatically in {exitCountdown}s...
                                </div>

                                <div className="mt-6 flex flex-wrap justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={forceExitToDashboard}
                                        className="rounded-xl bg-red-600 hover:bg-red-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition flex items-center gap-2"
                                    >
                                        <LogOut size={14} /> Exit to Dashboard Now
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                                    <CheckCircle2 size={36} />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white">
                                    Round Concluded • Final Submission Complete
                                </h3>
                                <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                                    Your solutions have been automatically evaluated and permanently recorded. Your score has
                                    been updated on the tournament leaderboard.
                                </p>
                                <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-300 font-medium">
                                    ✓ All solutions locked as final. No further modifications permitted.
                                </div>

                                <div className="mt-6 flex flex-wrap justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowTimeUpModal(false)}
                                        className="rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition"
                                    >
                                        Review My Results
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
