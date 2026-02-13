import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/contexts/UserContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { RequireAuth } from "@/components/RequireAuth";
import AdminPage from "@/pages/admin";
import ViewerPage from "@/pages/viewer";
import DocsPage from "@/pages/docs";
import CampaignViewerPage from "@/pages/campaign-viewer";
import AdvancedCampaignPage from "@/pages/advanced-campaign";
import ComponentsPage from "@/pages/components";
import ComponentDetailPage from "@/pages/component-detail";
import CampaignDashboard from "@/pages/campaign-dashboard";
import UserSessionPage from "@/pages/user-session";
import BroadcastDetailPage from "@/pages/broadcast-detail";
import AppsPage from "@/pages/apps";
import AppDetailPage from "@/pages/app-detail";
import DashboardPage from "@/pages/dashboard";
import CampaignsPage from "@/pages/campaigns";
import BroadcastsPage from "@/pages/broadcasts";
import NewCampaignPage from "@/pages/new-campaign";
import SponsorsPage from "@/pages/sponsors";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/user-session" component={UserSessionPage} />

      <Route path="/">
        <RequireAuth><DashboardPage /></RequireAuth>
      </Route>

      <Route path="/apps">
        <RequireAuth><AppsPage /></RequireAuth>
      </Route>
      <Route path="/apps/:appId">
        <RequireAuth><AppDetailPage /></RequireAuth>
      </Route>

      <Route path="/campaigns">
        <RequireAuth><CampaignsPage /></RequireAuth>
      </Route>
      <Route path="/campaigns/new">
        <RequireAuth><NewCampaignPage /></RequireAuth>
      </Route>
      <Route path="/campaigns/:campaignId">
        <RequireAuth><CampaignDashboard /></RequireAuth>
      </Route>

      <Route path="/broadcasts">
        <RequireAuth><BroadcastsPage /></RequireAuth>
      </Route>
      <Route path="/broadcasts/:broadcastId">
        <RequireAuth><BroadcastDetailPage /></RequireAuth>
      </Route>

      <Route path="/sponsors">
        <RequireAuth><SponsorsPage /></RequireAuth>
      </Route>
      <Route path="/components">
        <RequireAuth><ComponentsPage /></RequireAuth>
      </Route>
      <Route path="/components/:id">
        <RequireAuth><ComponentDetailPage /></RequireAuth>
      </Route>
      <Route path="/docs" component={DocsPage} />

      <Route path="/campaign/:id/dashboard">
        <RequireAuth><CampaignDashboard /></RequireAuth>
      </Route>
      <Route path="/campaign/:id/advanced" component={AdvancedCampaignPage} />
      <Route path="/campaign/:id/admin" component={AdminPage} />
      <Route path="/campaign/:name/:id" component={CampaignViewerPage} />

      <Route path="/admin" component={AdminPage} />
      <Route path="/viewer" component={ViewerPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UserProvider>
          <TooltipProvider>
            <div className="min-h-screen bg-background text-foreground">
              <Toaster />
              <Router />
            </div>
          </TooltipProvider>
        </UserProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
