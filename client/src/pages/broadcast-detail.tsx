import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AppLayout } from '@/components/AppLayout';
import type { BreadcrumbItem } from '@/components/AppLayout';
import type { Broadcast, Poll, PollOptionRecord, Contest, Campaign, ClientApp } from '@shared/schema';
import { ArrowLeft, Plus, Trash2, Clock, Calendar, Radio, BarChart3, Trophy, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';

type BroadcastWithRelations = Broadcast & {
  polls?: (Poll & { options?: PollOptionRecord[] })[];
  contests?: Contest[];
  campaign?: Campaign | null;
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400" data-testid="badge-status-live">Live</span>;
    case 'ended':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400" data-testid="badge-status-ended">Ended</span>;
    case 'upcoming':
    default:
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400" data-testid="badge-status-upcoming">Upcoming</span>;
  }
}

const CONTEST_TYPES = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'giveaway', label: 'Giveaway' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'prediction', label: 'Prediction' },
];

export default function BroadcastDetailPage() {
  const params = useParams();
  const { userId } = useUser();
  const broadcastId = params.broadcastId;
  const appId = params.appId ? parseInt(params.appId) : null;
  const campaignId = params.campaignId ? parseInt(params.campaignId) : null;
  const { toast } = useToast();

  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [contestDialogOpen, setContestDialogOpen] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] });
  const [contestForm, setContestForm] = useState({ title: '', description: '', prize: '', contestType: 'quiz' });

  const { data: broadcast, isLoading } = useQuery<BroadcastWithRelations>({
    queryKey: ['/api/broadcasts', broadcastId],
    enabled: !!broadcastId,
  });

  const createPollMutation = useMutation({
    mutationFn: async (data: { question: string; options: string[] }) => {
      return await apiRequest('POST', `/api/broadcasts/${broadcastId}/polls`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Poll Created', description: 'The poll has been created successfully.' });
      setPollDialogOpen(false);
      setPollForm({ question: '', options: ['', ''] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create poll.', variant: 'destructive' });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: number) => {
      return await apiRequest('DELETE', `/api/polls/${pollId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Poll Deleted', description: 'The poll has been deleted successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete poll.', variant: 'destructive' });
    },
  });

  const togglePollMutation = useMutation({
    mutationFn: async ({ pollId, isActive }: { pollId: number; isActive: boolean }) => {
      return await apiRequest('PUT', `/api/polls/${pollId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Poll Updated', description: 'Poll status has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update poll.', variant: 'destructive' });
    },
  });

  const createContestMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; prize: string; contestType: string }) => {
      return await apiRequest('POST', `/api/broadcasts/${broadcastId}/contests`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Contest Created', description: 'The contest has been created successfully.' });
      setContestDialogOpen(false);
      setContestForm({ title: '', description: '', prize: '', contestType: 'quiz' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create contest.', variant: 'destructive' });
    },
  });

  const deleteContestMutation = useMutation({
    mutationFn: async (contestId: number) => {
      return await apiRequest('DELETE', `/api/contests/${contestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Contest Deleted', description: 'The contest has been deleted successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete contest.', variant: 'destructive' });
    },
  });

  const toggleContestMutation = useMutation({
    mutationFn: async ({ contestId, isActive }: { contestId: number; isActive: boolean }) => {
      return await apiRequest('PUT', `/api/contests/${contestId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Contest Updated', description: 'Contest status has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update contest.', variant: 'destructive' });
    },
  });

  const handleCreatePoll = () => {
    const validOptions = pollForm.options.filter(o => o.trim());
    if (!pollForm.question.trim()) {
      toast({ title: 'Validation Error', description: 'Question is required.', variant: 'destructive' });
      return;
    }
    if (validOptions.length < 2) {
      toast({ title: 'Validation Error', description: 'At least 2 options are required.', variant: 'destructive' });
      return;
    }
    createPollMutation.mutate({ question: pollForm.question, options: validOptions });
  };

  const handleCreateContest = () => {
    if (!contestForm.title.trim()) {
      toast({ title: 'Validation Error', description: 'Title is required.', variant: 'destructive' });
      return;
    }
    createContestMutation.mutate(contestForm);
  };

  const addPollOption = () => {
    setPollForm(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removePollOption = (index: number) => {
    if (pollForm.options.length <= 2) return;
    setPollForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const updatePollOption = (index: number, value: string) => {
    setPollForm(prev => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? value : o)),
    }));
  };

  const { data: app } = useQuery<ClientApp>({
    queryKey: ['/api/client-apps', appId, userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appId}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!appId && !!userId
  });

  const { data: campaignData } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });

  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [{ label: 'My Apps', href: '/apps' }];
    if (app) crumbs.push({ label: app.name, href: `/apps/${appId}` });
    if (campaignData) crumbs.push({ label: campaignData.name, href: `/apps/${appId}/campaigns/${campaignId}` });
    if (broadcast) crumbs.push({ label: broadcast.broadcastName });
    else crumbs.push({ label: 'Loading...' });
    return crumbs;
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={buildBreadcrumbs()}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading broadcast...</p>
        </div>
      </AppLayout>
    );
  }

  if (!broadcast) {
    return (
      <AppLayout breadcrumbs={buildBreadcrumbs()}>
        <div className="text-center py-12">
          <p className="text-foreground">Broadcast not found</p>
        </div>
      </AppLayout>
    );
  }

  const polls = broadcast.polls || [];
  const contests = broadcast.contests || [];

  return (
    <AppLayout breadcrumbs={buildBreadcrumbs()}>
      <div>
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground" data-testid="text-broadcast-name">
                  {broadcast.broadcastName}
                </h1>
                {getStatusBadge(broadcast.status)}
              </div>
              <p className="text-sm text-muted-foreground font-mono mb-2" data-testid="text-broadcast-id">
                ID: {broadcast.broadcastId}
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {broadcast.startTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>Start: {new Date(broadcast.startTime).toLocaleString()}</span>
                  </div>
                )}
                {broadcast.endTime && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>End: {new Date(broadcast.endTime).toLocaleString()}</span>
                  </div>
                )}
                {broadcast.campaign && (
                  <Link href={`/campaign/${broadcast.campaignId}/dashboard`}>
                    <span className="flex items-center gap-1 text-primary hover:underline cursor-pointer" data-testid="link-campaign">
                      <ChevronRight className="w-4 h-4" />
                      Campaign: {broadcast.campaign.name}
                    </span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <Radio className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="polls" data-testid="tab-polls">
              <BarChart3 className="w-4 h-4 mr-2" />
              Polls ({polls.length})
            </TabsTrigger>
            <TabsTrigger value="contests" data-testid="tab-contests">
              <Trophy className="w-4 h-4 mr-2" />
              Contests ({contests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="border border-white/10">
              <CardHeader>
                <CardTitle>Broadcast Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="text-foreground font-medium" data-testid="text-overview-name">{broadcast.broadcastName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1" data-testid="text-overview-status">{getStatusBadge(broadcast.status)}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Broadcast ID</Label>
                    <p className="text-foreground font-mono text-sm" data-testid="text-overview-id">{broadcast.broadcastId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Campaign</Label>
                    <p className="text-foreground" data-testid="text-overview-campaign">
                      {broadcast.campaign?.name || 'None'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Start Time</Label>
                    <p className="text-foreground" data-testid="text-overview-start">
                      {broadcast.startTime ? new Date(broadcast.startTime).toLocaleString() : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">End Time</Label>
                    <p className="text-foreground" data-testid="text-overview-end">
                      {broadcast.endTime ? new Date(broadcast.endTime).toLocaleString() : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Polls</Label>
                    <p className="text-foreground" data-testid="text-overview-polls">{polls.length}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contests</Label>
                    <p className="text-foreground" data-testid="text-overview-contests">{contests.length}</p>
                  </div>
                </div>
                {broadcast.metadata != null ? (
                  <div className="mt-6">
                    <Label className="text-muted-foreground">Metadata</Label>
                    <pre className="bg-black/30 rounded-lg p-4 mt-1 text-sm text-foreground overflow-auto" data-testid="text-overview-metadata">
                      {String(JSON.stringify(broadcast.metadata, null, 2))}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="polls">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Polls</h3>
              <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-poll" className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Poll
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create Poll</DialogTitle>
                    <DialogDescription>Create a new poll for this broadcast.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pollQuestion">Question *</Label>
                      <Input
                        id="pollQuestion"
                        data-testid="input-poll-question"
                        value={pollForm.question}
                        onChange={(e) => setPollForm(prev => ({ ...prev, question: e.target.value }))}
                        placeholder="Enter poll question"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Options (min 2)</Label>
                      {pollForm.options.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            data-testid={`input-poll-option-${index}`}
                            value={option}
                            onChange={(e) => updatePollOption(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                          />
                          {pollForm.options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePollOption(index)}
                              data-testid={`button-remove-option-${index}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addPollOption} data-testid="button-add-option" className="gap-1">
                        <Plus className="w-3 h-3" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPollDialogOpen(false)} data-testid="button-cancel-poll">
                      Cancel
                    </Button>
                    <Button onClick={handleCreatePoll} disabled={createPollMutation.isPending} data-testid="button-submit-poll">
                      {createPollMutation.isPending ? 'Creating...' : 'Create Poll'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {polls.length === 0 ? (
              <Card className="border-0">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No polls yet</h3>
                  <p className="text-muted-foreground mb-4">Create a poll to engage your audience</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {polls.map((poll) => {
                  const totalVotes = poll.totalVotes || 0;
                  return (
                    <Card key={poll.id} className="border border-white/10" data-testid={`card-poll-${poll.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">{poll.question}</CardTitle>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${poll.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`} data-testid={`badge-poll-active-${poll.id}`}>
                                {poll.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <CardDescription>Total votes: {totalVotes}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={poll.isActive}
                              onCheckedChange={(checked) => togglePollMutation.mutate({ pollId: poll.id, isActive: checked })}
                              data-testid={`switch-poll-${poll.id}`}
                            />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-poll-${poll.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Poll?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete this poll and all its votes.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deletePollMutation.mutate(poll.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      {poll.options && poll.options.length > 0 && (
                        <CardContent>
                          <div className="space-y-3">
                            {poll.options.map((option) => {
                              const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
                              return (
                                <div key={option.id} data-testid={`poll-option-${option.id}`}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-foreground">{option.text}</span>
                                    <span className="text-muted-foreground">{option.voteCount} votes ({percentage}%)</span>
                                  </div>
                                  <div className="w-full bg-white/5 rounded-full h-2">
                                    <div
                                      className="bg-primary rounded-full h-2 transition-all"
                                      style={{ width: `${percentage}%` }}
                                      data-testid={`poll-option-bar-${option.id}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contests">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Contests</h3>
              <Dialog open={contestDialogOpen} onOpenChange={setContestDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-contest" className="gap-2">
                    <Plus className="w-4 h-4" />
                    New Contest
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create Contest</DialogTitle>
                    <DialogDescription>Create a new contest for this broadcast.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="contestTitle">Title *</Label>
                      <Input
                        id="contestTitle"
                        data-testid="input-contest-title"
                        value={contestForm.title}
                        onChange={(e) => setContestForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter contest title"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contestDescription">Description</Label>
                      <Textarea
                        id="contestDescription"
                        data-testid="input-contest-description"
                        value={contestForm.description}
                        onChange={(e) => setContestForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter contest description"
                        rows={3}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contestPrize">Prize</Label>
                      <Input
                        id="contestPrize"
                        data-testid="input-contest-prize"
                        value={contestForm.prize}
                        onChange={(e) => setContestForm(prev => ({ ...prev, prize: e.target.value }))}
                        placeholder="Enter prize description"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="contestType">Contest Type</Label>
                      <Select
                        value={contestForm.contestType}
                        onValueChange={(value) => setContestForm(prev => ({ ...prev, contestType: value }))}
                      >
                        <SelectTrigger data-testid="select-contest-type">
                          <SelectValue placeholder="Select contest type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTEST_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value} data-testid={`option-contest-type-${type.value}`}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setContestDialogOpen(false)} data-testid="button-cancel-contest">
                      Cancel
                    </Button>
                    <Button onClick={handleCreateContest} disabled={createContestMutation.isPending} data-testid="button-submit-contest">
                      {createContestMutation.isPending ? 'Creating...' : 'Create Contest'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {contests.length === 0 ? (
              <Card className="border-0">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No contests yet</h3>
                  <p className="text-muted-foreground mb-4">Create a contest to engage your audience</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contests.map((contest) => (
                  <Card key={contest.id} className="border border-white/10" data-testid={`card-contest-${contest.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-base">{contest.title}</CardTitle>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${contest.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`} data-testid={`badge-contest-active-${contest.id}`}>
                              {contest.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <CardDescription className="capitalize">Type: {contest.contestType}</CardDescription>
                          {contest.prize && <CardDescription>Prize: {contest.prize}</CardDescription>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={contest.isActive}
                            onCheckedChange={(checked) => toggleContestMutation.mutate({ contestId: contest.id, isActive: checked })}
                            data-testid={`switch-contest-${contest.id}`}
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" data-testid={`button-delete-contest-${contest.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Contest?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete this contest and all participations.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteContestMutation.mutate(contest.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardHeader>
                    {contest.description && (
                      <CardContent>
                        <p className="text-sm text-muted-foreground" data-testid={`text-contest-description-${contest.id}`}>{contest.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
