import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Home from "../pages/Home";
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
                element: <Home />
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
                path: "/invoice/:id", // Invoice page route
                element: <Invoice />,
              },
        ]
    },
]);
export default router;