import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import { apiUrl } from "./UserContext.jsx";

// Login state for the whole app (plans/10-login-security.md).
// The token is kept in localStorage and sent with every API call.
const TOKEN_KEY = "gh_token";
const readToken = () => {
    try {
        return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
        return "";
    }
};
const writeToken = (token) => {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        // private window or blocked storage: the login just won't survive a reload
    }
};

let currentToken = readToken();
let onLoggedOut = () => {};

// Every axios call carries the token; a 401 from the API means "log in again".
axios.interceptors.request.use((config) => {
    if (currentToken && config.url && config.url.startsWith(apiUrl)) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${currentToken}`;
    }
    return config;
});
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url || "";
        if (error.response?.status === 401 && url.startsWith(apiUrl) && !url.includes("/auth/login")) {
            onLoggedOut();
        }
        return Promise.reject(error);
    }
);

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    // status: "loading" | "setup" (no accounts yet) | "login" | "ready"
    const [status, setStatus] = useState("loading");
    const [staff, setStaff] = useState(null);
    const [error, setError] = useState("");

    const applyToken = (token, who) => {
        currentToken = token;
        writeToken(token);
        setStaff(who);
        setStatus(token ? "ready" : "login");
    };

    const logoutLocal = useCallback(() => {
        currentToken = "";
        writeToken("");
        setStaff(null);
        setStatus("login");
    }, []);
    onLoggedOut = logoutLocal;

    useEffect(() => {
        const start = async () => {
            try {
                if (currentToken) {
                    const me = await axios.get(`${apiUrl}/auth/me`);
                    setStaff(me.data.staff);
                    setStatus("ready");
                    return;
                }
                const res = await axios.get(`${apiUrl}/auth/status`);
                setStatus(res.data.setupNeeded ? "setup" : "login");
            } catch (err) {
                if (err.response?.status === 401) {
                    logoutLocal();
                    const res = await axios.get(`${apiUrl}/auth/status`).catch(() => null);
                    setStatus(res?.data?.setupNeeded ? "setup" : "login");
                } else {
                    setError("Can't reach the server. Is the app running?");
                    setStatus("login");
                }
            }
        };
        start();
    }, [logoutLocal]);

    const value = useMemo(
        () => ({
            status,
            staff,
            error,
            isOwner: staff?.role === "owner",
            login: async (username, password) => {
                const res = await axios.post(`${apiUrl}/auth/login`, { username, password });
                applyToken(res.data.token, res.data.staff);
            },
            setup: async (name, username, password) => {
                const res = await axios.post(`${apiUrl}/auth/setup`, { name, username, password });
                applyToken(res.data.token, res.data.staff);
            },
            changePassword: async (currentPassword, newPassword) => {
                const res = await axios.post(`${apiUrl}/auth/password`, { currentPassword, newPassword });
                applyToken(res.data.token, staff);
            },
            logout: async () => {
                await axios.post(`${apiUrl}/auth/logout`).catch(() => {});
                logoutLocal();
            },
        }),
        [status, staff, error, logoutLocal]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };
