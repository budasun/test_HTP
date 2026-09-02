'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { generateIntegratedPDF } from '@/utils/pdfGenerator'

interface PatientData {
  name: string
  age: string
  sex: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatPanelProps {
  originalAnalysis: string
  patientData: PatientData
  context: string
  imageData?: string
}

export default function ChatPanel({ originalAnalysis, patientData, context, imageData }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const sendMessage = async () => {
    const trimmedMessage = inputValue.trim()
    if (!trimmedMessage || isLoading) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const chatHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmedMessage,
          originalAnalysis,
          chatHistory,
          context,
          patientData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener respuesta')
      }

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleDownloadPDF = async () => {
    const refinements = messages
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.content)

    const lastAssistantMessage = messages
      .filter(msg => msg.role === 'assistant')
      .pop()?.content || originalAnalysis

    await generateIntegratedPDF(
      patientData,
      originalAnalysis,
      refinements,
      context,
      lastAssistantMessage,
      imageData
    )
  }

  const contextLabel = context === 'clinica' ? 'Clinica' :
                       context === 'laboral' ? 'Laboral' : 'Forense'

  if (!isOpen) {
    return (
      <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="font-semibold text-slate-700">Chat de Seguimiento</h3>
              <p className="text-sm text-slate-500">
                Contexto: {contextLabel} • {messages.length} mensajes
              </p>
            </div>
          </div>
          <span className="text-slate-400">▼</span>
        </button>
      </div>
    )
  }

  return (
    <div className="mt-6 bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-slate-700 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">💬</span>
          <div>
            <h3 className="font-semibold">Chat de Seguimiento</h3>
            <p className="text-sm text-slate-300">
              Contexto: {contextLabel} - Refina el analisis con informacion adicional
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={messages.length === 0}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
          >
            PDF Version Final
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-slate-600 rounded-lg transition"
          >
            ▲
          </button>
        </div>
      </div>

      <div className="h-96 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <p className="mb-2"><strong>Sugerencias para refinar el analisis:</strong></p>
            <ul className="text-sm space-y-1 text-left inline-block">
              <li>- &quot;Las manos si estan dibujadas en la imagen&quot;</li>
              <li>- &quot;El paciente tiene antecedentes de ansiedad&quot;</li>
              <li>- &quot;El dibujo fue realizado en contexto escolar&quot;</li>
              <li>- &quot;Observe que el trazo es mas fuerte en la casa&quot;</li>
            </ul>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="markdown-content text-sm">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{msg.content}</p>
              )}
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm text-slate-500">Analizando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ej: Las manos si estan presentes en el dibujo..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 disabled:bg-slate-100"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Presiona Enter para enviar. La IA refinara el analisis con tu informacion.
        </p>
      </div>
    </div>
  )
}
