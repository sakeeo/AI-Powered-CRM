import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { requireSession } from "@/lib/session";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

async function Shell({ children }: { children: React.ReactNode }) {
  // Status sidebar (collapse) disimpan di cookie oleh komponen shadcn.
  // Guard server-side: validasi session ke database; tanpa session → /login.
  const session = await requireSession();
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={{ name: session.user.name, email: session.user.email }} />
      <SidebarInset className="min-w-0">
        <AppTopbar />
        <div className="flex-1 p-3 sm:p-4 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
