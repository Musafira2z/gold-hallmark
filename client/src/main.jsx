import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import {RouterProvider} from 'react-router-dom'
import router from './router/Router.jsx'
import 'react-toastify/dist/ReactToastify.css';
import UserContextProvider from "./context/UserContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import AuthGate from "./components/AuthGate.jsx";

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AuthProvider>
            <AuthGate>
                <UserContextProvider>
                    <RouterProvider router={router}/>
                </UserContextProvider>
            </AuthGate>
        </AuthProvider>
    </StrictMode>,
)
