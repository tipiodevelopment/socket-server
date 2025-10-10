import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useWebSocket } from '@/hooks/use-websocket';
import { ConnectionStatusComponent } from '@/components/connection-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WebSocketEvent } from '@shared/schema';

export default function ViewerPage() {
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  
  const { connectionStatus, clientCount } = useWebSocket({
    onMessage: (event) => {
      setEvents(prev => [event, ...prev.slice(0, 29)]);
      setLastEvent(event);
      
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification(`Ny hendelse: ${event.type}`, {
          body: getEventDescription(event),
          icon: '/favicon.ico'
        });
      }
    }
  });

  useEffect(() => {
    // Request notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const getEventDescription = (event: WebSocketEvent): string => {
    switch (event.type) {
      case 'product':
        return `${event.data.name} - ${event.data.price}`;
      case 'poll':
        return event.data.question;
      case 'contest':
        return `${event.data.name} - ${event.data.prize}`;
      default:
        return 'Ukjent hendelse';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'product':
        return (
          <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
            </svg>
          </div>
        );
      case 'poll':
        return (
          <div className="w-16 h-16 bg-secondary/10 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
            </svg>
          </div>
        );
      case 'contest':
        return (
          <div className="w-16 h-16 bg-amber-500/10 rounded-lg flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Hendelsesvisning</h1>
                <p className="text-sm text-muted-foreground">Hendelser i sanntid</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <ConnectionStatusComponent 
                status={connectionStatus} 
                clientCount={clientCount} 
              />
              <div className="flex space-x-2">
                <Link href="/">
                  <Button variant="outline" size="sm" data-testid="link-admin">
                    Admin
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button variant="outline" size="sm" data-testid="link-docs">
                    Docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Current Event Display */}
        {lastEvent && (
          <div className="mb-8">
            <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getEventIcon(lastEvent.type)}
                    <div>
                      <div className="text-2xl font-bold">Siste hendelse</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(lastEvent.timestamp).toLocaleString('nb-NO')}
                      </div>
                    </div>
                  </div>
                  {lastEvent.campaignLogo && (
                    <div className="flex-shrink-0">
                      <img 
                        src={lastEvent.campaignLogo} 
                        alt="Campaign logo" 
                        className="h-16 w-16 object-contain"
                        data-testid="campaign-logo-latest"
                      />
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lastEvent.type === 'product' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <h3 className="text-xl font-semibold mb-2">{lastEvent.data.name}</h3>
                      <p className="text-muted-foreground mb-2">{lastEvent.data.description}</p>
                      <div className="text-2xl font-bold text-primary">{lastEvent.data.price}</div>
                    </div>
                    {lastEvent.data.imageUrl && (
                      <div className="flex justify-center">
                        <img 
                          src={lastEvent.data.imageUrl} 
                          alt={lastEvent.data.name}
                          className="w-32 h-32 object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {lastEvent.type === 'poll' && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4">{lastEvent.data.question}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {lastEvent.data.options.map((option, index) => (
                        <Button 
                          key={index} 
                          variant="outline" 
                          className="justify-start"
                          data-testid={`poll-option-${index}`}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      Varighet: {lastEvent.data.duration} sekunder
                    </div>
                  </div>
                )}
                
                {lastEvent.type === 'contest' && (
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{lastEvent.data.name}</h3>
                    <p className="text-muted-foreground mb-4">{lastEvent.data.prize}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Frist:</span>
                        <div className="font-medium">{lastEvent.data.deadline}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Maks deltakere:</span>
                        <div className="font-medium">{lastEvent.data.maxParticipants}</div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Event History */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Hendelseshistorikk</h2>
          
          {events.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <svg className="w-16 h-16 text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                </svg>
                <h3 className="text-lg font-semibold mb-2">Ingen hendelser</h3>
                <p className="text-muted-foreground text-center">
                  Koble til WebSocket for å se hendelser i sanntid.<br />
                  Gå til administrasjonspanelet for å sende testhendelser.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event, index) => (
                <Card key={`${event.type}-${event.timestamp}-${index}`} className="event-card" data-testid={`event-card-${event.type}`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-3 text-base">
                      <div className="flex items-center space-x-3 min-w-0">
                        {getEventIcon(event.type)}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">
                            {event.type === 'product' && event.data.name}
                            {event.type === 'poll' && 'Avstemning'}
                            {event.type === 'contest' && event.data.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString('nb-NO')}
                          </div>
                        </div>
                      </div>
                      {event.campaignLogo && (
                        <div className="flex-shrink-0">
                          <img 
                            src={event.campaignLogo} 
                            alt="Campaign logo" 
                            className="h-10 w-10 object-contain"
                            data-testid={`campaign-logo-${index}`}
                          />
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {event.type === 'product' && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {event.data.description}
                        </p>
                        <div className="text-lg font-bold text-primary">{event.data.price}</div>
                      </div>
                    )}
                    
                    {event.type === 'poll' && (
                      <div>
                        <p className="text-sm font-medium mb-2">{event.data.question}</p>
                        <div className="text-xs text-muted-foreground">
                          {event.data.options.length} alternativer • {event.data.duration}s
                        </div>
                      </div>
                    )}
                    
                    {event.type === 'contest' && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {event.data.prize}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Fram til {event.data.deadline}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
