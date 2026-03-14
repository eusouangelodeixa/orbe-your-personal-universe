import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-[100dvh] flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 shrink-0">
            <SidebarTrigger className="mr-4 text-muted-foreground hover:text-foreground" />
            <NotificationBell />
          </header>
          <main className="flex-1 overflow-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
