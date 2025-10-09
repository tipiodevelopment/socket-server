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
        title: "Copiado",
        description: `Código ${label} copiado al portapapeles`,
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "Error",
        description: "No se pudo copiar el código",
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
    guard let data = text.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let eventType = json["type"] as? String
    else { return }
    
    switch eventType {
    case "product":
        handleProductEvent(json)
    case "poll":
        handlePollEvent(json)
    case "contest":
        handleContestEvent(json)
    default:
        break
    }
}

private func handleProductEvent(_ json: [String: Any]) {
    guard let data = json["data"] as? [String: Any],
          let name = data["name"] as? String,
          let price = data["price"] as? String,
          let description = data["description"] as? String
    else { return }
    
    DispatchQueue.main.async {
        // Mostrar producto en la UI
        self.showProduct(name: name, price: price, description: description)
    }
}

private func handlePollEvent(_ json: [String: Any]) {
    guard let data = json["data"] as? [String: Any],
          let question = data["question"] as? String,
          let options = data["options"] as? [String],
          let duration = data["duration"] as? Int
    else { return }
    
    DispatchQueue.main.async {
        // Mostrar encuesta en la UI
        self.showPoll(question: question, options: options, duration: duration)
    }
}

private func handleContestEvent(_ json: [String: Any]) {
    guard let data = json["data"] as? [String: Any],
          let name = data["name"] as? String,
          let prize = data["prize"] as? String,
          let deadline = data["deadline"] as? String
    else { return }
    
    DispatchQueue.main.async {
        // Mostrar concurso en la UI
        self.showContest(name: name, prize: prize, deadline: deadline)
    }
}`;

  const productJSON = `{
  "type": "product",
  "data": {
    "id": "prod_123",
    "name": "iPhone 15 Pro Max",
    "description": "El último modelo con titanio y cámara de 48MP",
    "price": "$1,199",
    "currency": "USD",
    "imageUrl": "https://images.unsplash.com/photo-1592286927505-b7e00a46f74f"
  },
  "timestamp": 1703520000000
}`;

  const pollJSON = `{
  "type": "poll",
  "data": {
    "id": "poll_456",
    "question": "¿Cuál es tu smartphone favorito?",
    "options": [
      "iPhone",
      "Samsung",
      "Google Pixel",
      "Otro"
    ],
    "duration": 60
  },
  "timestamp": 1703520000000
}`;

  const contestJSON = `{
  "type": "contest",
  "data": {
    "id": "contest_789",
    "name": "Gran Sorteo Tech 2024",
    "prize": "Gana un MacBook Pro M3, AirPods Pro y más",
    "deadline": "2024-12-31",
    "maxParticipants": 1000
  },
  "timestamp": 1703520000000
}`;

  const modelStructCode = `struct WebSocketEvent: Codable {
    let type: String
    let timestamp: Int64
    let data: EventData
}

enum EventData: Codable {
    case product(ProductData)
    case poll(PollData)
    case contest(ContestData)
    
    enum CodingKeys: String, CodingKey {
        case type
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        
        switch type {
        case "product":
            self = .product(try ProductData(from: decoder))
        case "poll":
            self = .poll(try PollData(from: decoder))
        case "contest":
            self = .contest(try ContestData(from: decoder))
        default:
            throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Unknown event type"))
        }
    }
}

struct ProductData: Codable {
    let id: String
    let name: String
    let description: String
    let price: String
    let currency: String
    let imageUrl: String
}

struct PollData: Codable {
    let id: String
    let question: String
    let options: [String]
    let duration: Int
}

struct ContestData: Codable {
    let id: String
    let name: String
    let prize: String
    let deadline: String
    let maxParticipants: Int
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
                <h1 className="text-xl font-bold text-foreground">Documentación Swift</h1>
                <p className="text-sm text-muted-foreground">Integración WebSocket para iOS</p>
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
                  Visor
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
              <span>Introducción</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Esta documentación te guiará para integrar el servidor WebSocket con tu aplicación Swift/iOS. 
              El servidor envía eventos en tiempo real para productos, encuestas y concursos.
            </p>
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-primary">Información de Conexión</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WebSocket URL:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">
                    {`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protocolo:</span>
                  <code className="font-mono bg-background px-2 py-1 rounded">WebSocket</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Formato:</span>
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
              <span>Conectar al WebSocket</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Primero, crea una clase para manejar la conexión WebSocket:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(swiftConnectionCode, 'conexión Swift')}
                data-testid="button-copy-connection"
              >
                {copiedCode === 'conexión Swift' ? '✓ Copiado' : 'Copiar'}
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
              <span>Manejar Mensajes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Implementa el manejo de los diferentes tipos de eventos:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(messageHandlingCode, 'manejo de mensajes')}
                data-testid="button-copy-handling"
              >
                {copiedCode === 'manejo de mensajes' ? '✓ Copiado' : 'Copiar'}
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
              <span>Modelos de Datos</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Define las estructuras de datos para manejar los eventos:
            </p>
            
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="absolute right-2 top-2 z-10"
                onClick={() => copyToClipboard(modelStructCode, 'modelos Swift')}
                data-testid="button-copy-models"
              >
                {copiedCode === 'modelos Swift' ? '✓ Copiado' : 'Copiar'}
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
              <span>Ejemplos de Payloads JSON</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Product JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-primary">Producto</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(productJSON, 'JSON producto')}
                    data-testid="button-copy-product-json"
                  >
                    {copiedCode === 'JSON producto' ? '✓' : 'Copiar'}
                  </Button>
                </div>
                <pre className="bg-background border border-border rounded-lg p-3 overflow-x-auto code-block text-xs">
                  <code className="text-green-400">{productJSON}</code>
                </pre>
              </div>

              {/* Poll JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary">Encuesta</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(pollJSON, 'JSON encuesta')}
                    data-testid="button-copy-poll-json"
                  >
                    {copiedCode === 'JSON encuesta' ? '✓' : 'Copiar'}
                  </Button>
                </div>
                <pre className="bg-background border border-border rounded-lg p-3 overflow-x-auto code-block text-xs">
                  <code className="text-green-400">{pollJSON}</code>
                </pre>
              </div>

              {/* Contest JSON */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-amber-500">Concurso</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(contestJSON, 'JSON concurso')}
                    data-testid="button-copy-contest-json"
                  >
                    {copiedCode === 'JSON concurso' ? '✓' : 'Copiar'}
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
              <span>Tips de Implementación</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-primary">Buenas Prácticas</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Implementa reconexión automática en caso de pérdida de conexión</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Valida siempre los datos JSON recibidos antes de procesarlos</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Actualiza la UI en el hilo principal usando DispatchQueue.main.async</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Considera usar Combine para manejar eventos de forma reactiva</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Implementa caché local para eventos críticos</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-amber-500">Consideraciones de Rendimiento</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Procesa mensajes en un hilo de fondo para no bloquear la UI</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Implementa debouncing para eventos muy frecuentes</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-amber-500 mt-1">•</span>
                    <span>Limita el número de eventos en memoria para evitar uso excesivo</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-secondary">Manejo de Errores</h4>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Captura y logea errores de conexión y parsing JSON</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Implementa fallbacks para eventos críticos del negocio</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-secondary mt-1">•</span>
                    <span>Notifica al usuario cuando hay problemas de conectividad</span>
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
              <span>Inicio Rápido</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Para probar la integración rápidamente:
              </p>
              
              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Pasos:</h4>
                <ol className="text-sm space-y-2 text-muted-foreground">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">1.</span>
                    <span>Copia el código de conexión WebSocket a tu proyecto Swift</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">2.</span>
                    <span>Implementa los modelos de datos Codable</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">3.</span>
                    <span>Conecta al servidor usando la URL proporcionada</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">4.</span>
                    <span>Ve al <Link href="/"><Button variant="link" className="p-0 h-auto" data-testid="link-admin-inline">panel de administración</Button></Link> y envía eventos de prueba</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold text-primary">5.</span>
                    <span>Verifica que tu app recibe y procesa los eventos correctamente</span>
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
