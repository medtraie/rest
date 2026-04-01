import {
  MapPin,
  PackageSearch,
  Truck,
  UserRound,
  ArrowRightLeft,
  Factory,
  FileText,
  LayoutDashboard,
  PackagePlus,
  UsersRound,
  ShieldAlert,
  HandCoins,
  Wallet,
  Fuel,
  Wrench,
  SlidersHorizontal,
  Route,
  Calculator,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useApp } from "@/contexts/AppContext";
import type { PermissionKey } from "@/contexts/AppContext";
import { useLanguage, useT } from "@/contexts/LanguageContext";

type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

const menuItems: MenuItem[] = [
  { title: "dashboard", url: "/", icon: LayoutDashboard, permission: "dashboard" },
  { title: "inventory", url: "/inventory", icon: PackageSearch, permission: "inventory" },
  { title: "drivers", url: "/drivers", icon: UsersRound, permission: "drivers" },
  { title: "clients", url: "/clients", icon: UserRound, permission: "clients" },
  { title: "trucks", url: "/trucks", icon: Truck, permission: "trucks" },
  { title: "factory", url: "/factory", icon: Factory, permission: "factory" },
  { title: "supplyReturn", url: "/supply-return", icon: Route, permission: "supply-return" },
  { title: "petitCamion", url: "/petit-camion", icon: Truck, permission: "petit-camion" },
  { title: "exchanges", url: "/exchanges", icon: ArrowRightLeft, permission: "exchanges" },
  { title: "transfer", url: "/transfer", icon: Route, permission: "transfer" },
  { title: "defectiveStock", url: "/defective-stock", icon: ShieldAlert, permission: "defective-stock" },
  { title: "fuelManagement", url: "/fuel-management", icon: Fuel, permission: "fuel-management" },
  { title: "repairs", url: "/repairs", icon: Wrench, permission: "repairs" },
  { title: "expenses", url: "/expenses", icon: Wallet, permission: "expenses" },
  { title: "depensesCopt", url: "/depenses-copt", icon: PackagePlus, permission: "depenses-copt" },
  { title: "liveMap", url: "/live-map", icon: MapPin, permission: "live-map" },
  { title: "revenue", url: "/revenue", icon: HandCoins, permission: "revenue" },
  { title: "reports", url: "/reports", icon: FileText, permission: "reports" },
  { title: "accounting", url: "/accounting", icon: Calculator, permission: "accounting" },
  { title: "settings", url: "/settings", icon: SlidersHorizontal, permission: "settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { hasPermission } = useApp();
  const { language, setLanguage } = useLanguage();
  const t = useT();
  const visibleItems = menuItems.filter(item => hasPermission(item.permission));
  const side = language === "ar" ? "right" : "left";

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    [
      "app-nav-link group relative flex items-center w-full rounded-xl px-2 py-2 transition-all duration-300 ease-out",
      isActive
        ? "app-nav-link-active text-white shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.18)]"
        : "text-sidebar-foreground/85 hover:text-white hover:bg-white/10 hover:translate-x-0.5",
    ].join(" ");

  return (
    <Sidebar side={side} className={`app-nav-sidebar ${collapsed ? "w-14" : "w-64"}`} collapsible="icon">
      <SidebarContent>
        <div className="app-nav-brand border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <div className="app-nav-brand-icon flex h-8 w-8 items-center justify-center rounded-lg shadow-sm transition-transform duration-300 ease-out hover:scale-105">
              <img src="/sft-logo.svg?v=20260322sft10" alt="SFT GAZ logo" className="h-6 w-6 rounded-md object-contain" loading="lazy" width="24" height="24" decoding="async" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold uppercase tracking-tight text-white">{t("brand")}</h1>
                <p className="text-[10px] font-semibold uppercase text-white/75">{t("sidebar.tagline")}</p>
                <div className="mt-2 flex gap-1">
                  <button type="button" className={`px-2 py-1 text-xs rounded-md ${language === "fr" ? "bg-white/20 text-white" : "bg-white/10 text-white/80"}`} onClick={() => setLanguage("fr")}>{t("language.french")}</button>
                  <button type="button" className={`px-2 py-1 text-xs rounded-md ${language === "ar" ? "bg-white/20 text-white" : "bg-white/10 text-white/80"}`} onClick={() => setLanguage("ar")}>{t("language.arabic")}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="px-3">{t("sidebar.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 pb-2">
            <div
              className="max-h-[calc(100vh-8.5rem)] overflow-y-auto pr-1"
              style={{ scrollbarWidth: "thin" }}
            >
              <SidebarMenu className="gap-1.5">
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={t(`nav.${item.title}`, item.title)}>
                    <NavLink to={item.url} end className={getNavCls}>
                      {({ isActive }) => (
                        <>
                          {!collapsed && (
                            <span
                              className={[
                                "absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full transition-all duration-300 ease-out",
                                isActive ? "w-1 bg-primary" : "w-0 bg-transparent",
                              ].join(" ")}
                            />
                          )}
                          <span
                            className={[
                              "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 ease-out",
                              item.url === "/trucks" ? "app-nav-camions-icon" : "",
                              item.url === "/petit-camion" ? "app-nav-allogaz-icon" : "",
                              isActive
                                ? "bg-white/20 text-white shadow-sm"
                                : "bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white",
                            ].join(" ")}
                          >
                            <item.icon className="w-4 h-4" />
                          </span>
                          {!collapsed && (
                            <span className="ml-3 flex items-center gap-2 text-sm font-medium">
                              {t(`nav.${item.title}`, item.title)}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
