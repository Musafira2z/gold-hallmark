// Small shared building blocks so every page looks and behaves the same.
// Plain Tailwind only. One main colour (blue); red only for delete / errors.
import { Link } from "react-router-dom";
import PropTypes from "prop-types";

const BUTTON_STYLES = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 border border-blue-600",
    xray: "bg-purple-600 text-white hover:bg-purple-700 border border-purple-600",
    secondary: "bg-white text-gray-800 hover:bg-gray-50 border border-gray-300",
    danger: "bg-white text-red-600 hover:bg-red-50 border border-red-200",
    ghost: "bg-transparent text-blue-700 hover:bg-blue-50 border border-transparent",
};
const BUTTON_SIZES = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-3 text-base",
};

export function Button({ to, variant = "primary", size = "md", className = "", children, ...rest }) {
    const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${BUTTON_SIZES[size]} ${className}`;
    if (to) {
        return (
            <Link to={to} className={cls} {...rest}>
                {children}
            </Link>
        );
    }
    return (
        <button type="button" className={cls} {...rest}>
            {children}
        </button>
    );
}
Button.propTypes = {
    to: PropTypes.string,
    variant: PropTypes.oneOf(Object.keys(BUTTON_STYLES)),
    size: PropTypes.oneOf(Object.keys(BUTTON_SIZES)),
    className: PropTypes.string,
    children: PropTypes.node,
};

export function PageHeader({ title, subtitle, actions }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
}
PageHeader.propTypes = { title: PropTypes.node.isRequired, subtitle: PropTypes.node, actions: PropTypes.node };

export function Card({ title, actions, children, className = "", bodyClassName = "p-4" }) {
    return (
        <section className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
            {(title || actions) && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                    {title && <h2 className="font-semibold text-gray-900">{title}</h2>}
                    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}
Card.propTypes = {
    title: PropTypes.node,
    actions: PropTypes.node,
    children: PropTypes.node,
    className: PropTypes.string,
    bodyClassName: PropTypes.string,
};

export function StatBox({ label, value, hint, loading }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                {loading ? <span className="inline-block h-7 w-20 bg-gray-100 rounded animate-pulse" /> : value}
            </p>
            {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
    );
}
StatBox.propTypes = { label: PropTypes.node.isRequired, value: PropTypes.node, hint: PropTypes.node, loading: PropTypes.bool };

export function Loading({ text = "Loading…" }) {
    return (
        <div className="flex items-center justify-center gap-3 py-10 text-gray-500" role="status">
            <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
            {text}
        </div>
    );
}
Loading.propTypes = { text: PropTypes.string };

export function EmptyState({ title, hint, action }) {
    return (
        <div className="py-10 text-center">
            <p className="font-medium text-gray-700">{title}</p>
            {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
EmptyState.propTypes = { title: PropTypes.node.isRequired, hint: PropTypes.node, action: PropTypes.node };

export function ErrorBox({ text, onRetry }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{text}</span>
            {onRetry && (
                <Button variant="danger" size="sm" onClick={onRetry}>
                    Try again
                </Button>
            )}
        </div>
    );
}
ErrorBox.propTypes = { text: PropTypes.node.isRequired, onRetry: PropTypes.func };

export function Pager({ page, pages, onChange }) {
    if (pages <= 1) return null;
    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
                ← Previous
            </Button>
            <span className="text-gray-600">
                Page {page} of {pages}
            </span>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
                Next →
            </Button>
        </div>
    );
}
Pager.propTypes = { page: PropTypes.number.isRequired, pages: PropTypes.number.isRequired, onChange: PropTypes.func.isRequired };

export function TypeBadge({ type }) {
    const styles = {
        hallmark: "bg-blue-50 text-blue-700 border-blue-200",
        xray: "bg-purple-50 text-purple-700 border-purple-200",
    };
    const labels = { hallmark: "Hallmark", xray: "X-ray" };
    return (
        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[type] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
            {labels[type] || "Other"}
        </span>
    );
}
TypeBadge.propTypes = { type: PropTypes.string };
