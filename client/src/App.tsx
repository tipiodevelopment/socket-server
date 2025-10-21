import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminPage from "@/pages/admin";
import ViewerPage from "@/pages/viewer";
import DocsPage from "@/pages/docs";
import CampaignsPage from "@/pages/campaigns";
import NewCampaignPage from "@/pages/new-campaign";
import CampaignViewerPage from "@/pages/campaign-viewer";
import AdvancedCampaignPage from "@/pages/advanced-campaign";
import ComponentsPage from "@/pages/components";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Main page - campaign management */}
      <Route path="/" component={CampaignsPage} />
      <Route path="/campaigns/new" component={NewCampaignPage} />
      <Route path="/components" component={ComponentsPage} />
      
      {/* Campaign-specific routes - more specific routes first */}
      <Route path="/campaign/:id/advanced" component={AdvancedCampaignPage} />
      <Route path="/campaign/:id/admin" component={AdminPage} />
      <Route path="/campaign/:name/:id" component={CampaignViewerPage} />
      
      {/* Legacy routes for backward compatibility */}
      <Route path="/admin" component={AdminPage} />
      <Route path="/viewer" component={ViewerPage} />
      <Route path="/docs" component={DocsPage} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark min-h-screen bg-background text-foreground">
          <Toaster />
          <Router />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
