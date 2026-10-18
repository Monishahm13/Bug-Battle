import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import "./index.css";
import App from "./App.jsx";

// Global axios interceptor to guarantee each browser tab uses its own isolated auth token
axios.interceptors.request.use((config) => {
    // Priority: this tab's own sessionStorage token
    const tabToken = sessionStorage.getItem("bugBattleToken");
    if (tabToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${tabToken}`;
    } else {
        const localToken = localStorage.getItem("bugBattleToken");
        if (localToken && (!config.headers || !config.headers.Authorization)) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${localToken}`;
        }
    }
    return config;
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);