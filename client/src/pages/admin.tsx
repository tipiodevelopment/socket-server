import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { ConnectionStatusComponent } from '@/components/connection-status';
import { EventLog } from '@/components/event-log';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { WebSocketEvent } from '@shared/schema';

export default function AdminPage() {
  const { toast } = useToast();
  const [eventHistory, setEventHistory] = useState<WebSocketEvent[]>([]);
  
  // WebSocket connection
  const { connectionStatus, clientCount } = useWebSocket({
    onMessage: (event) => {
      setEventHistory(prev => [event, ...prev.slice(0, 49)]);
    }
  });

  // Product form state
  const [productForm, setProductForm] = useState({
    name: 'iPhone 15 Pro Max',
    description: 'El último modelo con titanio y cámara de 48MP',
    price: '$1,199',
    imageUrl: 'https://images.unsplash.com/photo-1592286927505-b7e00a46f74f'
  });

  // Poll form state
  const [pollForm, setPollForm] = useState({
    question: '¿Cuál es tu smartphone favorito?',
    options: 'iPhone, Samsung, Google Pixel, Otro',
    duration: '60'
  });

  // Contest form state
  const [contestForm, setContestForm] = useState({
    name: 'Gran Sorteo Tech 2024',
    prize: 'Gana un MacBook Pro M3, AirPods Pro y más',
    deadline: '2024-12-31',
    maxParticipants: '1000'
  });

  // Fetch server status
  const { data: serverStatus } = useQuery<{
    server: string;
    connectedClients: number;
    wsPort: string;
    httpPort: number | string;
  }>({
    queryKey: ['/api/status'],
    refetchInterval: 5000
  });

  // Mutations for sending events
  const productMutation = useMutation({
    mutationFn: (data: typeof productForm) => 
      apiRequest('POST', '/api/events/product', data),
    onSuccess: () => {
      toast({
        title: "Evento de Producto Enviado",
        description: "El evento ha sido enviado a todos los clientes conectados",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el evento de producto",
        variant: "destructive",
      });
    }
  });

  const pollMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('POST', '/api/events/poll', {
        ...data,
        options: data.options.split(',').map((opt: string) => opt.trim()),
        duration: parseInt(data.duration)
      }),
    onSuccess: () => {
      toast({
        title: "Encuesta Iniciada",
        description: "La encuesta ha sido enviada a todos los clientes conectados",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo iniciar la encuesta",
        variant: "destructive",
      });
    }
  });

  const contestMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest('POST', '/api/events/contest', {
        ...data,
        maxParticipants: parseInt(data.maxParticipants)
      }),
    onSuccess: () => {
      toast({
        title: "Concurso Lanzado",
        description: "El concurso ha sido enviado a todos los clientes conectados",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo lanzar el concurso",
        variant: "destructive",
      });
    }
  });

  const handleClearLog = () => {
    setEventHistory([]);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado",
        description: "Texto copiado al portapapeles",
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">WebSocket Event Server</h1>
                <p className="text-sm text-muted-foreground">Panel de Administración - Demo</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <ConnectionStatusComponent 
                status={connectionStatus} 
                clientCount={clientCount} 
              />
              <div className="flex space-x-2">
                <Link href="/viewer">
                  <Button variant="outline" size="sm" data-testid="link-viewer">
                    Visor
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Event Triggers */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Disparar Eventos</h2>
              <p className="text-muted-foreground mb-6">Selecciona un tipo de evento para enviar a todos los clientes conectados</p>
              
              {/* Product Event Card */}
              <div className="bg-card border border-border rounded-lg p-6 mb-4 event-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Mostrar Producto</h3>
                      <p className="text-sm text-muted-foreground">Envía información de producto destacado</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-medium rounded-full">PRODUCTO</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="product-name">Nombre del Producto</Label>
                    <Input
                      id="product-name"
                      value={productForm.name}
                      onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-product-name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="product-description">Descripción</Label>
                    <Textarea
                      id="product-description"
                      rows={3}
                      value={productForm.description}
                      onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                      data-testid="input-product-description"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="product-price">Precio</Label>
                      <Input
                        id="product-price"
                        value={productForm.price}
                        onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                        data-testid="input-product-price"
                      />
                    </div>
                    <div>
                      <Label htmlFor="product-image">URL Imagen</Label>
                      <Input
                        id="product-image"
                        value={productForm.imageUrl}
                        onChange={(e) => setProductForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                        data-testid="input-product-image"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => productMutation.mutate(productForm)}
                    disabled={productMutation.isPending}
                    data-testid="button-send-product"
                  >
                    {productMutation.isPending ? 'Enviando...' : 'Enviar Evento de Producto'}
                  </Button>
                </div>
              </div>

              {/* Poll Event Card */}
              <div className="bg-card border border-border rounded-lg p-6 mb-4 event-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Iniciar Encuesta</h3>
                      <p className="text-sm text-muted-foreground">Crea una encuesta interactiva para usuarios</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-secondary/20 text-secondary text-xs font-medium rounded-full">ENCUESTA</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="poll-question">Pregunta</Label>
                    <Input
                      id="poll-question"
                      value={pollForm.question}
                      onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                      data-testid="input-poll-question"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="poll-options">Opciones (separadas por coma)</Label>
                    <Input
                      id="poll-options"
                      value={pollForm.options}
                      onChange={(e) => setPollForm(prev => ({ ...prev, options: e.target.value }))}
                      data-testid="input-poll-options"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="poll-duration">Duración (segundos)</Label>
                    <Input
                      id="poll-duration"
                      type="number"
                      value={pollForm.duration}
                      onChange={(e) => setPollForm(prev => ({ ...prev, duration: e.target.value }))}
                      data-testid="input-poll-duration"
                    />
                  </div>
                  
                  <Button 
                    className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    onClick={() => pollMutation.mutate(pollForm)}
                    disabled={pollMutation.isPending}
                    data-testid="button-send-poll"
                  >
                    {pollMutation.isPending ? 'Enviando...' : 'Iniciar Encuesta'}
                  </Button>
                </div>
              </div>

              {/* Contest Event Card */}
              <div className="bg-card border border-border rounded-lg p-6 event-card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Lanzar Concurso</h3>
                      <p className="text-sm text-muted-foreground">Anuncia un nuevo concurso con premios</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-xs font-medium rounded-full">CONCURSO</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="contest-name">Nombre del Concurso</Label>
                    <Input
                      id="contest-name"
                      value={contestForm.name}
                      onChange={(e) => setContestForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-contest-name"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="contest-prize">Descripción del Premio</Label>
                    <Textarea
                      id="contest-prize"
                      rows={3}
                      value={contestForm.prize}
                      onChange={(e) => setContestForm(prev => ({ ...prev, prize: e.target.value }))}
                      data-testid="input-contest-prize"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contest-deadline">Fecha Límite</Label>
                      <Input
                        id="contest-deadline"
                        type="date"
                        value={contestForm.deadline}
                        onChange={(e) => setContestForm(prev => ({ ...prev, deadline: e.target.value }))}
                        data-testid="input-contest-deadline"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contest-participants">Participantes Max</Label>
                      <Input
                        id="contest-participants"
                        type="number"
                        value={contestForm.maxParticipants}
                        onChange={(e) => setContestForm(prev => ({ ...prev, maxParticipants: e.target.value }))}
                        data-testid="input-contest-participants"
                      />
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => contestMutation.mutate(contestForm)}
                    disabled={contestMutation.isPending}
                    data-testid="button-send-contest"
                  >
                    {contestMutation.isPending ? 'Enviando...' : 'Lanzar Concurso'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Event Log & Info */}
          <div className="space-y-6">
            <EventLog 
              events={eventHistory} 
              onClear={handleClearLog}
            />

            {/* Connection Info */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Información de Conexión</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">WebSocket URL</Label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm font-mono">
                      {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`)}
                      data-testid="button-copy-ws-url"
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">Puerto HTTP</Label>
                  <code className="block px-3 py-2 bg-background border border-border rounded text-sm font-mono">
                    {serverStatus?.httpPort || window.location.port || '5000'}
                  </code>
                </div>
                
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-3">Estado del Servidor</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>WebSocket Server</span>
                    <span className="text-green-500 font-medium">✓ Activo</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span>HTTP Server</span>
                    <span className="text-green-500 font-medium">✓ Activo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
