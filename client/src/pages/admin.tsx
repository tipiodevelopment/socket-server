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
import { Checkbox } from '@/components/ui/checkbox';
import type { WebSocketEvent } from '@shared/schema';

interface ProductForm {
  id: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  selected?: boolean;
}

interface PollForm {
  id: number;
  question: string;
  options: string;
  duration: string;
}

interface ContestForm {
  id: number;
  name: string;
  prize: string;
  deadline: string;
  maxParticipants: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [eventHistory, setEventHistory] = useState<WebSocketEvent[]>([]);
  
  // WebSocket connection
  const { connectionStatus, clientCount } = useWebSocket({
    onMessage: (event) => {
      setEventHistory(prev => [event, ...prev.slice(0, 49)]);
    }
  });

  // Product forms state (array) - 3 examples ready to send
  const [productForms, setProductForms] = useState<ProductForm[]>([
    {
      id: Date.now(),
      name: 'iPhone 15 Pro Max',
      description: 'El último modelo con titanio y cámara de 48MP. Disponible en colores titanio natural, azul, blanco y negro.',
      price: '$1,199',
      imageUrl: 'https://images.unsplash.com/photo-1592286927505-b7e00a46f74f?w=800&q=80'
    },
    {
      id: Date.now() + 1,
      name: 'MacBook Air M3',
      description: 'El portátil más delgado de Apple con chip M3, hasta 18 horas de batería y pantalla Liquid Retina de 13"',
      price: '$1,099',
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'
    },
    {
      id: Date.now() + 2,
      name: 'AirPods Pro (2da Gen)',
      description: 'Cancelación activa de ruido, audio espacial personalizado y hasta 6 horas de reproducción',
      price: '$249',
      imageUrl: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800&q=80'
    }
  ]);

  // Poll forms state (array) - 3 examples ready to send
  const [pollForms, setPollForms] = useState<PollForm[]>([
    {
      id: Date.now() + 3,
      question: '¿Cuál es tu smartphone favorito?',
      options: 'iPhone, Samsung Galaxy, Google Pixel, Xiaomi, Otro',
      duration: '60'
    },
    {
      id: Date.now() + 4,
      question: '¿Qué función nueva te gustaría ver en la próxima actualización?',
      options: 'Modo oscuro mejorado, Widgets personalizables, Mejor batería, IA integrada',
      duration: '90'
    },
    {
      id: Date.now() + 5,
      question: '¿Cuánto pagarías por un streaming sin anuncios?',
      options: '$5/mes, $10/mes, $15/mes, No pagaría',
      duration: '120'
    }
  ]);

  // Contest forms state (array) - 3 examples ready to send
  const [contestForms, setContestForms] = useState<ContestForm[]>([
    {
      id: Date.now() + 6,
      name: 'Gran Sorteo Tech 2024',
      prize: 'Gana un MacBook Pro M3, AirPods Pro, Apple Watch Ultra y suscripción anual Apple One',
      deadline: '2024-12-31',
      maxParticipants: '1000'
    },
    {
      id: Date.now() + 7,
      name: 'Concurso Gaming Ultimate',
      prize: 'PlayStation 5 Pro, 3 juegos AAA, suscripción PS Plus de 1 año y auriculares Sony Pulse 3D',
      deadline: '2024-11-30',
      maxParticipants: '500'
    },
    {
      id: Date.now() + 8,
      name: 'Sorteo Viaje Tech Conference',
      prize: 'Vuelo + Hotel para asistir a Apple WWDC 2025 en California (todo incluido)',
      deadline: '2025-03-15',
      maxParticipants: '250'
    }
  ]);

  // Add new product form
  const addProductForm = () => {
    setProductForms(prev => [...prev, {
      id: Date.now(),
      name: '',
      description: '',
      price: '',
      imageUrl: ''
    }]);
  };

  // Add new poll form
  const addPollForm = () => {
    setPollForms(prev => [...prev, {
      id: Date.now(),
      question: '',
      options: '',
      duration: '60'
    }]);
  };

  // Add new contest form
  const addContestForm = () => {
    setContestForms(prev => [...prev, {
      id: Date.now(),
      name: '',
      prize: '',
      deadline: '',
      maxParticipants: '100'
    }]);
  };

  // Remove forms
  const removeProductForm = (id: number) => {
    if (productForms.length > 1) {
      setProductForms(prev => prev.filter(form => form.id !== id));
    }
  };

  const removePollForm = (id: number) => {
    if (pollForms.length > 1) {
      setPollForms(prev => prev.filter(form => form.id !== id));
    }
  };

  const removeContestForm = (id: number) => {
    if (contestForms.length > 1) {
      setContestForms(prev => prev.filter(form => form.id !== id));
    }
  };

  // Update forms
  const updateProductForm = (id: number, field: keyof Omit<ProductForm, 'id'>, value: string) => {
    setProductForms(prev => prev.map(form => 
      form.id === id ? { ...form, [field]: value } : form
    ));
  };

  const updatePollForm = (id: number, field: keyof Omit<PollForm, 'id'>, value: string) => {
    setPollForms(prev => prev.map(form => 
      form.id === id ? { ...form, [field]: value } : form
    ));
  };

  const updateContestForm = (id: number, field: keyof Omit<ContestForm, 'id'>, value: string) => {
    setContestForms(prev => prev.map(form => 
      form.id === id ? { ...form, [field]: value } : form
    ));
  };

  // Toggle product selection
  const toggleProductSelection = (id: number) => {
    setProductForms(prev => prev.map(form => 
      form.id === id ? { ...form, selected: !form.selected } : form
    ));
  };

  // Send selected products
  const sendSelectedProducts = async () => {
    const selectedProducts = productForms.filter(form => form.selected);
    if (selectedProducts.length === 0) {
      toast({
        title: "Sin Selección",
        description: "Por favor selecciona al menos un producto",
        variant: "destructive",
      });
      return;
    }

    for (let i = 0; i < selectedProducts.length; i++) {
      const product = selectedProducts[i];
      try {
        await productMutation.mutateAsync({
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.imageUrl
        });
        // Small delay between products so they appear sequentially
        if (i < selectedProducts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error('Error sending product:', error);
      }
    }
    
    toast({
      title: "Productos Enviados",
      description: `Se enviaron ${selectedProducts.length} producto(s) correctamente`,
    });
  };

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
    mutationFn: (data: Omit<ProductForm, 'id'>) => 
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
    mutationFn: (data: Omit<PollForm, 'id'>) => 
      apiRequest('POST', '/api/events/poll', {
        question: data.question,
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
    mutationFn: (data: Omit<ContestForm, 'id'>) => 
      apiRequest('POST', '/api/events/contest', {
        name: data.name,
        prize: data.prize,
        deadline: data.deadline,
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
              <p className="text-muted-foreground mb-6">Usa el botón + para añadir más eventos y tenerlos listos</p>
              
              {/* Product Events Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-primary">Productos</h3>
                  </div>
                  <div className="flex gap-2">
                    {productForms.some(f => f.selected) && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={sendSelectedProducts}
                        data-testid="button-send-selected-products"
                        className="gap-1 bg-primary"
                        disabled={productMutation.isPending}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Enviar Seleccionados ({productForms.filter(f => f.selected).length})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addProductForm}
                      data-testid="button-add-product"
                      className="gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                      Añadir
                    </Button>
                  </div>
                </div>
                {productForms.map((form, index) => (
                  <div key={form.id} className="bg-card border border-border rounded-lg p-4 mb-3 relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`select-product-${form.id}`}
                            checked={form.selected || false}
                            onCheckedChange={() => toggleProductSelection(form.id)}
                            data-testid={`checkbox-product-${form.id}`}
                          />
                          <Label htmlFor={`select-product-${form.id}`} className="text-xs text-muted-foreground cursor-pointer">
                            Producto #{index + 1}
                          </Label>
                        </div>
                        {productForms.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeProductForm(form.id)}
                            data-testid={`button-remove-product-${form.id}`}
                            className="h-6 w-6 p-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`product-name-${form.id}`} className="text-xs">Nombre</Label>
                          <Input
                            id={`product-name-${form.id}`}
                            value={form.name}
                            onChange={(e) => updateProductForm(form.id, 'name', e.target.value)}
                            data-testid={`input-product-name-${form.id}`}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`product-price-${form.id}`} className="text-xs">Precio</Label>
                          <Input
                            id={`product-price-${form.id}`}
                            value={form.price}
                            onChange={(e) => updateProductForm(form.id, 'price', e.target.value)}
                            data-testid={`input-product-price-${form.id}`}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`product-description-${form.id}`} className="text-xs">Descripción</Label>
                        <Textarea
                          id={`product-description-${form.id}`}
                          rows={2}
                          value={form.description}
                          onChange={(e) => updateProductForm(form.id, 'description', e.target.value)}
                          data-testid={`input-product-description-${form.id}`}
                          className="resize-none"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`product-image-${form.id}`} className="text-xs">URL Imagen</Label>
                        <Input
                          id={`product-image-${form.id}`}
                          value={form.imageUrl}
                          onChange={(e) => updateProductForm(form.id, 'imageUrl', e.target.value)}
                          data-testid={`input-product-image-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9"
                        onClick={() => productMutation.mutate({
                          name: form.name,
                          description: form.description,
                          price: form.price,
                          imageUrl: form.imageUrl
                        })}
                        disabled={productMutation.isPending}
                        data-testid={`button-send-product-${form.id}`}
                      >
                        {productMutation.isPending ? 'Enviando...' : 'Disparar Evento'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Poll Events Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-secondary">Encuestas</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addPollForm}
                    data-testid="button-add-poll"
                    className="gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Añadir
                  </Button>
                </div>
                {pollForms.map((form, index) => (
                  <div key={form.id} className="bg-card border border-border rounded-lg p-4 mb-3 relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-muted-foreground">Encuesta #{index + 1}</span>
                        {pollForms.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePollForm(form.id)}
                            data-testid={`button-remove-poll-${form.id}`}
                            className="h-6 w-6 p-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`poll-question-${form.id}`} className="text-xs">Pregunta</Label>
                        <Input
                          id={`poll-question-${form.id}`}
                          value={form.question}
                          onChange={(e) => updatePollForm(form.id, 'question', e.target.value)}
                          data-testid={`input-poll-question-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`poll-options-${form.id}`} className="text-xs">Opciones (separadas por coma)</Label>
                        <Input
                          id={`poll-options-${form.id}`}
                          value={form.options}
                          onChange={(e) => updatePollForm(form.id, 'options', e.target.value)}
                          data-testid={`input-poll-options-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`poll-duration-${form.id}`} className="text-xs">Duración (segundos)</Label>
                        <Input
                          id={`poll-duration-${form.id}`}
                          type="number"
                          value={form.duration}
                          onChange={(e) => updatePollForm(form.id, 'duration', e.target.value)}
                          data-testid={`input-poll-duration-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <Button 
                        className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground h-9"
                        onClick={() => pollMutation.mutate({
                          question: form.question,
                          options: form.options,
                          duration: form.duration
                        })}
                        disabled={pollMutation.isPending}
                        data-testid={`button-send-poll-${form.id}`}
                      >
                        {pollMutation.isPending ? 'Enviando...' : 'Disparar Encuesta'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Contest Events Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-amber-500">Concursos</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addContestForm}
                    data-testid="button-add-contest"
                    className="gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Añadir
                  </Button>
                </div>
                {contestForms.map((form, index) => (
                  <div key={form.id} className="bg-card border border-border rounded-lg p-4 mb-3 relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-muted-foreground">Concurso #{index + 1}</span>
                        {contestForms.length > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeContestForm(form.id)}
                            data-testid={`button-remove-contest-${form.id}`}
                            className="h-6 w-6 p-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`contest-name-${form.id}`} className="text-xs">Nombre del Concurso</Label>
                        <Input
                          id={`contest-name-${form.id}`}
                          value={form.name}
                          onChange={(e) => updateContestForm(form.id, 'name', e.target.value)}
                          data-testid={`input-contest-name-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contest-prize-${form.id}`} className="text-xs">Premio</Label>
                        <Textarea
                          id={`contest-prize-${form.id}`}
                          rows={2}
                          value={form.prize}
                          onChange={(e) => updateContestForm(form.id, 'prize', e.target.value)}
                          data-testid={`input-contest-prize-${form.id}`}
                          className="resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`contest-deadline-${form.id}`} className="text-xs">Fecha Límite</Label>
                          <Input
                            id={`contest-deadline-${form.id}`}
                            type="date"
                            value={form.deadline}
                            onChange={(e) => updateContestForm(form.id, 'deadline', e.target.value)}
                            data-testid={`input-contest-deadline-${form.id}`}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`contest-participants-${form.id}`} className="text-xs">Max Participantes</Label>
                          <Input
                            id={`contest-participants-${form.id}`}
                            type="number"
                            value={form.maxParticipants}
                            onChange={(e) => updateContestForm(form.id, 'maxParticipants', e.target.value)}
                            data-testid={`input-contest-participants-${form.id}`}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <Button 
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white h-9"
                        onClick={() => contestMutation.mutate({
                          name: form.name,
                          prize: form.prize,
                          deadline: form.deadline,
                          maxParticipants: form.maxParticipants
                        })}
                        disabled={contestMutation.isPending}
                        data-testid={`button-send-contest-${form.id}`}
                      >
                        {contestMutation.isPending ? 'Enviando...' : 'Disparar Concurso'}
                      </Button>
                    </div>
                  </div>
                ))}
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
