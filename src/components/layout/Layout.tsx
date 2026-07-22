import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import ToastContainer from "@/components/shared/Toast";

export default function Layout() {
  return (
    <div className="min-h-screen bg-[#0F0F23] text-white">
      <div className="max-w-lg mx-auto pb-20">
        <Outlet />
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
}