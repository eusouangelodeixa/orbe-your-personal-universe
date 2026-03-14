import {
  Wallet,
  GraduationCap,
  Dumbbell,
  CheckSquare,
  LayoutDashboard,
  Receipt,
  Bot,
  LogOut,
  PiggyBank,
  Calendar,
  UserCircle,
  Utensils,
  TrendingUp,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { OrbeIcon } from "@/components/OrbeIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
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
  { title: "Tutor Central IA", url: "/estudos/chat", icon: Bot },
];

const fitItems = [
  { title: "Dashboard", url: "/fit", icon: LayoutDashboard },
  { title: "Treino", url: "/fit/treino", icon: Dumbbell },
  { title: "Alimentação", url: "/fit/alimentacao", icon: Utensils },
  { title: "Evolução", url: "/fit/progresso", icon: TrendingUp },
  { title: "Nutricionista IA", url: "/fit/chat", icon: Bot },
];

const taskItems = [
  { title: "Tarefas", url: "/tarefas", icon: CheckSquare },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isAdmin, isLoading: isRoleLoading } = useUserRole();
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <OrbeIcon size={collapsed ? 28 : 36} />
          {!collapsed && (
            <span className="text-2xl font-display tracking-[4px] text-foreground">
              OR<span className="text-primary">BE</span>
            </span>
          )}
        </div>

        {/* Financeiro */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 font-syne text-[10px] font-semibold tracking-[2px] uppercase text-primary">
            <Wallet className="h-4 w-4" />
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
                      className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-syne text-xs tracking-wide">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Estudos */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 font-syne text-[10px] font-semibold tracking-[2px] uppercase text-primary">
            <GraduationCap className="h-4 w-4" />
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
                      className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-syne text-xs tracking-wide">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Fit */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 font-syne text-[10px] font-semibold tracking-[2px] uppercase text-primary">
            <Dumbbell className="h-4 w-4" />
            {!collapsed && <span>Fit</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {fitItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-syne text-xs tracking-wide">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tarefas */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 font-syne text-[10px] font-semibold tracking-[2px] uppercase text-primary">
            <CheckSquare className="h-4 w-4" />
            {!collapsed && <span>Tarefas</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {taskItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="font-syne text-xs tracking-wide">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        <SidebarMenu>
          {!isRoleLoading && isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/admin"
                  end
                  className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-semibold"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  {!collapsed && <span className="font-syne text-xs tracking-wide">Admin</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/perfil"
                end
                className="text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                activeClassName="bg-primary/10 text-primary border-l-2 border-primary font-semibold"
              >
                <UserCircle className="mr-2 h-4 w-4" />
                {!collapsed && <span className="font-syne text-xs tracking-wide">Perfil</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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
