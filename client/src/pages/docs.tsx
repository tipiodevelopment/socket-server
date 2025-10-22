import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-0 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Swift Documentation</h1>
                <p className="text-sm text-muted-foreground">WebSocket Integration for iOS</p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Link href="/">
                <Button variant="outline" size="sm" data-testid="link-admin">
                  Admin
                </Button>
              </Link>
              <Link href="/viewer">
                <Button variant="outline" size="sm" data-testid="link-viewer">
                  Viewer
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Back Button */}
        <Link href="/">
          <Button variant="outline" size="sm" className="mb-4" data-testid="button-back-campaigns">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to campaigns
          </Button>
        </Link>

        {/* Introduction */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Introduction</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This documentation will guide you to integrate the WebSocket server with your Swift/iOS application. 
              The server sends real-time events for products, polls, and contests.
            </p>
            
            <div className="bg-primary/10 border-0 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-primary">Connection Information</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-2">WebSocket URL Pattern:</span>
                  <code className="font-mono bg-background px-3 py-2 rounded block">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/:campaignId`}
                  </code>
                </div>
                <div className="bg-background/50 rounded p-3 space-y-1.5">
                  <p className="text-xs text-muted-foreground font-semibold">Examples:</p>
                  <code className="font-mono text-xs block text-green-400">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/10`} → Campaign 10
                  </code>
                  <code className="font-mono text-xs block text-blue-400">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/25`} → Campaign 25
                  </code>
                  <code className="font-mono text-xs block text-purple-400">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/123`} → Campaign 123
                  </code>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-muted-foreground">Protocol:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">WebSocket</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">JSON</code>
                </div>
              </div>
            </div>
            
            <div className="bg-green-500/10 border-0 rounded-lg p-4 mt-4">
              <h4 className="font-semibold mb-2 text-green-400 flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span>Efficient Architecture</span>
              </h4>
              <p className="text-sm text-muted-foreground">
                Each campaign has its own isolated WebSocket channel. Events are only broadcast to clients connected to that specific campaign, 
                ensuring optimal performance and data isolation. Your app won't receive irrelevant events from other campaigns.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Connection */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
              <span>Connect to WebSocket</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Create a class to handle the WebSocket connection. Pass the campaign ID to connect to the correct channel:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(swiftConnectionCode, 'Swift connection')}
                data-testid="button-copy-connection"
              >
                {copiedCode === 'Swift connection' ? '✓ Copied' : 'Copy'}
              </Button>
              <pre className="bg-background border-0 rounded-lg p-4 overflow-x-auto code-block text-sm">
                <code className="text-green-400">{swiftConnectionCode}</code>
              </pre>
            </div>
            
            <div className="bg-background/50 rounded-lg p-4 mt-4">
              <h4 className="font-semibold mb-2 text-sm">Usage Example:</h4>
              <pre className="bg-gray-900 rounded p-3 overflow-x-auto text-xs">
                <code className="text-blue-400">{`// Initialize with your campaign ID
let wsManager = WebSocketManager(campaignId: 10)
wsManager.connect()

// Now you'll only receive events from campaign 10`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Message Handling */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
              <span>Handle Messages</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Implement handling of the different event types:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(messageHandlingCode, 'message handling')}
                data-testid="button-copy-handling"
              >
                {copiedCode === 'message handling' ? '✓ Copied' : 'Copy'}
              </Button>
              <pre className="bg-background border-0 rounded-lg p-4 overflow-x-auto code-block text-sm max-h-96">
                <code className="text-green-400">{messageHandlingCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Data Models */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
              <span>Data Models</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Define the data structures to handle the events:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(modelStructCode, 'Swift models')}
                data-testid="button-copy-models"
              >
                {copiedCode === 'Swift models' ? '✓ Copied' : 'Copy'}
              </Button>
              <pre className="bg-background border-0 rounded-lg p-4 overflow-x-auto code-block text-sm max-h-96">
                <code className="text-green-400">{modelStructCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* JSON Examples */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>JSON Payload Examples</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Product JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Product</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(productJSON, 'Product JSON')}
                    data-testid="button-copy-product-json"
                  >
                    {copiedCode === 'Product JSON' ? '✓' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-background border-0 rounded-lg p-3 overflow-x-auto code-block text-xs">
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
                    onClick={() => copyToClipboard(pollJSON, 'Poll JSON')}
                    data-testid="button-copy-poll-json"
                  >
                    {copiedCode === 'Poll JSON' ? '✓' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-background border-0 rounded-lg p-3 overflow-x-auto code-block text-xs">
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
                    onClick={() => copyToClipboard(contestJSON, 'Contest JSON')}
                    data-testid="button-copy-contest-json"
                  >
                    {copiedCode === 'Contest JSON' ? '✓' : 'Copy'}
                  </Button>
                </div>
                <pre className="bg-background border-0 rounded-lg p-3 overflow-x-auto code-block text-xs">
                  <code className="text-green-400">{contestJSON}</code>
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Tips */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Implementation Tips</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary/10 border-0 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-primary">Best Practices</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
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
              
              <div className="bg-amber-500/10 border-0 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-amber-500">Performance Considerations</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
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
              
              <div className="bg-secondary/10 border-0 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-secondary">Error Handling</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
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
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span>Quick Start</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                To quickly test the integration:
              </p>
              
              <div className="bg-background border-0 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Steps:</h4>
                <ol className="text-sm space-y-2 text-muted-foreground">
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
          </CardContent>
        </Card>

        {/* Dynamic Components Documentation */}
        <Card className="border-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-2xl">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"></path>
              </svg>
              <span>Dynamic Components System</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Overview</h3>
              <p className="text-muted-foreground mb-4">
                The Dynamic Components system allows you to display and control UI components in real-time from the admin panel. 
                Components can be activated, deactivated, or updated without rebuilding your iOS app.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Initial State - GET Active Components</h3>
              <p className="text-muted-foreground mb-3">
                When your app launches, fetch all active components for a campaign:
              </p>
              <div className="bg-background rounded-lg p-4 mb-3">
                <code className="text-green-400 text-sm">
                  GET {`${window.location.protocol}//${window.location.host}`}/api/campaigns/:id/active-components
                </code>
              </div>
              <p className="text-muted-foreground mb-3 text-sm">
                Response example:
              </p>
              <pre className="bg-background rounded-lg p-4 overflow-x-auto text-xs">
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
              <p className="text-muted-foreground mb-3">
                Your app receives two types of component events:
              </p>
              
              <div className="space-y-4">
                <div className="bg-background rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-blue-400">1. component_status_changed</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Fired when a component is activated or deactivated:
                  </p>
                  <pre className="bg-gray-900 rounded p-3 overflow-x-auto text-xs">
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

                <div className="bg-background rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-purple-400">2. component_config_updated</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Fired when a component's configuration is edited:
                  </p>
                  <pre className="bg-gray-900 rounded p-3 overflow-x-auto text-xs">
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
              <p className="text-muted-foreground mb-3">
                The Offer Banner is a premium promotional component with countdown timer, discount badge, and CTA button.
              </p>

              <div className="bg-background rounded-lg p-4 mb-3">
                <h4 className="font-semibold mb-2">Complete JSON Example:</h4>
                <pre className="bg-gray-900 rounded p-3 overflow-x-auto text-xs">
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
    "overlayOpacity": 0.4
  },
  "status": "active",
  "activatedAt": "2025-10-22T12:00:00Z"
}`}</code>
                </pre>
              </div>
              
              <div className="bg-background rounded-lg p-4 mb-3">
                <h4 className="font-semibold mb-2">Swift Data Model:</h4>
                <pre className="bg-gray-900 rounded p-3 overflow-x-auto text-xs">
                  <code className="text-green-400">{`struct OfferBannerConfig: Codable {
    let logoUrl: String
    let title: String
    let subtitle: String?
    let backgroundImageUrl: String
    let countdownEndDate: String // ISO 8601
    let discountBadgeText: String
    let ctaText: String
    let ctaLink: String?
    let overlayOpacity: Double?
}`}</code>
                </pre>
              </div>

              <div className="bg-background rounded-lg p-4">
                <h4 className="font-semibold mb-2">Usage Example:</h4>
                <pre className="bg-gray-900 rounded p-3 overflow-x-auto text-xs">
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
        overlayOpacity: config.overlayOpacity ?? 0.4
    )
}`}</code>
                </pre>
              </div>
            </div>

            <div className="bg-blue-500/10 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-blue-400">Component Types Available</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center space-x-2">
                  <span className="text-blue-500">•</span>
                  <span><code className="text-blue-300">banner</code> - Simple promotional banner</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-purple-500">•</span>
                  <span><code className="text-purple-300">offer_banner</code> - Premium banner with countdown and badges</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-green-500">•</span>
                  <span><code className="text-green-300">countdown</code> - Standalone countdown timer</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-amber-500">•</span>
                  <span><code className="text-amber-300">carousel_auto</code> - Auto product carousel</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-red-500">•</span>
                  <span><code className="text-red-300">carousel_manual</code> - Manual product carousel</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-cyan-500">•</span>
                  <span><code className="text-cyan-300">product_spotlight</code> - Highlight specific product</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-pink-500">•</span>
                  <span><code className="text-pink-300">offer_badge</code> - Small promotional badge</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-0">
          <p>Need help? Check the <Link href="/"><Button variant="link" className="p-0 h-auto" data-testid="link-admin-footer">admin panel</Button></Link> to test events in real-time.</p>
        </div>
      </div>
    </div>
  );
}
