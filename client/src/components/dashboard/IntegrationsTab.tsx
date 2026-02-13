import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Radio } from "lucide-react";
import { Campaign } from "@shared/schema";

interface IntegrationsTabProps {
  campaignId: number;
  campaign: Campaign;
}

export function IntegrationsTab({ campaignId, campaign }: IntegrationsTabProps) {
  return (
    <div className="space-y-6">
      {/* Reachu Integration */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Reachu.io Channel
          </CardTitle>
          <CardDescription>
            Connect a Reachu channel to fetch products in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reachu-channel-id">Channel ID</Label>
              <Input 
                id="reachu-channel-id"
                value={campaign.reachuChannelId || ''} 
                placeholder="No channel configured"
                disabled
                data-testid="input-reachu-channel-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reachu-api-key">API Key</Label>
              <Input 
                id="reachu-api-key"
                type="password"
                value={campaign.reachuApiKey || ''} 
                placeholder="No API key configured"
                disabled
                data-testid="input-reachu-api-key"
              />
            </div>
          </div>
          {campaign.reachuChannelId && (
            <Badge variant="default" className="bg-green-600" data-testid="badge-reachu-connected">
              ✓ Connected to Reachu
            </Badge>
          )}
          {!campaign.reachuChannelId && (
            <div className="text-sm text-muted-foreground">
              No Reachu channel connected. Configure this integration during campaign creation.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tipio Integration */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Tipio.no Liveshow
          </CardTitle>
          <CardDescription>
            Connect this campaign to a Tipio liveshow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipio Integration</Label>
            <p className="text-sm text-muted-foreground">Livestream data managed via campaign settings</p>
          </div>
          
          {/* Show livestream data if available */}
          {campaign.tipioLivestreamData ? (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Livestream Details</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                {(() => {
                  const data = campaign.tipioLivestreamData as any;
                  return (
                    <>
                      {data.title ? <div key="title">Title: {data.title}</div> : null}
                      {data.broadcasting !== undefined ? (
                        <div key="status">
                          Status: {data.broadcasting ? 
                            <Badge variant="default" className="bg-red-600 ml-2">● LIVE</Badge> : 
                            <Badge variant="secondary" className="ml-2">Offline</Badge>
                          }
                        </div>
                      ) : null}
                      {data.date ? <div key="date">Start: {new Date(data.date).toLocaleString()}</div> : null}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
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
                Integrations are configured when creating a campaign and cannot be modified afterwards. 
                To change integrations, you'll need to create a new campaign with the desired configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
