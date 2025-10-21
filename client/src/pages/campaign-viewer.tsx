import { useState, useEffect } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import type { WebSocketEvent, Campaign } from '@shared/schema';
import { ConnectionStatusComponent } from '@/components/connection-status';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CampaignViewerPage() {
  const params = useParams<{ name: string; id: string }>();
  const campaignId = params.id ? parseInt(params.id) : undefined;
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Fetch campaign info
  const { data: campaign } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId,
  });

  // Fetch historical events from API
  const { data: historicalEvents } = useQuery<WebSocketEvent[]>({
    queryKey: ['/api/events', campaignId],
    enabled: !!campaignId,
  });

  // Load historical events into state when data arrives
  useEffect(() => {
    if (historicalEvents && historicalEvents.length > 0) {
      setEvents(historicalEvents);
    }
  }, [historicalEvents]);

  // WebSocket connection
  const { connectionStatus } = useWebSocket({
    campaignId,
    onMessage: (event) => {
      setEvents((prev) => {
        // Check if event already exists in history (prevent duplicates)
        const exists = prev.some(e => 
          e.type === event.type && 
          e.timestamp === event.timestamp &&
          JSON.stringify(e.data) === JSON.stringify(event.data)
        );
        if (exists) return prev;
        return [event, ...prev];
      });
      
      // Show browser notification for new events
      if (notificationPermission === 'granted') {
        const title = event.type === 'product' 
          ? `New product: ${event.data.name}`
          : event.type === 'poll'
          ? `New poll: ${event.data.question}`
          : `New contest: ${event.data.name}`;
          
        new Notification(title, {
          icon: event.campaignLogo || '/icon.png',
          badge: event.campaignLogo || '/icon.png'
        });
      }
    },
  });

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  if (!campaignId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No campaign selected</h1>
          <Link href="/">
            <Button>Back to campaigns</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-0 bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Link href="/" className="w-full sm:w-auto">
                <Button variant="ghost" size="sm" data-testid="link-back" className="w-full sm:w-auto">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to campaigns
                </Button>
              </Link>
              <div>
                <h1 className="text-base sm:text-xl font-bold">{campaign?.name || 'Loading...'}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Live events</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <ConnectionStatusComponent status={connectionStatus} />
              {notificationPermission === 'default' && (
                <Button 
                  onClick={requestNotificationPermission}
                  variant="outline"
                  size="sm"
                  data-testid="button-enable-notifications"
                  className="text-xs sm:text-sm"
                >
                  Enable notifications
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {events.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Waiting for events</h3>
            <p className="text-muted-foreground">
              New events will appear here when they are sent
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event, index) => (
              <div
                key={index}
                className="bg-card border-0 rounded-lg p-6 animate-in slide-in-from-top"
                data-testid={`event-${event.type}-${index}`}
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        event.type === 'product' ? 'bg-primary/20 text-primary' :
                        event.type === 'poll' ? 'bg-secondary/20 text-secondary' :
                        'bg-accent/20 text-accent'
                      }`}>
                        {event.type === 'product' ? 'PRODUCT' : event.type === 'poll' ? 'POLL' : 'CONTEST'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString('nb-NO')}
                      </span>
                    </div>
                    
                    {event.type === 'product' && (
                      <>
                        <h3 className="text-lg sm:text-xl font-bold mb-2" data-testid={`product-name-${index}`}>{event.data.name}</h3>
                        <p className="text-sm sm:text-base text-muted-foreground mb-2">{event.data.description}</p>
                        <p className="text-xl sm:text-2xl font-bold text-primary">{event.data.price}</p>
                        {event.data.imageUrl && (
                          <img 
                            src={event.data.imageUrl} 
                            alt={event.data.name}
                            className="mt-4 rounded-lg w-full sm:max-w-md"
                          />
                        )}
                      </>
                    )}
                    
                    {event.type === 'poll' && (
                      <>
                        <h3 className="text-lg sm:text-xl font-bold mb-4">{event.data.question}</h3>
                        <div className="space-y-2">
                          {event.data.options.map((option, i) => (
                            <div
                              key={i}
                              className="bg-secondary/10 border-0 rounded-lg p-3 hover:bg-secondary/20 transition-colors cursor-pointer flex items-center gap-3"
                            >
                              {typeof option === 'string' ? option : (
                                <>
                                  {option.imageUrl && (
                                    <img src={option.imageUrl} alt={option.text} className="w-8 h-8 object-contain rounded" />
                                  )}
                                  <span className="text-sm sm:text-base">{option.text}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-4">
                          Duration: {event.data.duration} seconds
                        </p>
                      </>
                    )}
                    
                    {event.type === 'contest' && (
                      <>
                        <h3 className="text-lg sm:text-xl font-bold mb-2">{event.data.name}</h3>
                        <div className="bg-accent/10 border-0 rounded-lg p-4 mb-2">
                          <p className="font-semibold text-accent">Prize:</p>
                          <p className="text-sm sm:text-base">{event.data.prize}</p>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Deadline: {new Date(event.data.deadline).toLocaleDateString('en-US')} | 
                          Max participants: {event.data.maxParticipants}
                        </p>
                      </>
                    )}
                  </div>
                  
                  {event.campaignLogo && (
                    <img 
                      src={event.campaignLogo} 
                      alt="Campaign logo"
                      className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
