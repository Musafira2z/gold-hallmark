import PropTypes from "prop-types";
import { useAuth } from "../context/AuthContext.jsx";
import Login from "../pages/Login.jsx";

// Nothing of the app (and no customer data) loads until someone is logged in.
function AuthGate({ children }) {
    const { status } = useAuth();
    if (status === "loading") {
        return (
            <div className="flex min-h-screen items-center justify-center gap-3 text-gray-500" role="status">
                <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
                Loading…
            </div>
        );
    }
    if (status !== "ready") return <Login />;
    return children;
}

AuthGate.propTypes = { children: PropTypes.node.isRequired };

// Wraps owner-only pages; staff see a short note instead.
export function OwnerOnly({ children }) {
    const { isOwner } = useAuth();
    if (!isOwner) {
        return <p className="rounded-lg border border-gray-200 bg-white p-6 text-gray-700">Only the owner can open this page.</p>;
    }
    return children;
}

OwnerOnly.propTypes = { children: PropTypes.node.isRequired };

export default AuthGate;
