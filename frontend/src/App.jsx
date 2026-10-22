
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Bug, Trophy, Terminal, ArrowRight, Zap, Shield, Code2, Sparkles } from "lucide-react";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BugSnap from "./pages/BugSnap";
import DebugArena from "./pages/DebugArena";
import Leaderboard from "./pages/Leaderboard";
import SubmissionHistory from "./pages/SubmissionHistory";
import ManageQuestions from "./pages/ManageQuestions";
import { getAuthToken, getAuthUser } from "./utils/auth";

function Home() {
  const token = getAuthToken();
  const user = getAuthUser();
  const isOrganizer = user?.role === "organizer";

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-950 text-white selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-125 w-200 rounded-full bg-linear-to-b from-blue-600/15 via-violet-600/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 -left-48 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute top-2/3 -right-48 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/30 group-hover:border-blue-400 transition">
              <Bug size={20} />
            </div>
            <span className="text-lg font-bold tracking-wider text-white">
              BUG <span className="text-blue-500">BATTLE</span>
            </span>
          </a>

          <nav className="flex items-center gap-5 sm:gap-6 text-sm font-medium">
            {isOrganizer && (
              <a
                href="/leaderboard"
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white transition"
              >
                <Trophy size={16} className="text-amber-400" />
                Leaderboard
              </a>
            )}

            <a
              href={token ? "/dashboard" : "/login"}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-95"
            >
              {token ? "Dashboard" : "Sign in"}
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 sm:py-16">
        <div className="w-full max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 shadow-sm shadow-blue-500/10">
            <Zap size={14} className="text-blue-400 animate-pulse" />
            Competitive Debugging Platform
          </div>

          {/* Heading */}
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl sm:leading-tight">
            Find It. Fix It.
            <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-400 via-blue-500 to-violet-400 mt-1">
              Beat Your Opponent.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Sharpen your instincts, hunt real bugs in complex codebases, and dominate the live leaderboard in time-pressured debugging battles.
          </p>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={token ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 shadow-xl shadow-blue-600/30 active:scale-95"
            >
              Start Debugging
              <ArrowRight size={18} />
            </a>

            {isOrganizer && (
              <a
                href="/leaderboard"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 active:scale-95"
              >
                <Trophy size={16} className="text-amber-400" />
                View Leaderboard
              </a>
            )}

            {!token && (
              <a
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-3.5 text-sm font-medium text-slate-400 transition hover:text-white hover:border-slate-700"
              >
                Create Account
              </a>
            )}
          </div>

          {/* Visual Showcase: Terminal & Live Leaderboard Preview */}
          <div className="mt-12 sm:mt-16 grid gap-6 md:grid-cols-12 text-left max-w-4xl mx-auto">
            {/* Terminal Preview Card */}
            <div className="md:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-slate-400 flex items-center gap-1.5">
                    <Terminal size={13} className="text-blue-400" />
                    bug_battle.js
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  Live Testing
                </span>
              </div>

              <div className="mt-4 font-mono text-xs leading-6 text-slate-300">
                <p className="text-slate-500">// Inspecting buggy code snippet...</p>
                <p><span className="text-violet-400">function</span> <span className="text-blue-400">debugSolution</span>(input) {"{"}</p>
                <p className="pl-4 text-red-400/80 line-through">// bug: return input.sort();</p>
                <p className="pl-4 text-emerald-400 font-semibold"><span className="text-violet-400">const</span> fixed = fixBugs(input);</p>
                <p className="pl-4 text-emerald-400"><span className="text-violet-400">return</span> fixed.isValid(); <span className="text-slate-500">// ✅ Fix applied!</span></p>
                <p>{"}"}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-emerald-400 font-medium">Status: Accepted (100% test cases)</span>
                <span className="text-blue-400 font-bold">+25 pts earned</span>
              </div>
            </div>

            {/* Leaderboard Showcase Widget */}
            <div className="md:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-md">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      Live Standings
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded-full">
                    Top Teams
                  </span>
                </div>

                <div className="mt-3.5 space-y-2.5">
                  {[
                    { rank: "1st", name: "Null Pointers", score: "145 pts", badge: "bg-amber-400/10 text-amber-300 border-amber-400/30" },
                    { rank: "2nd", name: "Stack Overflowers", score: "120 pts", badge: "bg-slate-700/30 text-slate-300 border-slate-600/30" },
                    { rank: "3rd", name: "Byte Hunters", score: "105 pts", badge: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
                  ].map((team) => (
                    <div
                      key={team.rank}
                      className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${team.badge}`}>
                          {team.rank}
                        </span>
                        <span className="font-semibold text-slate-200 truncate max-w-27.5">
                          {team.name}
                        </span>
                      </div>
                      <span className="font-bold text-blue-400">{team.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isOrganizer && (
                <a
                  href="/leaderboard"
                  className="mt-4 block w-full rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-center text-xs font-bold text-blue-300 transition hover:bg-blue-500/20 hover:border-blue-500/50"
                >
                  Explore Full Leaderboard →
                </a>
              )}
            </div>
          </div>

          {/* Platform Feature Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Zap size={14} className="text-blue-400" />
              Instant Automated Evaluation
            </span>
            <span className="flex items-center gap-2">
              <Shield size={14} className="text-emerald-400" />
              Strict Anti-Cheat & Fair Play
            </span>
            <span className="flex items-center gap-2">
              <Code2 size={14} className="text-violet-400" />
              Multi-Language Debugging
            </span>
          </div>

          <p className="mt-8 text-xs text-slate-600 font-medium">
            Your next debugging challenge starts here • BUG BATTLE 2026
          </p>
        </div>
      </main>
    </div>
  );
}

function ProtectedDashboard() {
  const token = getAuthToken();

  return token ? <Dashboard /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route
          path="/bugsnap"
          element={
            getAuthToken() ? (
              <BugSnap />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/debug-arena"
          element={
            getAuthToken() ? (
              <DebugArena />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/leaderboard"
          element={
            getAuthToken() ? (
              <Leaderboard />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/submission-history"
          element={
            getAuthToken() ? (
              <SubmissionHistory />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/manage-questions"
          element={
            getAuthToken() ? (
              <ManageQuestions />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
