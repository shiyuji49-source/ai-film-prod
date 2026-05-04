// DESIGN: "鎏光机" 导演手册工业风暗色系
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProjectManagerProvider } from "./contexts/ProjectManagerContext";
import { ProjectProvider } from "./contexts/ProjectContext";
import PremiumStudio from "./pages/PremiumStudio";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={PremiumStudio} />
      <Route path={"/auth"} component={PremiumStudio} />
      <Route path={"/assets"} component={PremiumStudio} />
      <Route path={"/overseas"} component={PremiumStudio} />
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
