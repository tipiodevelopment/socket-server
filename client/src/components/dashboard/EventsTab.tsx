import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { ConnectionStatusComponent } from '@/components/connection-status';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Campaign, Broadcast } from '@shared/schema';
import { ObjectUploader } from '@/components/ObjectUploader';

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

interface EventsTabProps {
  campaignId: number;
  campaign: Campaign;
}

export function EventsTab({ campaignId, campaign }: EventsTabProps) {
  const { toast } = useToast();

  // WebSocket connection — only need connection status now
  const { connectionStatus } = useWebSocket({ campaignId });

  // Fetch live broadcast for this campaign so we can tag events with broadcastId
  const { data: campaignBroadcasts } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', campaignId],
    queryFn: async () => {
      const params = new URLSearchParams({ campaignId: String(campaignId) });
      const res = await fetch(`/api/broadcasts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch broadcasts');
      return res.json();
    },
    enabled: !!campaignId,
    staleTime: 30000,
  });
  const liveBroadcastId = campaignBroadcasts?.find(b => b.status === 'live')?.broadcastId ?? null;

  // Product forms state — starts empty, loads from DB if saved
  const [productForms, setProductForms] = useState<ProductForm[]>([
    {
      id: Date.now(),
      productId: '',
      name: '',
      description: '',
      price: '',
      imageUrl: ''
    }
  ]);

  // Poll forms state — starts empty, loads from DB if saved
  const [pollForms, setPollForms] = useState<PollForm[]>([
    {
      id: Date.now() + 1,
      question: '',
      options: [{ text: '', imageUrl: '' }, { text: '', imageUrl: '' }],
      duration: '60',
      imageUrl: ''
    }
  ]);

  // Contest forms state — starts empty, loads from DB if saved
  const [contestForms, setContestForms] = useState<ContestForm[]>([
    {
      id: Date.now() + 2,
      name: '',
      prize: '',
      deadline: '',
      maxParticipants: '100'
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
            const migratedPolls = state.formData.map((poll: any) => {
              if (typeof poll.options === 'string') {
                return {
                  ...poll,
                  options: poll.options.split(',').map((text: string) => ({
                    text: text.trim(),
                    imageUrl: ''
                  })).filter((opt: any) => opt.text)
                };
              }
              if (!Array.isArray(poll.options)) {
                return { ...poll, options: [{ text: '', imageUrl: '' }] };
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
      return await apiRequest('POST', '/api/form-state', { campaignId, formType, formData });
    }
  });

  // Auto-save with debounce
  const productsSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const pollsSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const contestsSaveTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!campaignId || !formsLoaded) return;
    if (productsSaveTimeoutRef.current) clearTimeout(productsSaveTimeoutRef.current);
    productsSaveTimeoutRef.current = setTimeout(() => {
      saveFormStateMutation.mutate({ formType: 'products', formData: productForms });
    }, 1000);
    return () => { if (productsSaveTimeoutRef.current) clearTimeout(productsSaveTimeoutRef.current); };
  }, [productForms, campaignId, formsLoaded]);

  useEffect(() => {
    if (!campaignId || !formsLoaded) return;
    if (pollsSaveTimeoutRef.current) clearTimeout(pollsSaveTimeoutRef.current);
    pollsSaveTimeoutRef.current = setTimeout(() => {
      saveFormStateMutation.mutate({ formType: 'polls', formData: pollForms });
    }, 1000);
    return () => { if (pollsSaveTimeoutRef.current) clearTimeout(pollsSaveTimeoutRef.current); };
  }, [pollForms, campaignId, formsLoaded]);

  useEffect(() => {
    if (!campaignId || !formsLoaded) return;
    if (contestsSaveTimeoutRef.current) clearTimeout(contestsSaveTimeoutRef.current);
    contestsSaveTimeoutRef.current = setTimeout(() => {
      saveFormStateMutation.mutate({ formType: 'contests', formData: contestForms });
    }, 1000);
    return () => { if (contestsSaveTimeoutRef.current) clearTimeout(contestsSaveTimeoutRef.current); };
  }, [contestForms, campaignId, formsLoaded]);

  // Add new forms
  const addProductForm = () => {
    setProductForms(prev => [...prev, { id: Date.now(), productId: '', name: '', description: '', price: '', imageUrl: '' }]);
  };

  const addPollForm = () => {
    setPollForms(prev => [...prev, { id: Date.now(), question: '', options: [{ text: '', imageUrl: '' }, { text: '', imageUrl: '' }], duration: '60', imageUrl: '' }]);
  };

  const addContestForm = () => {
    setContestForms(prev => [...prev, { id: Date.now(), name: '', prize: '', deadline: '', maxParticipants: '100' }]);
  };

  // Remove forms
  const removeProductForm = (id: number) => {
    if (productForms.length > 1) setProductForms(prev => prev.filter(form => form.id !== id));
  };

  const removePollForm = (id: number) => {
    if (pollForms.length > 1) setPollForms(prev => prev.filter(form => form.id !== id));
  };

  const removeContestForm = (id: number) => {
    if (contestForms.length > 1) setContestForms(prev => prev.filter(form => form.id !== id));
  };

  // Update forms
  const updateProductForm = (id: number, field: keyof Omit<ProductForm, 'id'>, value: string) => {
    setProductForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));
  };

  const updatePollForm = (id: number, field: keyof Omit<PollForm, 'id'>, value: any) => {
    setPollForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));
  };

  const addPollOption = (pollId: number) => {
    setPollForms(prev => prev.map(form =>
      form.id === pollId ? { ...form, options: [...form.options, { text: '', imageUrl: '' }] } : form
    ));
  };

  const updatePollOption = (pollId: number, optionIndex: number, field: 'text' | 'imageUrl', value: string) => {
    setPollForms(prev => prev.map(form =>
      form.id === pollId
        ? { ...form, options: form.options.map((opt, idx) => idx === optionIndex ? { ...opt, [field]: value } : opt) }
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
    setContestForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));
  };

  // Mutations for sending events
  const productMutation = useMutation({
    mutationFn: (data: Omit<ProductForm, 'id'>) =>
      apiRequest('POST', '/api/events/product', { ...data, campaignId }),
    onSuccess: () => {
      toast({ title: "Product Event Sent", description: "Sent to all connected clients" });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not send product event", variant: "destructive" });
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
        broadcastId: liveBroadcastId || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Poll Started", description: "Sent to all connected clients" });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not start the poll", variant: "destructive" });
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
        broadcastId: liveBroadcastId || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Contest Launched", description: "Sent to all connected clients" });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not launch the contest", variant: "destructive" });
    }
  });

  // Send first two products simultaneously
  const [isSendingDouble, setIsSendingDouble] = useState(false);
  const sendTwoProducts = async () => {
    if (productForms.length < 2) {
      toast({ title: "Not Enough Products", description: "You need at least 2 products", variant: "destructive" });
      return;
    }
    setIsSendingDouble(true);
    try {
      const product1 = productForms[0];
      const product2 = productForms[1];
      await productMutation.mutateAsync({ productId: product1.productId, name: product1.name, description: product1.description, price: product1.price, imageUrl: product1.imageUrl });
      await new Promise(resolve => setTimeout(resolve, 300));
      await productMutation.mutateAsync({ productId: product2.productId, name: product2.name, description: product2.description, price: product2.price, imageUrl: product2.imageUrl });
      toast({ title: "Two Products Sent", description: "First two products sent simultaneously" });
    } catch {
      toast({ title: "Error", description: "Could not send both products", variant: "destructive" });
    } finally {
      setIsSendingDouble(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">Trigger Events</h2>
        <ConnectionStatusComponent status={connectionStatus} />
      </div>

      <p className="text-sm text-muted-foreground">Use the + button to add more events. Changes are auto-saved per campaign.</p>

      {/* Product Events Section */}
      <div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`product-name-${form.id}`} className="text-xs">Name</Label>
                  <Input
                    id={`product-name-${form.id}`}
                    value={form.name}
                    onChange={(e) => updateProductForm(form.id, 'name', e.target.value)}
                    data-testid={`input-product-name-${form.id}`}
                    className="h-9"
                    placeholder="Product name"
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
                    placeholder="$0.00"
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
                  placeholder="Short product description"
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
                  placeholder="https://..."
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
      <div>
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
                  placeholder="What do you think about...?"
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
                          placeholder={`Option ${optionIndex + 1}`}
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
                        <Label className="text-xs text-muted-foreground">Option image (optional)</Label>
                        <Tabs defaultValue="url" className="w-full mt-1">
                          <TabsList className="grid w-full grid-cols-2 h-7">
                            <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
                            <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
                          </TabsList>
                          <TabsContent value="url" className="mt-1">
                            <Input
                              value={option.imageUrl || ''}
                              onChange={(e) => updatePollOption(form.id, optionIndex, 'imageUrl', e.target.value)}
                              placeholder="https://..."
                              data-testid={`input-poll-option-image-${form.id}-${optionIndex}`}
                              className="h-7 text-xs"
                            />
                          </TabsContent>
                          <TabsContent value="upload" className="mt-1">
                            <ObjectUploader
                              onUploadComplete={(url: string) => updatePollOption(form.id, optionIndex, 'imageUrl', url)}
                              onUploadError={(error: Error) => {
                                toast({ title: "Upload Error", description: error.message, variant: "destructive" });
                              }}
                              maxFileSize={5 * 1024 * 1024}
                              allowedFileTypes={['image/*']}
                            />
                          </TabsContent>
                        </Tabs>
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
                  placeholder="60"
                />
              </div>
              <div>
                <Label className="text-xs">Poll image (optional)</Label>
                <Tabs defaultValue="url" className="w-full mt-1">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="url">URL</TabsTrigger>
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-2">
                    <Input
                      value={form.imageUrl || ''}
                      onChange={(e) => updatePollForm(form.id, 'imageUrl', e.target.value)}
                      placeholder="https://..."
                      data-testid={`input-poll-image-${form.id}`}
                      className="h-9"
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2">
                    <ObjectUploader
                      onUploadComplete={(url: string) => updatePollForm(form.id, 'imageUrl', url)}
                      onUploadError={(error: Error) => {
                        toast({ title: "Upload Error", description: error.message, variant: "destructive" });
                      }}
                      maxFileSize={5 * 1024 * 1024}
                      allowedFileTypes={['image/*']}
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
      <div>
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
                  placeholder="Contest name"
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
                  placeholder="Describe the prize"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    placeholder="100"
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
  );
}
