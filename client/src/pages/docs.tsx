import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/AppLayout';

export default function DocsPage() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(label);
      toast({
        title: "Copied",
        description: `Code ${label} copied to clipboard`,
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "Error",
        description: "Could not copy code",
        variant: "destructive",
      });
    }
  };

  const swiftConnectionCode = `import Foundation

class WebSocketManager: NSObject, URLSessionWebSocketDelegate {
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    private let campaignId: Int
    
    init(campaignId: Int) {
        self.campaignId = campaignId
        super.init()
    }
    
    func connect() {
        urlSession = URLSession(configuration: .default, 
                               delegate: self, 
                               delegateQueue: OperationQueue())
        
        // Each campaign has its own isolated WebSocket channel
        let url = URL(string: "${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/\\(campaignId)")!
        webSocketTask = urlSession.webSocketTask(with: url)
        webSocketTask?.resume()
        
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                default:
                    break
                }
                self?.receiveMessage()
            case .failure(let error):
                print("Error: \\(error)")
            }
        }
    }
}`;

  const messageHandlingCode = `private func handleMessage(_ text: String) {
    guard let data = text.data(using: .utf8) else { return }
    
    // First, get event type
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let eventType = json["type"] as? String
    else { return }
    
    // Decode based on type
    do {
        switch eventType {
        case "product":
            let event = try JSONDecoder().decode(ProductEvent.self, from: data)
            handleProductEvent(event)
        case "poll":
            let event = try JSONDecoder().decode(PollEvent.self, from: data)
            handlePollEvent(event)
        case "contest":
            let event = try JSONDecoder().decode(ContestEvent.self, from: data)
            handleContestEvent(event)
        case "campaign_started":
            // Campaign has started, show all active components
            handleCampaignStarted(json)
        case "campaign_ended":
            // Campaign has ended, hide all components immediately
            handleCampaignEnded(json)
        case "component_status_changed":
            // Handle dynamic component status updates
            handleComponentStatusChanged(json)
        case "component_config_updated":
            // Handle dynamic component config updates
            handleComponentConfigUpdated(json)
        default:
            print("Unknown event type: \\(eventType)")
        }
    } catch {
        print("Error decoding event: \\(error)")
    }
}

private func handleCampaignStarted(_ json: [String: Any]) {
    DispatchQueue.main.async {
        // Campaign has started, prepare to show components
        // You can optionally fetch and display active components
        print("Campaign started, ready to display components")
        self.loadActiveComponents()
    }
}

private func handleCampaignEnded(_ json: [String: Any]) {
    DispatchQueue.main.async {
        // Hide all campaign components immediately
        self.hideAllComponents()
        print("Campaign ended, all components hidden")
    }
}

private func handleProductEvent(_ event: ProductEvent) {
    DispatchQueue.main.async {
        // Show product in UI
        self.showProduct(
            name: event.data.name,
            price: event.data.price,
            description: event.data.description,
            imageUrl: event.data.imageUrl,
            campaignLogo: event.campaignLogo
        )
    }
}

private func handlePollEvent(_ event: PollEvent) {
    DispatchQueue.main.async {
        // Show poll in UI
        self.showPoll(
            question: event.data.question,
            options: event.data.options,
            duration: event.data.duration,
            campaignLogo: event.campaignLogo
        )
    }
}

private func handleContestEvent(_ event: ContestEvent) {
    DispatchQueue.main.async {
        // Show contest in UI
        self.showContest(
            name: event.data.name,
            prize: event.data.prize,
            deadline: event.data.deadline,
            maxParticipants: event.data.maxParticipants,
            campaignLogo: event.campaignLogo
        )
    }
}`;

  const productJSON = `{
  "type": "product",
  "data": {
    "id": "prod_123",
    "name": "iPhone 15 Pro Max",
    "description": "Latest model with titanium and 48MP camera",
    "price": "12 999 kr",
    "currency": "NOK",
    "imageUrl": "https://images.unsplash.com/photo-1592286927505-b7e00a46f74f"
  },
  "campaignLogo": "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
  "timestamp": 1703520000000
}`;

  const pollJSON = `{
  "type": "poll",
  "data": {
    "id": "poll_456",
    "question": "What is your favorite smartphone?",
    "options": [
      "iPhone",
      "Samsung",
      "Google Pixel",
      "Other"
    ],
    "duration": 60
  },
  "campaignLogo": "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
  "timestamp": 1703520000000
}`;

  const contestJSON = `{
  "type": "contest",
  "data": {
    "id": "contest_789",
    "name": "Big Tech Contest 2024",
    "prize": "Win MacBook Pro M3, AirPods Pro and more",
    "deadline": "2024-12-31",
    "maxParticipants": 1000
  },
  "campaignLogo": "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
  "timestamp": 1703520000000
}`;

  const modelStructCode = `// Base model for WebSocket events
struct WebSocketEvent: Codable {
    let type: String
    let timestamp: Int64
    let campaignLogo: String?
    
    private enum CodingKeys: String, CodingKey {
        case type, timestamp, data, campaignLogo
    }
}

// Product event
struct ProductEvent: Codable {
    let type: String
    let timestamp: Int64
    let campaignLogo: String?
    let data: ProductData
    
    struct ProductData: Codable {
        let id: String
        let name: String
        let description: String
        let price: String
        let currency: String
        let imageUrl: String
    }
}

// Poll event
struct PollEvent: Codable {
    let type: String
    let timestamp: Int64
    let campaignLogo: String?
    let data: PollData
    
    struct PollData: Codable {
        let id: String
        let question: String
        let options: [String]
        let duration: Int
    }
}

// Contest event
struct ContestEvent: Codable {
    let type: String
    let timestamp: Int64
    let campaignLogo: String?
    let data: ContestData
    
    struct ContestData: Codable {
        let id: String
        let name: String
        let prize: String
        let deadline: String
        let maxParticipants: Int
    }
}`;

  return (
    <AppLayout title="Documentation">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Introduction */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Introduction</span>
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              This documentation will guide you to integrate the WebSocket server with your Swift/iOS application. 
              The server sends real-time events for products, polls, and contests.
            </p>
            
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-primary">Connection Information</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-white/40 block mb-2">WebSocket URL Pattern:</span>
                  <code className="font-mono bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-xl block text-green-600 dark:text-green-400">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/:campaignId`}
                  </code>
                </div>
                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs text-gray-500 dark:text-white/40 font-semibold">Examples:</p>
                  <code className="font-mono text-xs block text-green-600 dark:text-green-400">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/10`} → Campaign 10
                  </code>
                  <code className="font-mono text-xs block text-gray-600 dark:text-gray-300">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/25`} → Campaign 25
                  </code>
                  <code className="font-mono text-xs block text-gray-600 dark:text-gray-300">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/123`} → Campaign 123
                  </code>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-gray-500 dark:text-white/40">Protocol:</span>
                  <code className="font-mono bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 px-2 py-1 rounded-lg text-green-600 dark:text-green-400">WebSocket</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-white/40">Format:</span>
                  <code className="font-mono bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 px-2 py-1 rounded-lg text-green-600 dark:text-green-400">JSON</code>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4 mt-4">
              <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400 flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span>Efficient Architecture</span>
              </h4>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">
                Each campaign has its own isolated WebSocket channel. Events are only broadcast to clients connected to that specific campaign, 
                ensuring optimal performance and data isolation. Your app won't receive irrelevant events from other campaigns.
              </p>
            </div>
          </div>
        </div>

        {/* Step 1: Connection */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
              <span>Connect to WebSocket</span>
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              Create a class to handle the WebSocket connection. Pass the campaign ID to connect to the correct channel:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60"
                onClick={() => copyToClipboard(swiftConnectionCode, 'Swift connection')}
                data-testid="button-copy-connection"
              >
                {copiedCode === 'Swift connection' ? '✓ Copied' : 'Copy'}
              </Button>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-4 overflow-x-auto text-sm">
                <code className="text-green-400">{swiftConnectionCode}</code>
              </pre>
            </div>
            
            <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 mt-4">
              <h4 className="font-semibold mb-2 text-sm text-gray-900 dark:text-white">Usage Example:</h4>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                <code className="text-gray-300">{`// Initialize with your campaign ID
let wsManager = WebSocketManager(campaignId: 10)
wsManager.connect()

// Now you'll only receive events from campaign 10`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Step 2: Message Handling */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
              <span>Handle Messages</span>
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              Implement handling of the different event types:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60"
                onClick={() => copyToClipboard(messageHandlingCode, 'message handling')}
                data-testid="button-copy-handling"
              >
                {copiedCode === 'message handling' ? '✓ Copied' : 'Copy'}
              </Button>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-4 overflow-x-auto text-sm max-h-96">
                <code className="text-green-400">{messageHandlingCode}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Step 3: Data Models */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
              <span>Data Models</span>
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              Define the data structures to handle the events:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10 border-gray-200 dark:border-white/10 text-gray-600 dark:text-white/60"
                onClick={() => copyToClipboard(modelStructCode, 'Swift models')}
                data-testid="button-copy-models"
              >
                {copiedCode === 'Swift models' ? '✓ Copied' : 'Copy'}
              </Button>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-4 overflow-x-auto text-sm max-h-96">
                <code className="text-green-400">{modelStructCode}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* JSON Examples */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>JSON Payload Examples</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Product JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Product</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 dark:text-white/60"
                    onClick={() => copyToClipboard(productJSON, 'Product JSON')}
                    data-testid="button-copy-product-json"
                  >
                    {copiedCode === 'Product JSON' ? '✓' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{productJSON}</code>
                </pre>
              </div>

              {/* Poll JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary">Poll</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 dark:text-white/60"
                    onClick={() => copyToClipboard(pollJSON, 'Poll JSON')}
                    data-testid="button-copy-poll-json"
                  >
                    {copiedCode === 'Poll JSON' ? '✓' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{pollJSON}</code>
                </pre>
              </div>

              {/* Contest JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-500">Contest</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-600 dark:text-white/60"
                    onClick={() => copyToClipboard(contestJSON, 'Contest JSON')}
                    data-testid="button-copy-contest-json"
                  >
                    {copiedCode === 'Contest JSON' ? '✓' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{contestJSON}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Lifecycle */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Campaign Lifecycle</span>
            </h2>
            <p className="text-gray-600 dark:text-muted-foreground mb-4">
              All components automatically respect campaign start and end dates. The system broadcasts lifecycle events to notify your app when campaigns start or end.
            </p>
            
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300 flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                  <span>campaign_started Event</span>
                </h4>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                  Sent when a campaign's start date is reached. Use this to prepare your UI and load active components.
                </p>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`{
  "type": "campaign_started",
  "campaignId": 10,
  "startDate": "2024-12-25T10:00:00Z",
  "endDate": "2024-12-31T23:59:59Z"
}`}</code>
                </pre>
              </div>

              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-red-700 dark:text-red-400 flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  <span>campaign_ended Event</span>
                </h4>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                  Sent when a campaign's end date is reached. Hide all campaign components immediately when this event is received.
                </p>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`{
  "type": "campaign_ended",
  "campaignId": 10,
  "endDate": "2024-12-31T23:59:59Z"
}`}</code>
                </pre>
              </div>

              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Component Behavior</h4>
                <ul className="text-sm space-y-2 text-gray-600 dark:text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-gray-600 dark:text-gray-300 mt-1">•</span>
                    <span><strong>Before start date:</strong> Components will not activate, even if manually toggled</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-gray-600 dark:text-gray-300 mt-1">•</span>
                    <span><strong>During campaign:</strong> Components can be activated/deactivated via manual toggle or scheduling</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-gray-600 dark:text-gray-300 mt-1">•</span>
                    <span><strong>After end date:</strong> All components are automatically hidden</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-gray-600 dark:text-gray-300 mt-1">•</span>
                    <span><strong>Manual toggle:</strong> Admins can activate/deactivate components anytime during the active campaign period</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Implementation Tips */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Implementation Tips</span>
            </h2>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-primary">Best Practices</h4>
                <ul className="text-sm space-y-2 text-gray-600 dark:text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Implement automatic reconnection on connection loss</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Always validate received JSON data before processing</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Update UI on the main thread with DispatchQueue.main.async</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Consider using Combine for reactive event handling</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Implement local cache for critical events</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-amber-600 dark:text-amber-500">Performance Considerations</h4>
                <ul className="text-sm space-y-2 text-gray-600 dark:text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Process messages in background thread to avoid blocking UI</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Implement debouncing for very frequent events</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Limit number of events in memory to avoid overconsumption</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-50 dark:bg-secondary/10 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-secondary">Error Handling</h4>
                <ul className="text-sm space-y-2 text-gray-600 dark:text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Catch and log connection and JSON parsing errors</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Implement fallbacks for critical business events</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Notify user of connection issues</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="p-6">
            <h2 className="flex items-center space-x-2 text-lg font-semibold text-primary mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span>Quick Start</span>
            </h2>
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-muted-foreground">
                To quickly test the integration:
              </p>
              
              <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Steps:</h4>
                <ol className="text-sm space-y-2 text-gray-600 dark:text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">1.</span>
                    <span>Copy the WebSocket connection code to your Swift project</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">2.</span>
                    <span>Implement the Codable data models</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">3.</span>
                    <span>Connect to the server with the provided URL</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">4.</span>
                    <span>Go to <Link href="/"><Button variant="link" className="p-0 h-auto" data-testid="link-admin-inline">admin panel</Button></Link> and send test events</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">5.</span>
                    <span>Confirm that your app receives and processes events correctly</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Components Documentation */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50/50 dark:from-white/5 to-gray-50/50 dark:to-white/5">
          <div className="p-6 space-y-6">
            <h2 className="flex items-center space-x-2 text-2xl font-semibold text-gray-900 dark:text-white">
              <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>
              </svg>
              <span>Dynamic Components System</span>
            </h2>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Overview</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                The Dynamic Components system allows you to display and control UI components in real-time from the admin panel. 
                Components can be activated, deactivated, or updated without rebuilding your iOS app.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Initial State - GET Active Components</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-3">
                When your app launches, fetch all active components for a campaign:
              </p>
              <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 mb-3">
                <code className="text-green-600 dark:text-green-400 text-sm">
                  GET {`${window.location.protocol}//${window.location.host}`}/api/campaigns/:id/active-components
                </code>
              </div>
              <p className="text-gray-500 dark:text-white/40 mb-3 text-sm">
                Response example:
              </p>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-4 overflow-x-auto text-xs">
                <code className="text-green-400">{`[
  {
    "componentId": "cmp_abc123",
    "type": "offer_banner",
    "name": "Weekly Offer Banner",
    "config": {
      "logoUrl": "https://...",
      "title": "Ukens tilbud",
      "subtitle": "Se denne ukes beste tilbud",
      "backgroundImageUrl": "https://...",
      "countdownEndDate": "2025-12-31T23:59:59Z",
      "discountBadgeText": "Opp til 30%",
      "ctaText": "Se alle tilbud",
      "ctaLink": "https://example.com/offers",
      "deeplink": "myapp://offers/weekly",
      "overlayOpacity": 0.4
    },
    "status": "active",
    "activatedAt": "2025-10-22T12:00:00Z"
  }
]`}</code>
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Real-Time Updates via WebSocket</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-3">
                Your app receives two types of component events:
              </p>
              
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">1. component_status_changed</h4>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2">
                    Fired when a component is activated or deactivated:
                  </p>
                  <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                    <code className="text-green-400">{`{
  "type": "component_status_changed",
  "campaignId": 10,
  "componentId": "cmp_abc123",
  "status": "active",
  "component": {
    "id": "cmp_abc123",
    "type": "offer_banner",
    "name": "Weekly Offer Banner",
    "config": { ... }
  }
}`}</code>
                  </pre>
                </div>

                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">2. component_config_updated</h4>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2">
                    Fired when a component's configuration is edited:
                  </p>
                  <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                    <code className="text-green-400">{`{
  "type": "component_config_updated",
  "campaignId": 10,
  "componentId": "cmp_abc123",
  "component": {
    "id": "cmp_abc123",
    "type": "offer_banner",
    "name": "Weekly Offer Banner",
    "config": {
      "title": "Updated Title",
      ...
    }
  }
}`}</code>
                  </pre>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Offer Banner Component (XXL)</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-3">
                The Offer Banner is a premium promotional component with countdown timer, discount badge, and CTA button.
              </p>

              <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 mb-3">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Complete JSON Example:</h4>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`{
  "componentId": "cmp_abc123",
  "type": "offer_banner",
  "name": "Weekly Offer Banner",
  "config": {
    "logoUrl": "https://example.com/logo.png",
    "title": "Ukens tilbud",
    "subtitle": "Se denne ukes beste tilbud",
    "backgroundImageUrl": "https://example.com/banner-bg.jpg",
    "countdownEndDate": "2025-12-31T23:59:59Z",
    "discountBadgeText": "Opp til 30%",
    "ctaText": "Se alle tilbud",
    "ctaLink": "https://example.com/offers",
    "deeplink": "myapp://offers/weekly",
    "overlayOpacity": 0.4
  },
  "status": "active",
  "activatedAt": "2025-10-22T12:00:00Z"
}`}</code>
                </pre>
              </div>
              
              <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 mb-3">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Swift Data Model:</h4>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`struct OfferBannerConfig: Codable {
    let logoUrl: String
    let title: String
    let subtitle: String?
    let backgroundImageUrl: String
    let countdownEndDate: String // ISO 8601
    let discountBadgeText: String
    let ctaText: String
    let ctaLink: String?
    let deeplink: String?  // App URL scheme or universal link
    let overlayOpacity: Double?
}`}</code>
                </pre>
              </div>

              <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4 mb-3">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Usage Example:</h4>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`// Decode component from WebSocket or API
if component.type == "offer_banner" {
    let config = try JSONDecoder().decode(
        OfferBannerConfig.self, 
        from: JSONEncoder().encode(component.config)
    )
    
    // Display your OfferBannerView
    OfferBannerView(
        logoUrl: config.logoUrl,
        title: config.title,
        subtitle: config.subtitle,
        backgroundImageUrl: config.backgroundImageUrl,
        countdownEndDate: config.countdownEndDate,
        discountBadgeText: config.discountBadgeText,
        ctaText: config.ctaText,
        ctaLink: config.ctaLink,
        deeplink: config.deeplink,
        overlayOpacity: config.overlayOpacity ?? 0.4
    )
}`}</code>
                </pre>
              </div>
              
              <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Handling Deeplinks (CTA Button Tap):</h4>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`func handleCTAButtonTap(config: OfferBannerConfig) {
    // Priority: Deeplink > Web Link
    if let deeplink = config.deeplink, 
       let url = URL(string: deeplink) {
        
        // Try to open deeplink (app URL scheme or universal link)
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url, options: [:]) { success in
                if !success {
                    // Deeplink failed, fallback to web link
                    self.openWebLink(config.ctaLink)
                }
            }
        } else {
            // Deeplink not supported, fallback to web link
            openWebLink(config.ctaLink)
        }
    } else {
        // No deeplink, open web link
        openWebLink(config.ctaLink)
    }
}

func openWebLink(_ link: String?) {
    guard let link = link, let url = URL(string: link) else { return }
    UIApplication.shared.open(url)
}

// Example deeplink schemes:
// "myapp://offers/weekly"         -> Custom URL scheme
// "https://myapp.com/offers/123"  -> Universal link`}</code>
                </pre>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Component Types Available</h4>
              <ul className="text-sm space-y-1 text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <span className="text-gray-500">•</span>
                  <span><code className="text-gray-600 dark:text-gray-300">banner</code> - Simple promotional banner</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-gray-500">•</span>
                  <span><code className="text-gray-600 dark:text-gray-300">offer_banner</code> - Premium banner with countdown and badges</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-500">•</span>
                  <span><code className="text-green-600 dark:text-green-300">countdown</code> - Standalone countdown timer</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-amber-500">•</span>
                  <span><code className="text-amber-600 dark:text-amber-300">carousel_auto</code> - Auto product carousel</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-red-500">•</span>
                  <span><code className="text-red-600 dark:text-red-300">carousel_manual</code> - Manual product carousel</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-cyan-500">•</span>
                  <span><code className="text-cyan-600 dark:text-cyan-300">product_spotlight</code> - Highlight specific product</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-pink-500">•</span>
                  <span><code className="text-pink-600 dark:text-pink-300">offer_badge</code> - Small promotional badge</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Geographic Targeting & User Segmentation */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-gradient-to-br from-green-50/50 dark:from-green-500/10 to-gray-50/50 dark:to-white/5">
          <div className="p-6 space-y-6">
            <h2 className="flex items-center space-x-2 text-2xl font-semibold text-gray-900 dark:text-white">
              <svg className="w-8 h-8 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span>Geographic Targeting & User Segmentation</span>
            </h2>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-green-600 dark:text-green-500">Overview</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Target campaigns to specific users based on geography and user percentage. Perfect for A/B testing, regional campaigns, and market testing.
              </p>
            </div>

            <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-green-700 dark:text-green-400">Enable Segmentation in Campaign Settings</h4>
              <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                1. Go to Campaign Dashboard → Settings tab<br />
                2. Find "Targeting & Segmentation" section<br />
                3. Toggle "Enable segmentation for this campaign"<br />
                4. Select countries and set user percentage<br />
                5. Save settings
              </p>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">🌍 Geographic Targeting</h4>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-2">
                  Select which countries can see your campaign:
                </p>
                <p className="text-xs text-gray-500 dark:text-white/40">
                  Supported: US, MX, AR, CO, BR, ES, CA, DE, FR, GB, IT, JP, AU, NZ, SG, IN, KR, CN
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h4 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">📊 User Percentage (A/B Testing)</h4>
                <p className="text-sm text-gray-600 dark:text-muted-foreground">
                  Set 1-100% to control how many users see the campaign. Uses deterministic hashing to ensure the same user always gets the same result.
                </p>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">How to Pass Targeting Data from iOS</h4>
              <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                Your app should pass userId and userCountry parameters when requesting offers:
              </p>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs mb-3">
                <code className="text-green-400">{`// Swift Example
let userId = UserDefaults.standard.string(forKey: "userId") ?? "user123"
let userCountry = Locale.current.region?.identifier ?? "US" // "MX", "US", etc.

let urlString = """
${window.location.protocol}//${window.location.host}/v1/offers?\\
apiKey=xxx&\\
campaignId=14&\\
userId=\\(userId)&\\
userCountry=\\(userCountry)
"""

// Make request with these parameters
let url = URL(string: urlString)!
URLSession.shared.dataTask(with: url) { data, response, error in
    // Handle response
}.resume()`}</code>
              </pre>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">
                If the user doesn't match targeting criteria, the endpoint returns an empty offers array (graceful degradation).
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Use Cases</h4>
              <div className="space-y-2">
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary">A/B Testing</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Enable segmentation, set percentage to 50%, reach all countries</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary">Regional Campaign</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Enable segmentation, select Mexico (MX), set percentage to 100%</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary">Market Testing</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Enable segmentation, select multiple countries (BR, CO, AR), set percentage to 25%</p>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-amber-600 dark:text-amber-500">⚡ Important Notes</h4>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-muted-foreground">
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>When segmentation is disabled, all users see the campaign (no geographic or percentage restrictions)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>Deterministic hashing ensures the same user always gets consistent results</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>Changes to targeting settings take effect immediately</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>Missing userId or userCountry parameters result in empty offers (graceful degradation)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Dynamic Configuration System */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50/50 dark:from-white/5 to-gray-50/50 dark:to-white/5">
          <div className="p-6 space-y-6">
            <h2 className="flex items-center space-x-2 text-2xl font-semibold text-gray-900 dark:text-white">
              <svg className="w-8 h-8 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span>Dynamic Configuration System</span>
            </h2>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-600 dark:text-gray-300">Overview</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                The Dynamic Configuration System allows you to customize brand identity, engagement settings, UI themes, and feature flags for each campaign. All configurations are accessible via SDK endpoints and update in real-time via WebSocket.
              </p>
            </div>

            {/* SDK Endpoints */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">SDK Configuration Endpoints</h4>
              
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h5 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">GET /v1/campaigns/:campaignId/config</h5>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                  Returns the complete dynamic configuration for a campaign including brand, engagement, UI, and feature flags.
                </p>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`// Request
GET ${window.location.protocol}//${window.location.host}/v1/campaigns/3/config?apiKey=YOUR_API_KEY

// Response
{
  "campaignId": 3,
  "version": "1.0.0",
  "brand": {
    "name": "My Campaign",
    "iconAsset": "avatar_default",
    "iconUrl": null,
    "logoUrl": "https://example.com/logo.png",
    "sponsorBadgeText": {
      "no": "Sponset av",
      "en": "Sponsored by",
      "sv": "Sponsrad av"
    }
  },
  "engagement": {
    "demoMode": false,
    "defaultPollDuration": 300,
    "defaultContestDuration": 600,
    "maxVotesPerPoll": 1,
    "maxContestsPerMatch": 10,
    "enableRealTimeUpdates": true,
    "updateInterval": 1000
  },
  "ui": {
    "theme": {
      "primaryColor": "#007AFF",
      "secondaryColor": "#5856D6"
    },
    "components": {}
  },
  "features": {
    "enableLiveStreaming": true,
    "enableProductCatalog": true,
    "enableEngagement": true,
    "enablePolls": true,
    "enableContests": true
  },
  "cache": {
    "ttl": 300,
    "version": "1.0.0"
  }
}`}</code>
                </pre>
              </div>

              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-4">
                <h5 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">GET /v1/engagement/config</h5>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                  Returns engagement configuration for a specific match. Useful for match-specific settings.
                </p>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`// Request
GET ${window.location.protocol}//${window.location.host}/v1/engagement/config?apiKey=YOUR_API_KEY&matchId=MATCH_123

// Response
{
  "matchId": "MATCH_123",
  "engagement": {
    "demoMode": false,
    "defaultPollDuration": 300,
    "defaultContestDuration": 600,
    "enableRealTimeUpdates": true
  }
}`}</code>
                </pre>
              </div>

              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4">
                <h5 className="font-semibold mb-2 text-green-700 dark:text-green-400">GET /v1/localization/:language</h5>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                  Returns localized strings for the SDK with priority system: match-specific → campaign-specific → global translations.
                </p>
                <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`// Request
GET ${window.location.protocol}//${window.location.host}/v1/localization/en?apiKey=YOUR_API_KEY&campaignId=3

// Response
{
  "language": "en",
  "strings": {
    "sponsored_by": "Sponsored by",
    "vote_now": "Vote Now",
    "enter_contest": "Enter Contest",
    "time_remaining": "Time Remaining"
  },
  "cache": {
    "ttl": 3600,
    "version": "1.0.0"
  }
}`}</code>
                </pre>
              </div>
            </div>

            {/* Configuration Sections */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-gray-900 dark:text-white">Configuration Sections</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <h5 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">🏢 Brand Configuration</h5>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-muted-foreground">
                    <li>• <strong>Brand Name:</strong> Display name for SDK</li>
                    <li>• <strong>Icon Asset:</strong> Built-in icon identifier</li>
                    <li>• <strong>Icon URL:</strong> Custom icon URL</li>
                    <li>• <strong>Logo URL:</strong> Brand logo URL</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <h5 className="font-semibold mb-2 text-gray-700 dark:text-gray-300">⚡ Engagement Settings</h5>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-muted-foreground">
                    <li>• <strong>Demo Mode:</strong> Test mode for development</li>
                    <li>• <strong>Poll Duration:</strong> Default poll time (seconds)</li>
                    <li>• <strong>Contest Duration:</strong> Default contest time</li>
                    <li>• <strong>Real-Time Updates:</strong> Enable live updates</li>
                    <li>• <strong>Update Interval:</strong> Refresh rate (ms)</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <h5 className="font-semibold mb-2 text-pink-700 dark:text-pink-400">🎨 UI Theme</h5>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-muted-foreground">
                    <li>• <strong>Primary Color:</strong> Main accent color</li>
                    <li>• <strong>Secondary Color:</strong> Secondary accent</li>
                    <li>• <strong>Component Configs:</strong> Per-component styling</li>
                  </ul>
                </div>

                <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
                  <h5 className="font-semibold mb-2 text-amber-600 dark:text-amber-400">🚀 Feature Flags</h5>
                  <ul className="text-sm space-y-1 text-gray-600 dark:text-muted-foreground">
                    <li>• <strong>Live Streaming:</strong> Enable/disable streaming</li>
                    <li>• <strong>Product Catalog:</strong> Show products</li>
                    <li>• <strong>Engagement:</strong> Enable interactions</li>
                    <li>• <strong>Polls:</strong> Enable voting</li>
                    <li>• <strong>Contests:</strong> Enable contests</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* WebSocket Events */}
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-amber-600 dark:text-amber-500">📡 Real-Time Configuration Updates</h4>
              <p className="text-sm text-gray-600 dark:text-muted-foreground mb-3">
                When configuration changes are saved, a <code className="text-amber-600 dark:text-amber-300">config:updated</code> event is broadcast via WebSocket:
              </p>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                <code className="text-green-400">{`{
  "type": "config:updated",
  "campaignId": 3,
  "matchId": "MATCH_123",  // optional
  "sections": ["engagement"],  // which sections changed
  "version": "1.0.0",
  "timestamp": "2026-02-02T12:00:00Z"
}`}</code>
              </pre>
              <p className="text-sm text-gray-600 dark:text-muted-foreground mt-2">
                Your app should listen for this event and re-fetch the configuration endpoint to get updated values.
              </p>
            </div>

            {/* Swift Integration Example */}
            <div className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Swift Integration Example</h4>
              <pre className="bg-gray-900 dark:bg-black/50 rounded-xl p-3 overflow-x-auto text-xs">
                <code className="text-green-400">{`// Fetch campaign configuration
func fetchCampaignConfig(campaignId: Int, apiKey: String) async throws -> CampaignConfig {
    let url = URL(string: "${window.location.protocol}//${window.location.host}/v1/campaigns/\\(campaignId)/config?apiKey=\\(apiKey)")!
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(CampaignConfig.self, from: data)
}

// Handle config:updated WebSocket event
private func handleConfigUpdated(_ json: [String: Any]) {
    guard let sections = json["sections"] as? [String] else { return }
    
    Task {
        // Re-fetch configuration
        let config = try await fetchCampaignConfig(
            campaignId: currentCampaignId,
            apiKey: apiKey
        )
        
        // Apply updated config
        DispatchQueue.main.async {
            self.applyConfiguration(config)
        }
    }
}`}</code>
              </pre>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Caching Guidelines</h4>
              <div className="space-y-2">
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary">Configuration Endpoint</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Cache-Control: max-age=300 (5 minutes)</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary">Localization Endpoint</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Cache-Control: max-age=3600 (1 hour)</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-primary">Real-Time Updates</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Listen for config:updated WebSocket events to invalidate cache</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-gray-500 dark:text-muted-foreground pt-8">
          <p>Need help? Check the <Link href="/"><Button variant="link" className="p-0 h-auto" data-testid="link-admin-footer">admin panel</Button></Link> to test events in real-time.</p>
        </div>
      </div>
    </AppLayout>
  );
}
