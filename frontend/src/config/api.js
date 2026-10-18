/**
 * Centralized API Configuration
 * Supports local dev and production cloud deployment (Vercel / Render / Tunnel).
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, "")}/api`
    : (typeof window !== "undefined" && window.location.port === "5173"
        ? `http://${window.location.hostname}:5000/api`
        : `${typeof window !== "undefined" ? window.location.origin : ""}/api`);

export default API_BASE_URL;

