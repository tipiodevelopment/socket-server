import { useParams, Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AppLayout } from '@/components/AppLayout';
import type { BreadcrumbItem } from '@/components/AppLayout';
import type { Broadcast, Poll, PollOptionRecord, Contest, Campaign } from '@shared/schema';
import { ArrowLeft, Plus, Trash2, Clock, BarChart3, Trophy, X, MoreVertical, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useUser } from '@/contexts/UserContext';

type BroadcastWithRelations = Broadcast & {
  polls?: (Poll & { options?: PollOptionRecord[] })[];
  contests?: Contest[];
  campaign?: Campaign | null;
};

const CONTEST_TYPES = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'giveaway', label: 'Giveaway' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'prediction', label: 'Prediction' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="px-2 py-0.5 bg-white dark:bg-white text-black dark:text-black text-[10px] uppercase font-bold rounded-full flex items-center space-x-1" data-testid="badge-status-live">
        <div className="w-1.5 h-1.5 bg-black dark:bg-black rounded-full animate-pulse"></div>
        <span>Live</span>
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="px-2 py-0.5 bg-white/10 dark:bg-white/10 text-muted-foreground text-[10px] uppercase font-bold rounded-full border border-white/20 dark:border-white/20" data-testid="badge-status-upcoming">
        Upcoming
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-white/10 dark:bg-white/10 text-muted-foreground text-[10px] uppercase font-bold rounded-full border border-white/10 dark:border-white/10" data-testid="badge-status-ended">
      Ended
    </span>
  );
}

function ActivePollCard({ poll, onToggle, onDelete }: {
  poll: Poll & { options?: PollOptionRecord[] };
  onToggle: (pollId: number, isActive: boolean) => void;
  onDelete: (pollId: number) => void;
}) {
  const totalVotes = poll.totalVotes || 0;
  const isActive = poll.isActive;

  return (
    <div
      className={`bg-transparent border rounded-lg p-4 ${isActive ? 'border-blue-500/30' : 'border-white/10 dark:border-white/10'}`}
      data-testid={`card-poll-${poll.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isActive && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          <span className={`text-xs font-semibold uppercase ${isActive ? 'text-blue-400' : 'text-muted-foreground'}`} data-testid={`badge-poll-active-${poll.id}`}>
            {isActive ? 'Poll Active' : 'Poll Inactive'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={isActive}
            onCheckedChange={(checked) => onToggle(poll.id, checked)}
            data-testid={`switch-poll-${poll.id}`}
            className="scale-75"
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-foreground" data-testid={`button-delete-poll-${poll.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Poll?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete this poll and all its votes.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(poll.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-2" data-testid={`text-poll-question-${poll.id}`}>{poll.question}</h3>

      {isActive && poll.options && poll.options.length > 0 ? (
        <>
          <div className="space-y-2 mb-3">
            {poll.options.map((option) => {
              const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
              return (
                <div key={option.id} data-testid={`poll-option-${option.id}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground/70">{option.text}</span>
                    <span className="text-foreground font-semibold">{percentage}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${percentage}%` }} data-testid={`poll-option-bar-${option.id}`}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{totalVotes.toLocaleString()} votes</span>
          </div>
        </>
      ) : (
        poll.options && poll.options.length > 0 && (
          <div className="space-y-1.5 mb-3 text-xs text-muted-foreground">
            {poll.options.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3" />
                <span>{option.text}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ContestCard({ contest, onToggle, onDelete }: {
  contest: Contest;
  onToggle: (contestId: number, isActive: boolean) => void;
  onDelete: (contestId: number) => void;
}) {
  return (
    <div
      className={`bg-transparent border rounded-lg p-4 ${contest.isActive ? 'border-purple-500/30' : 'border-white/10 dark:border-white/10'}`}
      data-testid={`card-contest-${contest.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {contest.isActive && <div className="w-2 h-2 bg-purple-500 rounded-full"></div>}
          <span className={`text-xs font-semibold uppercase ${contest.isActive ? 'text-purple-400' : 'text-muted-foreground'}`}>
            {contest.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={contest.isActive}
            onCheckedChange={(checked) => onToggle(contest.id, checked)}
            data-testid={`switch-contest-${contest.id}`}
            className="scale-75"
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-foreground" data-testid={`button-delete-contest-${contest.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Contest?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete this contest and all participations.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(contest.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-start space-x-3">
        <div className={`w-12 h-12 rounded flex items-center justify-center flex-shrink-0 ${contest.isActive ? 'bg-purple-500/20' : 'bg-white/5 dark:bg-white/5'}`}>
          <Trophy className={`w-5 h-5 ${contest.isActive ? 'text-purple-400' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground mb-1" data-testid={`text-contest-title-${contest.id}`}>{contest.title}</h3>
          {contest.description && (
            <p className="text-xs text-muted-foreground mb-2 truncate">{contest.description}</p>
          )}
          <div className="flex items-center justify-between text-xs">
            {contest.contestType && <span className="text-muted-foreground capitalize">{contest.contestType}</span>}
            {contest.prize && <span className="text-foreground/70 font-medium">Prize: {contest.prize}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const broadcastId = params.broadcastId;
  const { toast } = useToast();

  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [contestDialogOpen, setContestDialogOpen] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] });
  const [contestForm, setContestForm] = useState({ title: '', description: '', prize: '', contestType: 'quiz' });

  const { data: broadcast, isLoading } = useQuery<BroadcastWithRelations>({
    queryKey: ['/api/broadcasts', broadcastId],
    enabled: !!broadcastId,
  });

  const { data: campaignData } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', broadcast?.campaignId],
    enabled: !!broadcast?.campaignId,
  });

  const createPollMutation = useMutation({
    mutationFn: async (data: { question: string; options: string[] }) => {
      return await apiRequest('POST', `/api/broadcasts/${broadcastId}/polls`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Poll Created' });
      setPollDialogOpen(false);
      setPollForm({ question: '', options: ['', ''] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create poll.', variant: 'destructive' });
    },
  });

  const deletePollMutation = useMutation({
    mutationFn: async (pollId: number) => apiRequest('DELETE', `/api/polls/${pollId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Poll Deleted' });
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
      toast({ title: 'Contest Created' });
      setContestDialogOpen(false);
      setContestForm({ title: '', description: '', prize: '', contestType: 'quiz' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create contest.', variant: 'destructive' });
    },
  });

  const deleteContestMutation = useMutation({
    mutationFn: async (contestId: number) => apiRequest('DELETE', `/api/contests/${contestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Contest Deleted' });
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

  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [{ label: 'Broadcasts', href: '/broadcasts' }];
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
  const activePolls = polls.filter(p => p.isActive);
  const inactivePolls = polls.filter(p => !p.isActive);

  return (
    <AppLayout breadcrumbs={buildBreadcrumbs()}>
      <div className="-mt-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setLocation('/broadcasts')}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <h1 className="text-xl font-bold text-foreground" data-testid="text-broadcast-name">{broadcast.broadcastName}</h1>
                <StatusBadge status={broadcast.status} />
              </div>
              <div className="flex items-center text-xs text-muted-foreground space-x-2">
                {campaignData && (
                  <>
                    <Link href={`/campaigns/${campaignData.id}`}>
                      <span className="text-foreground/70 hover:text-foreground cursor-pointer" data-testid="link-campaign">{campaignData.name}</span>
                    </Link>
                    <span className="text-muted-foreground/30">/</span>
                  </>
                )}
                <span className="text-muted-foreground" data-testid="text-broadcast-id">{broadcast.broadcastId}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-4 px-4 py-2 bg-white/5 dark:bg-white/5 rounded border border-white/10 dark:border-white/10">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Viewers</div>
                <div className="text-sm font-semibold text-foreground" data-testid="stat-header-viewers">—</div>
              </div>
              <div className="w-px h-8 bg-white/10 dark:bg-white/10"></div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Polls</div>
                <div className="text-sm font-semibold text-foreground" data-testid="stat-header-polls">{polls.length}</div>
              </div>
              <div className="w-px h-8 bg-white/10 dark:bg-white/10"></div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Contests</div>
                <div className="text-sm font-semibold text-foreground" data-testid="stat-header-contests">{contests.length}</div>
              </div>
              <div className="w-px h-8 bg-white/10 dark:bg-white/10"></div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Engagement</div>
                <div className="text-sm font-semibold text-foreground" data-testid="stat-header-engagement">—</div>
              </div>
            </div>
          </div>
        </div>

        {broadcast.description && (
          <div className="mb-6 text-sm text-muted-foreground" data-testid="text-broadcast-description">
            {broadcast.description}
          </div>
        )}

        <div className="mb-6" data-testid="section-engagement">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Active Engagement</h2>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-muted-foreground">{polls.length} poll{polls.length !== 1 ? 's' : ''}</span>
              <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
                <DialogTrigger asChild>
                  <button className="px-3 py-1.5 bg-white dark:bg-white text-black dark:text-black rounded text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-200 transition" data-testid="button-create-poll">
                    <Plus className="w-3 h-3 inline mr-1.5" />
                    Add Poll
                  </button>
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
                    <Button variant="outline" onClick={() => setPollDialogOpen(false)} data-testid="button-cancel-poll">Cancel</Button>
                    <Button onClick={handleCreatePoll} disabled={createPollMutation.isPending} data-testid="button-submit-poll">
                      {createPollMutation.isPending ? 'Creating...' : 'Create Poll'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {polls.length === 0 ? (
            <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-8 text-center">
              <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No polls yet</h3>
              <p className="text-xs text-muted-foreground">Create a poll to engage your audience</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePolls.map(poll => (
                <ActivePollCard
                  key={poll.id}
                  poll={poll}
                  onToggle={(id, active) => togglePollMutation.mutate({ pollId: id, isActive: active })}
                  onDelete={(id) => deletePollMutation.mutate(id)}
                />
              ))}
              {inactivePolls.map(poll => (
                <ActivePollCard
                  key={poll.id}
                  poll={poll}
                  onToggle={(id, active) => togglePollMutation.mutate({ pollId: id, isActive: active })}
                  onDelete={(id) => deletePollMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mb-6" data-testid="section-contests">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Contests & Trivia</h2>
            <Dialog open={contestDialogOpen} onOpenChange={setContestDialogOpen}>
              <DialogTrigger asChild>
                <button className="px-3 py-1.5 bg-transparent border border-white/20 dark:border-white/20 hover:border-white/40 dark:hover:border-white/40 text-foreground rounded text-xs font-medium transition" data-testid="button-create-contest">
                  <Plus className="w-3 h-3 inline mr-1.5" />
                  Add Contest
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Contest</DialogTitle>
                  <DialogDescription>Create a new contest for this broadcast.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Title *</Label>
                    <Input
                      data-testid="input-contest-title"
                      value={contestForm.title}
                      onChange={(e) => setContestForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Contest title"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input
                      data-testid="input-contest-description"
                      value={contestForm.description}
                      onChange={(e) => setContestForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Prize</Label>
                      <Input
                        data-testid="input-contest-prize"
                        value={contestForm.prize}
                        onChange={(e) => setContestForm(prev => ({ ...prev, prize: e.target.value }))}
                        placeholder="e.g. $250"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Type</Label>
                      <Select value={contestForm.contestType} onValueChange={(v) => setContestForm(prev => ({ ...prev, contestType: v }))}>
                        <SelectTrigger data-testid="select-contest-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTEST_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setContestDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateContest} disabled={createContestMutation.isPending} data-testid="button-submit-contest">
                    {createContestMutation.isPending ? 'Creating...' : 'Create Contest'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {contests.length === 0 ? (
            <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-8 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No contests yet</h3>
              <p className="text-xs text-muted-foreground">Create a contest to reward your audience</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contests.map(contest => (
                <ContestCard
                  key={contest.id}
                  contest={contest}
                  onToggle={(id, active) => toggleContestMutation.mutate({ contestId: id, isActive: active })}
                  onDelete={(id) => deleteContestMutation.mutate(id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Broadcast Details</h2>
          </div>
          <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <div className="mt-1"><StatusBadge status={broadcast.status} /></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Broadcast ID</div>
                <div className="text-sm text-foreground font-mono">{broadcast.broadcastId}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Start Time</div>
                <div className="text-sm text-foreground">
                  {broadcast.startTime ? new Date(broadcast.startTime).toLocaleString() : 'Not set'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">End Time</div>
                <div className="text-sm text-foreground">
                  {broadcast.endTime ? new Date(broadcast.endTime).toLocaleString() : 'Not set'}
                </div>
              </div>
            </div>
            {broadcast.metadata != null && (
              <div className="mt-4 pt-4 border-t border-white/10 dark:border-white/10">
                <div className="text-xs text-muted-foreground mb-2">Metadata</div>
                <pre className="bg-black/30 dark:bg-black/30 rounded-lg p-3 text-xs text-foreground overflow-auto" data-testid="text-broadcast-metadata">
                  {String(JSON.stringify(broadcast.metadata, null, 2))}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
