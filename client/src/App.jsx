import { Outlet } from "react-router-dom"
import Sidebar from "./Components/Sidebar";
import Navbar from "./Components/Navbar";
function App() {
  return (
    <div className=" bg-[#E0F2F1]">
      <div className="w-[100%]">
        <Navbar />
      </div>
      <div className="lg:flex">
        <div className="ml-2 lg:ml-12 my-10">
          <Sidebar />
        </div>
        <div className="w-full ">
          <div className="mx-2 lg:mx-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
