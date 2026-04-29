import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, Pencil, Trash2, PlayCircle } from "lucide-react";
import { CampaignComponent, Component } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface ScheduledTabProps {
  campaignId: number;
}

export function ScheduledTab({ campaignId }: ScheduledTabProps) {
  const { toast } = useToast();
  const [editingComponent, setEditingComponent] = useState<(CampaignComponent & { component: Component }) | null>(null);

  const { data: campaignComponents = [], isLoading } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
  });

  const scheduledComponents = campaignComponents.filter(cc => cc.scheduledTime);

  const triggerNowMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}`, { status: 'active' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      toast({
        title: 'Component Activated',
        description: 'The component has been activated immediately.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to activate component.',
        variant: 'destructive',
      });
    },
  });

  const deleteComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('DELETE', `/api/campaigns/${campaignId}/components/${componentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      toast({
        title: 'Component Deleted',
        description: 'The scheduled component has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete component.',
        variant: 'destructive',
      });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ componentId, scheduledTime, endTime }: { componentId: string; scheduledTime: string; endTime?: string | null }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}`, { 
        scheduledTime, 
        endTime 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      setEditingComponent(null);
      toast({
        title: 'Schedule Updated',
        description: 'The component schedule has been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update schedule.',
        variant: 'destructive',
      });
    },
  });

  const getComponentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      banner: 'Banner',
      countdown: 'Countdown',
      carousel_auto: 'Auto Carousel',
      carousel_manual: 'Manual Carousel',
      product_spotlight: 'Product Spotlight',
      offer_badge: 'Offer Badge',
      offer_banner: 'Offer Banner',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <Card className="border-0">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading scheduled components...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Scheduled Components
          </CardTitle>
          <CardDescription>
            Components programmed to activate automatically at specific times
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledComponents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled components</p>
              <p className="text-sm mt-2">Add scheduling to components in the Components tab</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledComponents
                .sort((a, b) => {
                  if (!a.scheduledTime || !b.scheduledTime) return 0;
                  return new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
                })
                .map((cc) => (
                  <div
                    key={cc.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50 border"
                    data-testid={`scheduled-component-${cc.id}`}
                  >
                    <div className="flex-1 w-full">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={cc.status === 'active' ? 'default' : 'secondary'}
                          data-testid={`status-${cc.id}`}
                        >
                          {cc.status}
                        </Badge>
                        <span className="font-medium" data-testid={`name-${cc.id}`}>
                          {cc.component.name}
                        </span>
                        <Badge variant="outline" data-testid={`type-${cc.id}`}>
                          {getComponentTypeLabel(cc.component.type)}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {cc.scheduledTime && (
                          <div className="flex items-center gap-2" data-testid={`scheduled-time-${cc.id}`}>
                            <Clock className="w-4 h-4" />
                            <span>Start: {new Date(cc.scheduledTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          </div>
                        )}
                        {cc.endTime && (
                          <div className="flex items-center gap-2" data-testid={`end-time-${cc.id}`}>
                            <Clock className="w-4 h-4" />
                            <span>End: {new Date(cc.endTime).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          </div>
                        )}
                        {!cc.endTime && (
                          <div className="text-xs">No end time - runs until manually stopped</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      {cc.status === 'inactive' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => triggerNowMutation.mutate(String(cc.id))}
                          disabled={triggerNowMutation.isPending}
                          data-testid={`button-trigger-now-${cc.id}`}
                        >
                          <PlayCircle className="w-4 h-4 mr-2" />
                          Trigger Now
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingComponent(cc)}
                        data-testid={`button-edit-${cc.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this scheduled component?')) {
                            deleteComponentMutation.mutate(String(cc.id));
                          }
                        }}
                        disabled={deleteComponentMutation.isPending}
                        data-testid={`button-delete-${cc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingComponent} onOpenChange={(open) => !open && setEditingComponent(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the scheduled times for {editingComponent?.component.name}
            </DialogDescription>
          </DialogHeader>
          {editingComponent && (
            <EditScheduleForm
              component={editingComponent}
              onSubmit={(data) => updateScheduleMutation.mutate({
                componentId: String(editingComponent.id),
                ...data
              })}
              onCancel={() => setEditingComponent(null)}
              isLoading={updateScheduleMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EditScheduleFormProps {
  component: CampaignComponent & { component: Component };
  onSubmit: (data: { scheduledTime: string; endTime?: string | null }) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function EditScheduleForm({ component, onSubmit, onCancel, isLoading }: EditScheduleFormProps) {
  const [scheduledTime, setScheduledTime] = useState(
    component.scheduledTime 
      ? new Date(component.scheduledTime).toISOString().slice(0, 16) 
      : ''
  );
  const [endTime, setEndTime] = useState(
    component.endTime 
      ? new Date(component.endTime).toISOString().slice(0, 16) 
      : ''
  );
  const [hasEndTime, setHasEndTime] = useState(!!component.endTime);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      scheduledTime,
      endTime: hasEndTime ? endTime : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="scheduledTime" className="text-sm font-medium">
          Scheduled Start Time
        </label>
        <input
          id="scheduledTime"
          type="datetime-local"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          className="w-full px-3 py-2 border rounded-md"
          required
          data-testid="input-scheduled-time"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="hasEndTime"
          checked={hasEndTime}
          onChange={(e) => setHasEndTime(e.target.checked)}
          className="rounded"
          data-testid="checkbox-has-end-time"
        />
        <label htmlFor="hasEndTime" className="text-sm font-medium">
          Set end time
        </label>
      </div>

      {hasEndTime && (
        <div className="space-y-2">
          <label htmlFor="endTime" className="text-sm font-medium">
            Scheduled End Time
          </label>
          <input
            id="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required={hasEndTime}
            data-testid="input-end-time"
          />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-save">
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
