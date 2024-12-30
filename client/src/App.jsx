import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/Navbar";

function App() {
  const location = useLocation(); // Get the current location (route)

  // Check if the current route is the invoice page
  const isInvoicePage = location.pathname.includes('/invoice');

  return (
    <div className="bg-[#E0F2F1]">
      {/* Conditionally render Navbar and Sidebar */}
      {!isInvoicePage && (
        <div className="w-[100%]">
          <Navbar />
        </div>
      )}
      
      {/* Only show Sidebar if it's not the Invoice page */}
      {!isInvoicePage && (
        <div className="lg:flex">
          <div className="ml-2 lg:ml-12 my-10">
            <Sidebar />
          </div>
          <div className="w-full">
            <div className="mx-2 lg:mx-8">
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
