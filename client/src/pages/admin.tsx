import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'wouter';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { WebSocketEvent, Campaign } from '@shared/schema';
import { ObjectUploader } from '@/components/ObjectUploader';
import barcelonaLogo from '@assets/barcelona_1760348072481.png';
import psgLogo from '@assets/download_1760348072483.png';
import { ArrowLeft } from 'lucide-react';

interface ProductForm {
  id: number;
  productId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
}

interface PollOption {
  text: string;
  imageUrl?: string;
}

interface PollForm {
  id: number;
  question: string;
  options: PollOption[];
  duration: string;
  imageUrl?: string;
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
  const params = useParams<{ id: string }>();
  const campaignId = params.id ? parseInt(params.id) : undefined;
  
  const [eventHistory, setEventHistory] = useState<WebSocketEvent[]>([]);
  
  // Campaign logo state
  const [campaignLogo, setCampaignLogo] = useState<string>('https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&q=80');
  
  // Fetch campaign info if campaignId exists
  const { data: campaign } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId,
  });
  
  // Load campaign logo when campaign data is fetched
  if (campaign?.logo && campaignLogo !== campaign.logo) {
    setCampaignLogo(campaign.logo);
  }

  // Fetch historical events from API
  const { data: historicalEvents } = useQuery<WebSocketEvent[]>({
    queryKey: ['/api/events', campaignId],
    enabled: !!campaignId,
  });

  // Load historical events into state when data arrives
  useEffect(() => {
    if (historicalEvents && historicalEvents.length > 0) {
      setEventHistory(historicalEvents.slice(0, 50));
    }
  }, [historicalEvents]);
  
  // WebSocket connection - now with campaignId
  const { connectionStatus, clientCount } = useWebSocket({
    campaignId,
    onMessage: (event) => {
      setEventHistory(prev => {
        // Check if event already exists in history (prevent duplicates)
        const exists = prev.some(e => 
          e.type === event.type && 
          e.timestamp === event.timestamp &&
          JSON.stringify(e.data) === JSON.stringify(event.data)
        );
        if (exists) return prev;
        return [event, ...prev.slice(0, 49)];
      });
    }
  });

  // Product forms state (array) - 3 examples ready to send
  const [productForms, setProductForms] = useState<ProductForm[]>([
    {
      id: Date.now(),
      productId: '101',
      name: 'iPhone 15 Pro Max',
      description: 'Latest model with titanium and 48MP camera. Available in natural titanium, blue, white and black.',
      price: '$1,199',
      imageUrl: 'https://images.unsplash.com/photo-1592286927505-b7e00a46f74f?w=800&q=80'
    },
    {
      id: Date.now() + 1,
      productId: '102',
      name: 'MacBook Air M3',
      description: 'Apple\'s thinnest laptop with M3 chip, up to 18 hours battery life and 13" Liquid Retina display',
      price: '$1,099',
      imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'
    },
    {
      id: Date.now() + 2,
      productId: '103',
      name: 'AirPods Pro (2. gen)',
      description: 'Active noise cancellation, personalized spatial audio and up to 6 hours of playback',
      price: '$249',
      imageUrl: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800&q=80'
    }
  ]);

  // Poll forms state (array) - 3 examples ready to send
  const [pollForms, setPollForms] = useState<PollForm[]>([
    {
      id: Date.now() + 3,
      question: 'Who will win this match?',
      options: [
        { text: 'Barcelona', imageUrl: barcelonaLogo },
        { text: 'PSG', imageUrl: psgLogo }
      ],
      duration: '60',
      imageUrl: barcelonaLogo
    },
    {
      id: Date.now() + 4,
      question: 'Who will score in the second half?',
      options: [
        { text: 'Lamine Yamal', imageUrl: barcelonaLogo },
        { text: 'Raphina', imageUrl: barcelonaLogo },
        { text: 'Dembélé', imageUrl: psgLogo },
        { text: 'Vitinha', imageUrl: psgLogo }
      ],
      duration: '90',
      imageUrl: barcelonaLogo
    },
    {
      id: Date.now() + 5,
      question: 'Will PSG score in the final minutes?',
      options: [
        { text: 'Yes' },
        { text: 'No' }
      ],
      duration: '120',
      imageUrl: psgLogo
    }
  ]);

  // Contest forms state (array) - 3 examples ready to send
  const [contestForms, setContestForms] = useState<ContestForm[]>([
    {
      id: Date.now() + 6,
      name: 'Big Tech Contest 2024',
      prize: 'Win MacBook Pro M3, AirPods Pro, Apple Watch Ultra and annual Apple One subscription',
      deadline: '2024-12-31',
      maxParticipants: '1000'
    },
    {
      id: Date.now() + 7,
      name: 'Ultimate Gaming Contest',
      prize: 'PlayStation 5 Pro, 3 AAA games, 1 year PS Plus subscription and Sony Pulse 3D headphones',
      deadline: '2024-11-30',
      maxParticipants: '500'
    },
    {
      id: Date.now() + 8,
      name: 'Tech Conference Trip Raffle',
      prize: 'Flight + hotel to attend Apple WWDC 2025 in California (all inclusive)',
      deadline: '2025-03-15',
      maxParticipants: '250'
    }
  ]);

  // Track if forms have been loaded from database
  const [formsLoaded, setFormsLoaded] = useState(false);

  // Load saved form states
  const { data: savedFormStates } = useQuery<any[]>({
    queryKey: ['/api/form-state', campaignId],
    enabled: !!campaignId && !formsLoaded,
  });

  // Load saved forms into state when data arrives
  useEffect(() => {
    if (savedFormStates !== undefined && !formsLoaded) {
      if (savedFormStates.length > 0) {
        savedFormStates.forEach(state => {
          if (state.formType === 'products') {
            setProductForms(state.formData);
          } else if (state.formType === 'polls') {
            // Migrate old poll format (options as string) to new format (options as array of objects)
            const migratedPolls = state.formData.map((poll: any) => {
              if (typeof poll.options === 'string') {
                // Convert comma-separated string to array of objects
                return {
                  ...poll,
                  options: poll.options.split(',').map((text: string) => ({
                    text: text.trim(),
                    imageUrl: ''
                  })).filter((opt: any) => opt.text)
                };
              }
              // Ensure options is an array of objects
              if (!Array.isArray(poll.options)) {
                return {
                  ...poll,
                  options: [{ text: '', imageUrl: '' }]
                };
              }
              return poll;
            });
            setPollForms(migratedPolls);
          } else if (state.formType === 'contests') {
            setContestForms(state.formData);
          }
        });
      }
      setFormsLoaded(true);
    }
  }, [savedFormStates, formsLoaded]);

  // Mutation to save form state
  const saveFormStateMutation = useMutation({
    mutationFn: async ({ formType, formData }: { formType: string; formData: any }) => {
      if (!campaignId) return;
      return await apiRequest('POST', '/api/form-state', {
        campaignId,
        formType,
        formData
      });
    }
  });

  // Auto-save with debounce - separate timers for each form type
  const productsSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const pollsSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const contestsSaveTimeoutRef = useRef<NodeJS.Timeout>();
  
  useEffect(() => {
    if (!campaignId || !formsLoaded) return;
    
    if (productsSaveTimeoutRef.current) {
      clearTimeout(productsSaveTimeoutRef.current);
    }

    productsSaveTimeoutRef.current = setTimeout(() => {
      saveFormStateMutation.mutate({ formType: 'products', formData: productForms });
    }, 1000);

    return () => {
      if (productsSaveTimeoutRef.current) {
        clearTimeout(productsSaveTimeoutRef.current);
      }
    };
  }, [productForms, campaignId, formsLoaded]);

  useEffect(() => {
    if (!campaignId || !formsLoaded) return;
    
    if (pollsSaveTimeoutRef.current) {
      clearTimeout(pollsSaveTimeoutRef.current);
    }

    pollsSaveTimeoutRef.current = setTimeout(() => {
      saveFormStateMutation.mutate({ formType: 'polls', formData: pollForms });
    }, 1000);

    return () => {
      if (pollsSaveTimeoutRef.current) {
        clearTimeout(pollsSaveTimeoutRef.current);
      }
    };
  }, [pollForms, campaignId, formsLoaded]);

  useEffect(() => {
    if (!campaignId || !formsLoaded) return;
    
    if (contestsSaveTimeoutRef.current) {
      clearTimeout(contestsSaveTimeoutRef.current);
    }

    contestsSaveTimeoutRef.current = setTimeout(() => {
      saveFormStateMutation.mutate({ formType: 'contests', formData: contestForms });
    }, 1000);

    return () => {
      if (contestsSaveTimeoutRef.current) {
        clearTimeout(contestsSaveTimeoutRef.current);
      }
    };
  }, [contestForms, campaignId, formsLoaded]);

  // Add new product form
  const addProductForm = () => {
    setProductForms(prev => [...prev, {
      id: Date.now(),
      productId: '',
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
      options: [{ text: '', imageUrl: '' }],
      duration: '60',
      imageUrl: ''
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

  const updatePollForm = (id: number, field: keyof Omit<PollForm, 'id'>, value: any) => {
    setPollForms(prev => prev.map(form => 
      form.id === id ? { ...form, [field]: value } : form
    ));
  };

  // Poll options management
  const addPollOption = (pollId: number) => {
    setPollForms(prev => prev.map(form => 
      form.id === pollId 
        ? { ...form, options: [...form.options, { text: '', imageUrl: '' }] }
        : form
    ));
  };

  const updatePollOption = (pollId: number, optionIndex: number, field: 'text' | 'imageUrl', value: string) => {
    setPollForms(prev => prev.map(form => 
      form.id === pollId 
        ? {
            ...form,
            options: form.options.map((opt, idx) => 
              idx === optionIndex ? { ...opt, [field]: value } : opt
            )
          }
        : form
    ));
  };

  const removePollOption = (pollId: number, optionIndex: number) => {
    setPollForms(prev => prev.map(form => 
      form.id === pollId && form.options.length > 1
        ? { ...form, options: form.options.filter((_, idx) => idx !== optionIndex) }
        : form
    ));
  };

  const updateContestForm = (id: number, field: keyof Omit<ContestForm, 'id'>, value: string) => {
    setContestForms(prev => prev.map(form => 
      form.id === id ? { ...form, [field]: value } : form
    ));
  };

  // Fetch server status (polling disabled)
  const { data: serverStatus } = useQuery<{
    server: string;
    connectedClients: number;
    wsPort: string;
    httpPort: number | string;
  }>({
    queryKey: ['/api/status'],
    // refetchInterval: 5000 // Disabled to reduce server requests
  });

  // Mutations for sending events
  const productMutation = useMutation({
    mutationFn: (data: Omit<ProductForm, 'id'>) => 
      apiRequest('POST', '/api/events/product', {
        ...data,
        campaignId,
        campaignLogo: campaignLogo || undefined
      }),
    onSuccess: () => {
      toast({
        title: "Product Event Sent",
        description: "The event has been sent to all connected clients",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not send product event",
        variant: "destructive",
      });
    }
  });

  const pollMutation = useMutation({
    mutationFn: (data: Omit<PollForm, 'id'>) => 
      apiRequest('POST', '/api/events/poll', {
        question: data.question,
        options: data.options,
        duration: parseInt(data.duration),
        imageUrl: data.imageUrl || undefined,
        campaignId,
        campaignLogo: campaignLogo || undefined
      }),
    onSuccess: () => {
      toast({
        title: "Poll Started",
        description: "The poll has been sent to all connected clients",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not start the poll",
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
        maxParticipants: parseInt(data.maxParticipants),
        campaignId,
        campaignLogo: campaignLogo || undefined
      }),
    onSuccess: () => {
      toast({
        title: "Contest Launched",
        description: "The contest has been sent to all connected clients",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not launch the contest",
        variant: "destructive",
      });
    }
  });
  
  // Update campaign logo mutation
  const updateLogoMutation = useMutation({
    mutationFn: (logo: string) => 
      apiRequest('PUT', `/api/campaigns/${campaignId}`, { logo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
    },
  });

  // Send first two products simultaneously
  const [isSendingDouble, setIsSendingDouble] = useState(false);
  const sendTwoProducts = async () => {
    if (productForms.length < 2) {
      toast({
        title: "Not Enough Products",
        description: "You need at least 2 products to send two simultaneously",
        variant: "destructive",
      });
      return;
    }

    setIsSendingDouble(true);
    try {
      const product1 = productForms[0];
      const product2 = productForms[1];

      await productMutation.mutateAsync({
        productId: product1.productId,
        name: product1.name,
        description: product1.description,
        price: product1.price,
        imageUrl: product1.imageUrl
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      await productMutation.mutateAsync({
        productId: product2.productId,
        name: product2.name,
        description: product2.description,
        price: product2.price,
        imageUrl: product2.imageUrl
      });

      toast({
        title: "Two Products Sent",
        description: "The first two products have been sent simultaneously",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not send both products",
        variant: "destructive",
      });
    } finally {
      setIsSendingDouble(false);
    }
  };

  const handleClearLog = () => {
    setEventHistory([]);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Text copied to clipboard",
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-0 bg-card">
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
                <p className="text-sm text-muted-foreground">Admin Panel - Demo</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <ConnectionStatusComponent 
                status={connectionStatus} 
                clientCount={clientCount} 
              />
              <div className="flex space-x-2">
                <Link href="/viewer">
                  <Button variant="outline" size="sm" data-testid="link-viewer" className="border-0">
                    Viewer
                  </Button>
                </Link>
                <Link href="/docs">
                  <Button variant="outline" size="sm" data-testid="link-docs" className="border-0">
                    Docs
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" data-testid="button-back-to-campaigns" className="gap-2 border-0">
              <ArrowLeft className="w-4 h-4" />
              Back to campaigns
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Event Triggers */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Trigger Events</h2>
              <p className="text-muted-foreground mb-6">Use the + button to add more events</p>
              
              {/* Campaign Logo Configuration */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-0 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-purple-500">Campaign Logo</h3>
                    <p className="text-xs text-muted-foreground">This logo appears on all events</p>
                  </div>
                  {campaignLogo && (
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-background border-0 rounded-lg flex items-center justify-center overflow-hidden">
                        <img 
                          src={campaignLogo} 
                          alt="Campaign logo preview" 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <Tabs defaultValue="url" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url" data-testid="tab-url">URL</TabsTrigger>
                    <TabsTrigger value="upload" data-testid="tab-upload">Upload File</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="url" className="mt-3">
                    <Label htmlFor="campaign-logo" className="text-xs text-muted-foreground">Logo URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="campaign-logo"
                        value={campaignLogo}
                        onChange={(e) => setCampaignLogo(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        data-testid="input-campaign-logo"
                        className="h-9"
                      />
                      {campaignId && (
                        <Button
                          size="sm"
                          onClick={() => updateLogoMutation.mutate(campaignLogo)}
                          disabled={updateLogoMutation.isPending}
                          data-testid="button-save-logo"
                          className="border-0"
                        >
                          {updateLogoMutation.isPending ? 'Saving...' : 'Save'}
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="upload" className="mt-3">
                    <ObjectUploader
                      onUploadComplete={(objectPath) => {
                        setCampaignLogo(objectPath);
                        if (campaignId) {
                          updateLogoMutation.mutate(objectPath);
                        }
                        toast({
                          title: "Logo Uploaded",
                          description: "Campaign logo has been updated and saved",
                        });
                      }}
                      onUploadError={(error) => {
                        toast({
                          title: "Upload Failed",
                          description: error.message,
                          variant: "destructive",
                        });
                      }}
                      maxFileSize={5 * 1024 * 1024}
                      allowedFileTypes={['image/*']}
                    />
                  </TabsContent>
                </Tabs>
              </div>
              
              {/* Product Events Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-primary">Products</h3>
                  </div>
                  <div className="flex gap-2">
                    {productForms.length >= 2 && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={sendTwoProducts}
                        data-testid="button-send-two-products"
                        className="gap-1 bg-primary border-0"
                        disabled={isSendingDouble}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        {isSendingDouble ? 'Sending...' : 'Send First Two'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addProductForm}
                      data-testid="button-add-product"
                      className="gap-1 border-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                      Add
                    </Button>
                  </div>
                </div>
                {productForms.map((form, index) => (
                  <div key={form.id} className="bg-card border-0 rounded-lg p-4 mb-3 relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-muted-foreground">Product #{index + 1}</span>
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
                      <div>
                        <Label htmlFor={`product-id-${form.id}`} className="text-xs">Product ID</Label>
                        <Input
                          id={`product-id-${form.id}`}
                          value={form.productId}
                          onChange={(e) => updateProductForm(form.id, 'productId', e.target.value)}
                          data-testid={`input-product-id-${form.id}`}
                          className="h-9"
                          placeholder="ID from external system"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`product-name-${form.id}`} className="text-xs">Name</Label>
                          <Input
                            id={`product-name-${form.id}`}
                            value={form.name}
                            onChange={(e) => updateProductForm(form.id, 'name', e.target.value)}
                            data-testid={`input-product-name-${form.id}`}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`product-price-${form.id}`} className="text-xs">Price</Label>
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
                        <Label htmlFor={`product-description-${form.id}`} className="text-xs">Description</Label>
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
                        <Label htmlFor={`product-image-${form.id}`} className="text-xs">Image URL</Label>
                        <Input
                          id={`product-image-${form.id}`}
                          value={form.imageUrl}
                          onChange={(e) => updateProductForm(form.id, 'imageUrl', e.target.value)}
                          data-testid={`input-product-image-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-9 border-0"
                        onClick={() => productMutation.mutate({
                          productId: form.productId,
                          name: form.name,
                          description: form.description,
                          price: form.price,
                          imageUrl: form.imageUrl
                        })}
                        disabled={productMutation.isPending}
                        data-testid={`button-send-product-${form.id}`}
                      >
                        {productMutation.isPending ? 'Sending...' : 'Send Event'}
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
                    <h3 className="text-lg font-semibold text-secondary">Polls</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addPollForm}
                    data-testid="button-add-poll"
                    className="gap-1 border-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Add
                  </Button>
                </div>
                {pollForms.map((form, index) => (
                  <div key={form.id} className="bg-card border-0 rounded-lg p-4 mb-3 relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-muted-foreground">Poll #{index + 1}</span>
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
                        <Label htmlFor={`poll-question-${form.id}`} className="text-xs">Question</Label>
                        <Input
                          id={`poll-question-${form.id}`}
                          value={form.question}
                          onChange={(e) => updatePollForm(form.id, 'question', e.target.value)}
                          data-testid={`input-poll-question-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs">Options</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => addPollOption(form.id)}
                            data-testid={`button-add-poll-option-${form.id}`}
                            className="h-6 px-2 gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                            <span className="text-xs">Add</span>
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {form.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="border-0 rounded-md p-2 space-y-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  value={option.text}
                                  onChange={(e) => updatePollOption(form.id, optionIndex, 'text', e.target.value)}
                                  placeholder={`Option ${optionIndex + 1} (e.g. Barcelona)`}
                                  data-testid={`input-poll-option-text-${form.id}-${optionIndex}`}
                                  className="h-8 flex-1"
                                />
                                {form.options.length > 1 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removePollOption(form.id, optionIndex)}
                                    data-testid={`button-remove-poll-option-${form.id}-${optionIndex}`}
                                    className="h-8 w-8 p-0"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                  </Button>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Logo (optional)</Label>
                                <Tabs defaultValue="url" className="w-full mt-1">
                                  <TabsList className="grid w-full grid-cols-2 h-7">
                                    <TabsTrigger value="url" className="text-xs py-0">URL</TabsTrigger>
                                    <TabsTrigger value="upload" className="text-xs py-0">Upload</TabsTrigger>
                                  </TabsList>
                                  <TabsContent value="url" className="mt-1">
                                    <Input
                                      value={option.imageUrl || ''}
                                      onChange={(e) => updatePollOption(form.id, optionIndex, 'imageUrl', e.target.value)}
                                      placeholder="https://example.com/logo.png"
                                      data-testid={`input-poll-option-image-${form.id}-${optionIndex}`}
                                      className="h-8"
                                    />
                                  </TabsContent>
                                  <TabsContent value="upload" className="mt-1">
                                    <ObjectUploader
                                      onUploadComplete={(url: string) => updatePollOption(form.id, optionIndex, 'imageUrl', url)}
                                      onUploadError={(error: Error) => {
                                        toast({
                                          title: "Feil ved opplasting",
                                          description: error.message,
                                          variant: "destructive",
                                        });
                                      }}
                                    />
                                  </TabsContent>
                                </Tabs>
                                {option.imageUrl && (
                                  <div className="mt-1">
                                    <img 
                                      src={option.imageUrl} 
                                      alt={option.text}
                                      className="h-8 w-8 object-contain rounded"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`poll-duration-${form.id}`} className="text-xs">Duration (seconds)</Label>
                        <Input
                          id={`poll-duration-${form.id}`}
                          type="number"
                          value={form.duration}
                          onChange={(e) => updatePollForm(form.id, 'duration', e.target.value)}
                          data-testid={`input-poll-duration-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs mb-2 block">Image (optional - e.g. team badge)</Label>
                        <Tabs defaultValue="url" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="url" data-testid={`tab-url-poll-${form.id}`}>URL</TabsTrigger>
                            <TabsTrigger value="upload" data-testid={`tab-upload-poll-${form.id}`}>Upload File</TabsTrigger>
                          </TabsList>
                          <TabsContent value="url" className="mt-2">
                            <Input
                              id={`poll-imageUrl-${form.id}`}
                              value={form.imageUrl || ''}
                              onChange={(e) => updatePollForm(form.id, 'imageUrl', e.target.value)}
                              placeholder="https://example.com/team-badge.png"
                              data-testid={`input-poll-image-${form.id}`}
                              className="h-9"
                            />
                          </TabsContent>
                          <TabsContent value="upload" className="mt-2">
                            <ObjectUploader
                              onUploadComplete={(url: string) => updatePollForm(form.id, 'imageUrl', url)}
                              onUploadError={(error: Error) => {
                                toast({
                                  title: "Upload Error",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }}
                            />
                          </TabsContent>
                        </Tabs>
                      </div>
                      <Button 
                        className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground h-9 border-0"
                        onClick={() => pollMutation.mutate({
                          question: form.question,
                          options: form.options,
                          duration: form.duration,
                          imageUrl: form.imageUrl
                        })}
                        disabled={pollMutation.isPending}
                        data-testid={`button-send-poll-${form.id}`}
                      >
                        {pollMutation.isPending ? 'Sending...' : 'Start Poll'}
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
                    <h3 className="text-lg font-semibold text-amber-500">Contests</h3>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addContestForm}
                    data-testid="button-add-contest"
                    className="gap-1 border-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    Add
                  </Button>
                </div>
                {contestForms.map((form, index) => (
                  <div key={form.id} className="bg-card border-0 rounded-lg p-4 mb-3 relative">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-muted-foreground">Contest #{index + 1}</span>
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
                        <Label htmlFor={`contest-name-${form.id}`} className="text-xs">Contest Name</Label>
                        <Input
                          id={`contest-name-${form.id}`}
                          value={form.name}
                          onChange={(e) => updateContestForm(form.id, 'name', e.target.value)}
                          data-testid={`input-contest-name-${form.id}`}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contest-prize-${form.id}`} className="text-xs">Prize</Label>
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
                          <Label htmlFor={`contest-deadline-${form.id}`} className="text-xs">Deadline</Label>
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
                          <Label htmlFor={`contest-participants-${form.id}`} className="text-xs">Max Participants</Label>
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
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white h-9 border-0"
                        onClick={() => contestMutation.mutate({
                          name: form.name,
                          prize: form.prize,
                          deadline: form.deadline,
                          maxParticipants: form.maxParticipants
                        })}
                        disabled={contestMutation.isPending}
                        data-testid={`button-send-contest-${form.id}`}
                      >
                        {contestMutation.isPending ? 'Sending...' : 'Launch Contest'}
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
            <div className="bg-card border-0 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Connection Information</h3>
              
              <div className="space-y-4">
                {campaignId && (
                  <div>
                    <Label className="text-muted-foreground">Campaign ID</Label>
                    <code className="block px-3 py-2 bg-background border-0 rounded text-sm font-mono">
                      {campaignId}
                    </code>
                  </div>
                )}
                
                <div>
                  <Label className="text-muted-foreground">WebSocket URL {campaignId ? 'for this campaign' : '(Legacy)'}</Label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-background border-0 rounded text-sm font-mono break-all">
                      {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws${campaignId ? `/${campaignId}` : ''}`}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws${campaignId ? `/${campaignId}` : ''}`)}
                      data-testid="button-copy-ws-url"
                      className="border-0"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label className="text-muted-foreground">HTTP Port</Label>
                  <code className="block px-3 py-2 bg-background border-0 rounded text-sm font-mono">
                    {serverStatus?.httpPort || window.location.port || '5000'}
                  </code>
                </div>
                
                <div className="pt-4 border-0">
                  <p className="text-sm text-muted-foreground mb-3">Server Status</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>WebSocket Server</span>
                    <span className="text-green-500 font-medium">✓ Active</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span>HTTP Server</span>
                    <span className="text-green-500 font-medium">✓ Active</span>
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
