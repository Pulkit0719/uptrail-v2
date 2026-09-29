import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { LiveMentorPage, LiveOpportunitiesPage } from "./pages/LivePages";
import LiveProfilePage from "./pages/LiveProfilePage";
import LiveOpportunityPageV2 from "./pages/LiveOpportunityPageV2";
import LiveProfilePageV2 from "./pages/LiveProfilePageV2";
import Onboarding from "./pages/Onboarding";
import { EnhancedProjectsPage, EnhancedRoadmapPage } from "./pages/ProgressPages";
import PersistentRoadmapPage from "./pages/PersistentRoadmapPage";
import { CareerExplorerPage, CareerGPSPage, DashboardPage, MentorPage, OpportunitiesPage, ProfilePage, ProjectsPage, RoadmapPage, SkillsPage } from "./pages/WorkspacePages";
import NotFound from "@/pages/NotFound";
import LoginPage from "./pages/Login";
import { Route, Switch } from "wouter";

function Router() {
  return <Switch>
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
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
