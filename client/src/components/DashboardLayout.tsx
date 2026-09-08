import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { BarChart3, Bot, BriefcaseBusiness, Compass, GraduationCap, LayoutDashboard, LogOut, Map, PanelLeft, Route, UserRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { UptrailLogo } from "./UptrailLogo";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Map, label: "Career GPS", path: "/gps" },
  { icon: Compass, label: "Explore careers", path: "/explore" },
  { icon: BarChart3, label: "Skills", path: "/skills" },
  { icon: Route, label: "Roadmap", path: "/roadmap" },
  { icon: PanelLeft, label: "Projects", path: "/projects" },
  { icon: BriefcaseBusiness, label: "Opportunities", path: "/opportunities" },
  { icon: Bot, label: "AI Mentor", path: "/mentor" },
];
const SIDEBAR_WIDTH_KEY = "uptrail-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 224;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children, allowDemo = false }: { children: React.ReactNode; allowDemo?: boolean }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); }, [sidebarWidth]);
  if (loading && !allowDemo) return <DashboardLayoutSkeleton />;
  if (!user && !allowDemo) return <div className="grid min-h-screen place-items-center bg-[#F7F7F2] p-5"><div className="w-full max-w-md rounded-[1.8rem] bg-white p-9 text-center shadow-[0_20px_55px_rgba(24,48,47,0.1)]"><UptrailLogo className="justify-center" /><h1 className="mt-7 font-display text-3xl font-semibold tracking-[-0.05em] text-[#18302F]">Your path is waiting.</h1><p className="mt-3 text-sm leading-6 text-[#6A7972]">Sign in to save your profile, evidence, milestones, and career direction.</p><Button onClick={() => startLogin()} className="mt-7 h-11 w-full rounded-xl bg-[#18302F] font-bold text-white hover:bg-[#244442]">Sign in to Uptrail</Button></div></div>;
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent allowDemo={allowDemo} setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, allowDemo, setSidebarWidth }: { children: React.ReactNode; allowDemo: boolean; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find((item) => item.path === location);
  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);
  useEffect(() => {
    function move(event: MouseEvent) { if (!isResizing) return; const left = sidebarRef.current?.getBoundingClientRect().left ?? 0; const width = event.clientX - left; if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width); }
    function up() { setIsResizing(false); }
    if (isResizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }
    return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
  }, [isResizing, setSidebarWidth]);
  const displayName = user?.name || (allowDemo ? "Career explorer" : "Uptrail member");
  const initials = displayName.slice(0, 2).toUpperCase();
  return <><div ref={sidebarRef} className="relative"><Sidebar collapsible="icon" className="border-r border-[#E6ECE7] bg-white" disableTransition={isResizing}><SidebarHeader className="h-[76px] px-3 py-4"><div className="flex items-center gap-2"><button onClick={toggleSidebar} className="grid size-9 shrink-0 place-items-center rounded-xl text-[#6E7E77] transition-colors hover:bg-[#F0F5F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F7863]" aria-label="Toggle navigation"><PanelLeft className="size-4" /></button>{!isCollapsed && <UptrailLogo />}</div></SidebarHeader><SidebarContent className="px-3 py-2"><p className="px-2 pb-2 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-[#98A49E] group-data-[collapsible=icon]:hidden">Navigate</p><SidebarMenu className="gap-1">{menuItems.map((item) => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className={cn("h-10 rounded-xl px-3 font-semibold text-[#61716A] transition-all hover:bg-[#F2F7F3] hover:text-[#18302F] data-[active=true]:bg-[#EAF4EE] data-[active=true]:text-[#176A55]", location === item.path && "shadow-none")}><item.icon className="size-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><div className="mt-7 rounded-2xl bg-[#18302F] p-3 text-white group-data-[collapsible=icon]:hidden"><div className="flex items-center gap-2"><div className="grid size-7 place-items-center rounded-lg bg-[#F4D793] text-[#18302F]"><GraduationCap className="size-3.5" /></div><p className="text-xs font-bold">Your career GPS</p></div><p className="mt-3 text-[0.7rem] leading-5 text-white/60">Your destination is Frontend Developer. Keep your next move visible.</p><button onClick={() => setLocation("/gps")} className="mt-3 text-xs font-bold text-[#F4D793]">View route →</button></div></SidebarContent><SidebarFooter className="p-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton isActive={location === "/profile"} onClick={() => setLocation("/profile")} tooltip="Profile" className="h-10 rounded-xl px-3 font-semibold text-[#61716A] hover:bg-[#F2F7F3] hover:text-[#18302F] data-[active=true]:bg-[#EAF4EE] data-[active=true]:text-[#176A55]"><UserRound className="size-4" /><span>Profile</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu><DropdownMenu><DropdownMenuTrigger asChild><button className="mt-3 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[#F2F7F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F7863]"><Avatar className="size-8 shrink-0 border border-[#E3EBE5]"><AvatarFallback className="bg-[#E8F2EC] text-[0.65rem] font-bold text-[#1F7863]">{initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-bold text-[#314841]">{displayName}</p><p className="mt-0.5 truncate text-[0.65rem] text-[#83918B]">{allowDemo && !user ? "Preview workspace" : user?.email}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48 rounded-xl"><DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer"><UserRound className="mr-2 size-4" />Profile</DropdownMenuItem>{user && <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 size-4" />Sign out</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></SidebarFooter></Sidebar><div className={cn("absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#1F7863]/20", isCollapsed && "hidden")} onMouseDown={() => !isCollapsed && setIsResizing(true)} /></div><SidebarInset className="min-h-screen bg-[#F7F8F5]">{isMobile && <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#E6ECE7] bg-white/95 px-4 backdrop-blur"><div className="flex items-center gap-3"><SidebarTrigger className="size-9 rounded-xl border border-[#E1E8E2] bg-white" /><div><p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#8B9792]">Uptrail</p><p className="text-sm font-bold text-[#263A35]">{activeMenuItem?.label ?? "Career space"}</p></div></div><UptrailLogo compact /></div>}<main className="min-h-screen p-4 sm:p-6 lg:p-8">{children}</main></SidebarInset></>;
}

