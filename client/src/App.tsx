import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";

const LoginPage = lazy(() => import("./pages/Login"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const DashboardPage = lazy(() => import("./pages/WorkspacePages").then(module => ({ default: module.DashboardPage })));
const CareerGPSPage = lazy(() => import("./pages/WorkspacePages").then(module => ({ default: module.CareerGPSPage })));
const CareerExplorerPage = lazy(() => import("./pages/WorkspacePages").then(module => ({ default: module.CareerExplorerPage })));
const SkillsPage = lazy(() => import("./pages/WorkspacePages").then(module => ({ default: module.SkillsPage })));
const PersistentRoadmapPage = lazy(() => import("./pages/PersistentRoadmapPage"));
const EnhancedProjectsPage = lazy(() => import("./pages/ProgressPages").then(module => ({ default: module.EnhancedProjectsPage })));
const LiveOpportunityPageV2 = lazy(() => import("./pages/LiveOpportunityPageV2"));
const LiveMentorPage = lazy(() => import("./pages/LivePages").then(module => ({ default: module.LiveMentorPage })));
const LiveProfilePageV2 = lazy(() => import("./pages/LiveProfilePageV2"));

function Router() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#F4F7F3] text-sm font-semibold text-[#577068]">Loading Uptrail…</main>}><Switch>
    <Route path="/" component={Home} />
    <Route path="/login" component={LoginPage} />
    <Route path="/onboarding" component={Onboarding} />
    <Route path="/dashboard" component={DashboardPage} />
    <Route path="/gps" component={CareerGPSPage} />
    <Route path="/explore" component={CareerExplorerPage} />
    <Route path="/skills" component={SkillsPage} />
    <Route path="/roadmap" component={PersistentRoadmapPage} />
    <Route path="/projects" component={EnhancedProjectsPage} />
    <Route path="/opportunities" component={LiveOpportunityPageV2} />
    <Route path="/mentor" component={LiveMentorPage} />
    <Route path="/profile" component={LiveProfilePageV2} />
    <Route component={NotFound} />
  </Switch></Suspense>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
