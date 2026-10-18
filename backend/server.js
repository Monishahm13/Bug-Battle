const express = require("express");
const cors = require("cors");
require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const teamRoutes = require("./routes/teamRoutes");

const eventRoutes = require("./routes/eventRoutes");

const questionRoutes = require("./routes/questionRoutes");

const submissionRoutes = require("./routes/submissionRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/teams", teamRoutes);

app.use("/api/events", eventRoutes);

app.use("/api/questions", questionRoutes);

app.use("/api/submissions", submissionRoutes);

const path = require("path");
const fs = require("fs");

const frontendDistPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
}

app.get("/api/health", (req, res) => {
    res.json({
        message: "BUG BATTLE API is running",
        status: "success"
    });
});

// All non-API GET routes serve frontend SPA index.html if built, otherwise API status
app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
        const indexPath = path.join(frontendDistPath, "index.html");
        if (fs.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
        return res.json({
            message: "BUG BATTLE Backend API is live",
            status: "success"
        });
    }
    next();
});

app.listen(PORT, () => {
    console.log(`BUG BATTLE backend running on http://localhost:${PORT}`);
});