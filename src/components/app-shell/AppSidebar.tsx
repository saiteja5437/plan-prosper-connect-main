import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Briefcase, Building2, Clock, Database, FileBarChart, Gauge, LayoutDashboard, Layers, Receipt, Tags, User, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }> };

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Projects", url: "/projects", icon: Briefcase },
      { title: "My Timesheet", url: "/timesheet", icon: Clock },
      { title: "Invoices", url: "/invoices", icon: Receipt },
    ],
  },
  {
    label: "Masters",
    items: [
      { title: "Clients", url: "/clients", icon: Building2 },
      { title: "Resources", url: "/resources", icon: Users },
    ],
  },
  {
    label: "Analytics",
    items: [
      { title: "Portfolio Health", url: "/analytics/portfolio", icon: BarChart3 },
      { title: "Utilization", url: "/analytics/utilization", icon: Gauge },
      { title: "Report Center", url: "/analytics/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Master Data", url: "/admin/master-data", icon: Database },
      { title: "Lookup Master", url: "/admin/lookups", icon: Tags },
      { title: "My Profile", url: "/profile", icon: User },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="size-8 rounded-md bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shrink-0">
            <Layers className="size-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">PPM Platform</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Enterprise</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = pathname === item.url || pathname.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}