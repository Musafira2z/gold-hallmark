import { useContext, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import { Button, Card, EmptyState, Loading } from "./ui/index.jsx";
import { formatDay } from "../utils/format.js";
import { formatContactForDisplay } from "../utils/formatContact.js";

// Owner only: customers that were "deleted" (kept in the database) and a Restore button.
function DeletedCustomers() {
    const { setCustomers } = useContext(UserContext);
    const [open, setOpen] = useState(false);
    const [list, setList] = useState(null);

    const load = async () => {
        try {
            const res = await axios.get(`${apiUrl}/users`, { params: { deleted: "only" } });
            setList(res.data);
        } catch (err) {
            toast.error(err.response?.data?.error || "Could not load deleted customers.");
        }
    };

    const toggle = () => {
        if (!open && !list) load();
        setOpen(!open);
    };

    const restore = async (c) => {
        try {
            const res = await axios.post(`${apiUrl}/users/${c._id}/restore`);
            toast.success(`#${c.customerID} ${c.name} is back.`);
            setList((prev) => prev.filter((x) => x._id !== c._id));
            setCustomers((prev) => [...prev, res.data]);
        } catch (err) {
            toast.error(err.response?.data?.error || "Restore failed.");
        }
    };

    return (
        <Card
            title="Deleted customers"
            actions={<Button variant="ghost" size="sm" onClick={toggle}>{open ? "Hide" : "Show"}</Button>}
            bodyClassName={open ? "" : "hidden"}
        >
            {open && (!list ? <Loading /> : list.length === 0 ? <EmptyState title="No deleted customers" /> : (
                <ul className="divide-y divide-gray-100 text-sm">
                    {list.map((c) => (
                        <li key={c._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                            <span>
                                <span className="font-mono text-gray-500">#{c.customerID}</span>{" "}
                                <span className="font-medium text-gray-900">{c.name}</span>{" "}
                                <span className="text-gray-500">{formatContactForDisplay(c.contact)}</span>
                                <span className="block text-xs text-gray-500">
                                    Deleted {c.deletedAt ? formatDay(c.deletedAt) : ""}{c.deletedBy ? ` by ${c.deletedBy}` : ""}
                                </span>
                            </span>
                            <Button size="sm" onClick={() => restore(c)}>Restore</Button>
                        </li>
                    ))}
                </ul>
            ))}
        </Card>
    );
}

export default DeletedCustomers;
