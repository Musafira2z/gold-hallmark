import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "../App";
import Today from "../pages/Today";
import Customers from "../pages/Customers";
import Orders from "../pages/Orders";
import Shops from "../pages/Shops";
import UpdateUser from "../components/UpdateUser";
import XRay from "../pages/Xray";
import Hallmark from "../pages/Hallmark";
import Invoice from "../pages/Invoice";
import CustomerProfile from "../pages/CustomerProfile";
import EditOrder from "../pages/EditOrder";
import Staff from "../pages/Staff";
import Activity from "../pages/Activity";
import ChangePassword from "../pages/ChangePassword";
import { OwnerOnly } from "../components/AuthGate";

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            { path: "/", element: <Today /> },
            { path: "/customers", element: <Customers /> },
            { path: "/customers/:customerID", element: <CustomerProfile /> },
            { path: "/orders", element: <Orders /> },
            { path: "/shops", element: <Shops /> },
            { path: "/orders/:id/edit", element: <EditOrder /> },
            { path: "/hallmark", element: <Hallmark /> },
            { path: "/xray", element: <XRay /> },
            { path: "/updateuser/:id", element: <UpdateUser /> },
            { path: "/invoice/:id", element: <Invoice /> },
            { path: "/staff", element: <OwnerOnly><Staff /></OwnerOnly> },
            { path: "/activity", element: <OwnerOnly><Activity /></OwnerOnly> },
            { path: "/account/password", element: <ChangePassword /> },
            // Old links keep working (bookmarks, staff habit).
            { path: "/add-customer", element: <Navigate to="/customers" replace /> },
            { path: "/account", element: <Navigate to="/" replace /> },
            { path: "/summary", element: <Navigate to="/orders?day=today" replace /> },
            { path: "*", element: <Navigate to="/" replace /> },
        ],
    },
]);

export default router;
