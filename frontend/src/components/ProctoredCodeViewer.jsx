import { useEffect, useRef } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * ProctoredCodeViewer
 * Renders buggy code onto an HTML5 Canvas raster surface instead of standard DOM text nodes.
 * This prevents browser AI assistants (such as Microsoft Edge Copilot's "Allow access to page content")
 * and automated DOM scrapers from reading the challenge code, while providing human participants
 * with crisp, syntax-highlighted code with line numbers.
 */
export default function ProctoredCodeViewer({
    code = "",
    language = "python",
    minHeight = 220
}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = container.clientWidth || 600;
        const lines = code ? code.split("\n") : ["// No code available"];

        const lineHeight = 24;
        const paddingTop = 18;
        const paddingBottom = 18;
        const gutterWidth = 46;
        const codePaddingLeft = 14;

        const totalHeight = Math.max(minHeight, paddingTop + lines.length * lineHeight + paddingBottom);

        // Adjust canvas resolution for high-DPI screens
        canvas.width = width * dpr;
        canvas.height = totalHeight * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${totalHeight}px`;

        ctx.scale(dpr, dpr);

        // Background
        ctx.fillStyle = "#090d16"; // deep slate-950
        ctx.fillRect(0, 0, width, totalHeight);

        // Gutter background
        ctx.fillStyle = "#0c1322";
        ctx.fillRect(0, 0, gutterWidth, totalHeight);

        // Gutter separator border
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gutterWidth, 0);
        ctx.lineTo(gutterWidth, totalHeight);
        ctx.stroke();

        // Keywords regex based on common languages
        const keywords = new Set([
            "def", "function", "return", "for", "in", "if", "else", "elif",
            "while", "import", "from", "as", "class", "try", "except", "catch",
            "finally", "const", "let", "var", "new", "this", "null", "undefined",
            "True", "False", "true", "false", "None", "break", "continue", "pass",
            "yield", "async", "await", "public", "private", "static", "void", "int", "float"
        ]);

        const builtins = new Set([
            "print", "console", "log", "len", "range", "str", "int", "float",
            "list", "dict", "set", "map", "filter", "sum", "min", "max", "Math",
            "push", "pop", "shift", "unshift", "append", "slice", "splice"
        ]);

        // Tokenizer for simple syntax coloring
        const tokenizeLine = (line) => {
            const tokens = [];
            let i = 0;

            // Check comment first
            const isPythonComment = line.trim().startsWith("#");
            const isJsComment = line.trim().startsWith("//");
            if (isPythonComment || isJsComment) {
                return [{ text: line, color: "#64748b", font: "italic 13px 'JetBrains Mono', 'Fira Code', 'Courier New', monospace" }];
            }

            const regex = /(\/\/.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_]\w*\b|[+\-*/%=<>!&|^~]+|[()[\]{},;:.])/g;
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    tokens.push({
                        text: line.substring(lastIndex, match.index),
                        color: "#94a3b8"
                    });
                }

                const word = match[0];
                let color = "#cbd5e1"; // default light text
                let font = "13px 'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

                if (word.startsWith("#") || word.startsWith("//")) {
                    color = "#64748b"; // comment
                    font = "italic 13px 'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
                } else if (word.startsWith('"') || word.startsWith("'")) {
                    color = "#34d399"; // emerald string
                } else if (!isNaN(Number(word))) {
                    color = "#fbbf24"; // amber number
                } else if (keywords.has(word)) {
                    color = "#c084fc"; // purple keyword
                } else if (builtins.has(word)) {
                    color = "#60a5fa"; // blue builtin
                } else if (/[+\-*/%=<>!&|^~]/.test(word)) {
                    color = "#f472b6"; // pink operator
                }

                tokens.push({ text: word, color, font });
                lastIndex = regex.lastIndex;
            }

            if (lastIndex < line.length) {
                tokens.push({
                    text: line.substring(lastIndex),
                    color: "#94a3b8"
                });
            }

            return tokens;
        };

        // Render each line
        lines.forEach((lineText, index) => {
            const y = paddingTop + index * lineHeight + 15;

            // Line number in gutter
            ctx.font = "12px 'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
            ctx.fillStyle = "#475569";
            ctx.textAlign = "right";
            ctx.fillText(String(index + 1), gutterWidth - 10, y);

            // Code tokens
            ctx.textAlign = "left";
            let x = gutterWidth + codePaddingLeft;

            const tokens = tokenizeLine(lineText);
            tokens.forEach((token) => {
                ctx.font = token.font || "13px 'JetBrains Mono', 'Fira Code', 'Courier New', monospace";
                ctx.fillStyle = token.color || "#cbd5e1";
                ctx.fillText(token.text, x, y);
                x += ctx.measureText(token.text).width;
            });
        });

    }, [code, language, minHeight]);

    return (
        <div
            ref={containerRef}
            className="relative w-full rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner select-none pointer-events-auto"
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
            onContextMenu={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
        >
            <div className="absolute top-2.5 right-3.5 z-10 flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400 select-none">
                <ShieldCheck size={12} />
                <span>Anti-Scrape Protected</span>
            </div>

            <canvas
                ref={canvasRef}
                className="block w-full select-none"
                aria-label="Proctored Code View"
            />
        </div>
    );
}
