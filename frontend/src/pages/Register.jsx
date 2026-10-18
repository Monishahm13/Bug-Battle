import axios from "axios";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Bug,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    UserRound,
} from "lucide-react";
import { API_BASE_URL } from "../config/api";

function Register() {
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");


    const handleSubmit = async (event) => {
        event.preventDefault();

        try {
            const response = await axios.post(
                `${API_BASE_URL}/auth/register`,
                {
                    name,
                    email,
                    password,
                }
            );

            alert(response.data.message || "Registration successful!");

            window.location.href = "/login";
        } catch (error) {
            alert(
                error.response?.data?.message ||
                "Registration failed. Please try again."
            );
        }
    };


    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-600/15 blur-3xl" />

            <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/30 md:grid-cols-2">
                <section className="hidden flex-col justify-between bg-linear-to-br from-blue-600/20 via-slate-900 to-violet-600/20 p-10 md:flex">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="rounded-xl bg-blue-500 p-3">
                            <Bug size={25} />
                        </div>
                        <span className="text-xl font-bold tracking-wide">
                            BUG <span className="text-blue-400">BATTLE</span>
                        </span>
                    </Link>

                    <div>
                        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
                            Join the competition
                        </p>
                        <h1 className="text-4xl font-bold leading-tight">
                            Your next victory
                            <br />
                            starts here.
                        </h1>
                        <p className="mt-5 max-w-sm leading-7 text-slate-400">
                            Create your account, practise debugging, and challenge yourself
                            to become a better developer.
                        </p>
                    </div>

                    <p className="text-sm text-slate-500">
                        Learn by solving. Improve by competing.
                    </p>
                </section>

                <section className="p-7 sm:p-10">
                    <Link to="/" className="mb-8 inline-flex items-center gap-2 md:hidden">
                        <Bug className="text-blue-400" size={25} />
                        <span className="font-bold">
                            BUG <span className="text-blue-400">BATTLE</span>
                        </span>
                    </Link>

                    <div className="mb-8">
                        <p className="mb-3 text-sm font-medium text-blue-400">
                            GET STARTED
                        </p>
                        <h2 className="text-3xl font-bold">Create account</h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Join BUG BATTLE and start your debugging journey.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label
                                htmlFor="name"
                                className="mb-2 block text-sm font-medium text-slate-300"
                            >
                                Full name
                            </label>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                                <UserRound size={18} className="shrink-0 text-slate-500" />
                                <input
                                    id="name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    required
                                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-slate-300"
                            >
                                Email address
                            </label>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                                <Mail size={18} className="shrink-0 text-slate-500" />
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="mb-2 block text-sm font-medium text-slate-300"
                            >
                                Password
                            </label>
                            <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                                <LockKeyhole size={18} className="shrink-0 text-slate-500" />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    placeholder="Create a password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    minLength={8}
                                    required
                                    className="w-full bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="text-slate-500 transition hover:text-white"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Use at least 8 characters.
                            </p>
                        </div>

                        <button
                            type="submit"
                            className="w-full rounded-xl bg-blue-600 py-3.5 font-semibold transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                            Create account
                        </button>
                    </form>

                    <p className="mt-7 text-center text-sm text-slate-400">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="font-semibold text-blue-400 hover:text-blue-300"
                        >
                            Sign in
                        </Link>
                    </p>

                    <p className="mt-8 text-center text-xs text-slate-600">
                        Secure access to your BUG BATTLE account
                    </p>
                </section>
            </div>
        </main>
    );
}

export default Register;
