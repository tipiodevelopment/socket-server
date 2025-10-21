import type { ConnectionStatus } from '@shared/schema';

interface ConnectionStatusProps {
  status: ConnectionStatus;
  clientCount?: number;
}

export function ConnectionStatusComponent({ status, clientCount = 0 }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Server Running';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
        <div className={`w-2 h-2 rounded-full status-indicator ${getStatusColor()}`}></div>
        <span className="text-sm font-medium" data-testid="server-status">
          {getStatusText()}
        </span>
      </div>
      
      <div className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
        <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
        <span className="text-sm" data-testid="client-count">
          {clientCount} connected clients
        </span>
      </div>
    </div>
  );
}
