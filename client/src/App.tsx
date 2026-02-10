import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserProvider } from "@/contexts/UserContext";
import { RequireAuth } from "@/components/RequireAuth";
import AdminPage from "@/pages/admin";
import ViewerPage from "@/pages/viewer";
import DocsPage from "@/pages/docs";
import CampaignViewerPage from "@/pages/campaign-viewer";
import AdvancedCampaignPage from "@/pages/advanced-campaign";
import ComponentsPage from "@/pages/components";
import CampaignDashboard from "@/pages/campaign-dashboard";
import UserSessionPage from "@/pages/user-session";
import BroadcastDetailPage from "@/pages/broadcast-detail";
import AppsPage from "@/pages/apps";
import AppDetailPage from "@/pages/app-detail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/user-session" component={UserSessionPage} />

      <Route path="/">
        <Redirect to="/apps" />
      </Route>

      <Route path="/apps">
        <RequireAuth><AppsPage /></RequireAuth>
      </Route>
      <Route path="/apps/:appId">
        <RequireAuth><AppDetailPage /></RequireAuth>
      </Route>
      <Route path="/apps/:appId/campaigns/:campaignId">
        <RequireAuth><CampaignDashboard /></RequireAuth>
      </Route>
      <Route path="/apps/:appId/campaigns/:campaignId/broadcasts/:broadcastId">
        <RequireAuth><BroadcastDetailPage /></RequireAuth>
      </Route>

      <Route path="/components">
        <RequireAuth><ComponentsPage /></RequireAuth>
      </Route>
      <Route path="/docs" component={DocsPage} />

      <Route path="/campaigns">
        <Redirect to="/apps" />
      </Route>
      <Route path="/client-apps">
        <Redirect to="/apps" />
      </Route>
      <Route path="/broadcasts">
        <Redirect to="/apps" />
      </Route>
      <Route path="/campaign/:id/dashboard">
        <RequireAuth><CampaignDashboard /></RequireAuth>
      </Route>
      <Route path="/campaign/:id/advanced" component={AdvancedCampaignPage} />
      <Route path="/campaign/:id/admin" component={AdminPage} />
      <Route path="/campaign/:name/:id" component={CampaignViewerPage} />
      <Route path="/broadcasts/:broadcastId" component={BroadcastDetailPage} />

      <Route path="/admin" component={AdminPage} />
      <Route path="/viewer" component={ViewerPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <TooltipProvider>
          <div className="dark min-h-screen bg-background text-foreground">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
