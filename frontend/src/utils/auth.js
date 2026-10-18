/**
 * Auth Storage Utility
 * Supports simultaneous multi-tab sessions in the same browser:
 * Uses sessionStorage (strictly isolated per tab) with fallback to localStorage.
 * This allows logging in as Participant 1 in Tab 1, Participant 2 in Tab 2, and Organizer in Tab 3
 * without tokens overwriting or conflicting with each other.
 */

export const getAuthToken = () => {
    return sessionStorage.getItem("bugBattleToken") || localStorage.getItem("bugBattleToken") || "";
};

export const getAuthUser = () => {
    const raw = sessionStorage.getItem("bugBattleUser") || localStorage.getItem("bugBattleUser");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const setAuthSession = (token, user) => {
    if (token) {
        // Store in this tab's sessionStorage for tab-level isolation
        sessionStorage.setItem("bugBattleToken", token);
        // Also keep in localStorage for default fallback
        localStorage.setItem("bugBattleToken", token);
    }
    if (user) {
        const uStr = typeof user === "string" ? user : JSON.stringify(user);
        sessionStorage.setItem("bugBattleUser", uStr);
        localStorage.setItem("bugBattleUser", uStr);
    }
};

export const clearAuthSession = (onlyThisTab = true) => {
    sessionStorage.removeItem("bugBattleToken");
    sessionStorage.removeItem("bugBattleUser");
    if (!onlyThisTab) {
        localStorage.removeItem("bugBattleToken");
        localStorage.removeItem("bugBattleUser");
    }
};
