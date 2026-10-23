const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE_TEMP_DIR = path.join(os.tmpdir(), "bug_battle_exec");
if (!fs.existsSync(BASE_TEMP_DIR)) {
    try {
        fs.mkdirSync(BASE_TEMP_DIR, { recursive: true });
    } catch (e) {
        console.warn("Could not create base temp directory:", e.message);
    }
}

/**
 * Converts a Windows path (e.g. C:\Users\... or C:/Users/...) to WSL format (/mnt/c/Users/...)
 */
function toWslPath(winPath) {
    const normalized = winPath.replace(/\\/g, "/");
    const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
    if (match) {
        return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
    }
    return normalized;
}

/**
 * Executes a command with timeout and optional stdin
 */
function runCommand(cmd, options = {}, stdin = "", timeoutMs = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const proc = exec(
            cmd,
            {
                timeout: timeoutMs,
                maxBuffer: 2 * 1024 * 1024,
                ...options
            },
            (error, stdout, stderr) => {
                const executionTime = Number(((Date.now() - startTime) / 1000).toFixed(3));
                const outStr = (stdout || "").toString();
                const errStr = (stderr || "").toString();

                if (error && (error.killed || error.signal === "SIGTERM" || error.code === 124)) {
                    return resolve({
                        timedOut: true,
                        exitCode: 124,
                        stdout: outStr,
                        stderr: "Time Limit Exceeded (Execution exceeded 5.0s)",
                        executionTime
                    });
                }

                resolve({
                    timedOut: false,
                    exitCode: error ? (error.code ?? 1) : 0,
                    error,
                    stdout: outStr,
                    stderr: errStr,
                    executionTime
                });
            }
        );

        if (stdin && proc.stdin) {
            try {
                proc.stdin.write(stdin);
                proc.stdin.end();
            } catch (err) {
                console.warn("Error piping stdin:", err.message);
            }
        }
    });
}

/**
 * Extracts class name for Java source code
 */
function getJavaClassName(code) {
    const publicMatch = code.match(/public\s+class\s+([A-Za-z0-9_]+)/);
    if (publicMatch) return publicMatch[1];
    const classMatch = code.match(/class\s+([A-Za-z0-9_]+)/);
    if (classMatch) return classMatch[1];
    return "Main";
}

/**
 * Compiles and executes code for a specific programming language.
 * Returns standard execution result format.
 */
async function compileAndExecute({
    language,
    sourceCode,
    stdin = "",
    timeoutMs = 5000
}) {
    if (!sourceCode || !sourceCode.trim()) {
        return {
            status: "wrong_answer",
            compileOutput: "Source code cannot be empty.",
            stdout: "",
            stderr: "",
            executionTime: 0
        };
    }

    const lang = (language || "").toLowerCase().trim();
    const uniqueId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const jobDir = path.join(BASE_TEMP_DIR, uniqueId);

    try {
        fs.mkdirSync(jobDir, { recursive: true });
    } catch (e) {
        console.error("Failed to create job directory:", e);
    }

    try {
        switch (lang) {
            case "c": {
                const srcFile = path.join(jobDir, "solution.c");
                const binFile = path.join(jobDir, "solution.out");
                fs.writeFileSync(srcFile, sourceCode, "utf8");

                const wslSrc = toWslPath(srcFile);
                const wslBin = toWslPath(binFile);

                // Step 1: Compile with GCC
                const compileRes = await runCommand(
                    `wsl bash -c "gcc -O2 '${wslSrc}' -o '${wslBin}' -lm"`,
                    {},
                    "",
                    8000
                );

                if (compileRes.exitCode !== 0) {
                    return {
                        status: "compile_error",
                        compileOutput: compileRes.stderr || "Compilation failed with syntax errors.",
                        stdout: "",
                        stderr: compileRes.stderr,
                        executionTime: compileRes.executionTime
                    };
                }

                // Step 2: Run compiled executable
                const runRes = await runCommand(
                    `wsl bash -c "'${wslBin}'"`,
                    {},
                    stdin,
                    timeoutMs
                );

                if (runRes.timedOut) {
                    return {
                        status: "time_limit",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                if (runRes.exitCode !== 0) {
                    return {
                        status: "runtime_error",
                        compileOutput: runRes.stderr || "Runtime error occurred during execution.",
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                return {
                    status: "accepted",
                    compileOutput: compileRes.stderr ? `Compiler warnings:\n${compileRes.stderr}` : "",
                    stdout: runRes.stdout,
                    stderr: runRes.stderr,
                    executionTime: runRes.executionTime
                };
            }

            case "cpp":
            case "c++": {
                const srcFile = path.join(jobDir, "solution.cpp");
                const binFile = path.join(jobDir, "solution.out");
                fs.writeFileSync(srcFile, sourceCode, "utf8");

                const wslSrc = toWslPath(srcFile);
                const wslBin = toWslPath(binFile);

                // Step 1: Compile with G++
                const compileRes = await runCommand(
                    `wsl bash -c "g++ -O2 -std=c++17 '${wslSrc}' -o '${wslBin}'"`,
                    {},
                    "",
                    8000
                );

                if (compileRes.exitCode !== 0) {
                    return {
                        status: "compile_error",
                        compileOutput: compileRes.stderr || "Compilation failed with C++ syntax errors.",
                        stdout: "",
                        stderr: compileRes.stderr,
                        executionTime: compileRes.executionTime
                    };
                }

                // Step 2: Run compiled executable
                const runRes = await runCommand(
                    `wsl bash -c "'${wslBin}'"`,
                    {},
                    stdin,
                    timeoutMs
                );

                if (runRes.timedOut) {
                    return {
                        status: "time_limit",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                if (runRes.exitCode !== 0) {
                    return {
                        status: "runtime_error",
                        compileOutput: runRes.stderr || "Runtime error occurred during execution.",
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                return {
                    status: "accepted",
                    compileOutput: compileRes.stderr ? `Compiler warnings:\n${compileRes.stderr}` : "",
                    stdout: runRes.stdout,
                    stderr: runRes.stderr,
                    executionTime: runRes.executionTime
                };
            }

            case "python":
            case "py": {
                const srcFile = path.join(jobDir, "solution.py");
                fs.writeFileSync(srcFile, sourceCode, "utf8");

                // Execute with py launcher (or fallback to wsl python3)
                let runRes = await runCommand(
                    `py -u "${srcFile}"`,
                    {},
                    stdin,
                    timeoutMs
                );

                // If py launcher fails to launch, fallback to wsl python3
                if (runRes.exitCode !== 0 && runRes.stderr.includes("not found")) {
                    const wslSrc = toWslPath(srcFile);
                    runRes = await runCommand(
                        `wsl bash -c "python3 -u '${wslSrc}'"`,
                        {},
                        stdin,
                        timeoutMs
                    );
                }

                if (runRes.timedOut) {
                    return {
                        status: "time_limit",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                if (runRes.exitCode !== 0) {
                    const isSyntax =
                        runRes.stderr.includes("SyntaxError:") ||
                        runRes.stderr.includes("IndentationError:") ||
                        runRes.stderr.includes("TabError:");

                    return {
                        status: isSyntax ? "compile_error" : "runtime_error",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                return {
                    status: "accepted",
                    compileOutput: "",
                    stdout: runRes.stdout,
                    stderr: runRes.stderr,
                    executionTime: runRes.executionTime
                };
            }

            case "java": {
                const className = getJavaClassName(sourceCode);
                const srcFile = path.join(jobDir, `${className}.java`);
                fs.writeFileSync(srcFile, sourceCode, "utf8");

                // Step 1: Compile with javac
                const compileRes = await runCommand(
                    `javac "${srcFile}"`,
                    { cwd: jobDir },
                    "",
                    8000
                );

                if (compileRes.exitCode !== 0) {
                    return {
                        status: "compile_error",
                        compileOutput: compileRes.stderr || "Java compilation failed with syntax errors.",
                        stdout: "",
                        stderr: compileRes.stderr,
                        executionTime: compileRes.executionTime
                    };
                }

                // Step 2: Run with java
                const runRes = await runCommand(
                    `java -cp "${jobDir}" ${className}`,
                    { cwd: jobDir },
                    stdin,
                    timeoutMs
                );

                if (runRes.timedOut) {
                    return {
                        status: "time_limit",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                if (runRes.exitCode !== 0) {
                    return {
                        status: "runtime_error",
                        compileOutput: runRes.stderr || "Runtime exception occurred in Java execution.",
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                return {
                    status: "accepted",
                    compileOutput: "",
                    stdout: runRes.stdout,
                    stderr: runRes.stderr,
                    executionTime: runRes.executionTime
                };
            }

            case "javascript":
            case "js": {
                const srcFile = path.join(jobDir, "solution.js");
                fs.writeFileSync(srcFile, sourceCode, "utf8");

                const runRes = await runCommand(
                    `node "${srcFile}"`,
                    {},
                    stdin,
                    timeoutMs
                );

                if (runRes.timedOut) {
                    return {
                        status: "time_limit",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                if (runRes.exitCode !== 0) {
                    const isSyntax = runRes.stderr.includes("SyntaxError");

                    return {
                        status: isSyntax ? "compile_error" : "runtime_error",
                        compileOutput: runRes.stderr,
                        stdout: runRes.stdout,
                        stderr: runRes.stderr,
                        executionTime: runRes.executionTime
                    };
                }

                return {
                    status: "accepted",
                    compileOutput: "",
                    stdout: runRes.stdout,
                    stderr: runRes.stderr,
                    executionTime: runRes.executionTime
                };
            }

            default:
                return {
                    status: "system_error",
                    compileOutput: `Unsupported programming language: ${language}`,
                    stdout: "",
                    stderr: "",
                    executionTime: 0
                };
        }
    } catch (err) {
        console.error(`Compiler execution failed for ${language}:`, err);
        return {
            status: "system_error",
            compileOutput: `Execution error: ${err.message}`,
            stdout: "",
            stderr: err.message,
            executionTime: 0
        };
    } finally {
        // Clean up job directory
        try {
            if (fs.existsSync(jobDir)) {
                fs.rmSync(jobDir, { recursive: true, force: true });
            }
        } catch (cleanupErr) {
            console.warn("Could not delete job directory:", cleanupErr.message);
        }
    }
}

module.exports = {
    compileAndExecute
};
