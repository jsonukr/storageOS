import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { StatusBar } from "./StatusBar";
import { UpdateBanner } from "../components/UpdateBanner";

export function AppLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <UpdateBanner />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNav />
          <main className="flex flex-1 flex-col overflow-hidden bg-surface">
            <Outlet />
          </main>
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
