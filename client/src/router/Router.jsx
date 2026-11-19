import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import Today from "../pages/Today";
import Customers from "../pages/Customers";
import Orders from "../pages/Orders";
import UpdateUser from "../components/UpdateUser";
import XRay from "../pages/Xray";
import Hallmark from "../pages/Hallmark";
import Invoice from "../pages/Invoice";
import CustomerProfile from "../pages/CustomerProfile";

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { path: "/", element: <Today /> },
            { path: "/customers", element: <Customers /> },
            { path: "/customers/:customerID", element: <CustomerProfile /> },
            { path: "/orders", element: <Orders /> },
            { path: "/hallmark", element: <Hallmark /> },
            { path: "/xray", element: <XRay /> },
            { path: "/updateuser/:id", element: <UpdateUser /> },
            { path: "/invoice/:id", element: <Invoice /> },
            // Old links keep working (bookmarks, staff habit).
            { path: "/add-customer", element: <Navigate to="/customers" replace /> },
            { path: "/account", element: <Navigate to="/" replace /> },
            { path: "/summary", element: <Navigate to="/orders?day=today" replace /> },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
]);

export default router;
