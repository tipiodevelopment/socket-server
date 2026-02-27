import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag } from "lucide-react";
import { Campaign } from "@shared/schema";

interface IntegrationsTabProps {
  campaignId: number;
  campaign: Campaign;
}

export function IntegrationsTab({ campaignId, campaign }: IntegrationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Commerce Integration */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Commerce Channel
          </CardTitle>
          <CardDescription>
            Connect a Commerce channel to fetch products in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commerce-channel-id">Channel ID</Label>
              <Input 
                id="commerce-channel-id"
                value={campaign.reachuChannelId || ''} 
                placeholder="No channel configured"
                disabled
                data-testid="input-commerce-channel-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commerce-api-key">API Key</Label>
              <Input 
                id="commerce-api-key"
                type="password"
                value={campaign.reachuApiKey || ''} 
                placeholder="No API key configured"
                disabled
                data-testid="input-commerce-api-key"
              />
            </div>
          </div>
          {campaign.reachuChannelId && (
            <Badge variant="default" className="bg-green-600" data-testid="badge-commerce-connected">
              ✓ Commerce Connected
            </Badge>
          )}
          {!campaign.reachuChannelId && (
            <div className="text-sm text-muted-foreground">
              No Commerce channel connected. Configure this integration in the campaign Settings tab.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Info */}
      <Card className="border-0 bg-muted/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-medium mb-1">About Integrations</h4>
              <p className="text-sm text-muted-foreground">
                The Commerce API key is configured per campaign in the Settings tab. It is delivered dynamically to the SDK via the config endpoint — it is never hardcoded in the app.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
