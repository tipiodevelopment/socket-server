import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Trophy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatchEvent {
  minute: number;
  type: string;
  label: string;
  teamId?: number | null;
  score?: string | null;
}

interface FixtureResult {
  fixtureId: number;
  homeTeam: { id: number; name: string; logo: string | null } | null;
  awayTeam: { id: number; name: string; logo: string | null } | null;
  homeScore: number;
  awayScore: number;
  status: string;
  date: string | null;
  league: string | null;
  events: MatchEvent[];
}

interface MatchDataCardProps {
  broadcastId: string;
  sportmonksFixtureId?: number | null;
  homeTeamName?: string | null;
  homeTeamLogo?: string | null;
  awayTeamName?: string | null;
  awayTeamLogo?: string | null;
}

const eventConfig: Record<string, { icon: string; color: string; label: string }> = {
  kickoff:    { icon: '⚽', color: 'text-white/40',   label: 'Avspark' },
  goal:       { icon: '⚽', color: 'text-yellow-400', label: 'Mål' },
  owngoal:    { icon: '⚽', color: 'text-red-400',    label: 'Selvmål' },
  yellowcard: { icon: '🟨', color: 'text-yellow-400', label: 'Gult kort' },
  redcard:    { icon: '🟥', color: 'text-red-400',    label: 'Rødt kort' },
  halftime:   { icon: '⏸', color: 'text-white/40',   label: 'Pause' },
  fulltime:   { icon: '⏹', color: 'text-white/40',   label: 'Slutt' },
  var:        { icon: '📺', color: 'text-blue-400',   label: 'VAR' },
  penalty:    { icon: '⚽', color: 'text-orange-400', label: 'Straffe' },
};

function TeamLogo({ logo, name, size = 'md' }: { logo: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-6 h-6 text-[9px]', md: 'w-10 h-10 text-xs', lg: 'w-14 h-14 text-sm' };
  if (logo) {
    return <img src={logo} alt={name} className={`${sizeClasses[size]} rounded-full object-contain bg-white/5 p-0.5`} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
  }
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-white/10 flex items-center justify-center font-bold text-white/60`}>
      {name.substring(0, 2).toUpperCase()}
    </div>
  );
}

export default function MatchDataCard({ sportmonksFixtureId, homeTeamName, homeTeamLogo, awayTeamName, awayTeamLogo }: MatchDataCardProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: result, isLoading, error } = useQuery<FixtureResult>({
    queryKey: ['/api/sportmonks/fixture', sportmonksFixtureId, 'result', refreshKey],
    queryFn: async () => {
      const res = await fetch(`/api/sportmonks/fixture/${sportmonksFixtureId}/result`);
      if (!res.ok) throw new Error('Failed to fetch fixture');
      return res.json();
    },
    enabled: !!sportmonksFixtureId,
    staleTime: 30 * 1000,
    retry: false,
  });

  if (!sportmonksFixtureId) return null;

  const home = result?.homeTeam ?? (homeTeamName ? { id: 0, name: homeTeamName, logo: homeTeamLogo ?? null } : null);
  const away = result?.awayTeam ?? (awayTeamName ? { id: 0, name: awayTeamName, logo: awayTeamLogo ?? null } : null);

  const statusLabel: Record<string, string> = { FT: 'Slutt', HT: 'Pause', LIVE: 'Live', NS: 'Ikke startet' };

  return (
    <div className="mb-6" data-testid="section-match-data">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          Kampdata
        </h2>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              result.status === 'LIVE' ? 'bg-red-500/20 text-red-400' :
              result.status === 'FT' ? 'bg-white/10 text-white/50' :
              'bg-white/5 text-white/40'
            }`}>
              {statusLabel[result.status] || result.status}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-white/40 hover:text-white"
            onClick={() => setRefreshKey(k => k + 1)}
            data-testid="button-refresh-match-data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="bg-transparent border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        {isLoading && !result ? (
          <div className="p-8 flex items-center justify-center">
            <div className="flex items-center gap-3 text-white/30 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Laster kampdata...
            </div>
          </div>
        ) : error && !result ? (
          <div className="p-6 flex items-center justify-center gap-2 text-white/30 text-sm">
            <AlertCircle className="w-4 h-4" />
            Kunne ikke laste kampdata
          </div>
        ) : (
          <>
            {/* Scoreboard */}
            <div className="p-6 border-b border-white/5">
              <div className="flex items-center justify-between gap-4">
                {/* Home team */}
                <div className="flex flex-col items-center gap-2 flex-1 text-center">
                  <TeamLogo logo={home?.logo ?? null} name={home?.name ?? '?'} size="lg" />
                  <span className="text-sm font-medium text-white leading-tight">{home?.name ?? homeTeamName ?? '—'}</span>
                </div>

                {/* Score */}
                <div className="flex flex-col items-center px-4">
                  {result ? (
                    <div className="text-4xl font-bold text-white tabular-nums tracking-wider">
                      {result.homeScore} <span className="text-white/20">–</span> {result.awayScore}
                    </div>
                  ) : (
                    <div className="text-4xl font-bold text-white/20">vs</div>
                  )}
                  {result?.league && (
                    <div className="text-[10px] text-white/30 mt-1">{result.league}</div>
                  )}
                  {result?.date && (
                    <div className="text-[10px] text-white/20">{new Date(result.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  )}
                </div>

                {/* Away team */}
                <div className="flex flex-col items-center gap-2 flex-1 text-center">
                  <TeamLogo logo={away?.logo ?? null} name={away?.name ?? '?'} size="lg" />
                  <span className="text-sm font-medium text-white leading-tight">{away?.name ?? awayTeamName ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Event list */}
            {result && result.events.length > 0 && (
              <div className="divide-y divide-white/5">
                {result.events.map((ev, i) => {
                  const cfg = eventConfig[ev.type] ?? { icon: '•', color: 'text-white/40', label: ev.type };
                  const isHomeEvent = ev.teamId && home && ev.teamId === home.id;
                  const isAwayEvent = ev.teamId && away && ev.teamId === away.id;
                  const isMatchEvent = ev.type === 'kickoff' || ev.type === 'halftime' || ev.type === 'fulltime';

                  return (
                    <div
                      key={i}
                      className={`flex items-center px-5 py-2.5 gap-3 ${isMatchEvent ? 'opacity-40' : ''}`}
                      data-testid={`match-event-${i}`}
                    >
                      {/* Minute */}
                      <span className="text-[11px] text-white/30 w-8 text-right tabular-nums shrink-0">{ev.minute}'</span>

                      {/* Home team side */}
                      <div className="flex-1 text-right">
                        {isHomeEvent && (
                          <span className={`text-xs font-medium ${cfg.color}`}>{ev.label}</span>
                        )}
                      </div>

                      {/* Center icon */}
                      <div className="w-6 text-center text-base shrink-0">{cfg.icon}</div>

                      {/* Away team side */}
                      <div className="flex-1">
                        {isAwayEvent && (
                          <span className={`text-xs font-medium ${cfg.color}`}>{ev.label}</span>
                        )}
                        {isMatchEvent && (
                          <span className="text-xs text-white/30">{ev.label}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
