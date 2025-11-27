import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Dashboard from "../pages/Dashboard";
import AddCustomer from "../pages/AddCustomer";
import Orders from "../pages/Orders";
import Account from "../pages/Account";
import DaySummary from "../components/DaySummary";
import UpdateUser from "../components/UpdateUser";
import XRay from "../pages/Xray";
import Hallmark from "../pages/Hallmark";
import Invoice from "../pages/Invoice";

const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            {
                path: "/",
                element: <Dashboard />
            },
            {
                path: "/add-customer",
                element: <AddCustomer />
            },
            {
                path: "/orders",
                element: <Orders />
            },
            {
                path: "/account",
                element: <Account />
            },
            {
                path: "/updateuser/:id",
                element: <UpdateUser />
            },
            {
                path: "/xray",
                element: <XRay />
            },
            {
                path: "/hallmark",
                element: <Hallmark />
            },
            {
                path: "/summary",
                element: <DaySummary />
            },
            {
                path: "/invoice/:id",
                element: <Invoice />,
            },
        ]
    },
]);
export default router;