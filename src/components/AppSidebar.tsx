import {
  Wallet,
  GraduationCap,
  Dumbbell,
  CheckSquare,
  LayoutDashboard,
  Receipt,
  Bot,
  Lock,
  LogOut,
  PiggyBank,
  BookOpen,
  Calendar,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { OrbeIcon } from "@/components/OrbeIcon";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const financeItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Planilha", url: "/planilha", icon: Receipt },
  { title: "Cofrinho", url: "/cofrinho", icon: PiggyBank },
  { title: "Consultor IA", url: "/consultor", icon: Bot },
];

const studiesItems = [
  { title: "Dashboard", url: "/estudos", icon: LayoutDashboard },
  { title: "Disciplinas", url: "/disciplinas", icon: GraduationCap },
  { title: "Agenda", url: "/agenda", icon: Calendar },
];

const comingSoon = [
  { title: "Fit", icon: Dumbbell },
  { title: "Tarefas", icon: CheckSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5">
          <OrbeIcon size={collapsed ? 28 : 36} />
          {!collapsed && (
            <span className="text-xl font-bold font-display tracking-tight">
              ORBE
            </span>
          )}
        </div>

        {/* Financeiro */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {!collapsed && <span>Financeiro</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Estudos */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            {!collapsed && <span>Estudos</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studiesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed ? "Em breve" : ""}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comingSoon.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton disabled className="opacity-40 cursor-not-allowed">
                    <item.icon className="mr-2 h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                    {!collapsed && <Lock className="ml-auto h-3 w-3" />}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
