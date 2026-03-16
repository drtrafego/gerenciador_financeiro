import { stackServerApp } from "@/stack/server";
import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await stackServerApp.getUser({ or: "redirect" });

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
