import { Outlet, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

function App() {
  const location = useLocation();

  // The invoice (memo) page is printed, so it gets no menu or top bar.
  if (location.pathname.startsWith("/invoice")) {
    return <Outlet />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
      {/* Was inside <RouterProvider> in main.jsx, where it never rendered. */}
      <ToastContainer position="bottom-right" autoClose={2500} />
    </div>
  );
}

export default App;
