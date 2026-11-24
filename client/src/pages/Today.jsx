import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";
import { Button, Card, EmptyState, ErrorBox, Loading, PageHeader, StatBox } from "../components/ui/index.jsx";
import OrderTable from "../components/OrderTable.jsx";
import { dhakaToday, formatMonth, formatShortDay, taka } from "../utils/format.js";

// Home page: what happened today, and the three things staff do most.
// All numbers come from the server (/orders/summary); the browser never
// downloads the full order list.
function Today() {
    const [summary, setSummary] = useState(null);
    const [orders, setOrders] = useState(null);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setError("");
        try {
            const [s, o] = await Promise.all([
                axios.get(`${apiUrl}/orders/summary`),
                axios.get(`${apiUrl}/orders`, { params: { day: dhakaToday(), limit: 200 } }),
            ]);
            setSummary(s.data);
            setOrders(o.data);
        } catch (err) {
            console.error("Error loading today:", err);
            setError("Could not load today's numbers. Is the server running?");
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const loading = !summary && !error;
    const week = summary?.lastSevenDays || [];
    const maxAmount = Math.max(1, ...week.map((d) => d.amount));

    return (
        <div className="space-y-5">
            <PageHeader
                title="Today"
                subtitle={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" })}
                actions={
                    <>
                        <Button to="/hallmark" size="lg">+ New Hallmark</Button>
                        <Button to="/xray" size="lg" variant="xray">+ New X-ray</Button>
                        <Button to="/customers?new=1" size="lg" variant="secondary">+ New customer</Button>
                    </>
                }
            />

            {error && <ErrorBox text={error} onRetry={load} />}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Link to="/orders?status=open" className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" aria-label="Orders waiting for pickup">
                    <StatBox
                        label="Waiting for pickup"
                        value={summary?.waiting?.total}
                        hint={summary?.waiting ? `${summary.waiting.ready} ready · ${summary.waiting.received} received` : null}
                        loading={loading}
                    />
                </Link>
                <StatBox
                    label="Orders today"
                    value={summary?.today.orders}
                    hint={summary ? `${summary.today.hallmark} hallmark · ${summary.today.xray} x-ray` : null}
                    loading={loading}
                />
                <StatBox
                    label="Taka today"
                    value={summary && taka(summary.today.amount)}
                    hint={summary ? `Cash received today ${taka(summary.cashToday)}` : null}
                    loading={loading}
                />
                <StatBox
                    label={summary ? `Taka in ${formatMonth(summary.month)}` : "Taka this month"}
                    value={summary && taka(summary.thisMonth.amount)}
                    hint={summary ? `${summary.thisMonth.orders} orders` : null}
                    loading={loading}
                />
                <StatBox
                    label="Total due (baki)"
                    value={summary && taka(summary.totalDue)}
                    hint={summary ? `${summary.customersWithDue} customers owe · ${summary.customers.toLocaleString("en-IN")} customers` : null}
                    loading={loading}
                />
            </div>

            <Card
                title={`Today's orders${orders ? ` (${orders.total})` : ""}`}
                actions={<Button to="/orders" variant="ghost" size="sm">All orders →</Button>}
                bodyClassName=""
            >
                {!orders && !error ? (
                    <Loading />
                ) : orders && orders.orders.length > 0 ? (
                    <OrderTable orders={orders.orders} showDate={false} onStatusChange={load} />
                ) : (
                    <EmptyState
                        title="No orders yet today"
                        hint="New orders will show here as soon as they are saved."
                        action={<Button to="/hallmark">+ New Hallmark</Button>}
                    />
                )}
            </Card>

            {week.length > 0 && (
                <Card title="Last 7 days">
                    <div className="flex h-40 items-end gap-2" role="img" aria-label="Taka per day for the last 7 days">
                        {week.map((d) => (
                            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                                <span className="text-xs tabular-nums text-gray-600">{d.amount ? taka(d.amount) : ""}</span>
                                <div
                                    className={`w-full max-w-[3rem] rounded-t ${d.day === summary.day ? "bg-blue-600" : "bg-blue-200"}`}
                                    style={{ height: `${Math.max(2, (d.amount / maxAmount) * 75)}%` }}
                                    title={`${d.orders} orders · ${taka(d.amount)}`}
                                />
                                <span className="text-xs text-gray-500">{formatShortDay(d.day)}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

export default Today;
