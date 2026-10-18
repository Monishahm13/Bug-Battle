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

const frontendDistPath = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDistPath));

app.get("/api/health", (req, res) => {
    res.json({
        message: "BUG BATTLE API is running",
        status: "success"
    });
});

// All non-API GET routes serve frontend SPA index.html
app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
        return res.sendFile(path.join(frontendDistPath, "index.html"));
    }
    next();
});

app.listen(PORT, () => {
    console.log(`BUG BATTLE backend running on http://localhost:${PORT}`);
});