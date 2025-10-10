import { useState } from 'react';
import { Link } from 'wouter';
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
        title: "Kopiert",
        description: `Kode ${label} kopiert til utklippstavle`,
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "Feil",
        description: "Kunne ikke kopiere koden",
        variant: "destructive",
      });
    }
  };

  const swiftConnectionCode = `import Foundation

class WebSocketManager: NSObject, URLSessionWebSocketDelegate {
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    
    func connect() {
        urlSession = URLSession(configuration: .default, 
                               delegate: self, 
                               delegateQueue: OperationQueue())
        
        let url = URL(string: "${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws")!
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
    
    // Først, hent hendelsestype
    guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let eventType = json["type"] as? String
    else { return }
    
    // Dekode basert på type
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
        default:
            print("Ukjent hendelsestype: \\(eventType)")
        }
    } catch {
        print("Feil ved dekoding av hendelse: \\(error)")
    }
}

private func handleProductEvent(_ event: ProductEvent) {
    DispatchQueue.main.async {
        // Vis produkt i UI
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
        // Vis avstemning i UI
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
        // Vis konkurranse i UI
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
    "description": "Siste modell med titan og 48MP kamera",
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
    "question": "Hva er din favoritt smarttelefon?",
    "options": [
      "iPhone",
      "Samsung",
      "Google Pixel",
      "Annet"
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
    "name": "Stor Tech-konkurranse 2024",
    "prize": "Vinn MacBook Pro M3, AirPods Pro og mer",
    "deadline": "2024-12-31",
    "maxParticipants": 1000
  },
  "campaignLogo": "https://images.unsplash.com/photo-1611162617474-5b21e879e113",
  "timestamp": 1703520000000
}`;

  const modelStructCode = `// Basismodell for WebSocket-hendelser
struct WebSocketEvent: Codable {
    let type: String
    let timestamp: Int64
    let campaignLogo: String?
    
    private enum CodingKeys: String, CodingKey {
        case type, timestamp, data, campaignLogo
    }
}

// Produkthendelse
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

// Avstemningshendelse
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

// Konkurransehendelse
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
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Swift-dokumentasjon</h1>
                <p className="text-sm text-muted-foreground">WebSocket-integrasjon for iOS</p>
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
                  Viser
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Introduksjon</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Denne dokumentasjonen vil guide deg til å integrere WebSocket-serveren med Swift/iOS-applikasjonen din. 
              Serveren sender sanntidshendelser for produkter, avstemninger og konkurranser.
            </p>
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-primary">Tilkoblingsinformasjon</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WebSocket URL:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protokoll:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">WebSocket</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">JSON</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
              <span>Koble til WebSocket</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Først, opprett en klasse for å håndtere WebSocket-tilkoblingen:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(swiftConnectionCode, 'Swift-tilkobling')}
                data-testid="button-copy-connection"
              >
                {copiedCode === 'Swift-tilkobling' ? '✓ Kopiert' : 'Kopier'}
              </Button>
              <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto code-block text-sm">
                <code className="text-green-400">{swiftConnectionCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Message Handling */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
              <span>Håndter meldinger</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Implementer håndtering av de forskjellige hendelsestypene:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(messageHandlingCode, 'meldingshåndtering')}
                data-testid="button-copy-handling"
              >
                {copiedCode === 'meldingshåndtering' ? '✓ Kopiert' : 'Kopier'}
              </Button>
              <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto code-block text-sm max-h-96">
                <code className="text-green-400">{messageHandlingCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Data Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
              <span>Datamodeller</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Definer datastrukturene for å håndtere hendelsene:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(modelStructCode, 'Swift-modeller')}
                data-testid="button-copy-models"
              >
                {copiedCode === 'Swift-modeller' ? '✓ Kopiert' : 'Kopier'}
              </Button>
              <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto code-block text-sm max-h-96">
                <code className="text-green-400">{modelStructCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* JSON Examples */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>Eksempler på JSON-payloads</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Product JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Produkt</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(productJSON, 'JSON produkt')}
                    data-testid="button-copy-product-json"
                  >
                    {copiedCode === 'JSON produkt' ? '✓' : 'Kopier'}
                  </Button>
                </div>
                <pre className="bg-background border border-border rounded-lg p-3 overflow-x-auto code-block text-xs">
                  <code className="text-green-400">{productJSON}</code>
                </pre>
              </div>

              {/* Poll JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary">Avstemning</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(pollJSON, 'JSON avstemning')}
                    data-testid="button-copy-poll-json"
                  >
                    {copiedCode === 'JSON avstemning' ? '✓' : 'Kopier'}
                  </Button>
                </div>
                <pre className="bg-background border border-border rounded-lg p-3 overflow-x-auto code-block text-xs">
                  <code className="text-green-400">{pollJSON}</code>
                </pre>
              </div>

              {/* Contest JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-500">Konkurranse</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(contestJSON, 'JSON konkurranse')}
                    data-testid="button-copy-contest-json"
                  >
                    {copiedCode === 'JSON konkurranse' ? '✓' : 'Kopier'}
                  </Button>
                </div>
                <pre className="bg-background border border-border rounded-lg p-3 overflow-x-auto code-block text-xs">
                  <code className="text-green-400">{contestJSON}</code>
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>Implementeringstips</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-primary">Beste praksis</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Implementer automatisk gjenoppretting ved tilkoblingstap</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Valider alltid mottatte JSON-data før behandling</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Oppdater UI i hovedtråden med DispatchQueue.main.async</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Vurder å bruke Combine for reaktiv hendelseshåndtering</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Implementer lokal cache for kritiske hendelser</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-amber-500">Ytelseshensyn</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Behandle meldinger i bakgrunnstråd for å ikke blokkere UI</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Implementer debouncing for svært hyppige hendelser</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Begrens antall hendelser i minnet for å unngå overforbruk</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-secondary">Feilhåndtering</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Fang og logg tilkoblings- og JSON-parsing-feil</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Implementer fallbacks for kritiske forretningshendelser</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Varsle brukeren ved tilkoblingsproblemer</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span>Hurtigstart</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                For å teste integrasjonen raskt:
              </p>
              
              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Trinn:</h4>
                <ol className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">1.</span>
                    <span>Kopier WebSocket-tilkoblingskoden til ditt Swift-prosjekt</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">2.</span>
                    <span>Implementer Codable-datamodellene</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">3.</span>
                    <span>Koble til serveren med oppgitt URL</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">4.</span>
                    <span>Gå til <Link href="/"><Button variant="link" className="p-0 h-auto" data-testid="link-admin-inline">administrasjonspanelet</Button></Link> og send testhendelser</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">5.</span>
                    <span>Bekreft at appen din mottar og behandler hendelser korrekt</span>
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
          <p>Trenger du hjelp? Sjekk <Link href="/"><Button variant="link" className="p-0 h-auto" data-testid="link-admin-footer">administrasjonspanelet</Button></Link> for å teste hendelser i sanntid.</p>
        </div>
      </div>
    </div>
  );
}
