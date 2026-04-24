import { useParams, Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AppLayout } from '@/components/AppLayout';
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import MatchDataCard from '@/components/match-data-card';
import type { Broadcast, Poll, PollOptionRecord, Contest, Campaign, BroadcastAd, BroadcastProduct, ChatMessage, Sponsor } from '@shared/schema';
import { ArrowLeft, Plus, Trash2, BarChart3, Trophy, X, MoreVertical, CheckCircle, Play, SkipBack, SkipForward, Maximize2, Send, Megaphone, ShoppingBag, ExternalLink, Eye, TrendingUp, Vote, MessageSquare, RefreshCw, Users, Radio, Pencil, Check, AtSign, ChevronDown, ChevronRight, Code2, Shirt } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { SponsorCatalogPicker } from '@/components/sponsor-catalog-picker';

type BroadcastWithRelations = Broadcast & {
  polls?: (Poll & { options?: PollOptionRecord[] })[];
  contests?: Contest[];
  campaign?: Campaign | null;
};

type BroadcastAnalytics = {
  broadcastId: string;
  pollCount: number;
  activePolls: number;
  contestCount: number;
  activeContests: number;
  totalVotes: number;
  viewerCount: number;
  peakViewers: number;
  status: string;
};

const CONTEST_TYPES = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'giveaway', label: 'Giveaway' },
  { value: 'trivia', label: 'Trivia' },
  { value: 'prediction', label: 'Prediction' },
];

function formatViewers(num: number): string {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="px-2 py-0.5 bg-[#3d8b7a] text-white dark:bg-white dark:text-black text-[10px] uppercase font-bold rounded-full flex items-center space-x-1" data-testid="badge-status-live">
        <div className="w-1.5 h-1.5 bg-white dark:bg-black rounded-full animate-pulse"></div>
        <span>Live</span>
      </span>
    );
  }
  if (status === 'upcoming') {
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 text-[10px] uppercase font-bold rounded-full border border-gray-200 dark:border-white/20" data-testid="badge-status-upcoming">
        Upcoming
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-400 text-[10px] uppercase font-bold rounded-full border border-gray-200 dark:border-white/10" data-testid="badge-status-ended">
      Ended
    </span>
  );
}

type MatchEvent = { minute: number; type: string; label: string; team?: string };

function EventTimeline({ polls, contests, matchEvents, broadcastStatus, onTogglePoll, onToggleContest }: { 
  polls: (Poll & { options?: PollOptionRecord[] })[]; 
  contests: Contest[];
  matchEvents?: MatchEvent[];
  broadcastStatus?: string;
  onTogglePoll: (id: number, active: boolean) => void;
  onToggleContest: (id: number, active: boolean) => void;
}) {
  const { toast } = useToast();
  const MATCH_DURATION = 90;

  type TimelineEvent = {
    id: string;
    minute: number;
    type: 'kickoff' | 'goal' | 'fulltime' | 'poll' | 'contest' | 'shoppable_ad';
    label: string;
    isActive?: boolean;
    detail?: string;
    pollId?: number;
    contestId?: number;
  };

  const buildEvents = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    if (matchEvents && matchEvents.length > 0) {
      matchEvents.forEach(ev => {
        events.push({
          id: `match-${ev.minute}-${ev.type}`,
          minute: ev.minute,
          type: ev.type as any,
          label: ev.label,
        });
      });
    } else {
      events.push({ id: 'kickoff', minute: 0, type: 'kickoff', label: 'Kickoff' });
      if (broadcastStatus === 'ended') {
        events.push({ id: 'fulltime', minute: 90, type: 'fulltime', label: 'Full Time' });
      }
    }

    polls.forEach((p, i) => {
      const hasMatchEvent = matchEvents?.some(ev => ev.type === 'poll' && ev.label.includes(p.question.substring(0, 15)));
      if (!hasMatchEvent) {
        events.push({
          id: `poll-${p.id}`,
          minute: Math.min(5 + i * 18, 88),
          type: 'poll',
          label: p.question,
          isActive: p.isActive ?? false,
          detail: p.totalVotes ? `${p.totalVotes.toLocaleString()} votes` : undefined,
          pollId: p.id,
        });
      } else {
        const existing = events.find(ev => ev.type === 'poll' && ev.label.includes(p.question.substring(0, 15)));
        if (existing) {
          existing.pollId = p.id;
          existing.isActive = p.isActive ?? false;
          existing.detail = p.totalVotes ? `${p.totalVotes.toLocaleString()} votes` : undefined;
        }
      }
    });

    contests.forEach((c, i) => {
      const hasMatchEvent = matchEvents?.some(ev => ev.type === 'contest');
      if (!hasMatchEvent) {
        events.push({
          id: `contest-${c.id}`,
          minute: Math.min(30 + i * 20, 85),
          type: 'contest',
          label: c.title,
          isActive: c.isActive ?? false,
          contestId: c.id,
        });
      } else {
        const existing = events.find(ev => ev.type === 'contest');
        if (existing) {
          existing.contestId = c.id;
          existing.isActive = c.isActive ?? false;
        }
      }
    });

    return events.sort((a, b) => a.minute - b.minute);
  };

  const allEvents = buildEvents();
  const engagementEvents = allEvents.filter(e => e.type === 'poll' || e.type === 'contest' || e.type === 'shoppable_ad');
  const firedCount = allEvents.filter(e => e.type === 'goal' || e.isActive || e.type === 'kickoff' || e.type === 'fulltime' || e.type === 'shoppable_ad').length;

  const typeConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    kickoff:     { color: 'text-white/60', bg: 'bg-white/30',    icon: '⚽', label: 'Match' },
    goal:        { color: 'text-yellow-400', bg: 'bg-yellow-400', icon: '⚽', label: 'Goal' },
    fulltime:    { color: 'text-white/60', bg: 'bg-white/30',    icon: '⏹', label: 'FT' },
    poll:        { color: 'text-blue-400',   bg: 'bg-blue-500',   icon: '📊', label: 'Poll' },
    contest:     { color: 'text-purple-400', bg: 'bg-purple-500', icon: '🏆', label: 'Contest' },
    shoppable_ad:{ color: 'text-green-400',  bg: 'bg-green-500',  icon: '🛍️', label: 'Ad' },
  };

  return (
    <div className="mb-6" data-testid="section-timeline">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Event Timeline</h2>
        <div className="flex items-center gap-3 text-[10px] text-white/30">
          {(['poll','contest','shoppable_ad','goal'] as const).map(t => (
            <span key={t} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${typeConfig[t].bg}`} />
              {typeConfig[t].label}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-xl p-5">
        {/* Stats row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] text-white/30 mb-0.5">Events fired</div>
              <div className="text-xl font-bold text-white">{firedCount}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/30 mb-0.5">Engagement events</div>
              <div className="text-xl font-bold text-white">{engagementEvents.length}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                const nextInactivePoll = polls.find(p => !p.isActive);
                if (nextInactivePoll) onTogglePoll(nextInactivePoll.id, true);
                else {
                  const nextInactiveContest = contests.find(c => !c.isActive);
                  if (nextInactiveContest) onToggleContest(nextInactiveContest.id, true);
                  else toast({ title: 'All events activated' });
                }
              }}
              data-testid="button-timeline-play"
            >
              <Play className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => toast({ title: 'Skip not implemented' })}
              data-testid="button-timeline-skip"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              data-testid="button-timeline-maximize"
              onClick={() => {}}
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {allEvents.length <= 2 && !matchEvents?.length && polls.length === 0 && contests.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
            No events yet. Create polls or contests to see them on the timeline.
          </div>
        ) : (
          <div className="relative">
            {/* Minute labels */}
            <div className="flex justify-between text-[9px] text-white/20 mb-2 px-1">
              {[0, 15, 30, 45, 60, 75, 90].map(m => (
                <span key={m}>{m}'</span>
              ))}
            </div>

            {/* Scrubber track */}
            <div className="relative h-2 bg-white/5 rounded-full mb-8">
              {/* Progress fill for ended matches */}
              {broadcastStatus === 'ended' && (
                <div className="absolute inset-0 bg-white/10 rounded-full" />
              )}
              {/* Tick marks at 15, 30, 45, 60, 75 */}
              {[15, 30, 45, 60, 75].map(m => (
                <div key={m} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${(m / MATCH_DURATION) * 100}%` }} />
              ))}
              {/* Half-time line */}
              <div className="absolute top-[-3px] bottom-[-3px] w-px bg-white/25" style={{ left: '50%' }} />
            </div>

            {/* Event markers */}
            <div className="relative h-16">
              {allEvents.map((event, i) => {
                const cfg = typeConfig[event.type] ?? typeConfig.poll;
                const pct = (event.minute / MATCH_DURATION) * 100;
                const row = i % 3;
                const isGoal = event.type === 'goal';
                const isMatch = event.type === 'kickoff' || event.type === 'fulltime';

                return (
                  <div
                    key={event.id}
                    className="absolute group cursor-default"
                    style={{ left: `calc(${Math.min(pct, 98)}% - 6px)`, top: `${row * 20}px` }}
                    data-testid={`timeline-event-${event.id}`}
                  >
                    {/* Vertical connector line from track */}
                    <div
                      className="absolute bottom-full left-1/2 w-px bg-white/10"
                      style={{ height: `${26 + (2 - row) * 20}px`, bottom: `calc(100% + 2px)` }}
                    />
                    {/* Dot */}
                    <div className={`w-3 h-3 rounded-full border-2 border-black ${cfg.bg} ${isGoal ? 'ring-2 ring-yellow-400/50 scale-125' : ''} ${isMatch ? 'opacity-40' : ''}`} />

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      <div className="bg-gray-900 dark:bg-black border border-white/10 rounded-lg p-2.5 text-xs whitespace-nowrap shadow-xl min-w-[140px]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span>{cfg.icon}</span>
                          <span className="text-white/50 text-[10px]">{event.minute}'</span>
                        </div>
                        <div className="font-medium text-white text-[11px] leading-tight">{event.label}</div>
                        {event.detail && <div className="text-white/40 text-[10px] mt-1">{event.detail}</div>}
                        {event.isActive && <div className="text-green-400 text-[10px] mt-1 font-medium">● Active</div>}
                      </div>
                      <div className="w-2 h-2 bg-gray-900 border-b border-r border-white/10 rotate-45 mx-auto -mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom stats */}
            <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px] text-white/25">
              <span>{allEvents.length} total events</span>
              <span>{broadcastStatus === 'ended' ? '90\' FT' : broadcastStatus === 'live' ? 'Live' : 'Scheduled'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivePollCard({ poll, onToggle, onDelete, campaignId }: {
  poll: Poll & { options?: PollOptionRecord[] };
  onToggle: (pollId: number, isActive: boolean) => void;
  onDelete: (pollId: number) => void;
  campaignId?: number | null;
}) {
  const { toast } = useToast();
  const totalVotes = poll.totalVotes || 0;
  const isActive = poll.isActive;

  const sendLiveMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/events/poll', {
      question: poll.question,
      options: (poll.options || []).map(o => ({ text: o.text })),
      duration: 60,
      campaignId,
    }),
    onSuccess: () => toast({ title: 'Poll sent live', description: 'Broadcasted to all connected clients' }),
    onError: () => toast({ title: 'Error', description: 'Failed to send poll live', variant: 'destructive' }),
  });

  return (
    <div
      className={`bg-transparent border rounded-lg p-4 ${isActive ? 'border-blue-500/30' : 'border-gray-200 dark:border-white/10'}`}
      data-testid={`card-poll-${poll.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {isActive && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          <span className={`text-xs font-semibold uppercase ${isActive ? 'text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} data-testid={`badge-poll-active-${poll.id}`}>
            {isActive ? 'Poll Active' : 'Poll Scheduled'}
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
              <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" data-testid={`button-delete-poll-${poll.id}`}>
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

      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2" data-testid={`text-poll-question-${poll.id}`}>{poll.question}</h3>

      {isActive && poll.options && poll.options.length > 0 ? (
        <>
          <div className="space-y-2 mb-3">
            {poll.options.map((option) => {
              const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
              return (
                <div key={option.id} data-testid={`poll-option-${option.id}`}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 dark:text-gray-300">{option.text}</span>
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {percentage}%
                      {totalVotes > 0 && (
                        <span className="text-gray-400 dark:text-gray-500 font-normal ml-1">({(option.voteCount || 0).toLocaleString()} votes)</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${percentage}%` }} data-testid={`poll-option-bar-${option.id}`}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>{totalVotes.toLocaleString()} votes</span>
          </div>
        </>
      ) : (
        poll.options && poll.options.length > 0 && (
          <div className="space-y-1.5 mb-3 text-xs text-gray-500 dark:text-gray-400">
            {poll.options.map((option) => (
              <div key={option.id} className="flex items-center space-x-2">
                <CheckCircle className="w-3 h-3" />
                <span>{option.text}</span>
              </div>
            ))}
          </div>
        )
      )}
      {campaignId && (
        <button
          onClick={() => sendLiveMutation.mutate()}
          disabled={sendLiveMutation.isPending}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition disabled:opacity-50"
          data-testid={`button-send-live-poll-${poll.id}`}
        >
          <Radio className="w-3 h-3" />
          {sendLiveMutation.isPending ? 'Sending...' : 'Send Live'}
        </button>
      )}
    </div>
  );
}

function ContestCard({ contest, onToggle, onDelete, campaignId, broadcastId }: {
  contest: Contest;
  onToggle: (contestId: number, isActive: boolean) => void;
  onDelete: (contestId: number) => void;
  campaignId?: number | null;
  broadcastId: string;
}) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(contest.title);
  const [editDescription, setEditDescription] = useState(contest.description ?? '');
  const [editImageUrl, setEditImageUrl] = useState(contest.imageUrl ?? '');
  const [editPrize, setEditPrize] = useState(contest.prize ?? '');
  const [editType, setEditType] = useState(contest.contestType);

  const openEdit = () => {
    setEditTitle(contest.title);
    setEditDescription(contest.description ?? '');
    setEditImageUrl(contest.imageUrl ?? '');
    setEditPrize(contest.prize ?? '');
    setEditType(contest.contestType);
    setEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: () => apiRequest('PUT', `/api/contests/${contest.id}`, {
      title: editTitle,
      description: editDescription || null,
      imageUrl: editImageUrl || null,
      prize: editPrize || null,
      contestType: editType,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'contests'] });
      setEditOpen(false);
      toast({ title: 'Contest updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update contest', variant: 'destructive' }),
  });

  const sendLiveMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/events/contest', {
      name: contest.title,
      prize: contest.prize || '',
      deadline: contest.endTime ? new Date(contest.endTime).toISOString().split('T')[0] : '',
      maxParticipants: 100,
      campaignId,
    }),
    onSuccess: () => toast({ title: 'Contest sent live', description: 'Broadcasted to all connected clients' }),
    onError: () => toast({ title: 'Error', description: 'Failed to send contest live', variant: 'destructive' }),
  });

  return (
    <div
      className={`bg-transparent border rounded-lg p-4 ${contest.isActive ? 'border-purple-500/30' : 'border-gray-200 dark:border-white/10'}`}
      data-testid={`card-contest-${contest.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {contest.isActive && <div className="w-2 h-2 bg-purple-500 rounded-full"></div>}
          <span className={`text-xs font-semibold uppercase ${contest.isActive ? 'text-purple-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {contest.isActive ? 'Active' : 'Scheduled'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={openEdit}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            data-testid={`button-edit-contest-${contest.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <Switch
            checked={contest.isActive}
            onCheckedChange={(checked) => onToggle(contest.id, checked)}
            data-testid={`switch-contest-${contest.id}`}
            className="scale-75"
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white" data-testid={`button-delete-contest-${contest.id}`}>
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
        <div className={`w-12 h-12 rounded flex items-center justify-center flex-shrink-0 overflow-hidden ${contest.isActive ? 'bg-purple-500/20' : 'bg-gray-50 dark:bg-white/5'}`}>
          {contest.imageUrl ? (
            <img src={contest.imageUrl} alt="" className="w-12 h-12 object-cover rounded" data-testid={`img-contest-${contest.id}`} />
          ) : (
            <Trophy className={`w-5 h-5 ${contest.isActive ? 'text-purple-400' : 'text-gray-500 dark:text-gray-400'}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1" data-testid={`text-contest-title-${contest.id}`}>{contest.title}</h3>
          {contest.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{contest.description}</p>
          )}
          <div className="flex items-center justify-between text-xs">
            {contest.contestType && <span className="text-gray-400 dark:text-gray-500 capitalize">{contest.contestType}</span>}
            {contest.prize && <span className="text-gray-600 dark:text-gray-300 font-medium">Prize: {contest.prize}</span>}
          </div>
        </div>
      </div>
      {campaignId && (
        <button
          onClick={() => sendLiveMutation.mutate()}
          disabled={sendLiveMutation.isPending}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition disabled:opacity-50"
          data-testid={`button-send-live-contest-${contest.id}`}
        >
          <Radio className="w-3 h-3" />
          {sendLiveMutation.isPending ? 'Sending...' : 'Send Live'}
        </button>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contest</DialogTitle>
            <DialogDescription>Update the contest details. Changes are saved immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor={`contest-title-${contest.id}`}>Title *</Label>
              <Input
                id={`contest-title-${contest.id}`}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Contest title"
                data-testid={`input-edit-contest-title-${contest.id}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`contest-desc-${contest.id}`}>Description</Label>
              <Textarea
                id={`contest-desc-${contest.id}`}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Short description"
                rows={2}
                data-testid={`input-edit-contest-desc-${contest.id}`}
              />
            </div>
            <ImageUploadWithPreview
              label="Image"
              value={editImageUrl}
              onChange={setEditImageUrl}
              placeholder="https://example.com/image.jpg"
              testId={`edit-contest-image-${contest.id}`}
            />
            <div className="space-y-1.5">
              <Label htmlFor={`contest-prize-${contest.id}`}>Prize</Label>
              <Input
                id={`contest-prize-${contest.id}`}
                value={editPrize}
                onChange={(e) => setEditPrize(e.target.value)}
                placeholder="e.g. Nike shoes worth 150 USD"
                data-testid={`input-edit-contest-prize-${contest.id}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger data-testid={`select-edit-contest-type-${contest.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vote">Vote</SelectItem>
                  <SelectItem value="trivia">Trivia</SelectItem>
                  <SelectItem value="prediction">Prediction</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} data-testid={`button-cancel-edit-contest-${contest.id}`}>
              Cancel
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !editTitle.trim()}
              data-testid={`button-save-edit-contest-${contest.id}`}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduledAdsSection({ broadcastId }: { broadcastId: string }) {
  const { toast } = useToast();
  const { data: ads = [], isLoading } = useQuery<BroadcastAd[]>({
    queryKey: ['/api/broadcasts', broadcastId, 'ads'],
  });

  const deleteAdMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/broadcasts/ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'ads'] });
      toast({ title: 'Ad removed' });
    },
  });

  return (
    <div className="mb-6" data-testid="section-ads">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Scheduled Ads</h2>
      </div>

      {isLoading ? (
        <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-6 text-center text-xs text-gray-400 dark:text-gray-500">Loading ads...</div>
      ) : ads.length === 0 ? (
        <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-8 text-center">
          <Megaphone className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No ads scheduled</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ads will appear here once added to this broadcast</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-4 flex items-center justify-between" data-testid={`card-ad-${ad.id}`}>
              <div className="flex items-center space-x-4">
                {ad.imageUrl ? (
                  <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded overflow-hidden flex-shrink-0">
                    <img className="w-full h-full object-cover" src={ad.imageUrl} alt={ad.name} />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{ad.name}</h3>
                  {ad.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{ad.description}</p>}
                  <div className="flex items-center space-x-3 text-xs text-gray-400 dark:text-gray-500">
                    {ad.duration && <span>Duration: {ad.duration}s</span>}
                    {ad.adType && <><span className="text-gray-300 dark:text-gray-700">•</span><span className="capitalize">{ad.adType}</span></>}
                    <span className={ad.isActive ? 'text-green-400' : 'text-gray-400 dark:text-gray-500'}>{ad.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {ad.ctaUrl && (
                  <a href={ad.ctaUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white transition" data-testid={`button-link-ad-${ad.id}`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 transition" data-testid={`button-delete-ad-${ad.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Ad?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently remove this ad from the broadcast.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteAdMutation.mutate(ad.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShoppableProductsSection({ broadcastId, campaignId }: { broadcastId: string; campaignId: number | null }) {
  const { toast } = useToast();
  const [firingId, setFiringId] = useState<number | null>(null);

  const { data: products = [], isLoading } = useQuery<CommerceProduct[]>({
    queryKey: ['/api/commerce/products', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await fetch(`/api/commerce/products?campaignId=${campaignId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!campaignId,
  });

  const fireAdMutation = useMutation({
    mutationFn: async (productId: number) => {
      setFiringId(productId);
      const res = await fetch(`/api/broadcasts/${broadcastId}/trigger-shoppable-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: String(productId) }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data, productId) => {
      const product = products.find(p => p.id === productId);
      toast({ title: 'Ad triggered', description: `"${product?.name ?? 'Product'}" sent to viewers` });
      setFiringId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to trigger ad', variant: 'destructive' });
      setFiringId(null);
    },
  });

  return (
    <div className="mb-6" data-testid="section-products">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sponsor Catalog</h2>
          <p className="text-[11px] text-white/40 mt-0.5">Fire a shoppable ad from any product in the sponsors' Commerce catalog</p>
        </div>
        {products.length > 0 && (
          <span className="text-[11px] text-white/30">{products.length} product{products.length !== 1 ? 's' : ''} from Commerce</span>
        )}
      </div>

      {!campaignId ? (
        <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-8 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="text-xs text-gray-500 dark:text-gray-400">Link this broadcast to a campaign to see Commerce products</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-56 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-8 text-center">
          <ShoppingBag className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No Commerce products</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Configure the Commerce integration in campaign settings to list products here</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden hover:border-gray-300 dark:hover:border-white/30 transition flex flex-col" data-testid={`card-product-${product.id}`}>
              <div className="h-40 bg-gray-50 dark:bg-white/5 flex items-center justify-center p-4">
                {product.imageUrl ? (
                  <img className="w-full h-full object-contain" src={product.imageUrl} alt={product.name} />
                ) : (
                  <ShoppingBag className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 flex-1">{product.name}</h3>
                {product.price != null && (
                  <p className="text-sm font-bold text-green-500 dark:text-green-400 mb-2">
                    {product.price} <span className="text-[10px] font-normal text-gray-400">{product.currency}</span>
                  </p>
                )}
                <button
                  onClick={() => fireAdMutation.mutate(product.id)}
                  disabled={firingId === product.id || fireAdMutation.isPending}
                  data-testid={`button-fire-ad-product-${product.id}`}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition ${
                    firingId === product.id
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                  }`}
                >
                  <Radio className="w-3 h-3" />
                  {firingId === product.id ? 'Sending...' : 'Fire Ad'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TriggeredAdEntry = {
  id: string;
  productId: string;
  productName: string;
  productPrice: string | null;
  productImage: string | null;
  sponsorName: string | null;
  triggeredAt: Date;
};

type CommerceProduct = { id: number; name: string; imageUrl: string | null; price: number | null; currency: string };
type SponsorSlot = {
  id: number; broadcastId: string; sponsorId: number; campaignId: number | null;
  role: string; type: string; config: Record<string, any> | null;
  triggerType: string; triggerValue: string | null;
  autoExecute: boolean | null; productIds: number[] | null;
  status: string | null; executedAt: string | null; createdAt: string;
  sponsorName: string; sponsorLogoUrl: string | null; sponsorPrimaryColor: string | null;
};

function ShoppableAdTriggerSection({ broadcastId, campaignId }: { broadcastId: string; campaignId: number | null }) {
  const { toast } = useToast();
  const { userId } = useUser();
  const [log, setLog] = useState<TriggeredAdEntry[]>([]);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  /// When set, the dialog is in "edit" mode — submit performs a PUT against
  /// that slot id instead of creating a new row. Cleared by `resetSlotForm()`.
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  /// Opens the "add sponsor to campaign" sub-dialog inline from the slot form
  /// so operators don't have to navigate to campaign-dashboard to link a
  /// sponsor mid-authoring. Uses `POST /api/campaigns/:id/sponsors`.
  const [addSponsorToCampaignOpen, setAddSponsorToCampaignOpen] = useState(false);
  const [pendingSponsorIdToLink, setPendingSponsorIdToLink] = useState('');
  const [slotType, setSlotType] = useState<'product' | 'lead' | 'poll_cta' | 'contest_cta' | 'link'>('product');
  const [slotTriggerType, setSlotTriggerType] = useState('manual');
  const [slotTriggerValue, setSlotTriggerValue] = useState('');
  const [slotProductIds, setSlotProductIds] = useState<number[]>([]);
  const [autoExecute, setAutoExecute] = useState(false);
  // Config fields for non-product types
  const [cfgTitle, setCfgTitle] = useState('');
  const [cfgUrl, setCfgUrl] = useState('');
  const [cfgCta, setCfgCta] = useState('');
  const [cfgMessage, setCfgMessage] = useState('');
  const [cfgRefId, setCfgRefId] = useState('');
  const [cfgLeadFields, setCfgLeadFields] = useState<string[]>(['email']);

  const [adhocSponsorId, setAdhocSponsorId] = useState('');
  const [adhocProductId, setAdhocProductId] = useState<number | null>(null);

  const { data: campaignSponsors = [] } = useQuery<any[]>({
    queryKey: ['/api/campaigns', campaignId, 'sponsors'],
    queryFn: async () => {
      if (!campaignId) return [];
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!campaignId,
  });

  /// User's full sponsor roster — fetched lazily only when the operator opens
  /// the "add sponsor to campaign" picker, to avoid an unnecessary request on
  /// every broadcast visit.
  const { data: allSponsors = [] } = useQuery<any[]>({
    queryKey: ['/api/sponsors', userId, 'for-picker'],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/sponsors?userId=${userId}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId && addSponsorToCampaignOpen,
  });

  const availableToLink = (allSponsors as any[]).filter(
    (s: any) => !campaignSponsors.some((cs: any) => cs.sponsorId === s.id),
  );

  const addSponsorToCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error('No campaign');
      if (!pendingSponsorIdToLink) throw new Error('Pick a sponsor');
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId: parseInt(pendingSponsorIdToLink), role: 'shoppable' }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'sponsors'] });
      // Pre-select the newly linked sponsor so the operator can continue
      // filling the slot form without having to re-pick from the dropdown.
      setSelectedSponsorId(pendingSponsorIdToLink);
      setAddSponsorToCampaignOpen(false);
      setPendingSponsorIdToLink('');
      toast({ title: 'Sponsor added to campaign' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || 'Could not add sponsor', variant: 'destructive' }),
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SponsorSlot[]>({
    queryKey: ['/api/broadcasts', broadcastId, 'sponsor-slots'],
    queryFn: async () => {
      const res = await fetch(`/api/broadcasts/${broadcastId}/sponsor-slots`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const buildSlotConfig = () => {
    if (slotType === 'lead') return { title: cfgTitle, fields: cfgLeadFields, cta: cfgCta };
    if (slotType === 'poll_cta') return { pollId: cfgRefId, message: cfgMessage, cta: cfgCta };
    if (slotType === 'contest_cta') return { contestId: cfgRefId, message: cfgMessage, cta: cfgCta };
    if (slotType === 'link') return { url: cfgUrl, title: cfgTitle, cta: cfgCta };
    return {};
  };

  const resetSlotForm = () => {
    setEditingSlotId(null);
    setSelectedSponsorId(''); setSlotType('product');
    setSlotTriggerType('manual'); setSlotTriggerValue(''); setSlotProductIds([]); setAutoExecute(false);
    setCfgTitle(''); setCfgUrl(''); setCfgCta(''); setCfgMessage(''); setCfgRefId(''); setCfgLeadFields(['email']);
  };

  /// Open the slot dialog in edit mode, pre-populating the form from an
  /// existing slot. Config fields map back from `slot.config` when present.
  const openEditSlot = (slot: SponsorSlot) => {
    setEditingSlotId(slot.id);
    setSelectedSponsorId(String(slot.sponsorId));
    setSlotType((slot.type as any) ?? 'product');
    setSlotTriggerType(slot.triggerType ?? 'manual');
    setSlotTriggerValue(slot.triggerValue ?? '');
    setSlotProductIds(slot.productIds ?? []);
    setAutoExecute(Boolean(slot.autoExecute));
    const cfg = (slot.config ?? {}) as Record<string, any>;
    setCfgTitle(String(cfg.title ?? ''));
    setCfgUrl(String(cfg.url ?? ''));
    setCfgCta(String(cfg.cta ?? ''));
    setCfgMessage(String(cfg.message ?? ''));
    setCfgRefId(String(cfg.pollId ?? cfg.contestId ?? ''));
    setCfgLeadFields(Array.isArray(cfg.fields) ? cfg.fields : ['email']);
    setAddSlotOpen(true);
  };

  const createSlotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/broadcasts/${broadcastId}/sponsor-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: parseInt(selectedSponsorId),
          campaignId,
          type: slotType,
          config: buildSlotConfig(),
          triggerType: slotTriggerType,
          triggerValue: slotTriggerValue || null,
          productIds: slotType === 'product' ? slotProductIds : [],
          autoExecute,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'sponsor-slots'] });
      toast({ title: 'Slot configured' });
      setAddSlotOpen(false);
      resetSlotForm();
    },
    onError: () => toast({ title: 'Error', description: 'Could not create slot', variant: 'destructive' }),
  });

  const updateSlotMutation = useMutation({
    mutationFn: async () => {
      if (!editingSlotId) throw new Error('No slot being edited');
      const res = await fetch(`/api/broadcasts/${broadcastId}/sponsor-slots/${editingSlotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorId: parseInt(selectedSponsorId),
          type: slotType,
          config: buildSlotConfig(),
          triggerType: slotTriggerType,
          triggerValue: slotTriggerValue || null,
          productIds: slotType === 'product' ? slotProductIds : [],
          autoExecute,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'sponsor-slots'] });
      toast({ title: 'Slot updated' });
      setAddSlotOpen(false);
      resetSlotForm();
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || 'Could not update slot', variant: 'destructive' }),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await fetch(`/api/broadcasts/${broadcastId}/sponsor-slots/${slotId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'sponsor-slots'] });
      toast({ title: 'Slot removed' });
    },
  });

  const executeSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await fetch(`/api/broadcasts/${broadcastId}/sponsor-slots/${slotId}/execute`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data, slotId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'sponsor-slots'] });
      const slot = slots.find(s => s.id === slotId);
      const entry: TriggeredAdEntry = {
        id: `slot-${slotId}-${Date.now()}`,
        productId: String(data.product?.id ?? ''),
        productName: data.product?.name ?? 'Product',
        productPrice: data.product?.price != null ? `${data.product.price} ${data.product.currency ?? 'NOK'}`.trim() : null,
        productImage: data.product?.imageUrl ?? null,
        sponsorName: slot?.sponsorName ?? null,
        triggeredAt: new Date(),
      };
      setLog(prev => [entry, ...prev]);
      toast({ title: 'Ad fired', description: `"${entry.productName}" sent to viewers` });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || 'Failed', variant: 'destructive' }),
  });

  const adhocTriggerMutation = useMutation({
    mutationFn: async () => {
      if (!adhocProductId) throw new Error('Select a product');
      const res = await fetch(`/api/broadcasts/${broadcastId}/trigger-shoppable-ad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: String(adhocProductId),
          sponsorId: (adhocSponsorId && adhocSponsorId !== 'none') ? adhocSponsorId : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      const sponsor = adhocSponsorId && adhocSponsorId !== 'none'
        ? campaignSponsors.find((s: any) => String(s.sponsorId) === adhocSponsorId)
        : undefined;
      const entry: TriggeredAdEntry = {
        id: `adhoc-${Date.now()}`,
        productId: String(adhocProductId),
        productName: data.product?.name ?? `Product #${adhocProductId}`,
        productPrice: data.product?.price != null ? `${data.product.price} ${data.product.currency ?? 'NOK'}`.trim() : null,
        productImage: data.product?.imageUrl ?? null,
        sponsorName: sponsor?.name ?? null,
        triggeredAt: new Date(),
      };
      setLog(prev => [entry, ...prev]);
      toast({ title: 'Ad triggered', description: `"${entry.productName}" sent to viewers` });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message || 'Failed', variant: 'destructive' }),
  });

  const slotStatusStyles: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400',
    active: 'bg-green-500/20 text-green-400',
    completed: 'bg-gray-500/20 text-gray-400',
  };

  const triggerTypeLabel: Record<string, string> = {
    manual: 'Manual',
    match_minute: 'Match Minute',
    absolute_time: 'Absolute Time',
  };

  return (
    <div className="mb-6 space-y-5" data-testid="section-shoppable-ads">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Shoppable Ad Slots</h2>
          <p className="text-[11px] text-white/40 mt-0.5">Pre-program sponsor moments for this broadcast · quick-fire ad-hoc from the catalog below</p>
        </div>
      </div>

      {/* Pre-programmed Slots Panel */}
      <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/10">
          <span className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">Pre-programmed Slots</span>
          <Dialog open={addSlotOpen} onOpenChange={(open) => {
            setAddSlotOpen(open);
            // Clearing the edit state when the dialog closes prevents the next
            // "Add Slot" click from starting pre-populated with the last edit.
            if (!open) resetSlotForm();
          }}>
            <DialogTrigger asChild>
              <button
                data-testid="button-add-slot"
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition px-2 py-1 rounded-md hover:bg-white/5"
              >
                <Plus className="w-3 h-3" />
                Add Slot
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingSlotId ? 'Edit Slot' : 'Configure Slot'}</DialogTitle>
                <DialogDescription>
                  {editingSlotId
                    ? 'Update this pre-programmed sponsor moment.'
                    : 'Pre-program a sponsor moment for this broadcast.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Sponsor</Label>
                  <div className="flex items-center gap-2">
                    <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                      <SelectTrigger data-testid="select-slot-sponsor" className="flex-1">
                        <SelectValue placeholder="Select sponsor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignSponsors.map((s: any) => (
                          <SelectItem key={s.sponsorId} value={String(s.sponsorId)}>
                            <div className="flex items-center gap-2">
                              {s.logoUrl
                                ? <img src={s.logoUrl} alt={s.name} className="w-4 h-4 object-contain rounded" />
                                : <div className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: s.primaryColor ?? '#3d8b7a' }}>{s.name.slice(0, 2).toUpperCase()}</div>
                              }
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => setAddSponsorToCampaignOpen(true)}
                      data-testid="button-add-sponsor-to-campaign-inline"
                      className="shrink-0 flex items-center gap-1 px-2.5 h-9 rounded-md border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/5 transition"
                      title="Link another sponsor to this campaign"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                  {campaignSponsors.length === 0 && (
                    <p className="text-[11px] text-amber-400/80">
                      No sponsors on this campaign yet — click <span className="font-semibold">Add</span> to link one.
                    </p>
                  )}
                </div>

                <Dialog open={addSponsorToCampaignOpen} onOpenChange={setAddSponsorToCampaignOpen}>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Link sponsor to campaign</DialogTitle>
                      <DialogDescription>
                        Only sponsors linked here can be picked on slots. Creating a new sponsor from scratch still lives on the sponsors page.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <div className="space-y-1.5">
                        <Label>Sponsor</Label>
                        <Select value={pendingSponsorIdToLink} onValueChange={setPendingSponsorIdToLink}>
                          <SelectTrigger data-testid="select-inline-add-sponsor">
                            <SelectValue placeholder={availableToLink.length === 0 ? 'All sponsors already linked' : 'Pick a sponsor...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableToLink.map((s: any) => (
                              <SelectItem key={s.id} value={String(s.id)}>
                                <div className="flex items-center gap-2">
                                  {s.logoUrl
                                    ? <img src={s.logoUrl} alt={s.name} className="w-4 h-4 object-contain rounded" />
                                    : <div className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: s.primaryColor ?? '#3d8b7a' }}>{s.name.slice(0, 2).toUpperCase()}</div>
                                  }
                                  {s.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[11px] text-white/30">
                        Role defaults to <span className="font-semibold">shoppable</span>. Change it from the campaign settings if needed.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setAddSponsorToCampaignOpen(false); setPendingSponsorIdToLink(''); }}>Cancel</Button>
                      <Button
                        onClick={() => addSponsorToCampaignMutation.mutate()}
                        disabled={!pendingSponsorIdToLink || addSponsorToCampaignMutation.isPending}
                        data-testid="button-link-sponsor-inline"
                      >
                        {addSponsorToCampaignMutation.isPending ? 'Linking...' : 'Link'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={slotType} onValueChange={v => setSlotType(v as typeof slotType)}>
                    <SelectTrigger data-testid="select-slot-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="lead">Lead capture</SelectItem>
                      <SelectItem value="poll_cta">Poll CTA</SelectItem>
                      <SelectItem value="contest_cta">Contest CTA</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic config fields by type */}
                {slotType === 'product' && (
                  <div className="space-y-1.5">
                    <Label>Products</Label>
                    <SponsorCatalogPicker
                      multi
                      sponsorId={selectedSponsorId}
                      value={slotProductIds}
                      onChange={setSlotProductIds}
                      sponsorPlaceholderText="Select a sponsor above to load its product catalog."
                    />
                  </div>
                )}

                {slotType === 'lead' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input placeholder="Win a jersey!" value={cfgTitle} onChange={e => setCfgTitle(e.target.value)} data-testid="input-cfg-title" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Fields</Label>
                      <div className="flex gap-3">
                        {['email', 'phone', 'name'].map(f => (
                          <label key={f} className="flex items-center gap-1.5 text-sm text-white/70 cursor-pointer">
                            <input type="checkbox" checked={cfgLeadFields.includes(f)} onChange={e => setCfgLeadFields(prev => e.target.checked ? [...prev, f] : prev.filter(x => x !== f))} className="w-3.5 h-3.5 rounded" />
                            {f}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>CTA text</Label>
                      <Input placeholder="Submit" value={cfgCta} onChange={e => setCfgCta(e.target.value)} data-testid="input-cfg-cta" />
                    </div>
                  </div>
                )}

                {(slotType === 'poll_cta' || slotType === 'contest_cta') && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>{slotType === 'poll_cta' ? 'Poll ID' : 'Contest ID'}</Label>
                      <Input placeholder="e.g. 42" value={cfgRefId} onChange={e => setCfgRefId(e.target.value)} data-testid="input-cfg-ref-id" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Message</Label>
                      <Input placeholder="Vote now!" value={cfgMessage} onChange={e => setCfgMessage(e.target.value)} data-testid="input-cfg-message" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CTA text</Label>
                      <Input placeholder="Go to poll" value={cfgCta} onChange={e => setCfgCta(e.target.value)} data-testid="input-cfg-cta" />
                    </div>
                  </div>
                )}

                {slotType === 'link' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>URL</Label>
                      <Input placeholder="https://example.com" value={cfgUrl} onChange={e => setCfgUrl(e.target.value)} data-testid="input-cfg-url" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Title</Label>
                      <Input placeholder="Check it out" value={cfgTitle} onChange={e => setCfgTitle(e.target.value)} data-testid="input-cfg-title" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CTA text</Label>
                      <Input placeholder="Open" value={cfgCta} onChange={e => setCfgCta(e.target.value)} data-testid="input-cfg-cta" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Trigger Type</Label>
                  <Select value={slotTriggerType} onValueChange={setSlotTriggerType}>
                    <SelectTrigger data-testid="select-slot-trigger-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="match_minute">Match Minute</SelectItem>
                      <SelectItem value="absolute_time">Absolute Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {slotTriggerType === 'match_minute' && (
                  <div className="space-y-1.5">
                    <Label>Minute</Label>
                    <Input type="number" min={1} max={120} placeholder="45" value={slotTriggerValue} onChange={e => setSlotTriggerValue(e.target.value)} data-testid="input-slot-trigger-minute" />
                  </div>
                )}
                {slotTriggerType === 'absolute_time' && (
                  <div className="space-y-1.5">
                    <Label>Date/Time</Label>
                    <Input type="datetime-local" value={slotTriggerValue} onChange={e => setSlotTriggerValue(e.target.value)} data-testid="input-slot-trigger-time" className="[color-scheme:dark]" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/80">Auto-execute</p>
                    <p className="text-xs text-white/30">Fire automatically at trigger time (not implemented yet)</p>
                  </div>
                  <input type="checkbox" checked={autoExecute} onChange={e => setAutoExecute(e.target.checked)} data-testid="checkbox-auto-execute" className="w-4 h-4 rounded" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddSlotOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => (editingSlotId ? updateSlotMutation.mutate() : createSlotMutation.mutate())}
                  disabled={!selectedSponsorId || createSlotMutation.isPending || updateSlotMutation.isPending}
                  data-testid="button-save-slot"
                >
                  {editingSlotId
                    ? (updateSlotMutation.isPending ? 'Updating...' : 'Update Slot')
                    : (createSlotMutation.isPending ? 'Saving...' : 'Save Slot')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {slotsLoading ? (
          <div className="p-6 space-y-2">
            {[1, 2].map(i => <div key={i} className="h-14 bg-white/5 rounded-lg animate-pulse" />)}
          </div>
        ) : slots.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-white/25">No slots configured. Add one to pre-program ads.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {slots.map(slot => (
              <div key={slot.id} className="flex items-center gap-3 px-4 py-3" data-testid={`slot-card-${slot.id}`}>
                <div className="shrink-0">
                  {slot.sponsorLogoUrl
                    ? <img src={slot.sponsorLogoUrl} alt={slot.sponsorName} className="w-8 h-8 rounded object-contain bg-white/5 p-0.5" />
                    : <div className="w-8 h-8 rounded text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: slot.sponsorPrimaryColor ?? '#3d8b7a' }}>{slot.sponsorName.slice(0, 2).toUpperCase()}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{slot.sponsorName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${slotStatusStyles[slot.status ?? 'scheduled'] ?? 'bg-white/10 text-white/50'}`}>
                      {slot.status ?? 'scheduled'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-white/10 text-white/50">
                      {slot.type || 'product'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span>{triggerTypeLabel[slot.triggerType]}</span>
                    {slot.triggerValue && <span>· {slot.triggerValue}</span>}
                    {slot.productIds && slot.productIds.length > 0 && <span>· {slot.productIds.length} product{slot.productIds.length !== 1 ? 's' : ''}</span>}
                    {slot.executedAt && <span className="text-green-400">· Fired {new Date(slot.executedAt).toLocaleTimeString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => executeSlotMutation.mutate(slot.id)}
                    disabled={executeSlotMutation.isPending}
                    data-testid={`button-fire-slot-${slot.id}`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium transition disabled:opacity-40"
                    title="Fire Now"
                  >
                    <Play className="w-3 h-3" />
                    Fire
                  </button>
                  <button
                    onClick={() => openEditSlot(slot)}
                    data-testid={`button-edit-slot-${slot.id}`}
                    className="p-1.5 rounded-lg text-white/20 hover:text-blue-400 hover:bg-blue-500/10 transition"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteSlotMutation.mutate(slot.id)}
                    data-testid={`button-delete-slot-${slot.id}`}
                    className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ad-hoc Trigger Panel */}
      <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/10">
          <span className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">Quick Fire</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Sponsor</Label>
              <Select value={adhocSponsorId} onValueChange={setAdhocSponsorId}>
                <SelectTrigger data-testid="select-adhoc-sponsor" className="text-sm">
                  <SelectValue placeholder="No sponsor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No sponsor</SelectItem>
                  {campaignSponsors.map((s: any) => (
                    <SelectItem key={s.sponsorId} value={String(s.sponsorId)}>
                      <div className="flex items-center gap-2">
                        {s.logoUrl ? <img src={s.logoUrl} alt={s.name} className="w-3.5 h-3.5 object-contain rounded" /> : null}
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Product</Label>
              <SponsorCatalogPicker
                sponsorId={adhocSponsorId && adhocSponsorId !== 'none' ? adhocSponsorId : null}
                value={adhocProductId}
                onChange={setAdhocProductId}
                sponsorPlaceholderText="Pick a sponsor to browse its catalog."
              />
            </div>
          </div>
          <button
            onClick={() => adhocTriggerMutation.mutate()}
            disabled={!adhocProductId || adhocTriggerMutation.isPending}
            data-testid="button-trigger-shoppable-ad"
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
              !adhocProductId || adhocTriggerMutation.isPending
                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            {adhocTriggerMutation.isPending ? 'Sending...' : 'Trigger Ad'}
          </button>
        </div>
      </div>

      {/* Session Log */}
      {log.length > 0 && (
        <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/10">
            <span className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">Session Log</span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5 max-h-48 overflow-y-auto">
            {log.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 text-xs" data-testid={`log-shoppable-ad-${entry.id}`}>
                {entry.productImage
                  ? <img src={entry.productImage} className="w-8 h-8 rounded object-cover flex-shrink-0 border border-gray-100 dark:border-white/10" alt="" />
                  : <div className="w-8 h-8 rounded bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0"><ShoppingBag className="w-3.5 h-3.5 text-gray-400" /></div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">{entry.productName}</span>
                    {entry.productPrice && <span className="text-green-500 dark:text-green-400 shrink-0">{entry.productPrice}</span>}
                  </div>
                  <div className="text-gray-400 dark:text-gray-500">
                    {entry.sponsorName && <span>{entry.sponsorName} · </span>}
                    {entry.triggeredAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LiveChatSidebar({ broadcastId, analytics, reachuUserId, broadcastStatus }: { broadcastId: string; analytics?: BroadcastAnalytics; reachuUserId: string | null; broadcastStatus?: string }) {
  const [activeTab, setActiveTab] = useState<'chat' | 'analytics'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [tweetMode, setTweetMode] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const { data: messages = [], isLoading: chatLoading, dataUpdatedAt } = useQuery<ChatMessage[]>({
    queryKey: ['/api/broadcasts', broadcastId, 'chat'],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastRefreshed(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => {
      if (tweetMode) {
        return apiRequest('POST', `/api/broadcasts/${broadcastId}/tweet`, { username: reachuUserId ?? 'Guest', message });
      }
      return apiRequest('POST', `/api/broadcasts/${broadcastId}/chat`, { username: reachuUserId ?? 'Guest', message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'chat'] });
      setChatInput('');
    },
  });

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    sendMessageMutation.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  function timeAgo(dateStr: string | Date) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <aside className="w-80 bg-white dark:bg-black border-l border-gray-200 dark:border-white/10 flex flex-col overflow-hidden flex-shrink-0" data-testid="sidebar-live-chat">
      <div className="flex border-b border-gray-200 dark:border-white/10">
        <button
          className={`flex-1 px-4 py-3 text-xs font-semibold transition ${activeTab === 'chat' ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 border-b-2 border-[#3d8b7a] dark:border-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
          onClick={() => setActiveTab('chat')}
          data-testid="tab-live-chat"
        >
          Live Chat {messages.length > 0 && <span className="ml-1 text-gray-400 dark:text-gray-500">({messages.length})</span>}
        </button>
        <button
          className={`flex-1 px-4 py-3 text-xs font-semibold transition ${activeTab === 'analytics' ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5 border-b-2 border-[#3d8b7a] dark:border-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
          onClick={() => setActiveTab('analytics')}
          data-testid="tab-analytics"
        >
          Analytics
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeTab === 'chat' ? (
          chatLoading ? (
            <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-4">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">No messages yet. Be the first to chat!</div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex items-start space-x-2 ${(msg as any).type === 'tweet' ? 'bg-blue-50 dark:bg-blue-900/10 rounded-lg px-2 py-1.5 -mx-2' : ''}`} data-testid={`chat-message-${msg.id}`}>
                  <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${(msg as any).type === 'tweet' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-[#3d8b7a]/10 dark:bg-white/10'}`}>
                    {(msg as any).type === 'tweet' ? <AtSign className="w-3 h-3 text-blue-500" /> : <span className="text-[9px] text-gray-500 dark:text-gray-400 font-semibold">{msg.username.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{msg.username}</span>
                      {(msg as any).type === 'tweet' && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-500 font-medium">tweet</span>}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{timeAgo(msg.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </>
          )
        ) : (
          <div className="space-y-2 pt-2">
            {[
              { icon: Eye, label: 'Live Viewers', value: (analytics?.viewerCount ?? 0) > 0 ? formatViewers(analytics!.viewerCount) : 'N/A' },
              { icon: TrendingUp, label: 'Peak Viewers', value: (analytics?.peakViewers ?? 0) > 0 ? formatViewers(analytics!.peakViewers) : 'N/A' },
              { icon: Vote, label: 'Total Votes', value: (analytics?.totalVotes ?? 0).toLocaleString() },
              { icon: BarChart3, label: 'Active Polls', value: String(analytics?.activePolls ?? 0) },
              { icon: Trophy, label: 'Active Contests', value: String(analytics?.activeContests ?? 0) },
              { icon: MessageSquare, label: 'Chat Messages', value: String(messages.length) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 pt-1 justify-end">
              <RefreshCw className="w-2.5 h-2.5 text-gray-300 dark:text-gray-600" />
              <span className="text-[10px] text-gray-300 dark:text-gray-600">Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-white/10">
        {broadcastStatus === 'ended' ? (
          <div className="flex flex-col gap-2">
            <div className="text-center py-3 px-4 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
              <p className="text-xs text-gray-400 dark:text-gray-500">Este broadcast ha terminado — el chat es de solo lectura</p>
            </div>
            <input
              type="text"
              disabled
              placeholder="Chat deshabilitado"
              className="w-full px-3 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded text-xs text-gray-400 cursor-not-allowed"
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              {reachuUserId && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" />
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">As <span className="font-semibold text-gray-600 dark:text-gray-300">{reachuUserId}</span></span>
                </div>
              )}
              <button
                onClick={() => setTweetMode(t => !t)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition ${tweetMode ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                data-testid="button-toggle-tweet-mode"
              >
                <AtSign className="w-2.5 h-2.5" /> {tweetMode ? 'Tweet mode' : 'Tweet'}
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tweetMode ? 'Send a tweet...' : 'Type a message...'}
                className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-white/5 border rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition ${tweetMode ? 'border-blue-300 dark:border-blue-700 focus:border-blue-400 dark:focus:border-blue-500' : 'border-gray-200 dark:border-white/10 focus:border-gray-300 dark:focus:border-white/30'}`}
                data-testid="input-chat-message"
              />
              <button
                onClick={handleSend}
                disabled={sendMessageMutation.isPending || !chatInput.trim()}
                className={`w-9 h-9 flex items-center justify-center rounded transition disabled:opacity-50 ${tweetMode ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black hover:bg-[#2f7365] dark:hover:bg-gray-200'}`}
                data-testid="button-send-message"
              >
                {tweetMode ? <AtSign className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}


function LineupSection({ broadcastId, hasFixture, showLineup, broadcastStatus }: {
  broadcastId: string;
  hasFixture: boolean;
  showLineup: boolean;
  broadcastStatus?: string;
}) {
  const { toast } = useToast();
  const [sentAt, setSentAt] = useState<Date | null>(null);

  const { data: lineup, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ['/api/broadcasts', broadcastId, 'lineup'],
    queryFn: async () => {
      const res = await fetch(`/api/broadcasts/${broadcastId}/lineup`);
      if (!res.ok) throw new Error('Failed to fetch lineup');
      return res.json();
    },
    enabled: hasFixture,
    staleTime: 5 * 60 * 1000,
  });

  const toggleMutation = useMutation({
    mutationFn: (value: boolean) => apiRequest('PUT', `/api/broadcasts/${broadcastId}`, { showLineup: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] }),
    onError: () => toast({ title: 'Error', description: 'Failed to update lineup setting', variant: 'destructive' }),
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/broadcasts/${broadcastId}/send-lineup`, {}),
    onSuccess: () => {
      setSentAt(new Date());
      toast({ title: 'Lineup sent', description: 'lineup_show event broadcast to all SDK clients' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message || 'Failed to send lineup', variant: 'destructive' }),
  });

  const positionIcon = (pos: string) => {
    if (pos === 'goalkeeper') return '🧤';
    if (pos === 'defender') return '🛡️';
    if (pos === 'midfielder') return '⚙️';
    return '⚡';
  };

  const renderTeam = (team: { teamName: string | null; formation: string | null; players: { id: number; name: string; jerseyNumber: number | null; position: string }[] }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-white truncate">{team.teamName ?? 'Team'}</span>
        {team.formation && <span className="text-xs text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">{team.formation}</span>}
      </div>
      <div className="space-y-0.5">
        {team.players.map(p => (
          <div key={p.id} className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-5 text-right text-gray-600 font-mono">{p.jerseyNumber ?? '–'}</span>
            <span className="flex-1 truncate">{p.name}</span>
            <span className="text-gray-600">{positionIcon(p.position)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  if (!hasFixture) return null;

  return (
    <div className="mb-6 rounded-lg border border-white/10 bg-[#141824] p-4" data-testid="section-lineup">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shirt className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-white">Lineup</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition"
          data-testid="button-lineup-refresh"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex items-center justify-between py-2 border-b border-white/5 mb-3">
        <div>
          <p className="text-xs text-white">Show lineup to viewers</p>
          <p className="text-xs text-gray-600">Auto-sends 10 min before kickoff when enabled</p>
        </div>
        <Switch
          checked={showLineup}
          onCheckedChange={(v) => toggleMutation.mutate(v)}
          disabled={toggleMutation.isPending}
          data-testid="switch-show-lineup"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || !showLineup}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs rounded transition"
          data-testid="button-send-lineup-now"
        >
          <Play className="w-3 h-3" />
          {sendMutation.isPending ? 'Sending…' : 'Send lineup now'}
        </button>
        <span className="text-xs text-gray-600">
          {sentAt ? `Sent at ${sentAt.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}` : 'Not yet sent'}
        </span>
      </div>

      {isLoading && (
        <div className="text-xs text-gray-500 py-4 text-center">Loading lineup…</div>
      )}

      {!isLoading && lineup && !lineup.available && (
        <div className="text-xs text-gray-500 py-2 text-center">
          {lineup.message ?? 'Alineación disponible ~60 min antes del partido'}
        </div>
      )}

      {!isLoading && lineup?.available && (
        <div className="flex gap-6">
          {lineup.home && renderTeam(lineup.home)}
          <div className="w-px bg-white/10 self-stretch" />
          {lineup.away && renderTeam(lineup.away)}
        </div>
      )}
    </div>
  );
}

export default function BroadcastDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { userId, reachuUserId } = useUser();
  const broadcastId = params.broadcastId;
  const { toast } = useToast();

  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [contestDialogOpen, setContestDialogOpen] = useState(false);
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''], duration: '60' });
  const [contestForm, setContestForm] = useState({ title: '', description: '', prize: '', contestType: 'giveaway', imageUrl: '', isActive: true });
  const [editingExternalId, setEditingExternalId] = useState(false);
  const [externalIdValue, setExternalIdValue] = useState('');
  const [showDeveloper, setShowDeveloper] = useState(false);

  const { data: broadcast, isLoading } = useQuery<BroadcastWithRelations>({
    queryKey: ['/api/broadcasts', broadcastId],
    enabled: !!broadcastId,
  });

  const { data: campaignData } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', broadcast?.campaignId],
    enabled: !!broadcast?.campaignId,
  });

  // TV-gated sections (Scheduled Ads, Sponsor Catalog, Shoppable Ad Slots) only
  // make sense when the host clientApp has TV SDK enabled, because `shoppable_ad`
  // WS events are consumed exclusively by VioTVSDK / Kotlin TV SDK. Fetch the
  // clientApp so the sections can gate their UI.
  const { data: hostApp } = useQuery<{ id: number; name: string; tvEnabled: boolean; tvPlatforms: string[] }>({
    queryKey: ['/api/client-apps', (campaignData as any)?.clientAppId, userId],
    queryFn: async () => {
      const appId = (campaignData as any)?.clientAppId;
      const res = await fetch(`/api/client-apps/${appId}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch app');
      return res.json();
    },
    enabled: !!(campaignData as any)?.clientAppId && !!userId,
  });
  const tvEnabled = hostApp?.tvEnabled === true;

  const { data: analytics } = useQuery<BroadcastAnalytics>({
    queryKey: ['/api/broadcasts', broadcastId, 'analytics'],
    enabled: !!broadcastId,
    refetchInterval: 30000,
  });

  const { data: fixtureResult } = useQuery<{
    events: Array<{ minute: number; type: string; label: string; teamId?: number | null }>;
    status: string;
  }>({
    queryKey: ['/api/sportmonks/fixture', broadcast?.sportmonksFixtureId, 'result'],
    queryFn: async () => {
      const res = await fetch(`/api/sportmonks/fixture/${broadcast!.sportmonksFixtureId}/result`);
      if (!res.ok) throw new Error('Failed to fetch fixture result');
      return res.json();
    },
    enabled: !!broadcast?.sportmonksFixtureId,
    refetchInterval: broadcast?.status === 'live' ? 60000 : false,
    staleTime: 30000,
  });

  const seedDemoMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/seed-demo', { broadcastId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'ads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId, 'chat'] });
      toast({ title: 'Demo data loaded', description: 'Ads, products and chat messages have been seeded.' });
    },
  });

  const updateExternalIdMutation = useMutation({
    mutationFn: (newExternalId: string) =>
      apiRequest('PUT', `/api/broadcasts/${broadcastId}`, { externalId: newExternalId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      setEditingExternalId(false);
      toast({ title: 'External ID updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update External ID.', variant: 'destructive' });
    },
  });

  const createPollMutation = useMutation({
    mutationFn: async (data: { question: string; options: string[]; duration?: number }) => {
      return await apiRequest('POST', `/api/broadcasts/${broadcastId}/polls`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Poll Created' });
      setPollDialogOpen(false);
      setPollForm({ question: '', options: ['', ''], duration: '60' });
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
    mutationFn: async (data: { title: string; description: string; prize: string; contestType: string; imageUrl: string; isActive: boolean }) => {
      return await apiRequest('POST', `/api/broadcasts/${broadcastId}/contests`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', broadcastId] });
      toast({ title: 'Contest Created' });
      setContestDialogOpen(false);
      setContestForm({ title: '', description: '', prize: '', contestType: 'giveaway', imageUrl: '', isActive: true });
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
    createPollMutation.mutate({
      question: pollForm.question,
      options: validOptions,
      duration: pollForm.duration ? parseInt(pollForm.duration) : undefined,
    });
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

  const breadcrumbs = campaignData
    ? [
        { label: 'Campaigns', href: '/campaigns' },
        { label: campaignData.name, href: `/campaigns/${campaignData.id}` },
        { label: broadcast?.broadcastName ?? 'Broadcast' },
      ]
    : [
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'Broadcast' },
      ];

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Campaigns', href: '/campaigns' }, { label: 'Loading...' }]}>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading broadcast...</p>
        </div>
      </AppLayout>
    );
  }

  if (!broadcast) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Campaigns', href: '/campaigns' }, { label: 'Not Found' }]}>
        <div className="text-center py-12">
          <p className="text-gray-900 dark:text-white">Broadcast not found</p>
        </div>
      </AppLayout>
    );
  }

  const polls = broadcast.polls || [];
  const contests = broadcast.contests || [];
  const activePolls = polls.filter(p => p.isActive);
  const inactivePolls = polls.filter(p => !p.isActive);

  // Merge Sportmonks events with broadcast metadata events for the EventTimeline
  // Strategy: Sportmonks events are authoritative for match events (goal, card, etc.)
  // Metadata events are authoritative for engagement events (poll, contest, shoppable_ad)
  const metadataEvents: MatchEvent[] = (broadcast?.metadata as any)?.matchEvents || [];
  const engagementTypes = new Set(['poll', 'contest', 'shoppable_ad']);
  const matchDayTypes = new Set(['kickoff', 'goal', 'owngoal', 'yellowcard', 'redcard', 'halftime', 'fulltime', 'var', 'penalty']);
  const mergedMatchEvents: MatchEvent[] = (() => {
    const sportmonksEvents: MatchEvent[] = (fixtureResult?.events || []).map(e => ({
      minute: e.minute,
      type: e.type,
      label: e.label,
    }));
    if (sportmonksEvents.length === 0) return metadataEvents;
    // Use Sportmonks for match-day events, metadata for engagement events
    const engagementEvents = metadataEvents.filter(e => engagementTypes.has(e.type));
    const merged = [
      ...sportmonksEvents.filter(e => matchDayTypes.has(e.type)),
      ...engagementEvents,
    ].sort((a, b) => a.minute - b.minute);
    return merged;
  })();

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="-mx-8 -mt-6 flex h-[calc(100vh-64px)] overflow-hidden">
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setLocation('/broadcasts')}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  {(broadcast as any).homeTeamLogo && (
                    <img src={(broadcast as any).homeTeamLogo} alt={(broadcast as any).homeTeamName ?? ''} className="w-8 h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white" data-testid="text-broadcast-name">{broadcast.broadcastName}</h1>
                  {(broadcast as any).awayTeamLogo && (
                    <img src={(broadcast as any).awayTeamLogo} alt={(broadcast as any).awayTeamName ?? ''} className="w-8 h-8 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <StatusBadge status={broadcast.status} />
                </div>
                <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-2">
                  {campaignData && (
                    <>
                      <Link href={`/campaigns/${campaignData.id}`}>
                        <span className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer" data-testid="link-campaign">{campaignData.name}</span>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-4 px-4 py-2 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                <div className="text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-500">Viewers</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="stat-header-viewers">
                    {formatViewers(analytics?.viewerCount ?? broadcast.viewerCount ?? 0)}
                  </div>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-500">Total Votes</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="stat-header-engagement">
                    {(analytics?.totalVotes ?? 0).toLocaleString()}
                  </div>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-500">Engagement Rate</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="stat-header-engagement-rate">
                    {(() => {
                      const viewers = analytics?.viewerCount ?? broadcast.viewerCount ?? 0;
                      const votes = analytics?.totalVotes ?? 0;
                      if (!viewers || !votes) return '--';
                      return `${Math.round((votes / viewers) * 100)}%`;
                    })()}
                  </div>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-white/10"></div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 dark:text-gray-500">Status</div>
                  <div className="text-sm font-semibold capitalize text-gray-900 dark:text-white" data-testid="stat-header-status">
                    {broadcast.status}
                  </div>
                </div>
              </div>
              <button className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 dark:border-white/20 hover:border-gray-300 dark:hover:border-white/40 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition" data-testid="button-more-options">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <button
              onClick={() => setShowDeveloper(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition"
              data-testid="button-toggle-developer"
            >
              {showDeveloper ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Code2 className="w-3 h-3" />
              Developer
            </button>
            {showDeveloper && (
              <div className="mt-2 p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg flex flex-col gap-2" data-testid="section-developer">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider w-20">Broadcast ID</span>
                  <span className="font-mono text-xs text-gray-600 dark:text-gray-400" data-testid="text-broadcast-id">{broadcast.broadcastId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider w-20">External ID</span>
                  {editingExternalId ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={externalIdValue}
                        onChange={(e) => setExternalIdValue(e.target.value)}
                        placeholder="e.g. match-12345"
                        className="h-6 text-xs px-2 py-0 w-44 bg-white dark:bg-white/5"
                        data-testid="input-external-id-inline"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateExternalIdMutation.mutate(externalIdValue);
                          if (e.key === 'Escape') setEditingExternalId(false);
                        }}
                        autoFocus
                      />
                      <button onClick={() => updateExternalIdMutation.mutate(externalIdValue)} disabled={updateExternalIdMutation.isPending} className="text-green-600 dark:text-green-400 hover:text-green-700" data-testid="button-save-external-id">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingExternalId(false)} className="text-gray-400 hover:text-gray-600" data-testid="button-cancel-external-id">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setExternalIdValue(broadcast.externalId || ''); setEditingExternalId(true); }}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition group font-mono"
                      data-testid="button-edit-external-id"
                    >
                      {broadcast.externalId
                        ? <span>{broadcast.externalId}</span>
                        : <span className="italic text-gray-300 dark:text-gray-600">+ add external ID</span>
                      }
                      <Pencil className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <EventTimeline
            polls={polls}
            contests={contests}
            matchEvents={mergedMatchEvents.length > 0 ? mergedMatchEvents : undefined}
            broadcastStatus={broadcast?.status ?? undefined}
            onTogglePoll={(id, active) => togglePollMutation.mutate({ pollId: id, isActive: active })}
            onToggleContest={(id, active) => toggleContestMutation.mutate({ contestId: id, isActive: active })}
          />

          <MatchDataCard
            broadcastId={broadcastId!}
            sportmonksFixtureId={broadcast?.sportmonksFixtureId ?? null}
            homeTeamName={broadcast?.homeTeamName ?? null}
            homeTeamLogo={broadcast?.homeTeamLogo ?? null}
            awayTeamName={broadcast?.awayTeamName ?? null}
            awayTeamLogo={broadcast?.awayTeamLogo ?? null}
          />

          <LineupSection
            broadcastId={broadcastId!}
            hasFixture={!!broadcast?.sportmonksFixtureId}
            showLineup={(broadcast as any)?.showLineup ?? false}
            broadcastStatus={broadcast?.status ?? undefined}
          />

          <div className="mb-6" data-testid="section-engagement">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Active Engagement</h2>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">{activePolls.length} active</span>
                <Dialog open={pollDialogOpen} onOpenChange={setPollDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="px-3 py-1.5 bg-[#3d8b7a] text-white dark:bg-white dark:text-black rounded text-xs font-medium hover:bg-[#2f7365] dark:hover:bg-gray-200 transition" data-testid="button-create-poll">
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
                      <div className="grid gap-2">
                        <Label htmlFor="pollDuration">Display Duration (seconds)</Label>
                        <Input
                          id="pollDuration"
                          data-testid="input-poll-duration"
                          type="number"
                          min="1"
                          value={pollForm.duration}
                          onChange={(e) => setPollForm(prev => ({ ...prev, duration: e.target.value }))}
                          placeholder="60"
                        />
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
              broadcast.status === 'ended' ? (
                <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg p-6" data-testid="section-ended-summary">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Broadcast Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatViewers(analytics?.viewerCount ?? broadcast.viewerCount ?? 0)}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Total Viewers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{(analytics?.totalVotes ?? 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Total Votes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics?.pollCount ?? 0}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Polls Run</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {broadcast.startTime && broadcast.endTime
                          ? (() => {
                              const mins = Math.round((new Date(broadcast.endTime).getTime() - new Date(broadcast.startTime).getTime()) / 60000);
                              return mins > 0 ? `${mins}m` : '—';
                            })()
                          : '—'}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Duration</div>
                    </div>
                  </div>
                </div>
              ) : (
              <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-8 text-center">
                <BarChart3 className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No polls yet</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Create a poll to engage your audience</p>
              </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activePolls.map(poll => (
                  <ActivePollCard
                    key={poll.id}
                    poll={poll}
                    onToggle={(id, active) => togglePollMutation.mutate({ pollId: id, isActive: active })}
                    onDelete={(id) => deletePollMutation.mutate(id)}
                    campaignId={broadcast.campaignId}
                  />
                ))}
                {inactivePolls.map(poll => (
                  <ActivePollCard
                    key={poll.id}
                    poll={poll}
                    onToggle={(id, active) => togglePollMutation.mutate({ pollId: id, isActive: active })}
                    onDelete={(id) => deletePollMutation.mutate(id)}
                    campaignId={broadcast.campaignId}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mb-6" data-testid="section-contests">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Contests & Trivia</h2>
              <Dialog open={contestDialogOpen} onOpenChange={setContestDialogOpen}>
                <DialogTrigger asChild>
                  <button className="px-3 py-1.5 bg-transparent border border-gray-200 dark:border-white/20 hover:border-gray-300 dark:hover:border-white/40 text-gray-900 dark:text-white rounded text-xs font-medium transition" data-testid="button-create-contest">
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
                      <Textarea
                        data-testid="input-contest-description"
                        value={contestForm.description}
                        onChange={(e) => setContestForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description shown in the SDK"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Prize</Label>
                        <Input
                          data-testid="input-contest-prize"
                          value={contestForm.prize}
                          onChange={(e) => setContestForm(prev => ({ ...prev, prize: e.target.value }))}
                          placeholder="e.g. To billetter"
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
                    <ImageUploadWithPreview
                      label="Image"
                      value={contestForm.imageUrl}
                      onChange={(url) => setContestForm(prev => ({ ...prev, imageUrl: url }))}
                      placeholder="https://... or upload an image"
                      testId="input-contest-image-url"
                    />
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-white/10 px-4 py-3">
                      <div>
                        <Label className="text-sm font-medium">Active on creation</Label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Activates immediately and sends a live WS event</p>
                      </div>
                      <Switch
                        checked={contestForm.isActive}
                        onCheckedChange={(checked) => setContestForm(prev => ({ ...prev, isActive: checked }))}
                        data-testid="switch-contest-is-active"
                      />
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
              <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-8 text-center">
                <Trophy className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">No contests yet</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Create a contest to reward your audience</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contests.map(contest => (
                  <ContestCard
                    key={contest.id}
                    contest={contest}
                    onToggle={(id, active) => toggleContestMutation.mutate({ contestId: id, isActive: active })}
                    onDelete={(id) => deleteContestMutation.mutate(id)}
                    campaignId={broadcast.campaignId}
                    broadcastId={broadcast.broadcastId}
                  />
                ))}
              </div>
            )}
          </div>

          {hostApp && !tvEnabled ? (
            <div className="mb-6" data-testid="tv-disabled-banner">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Shoppable moments</h2>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Megaphone className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white mb-1">TV companion not enabled for this app</h3>
                    <p className="text-xs text-gray-400 mb-3">
                      Shoppable ads (scheduled ads, sponsor catalog, ad slots, quick fire) dispatch a{' '}
                      <code className="text-amber-300/80 font-mono text-[10px]">shoppable_ad</code>{' '}
                      WebSocket event that is rendered by the TV companion SDK (VioTVSDK on Apple TV, Kotlin TV SDK on Android TV).
                      This app <span className="text-white font-semibold">{hostApp.name}</span> has <code className="text-amber-300/80 font-mono text-[10px]">tvEnabled=false</code>{' '}
                      so firing any moment would succeed but nothing would render anywhere.
                    </p>
                    <p className="text-xs text-gray-500">
                      To enable:{' '}
                      <Link href={`/apps/${hostApp.id}`}>
                        <span className="text-amber-300 hover:text-amber-200 cursor-pointer underline underline-offset-2">
                          open {hostApp.name} → Settings → Platforms
                        </span>
                      </Link>
                      {' '}and toggle <span className="text-white">TV companion app</span> on, picking at least one platform.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <ScheduledAdsSection broadcastId={broadcastId!} />
              <ShoppableProductsSection broadcastId={broadcastId!} campaignId={broadcast.campaignId ?? null} />
              <ShoppableAdTriggerSection broadcastId={broadcastId!} campaignId={broadcast.campaignId ?? null} />
            </>
          )}
        </main>

        <LiveChatSidebar broadcastId={broadcastId!} analytics={analytics} reachuUserId={reachuUserId} broadcastStatus={broadcast?.status} />
      </div>
    </AppLayout>
  );
}
