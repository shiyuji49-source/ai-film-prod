// DESIGN: "鎏光机" 导演手册工业风暗色系
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectManagerProvider } from "./contexts/ProjectManagerContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import Home from "./pages/Home";
import AdminPage from "./pages/AdminPage";
import CreditsPage from "./pages/CreditsPage";
import AssetsPage from "./pages/AssetsPage";
import AuthPage from "./pages/AuthPage";
import ApiSettingsPage from "./pages/ApiSettingsPage";
import OverseasWorkflow from "./pages/OverseasWorkflow";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/admin"} component={AdminPage} />
      <Route path={"/credits"} component={CreditsPage} />
      <Route path={"/assets"} component={AssetsPage} />
      <Route path={"/api-settings"} component={ApiSettingsPage} />
      <Route path={"/overseas"} component={OverseasWorkflow} />
      <Route path={"/auth"}>{() => <AuthPage />}</Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ProjectManagerProvider>
          <ProjectProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </ProjectProvider>
        </ProjectManagerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
