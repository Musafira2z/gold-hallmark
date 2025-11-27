import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

function App() {
  const location = useLocation(); // Get the current location (route)

  // Check if the current route is the invoice page
  const isInvoicePage = location.pathname.includes('/invoice');

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Conditionally render Navbar and Sidebar */}
      {!isInvoicePage && (
        <div className="w-full flex-shrink-0">
          <Navbar />
        </div>
      )}
      
      {/* Only show Sidebar if it's not the Invoice page */}
      {!isInvoicePage && (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-auto">
            <div className="p-4 lg:p-6">
              <Outlet />
            </div>
          </div>
        </div>
      )}

      {/* Invoice page will show only the invoice content */}
      {isInvoicePage && <Outlet />}
    </div>
  );
}

export default App;
