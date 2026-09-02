'use client'

import { useState, useRef } from 'react'
import NextImage from 'next/image'
import ReactMarkdown from 'react-markdown'
import { generatePDF } from '@/utils/pdfGenerator'
import ChatPanel from '@/app/components/ChatPanel'

interface PatientData {
  name: string
  age: string
  sex: string
}

interface AnalysisResult {
  imageType: string
  result: string
  model: string
  imageData: string
  context: string
}

type AnalysisContext = 'clinica' | 'laboral' | 'forense'

const CONTEXT_INFO: Record<AnalysisContext, { label: string; color: string; description: string }> = {
  clinica: {
    label: 'Analizar para Clinica',
    color: 'bg-blue-500 hover:bg-blue-600 text-white',
    description: 'Enfoque en rasgos de personalidad, estabilidad emocional y autoimagen',
  },
  laboral: {
    label: 'Analizar para Laboral',
    color: 'bg-green-500 hover:bg-green-600 text-white',
    description: 'Enfoque en adaptabilidad, liderazgo, habilidades sociales y confiabilidad',
  },
  forense: {
    label: 'Analizar para Psicologia Forense',
    color: 'bg-red-600 hover:bg-red-700 text-white',
    description: 'Enfoque en impulsividad, agresion, signos de trauma y credibilidad',
  },
}

export default function Home() {
  const [patientData, setPatientData] = useState<PatientData>({
    name: '',
    age: '',
    sex: '',
  })
  const [image, setImage] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState<AnalysisContext | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handlePatientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setPatientData({ ...patientData, [e.target.name]: e.target.value })
  }

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxSize = 1280
          let width = img.width
          let height = img.height

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height * maxSize) / width
              width = maxSize
            } else {
              width = (width * maxSize) / height
              height = maxSize
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFileUpload = async (file: File) => {
    try {
      const dataUrl = await resizeImage(file)
      setImage(dataUrl)
      setResult(null)
    } catch {
      setError('Error al procesar la imagen')
    }
  }

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleFileUpload(file)
    }
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
      }
    } catch {
      setError('No se pudo acceder a la camara')
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      setImage(dataUrl)
      setResult(null)
      stopCamera()
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
    }
    setCameraActive(false)
  }

  const analyzeImage = async (context: AnalysisContext) => {
    if (!image) {
      setError('Primero carga o captura una imagen')
      return
    }

    if (!patientData.name || !patientData.age || !patientData.sex) {
      setError('Completa los datos del paciente primero')
      return
    }

    setLoading(context)
    setError(null)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: image,
          patientData,
          context,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error en el analisis')
      }

      setResult({ imageType: 'htp-complete', result: data.result, model: data.model, imageData: image, context })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(null)
    }
  }

  const generateReport = async () => {
    if (!result) {
      setError('No hay resultados para generar el reporte')
      return
    }
    await generatePDF(patientData, [result])
  }

  const inputBaseClass = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">HTP AI Analyst</h1>
          <p className="text-slate-600">Evaluacion Psicologica Casa-Arbol-Persona</p>
        </header>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">Instrucciones</h2>
          <p className="text-blue-700 text-sm leading-relaxed">
            Por favor, dibuje una Casa, un Arbol y una Persona en la hoja. Puede dibujarlos como desee y tomarse el tiempo que necesite. 
            Una vez terminado, tome una foto de la hoja completa y subala aqui.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Datos del Paciente</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  name="name"
                  value={patientData.name}
                  onChange={handlePatientChange}
                  className={inputBaseClass}
                  placeholder="Nombre del paciente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Edad</label>
                <input
                  type="number"
                  name="age"
                  value={patientData.age}
                  onChange={handlePatientChange}
                  className={inputBaseClass}
                  placeholder="Edad en anos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Sexo</label>
                <select
                  name="sex"
                  value={patientData.sex}
                  onChange={handlePatientChange}
                  className={inputBaseClass}
                >
                  <option value="">Seleccionar</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-slate-700 mb-4">Cargar Hoja Completa (Casa, Arbol y Persona)</h2>
              
              {image ? (
                <div className="space-y-4">
                  <div className="relative w-full h-80">
                    <NextImage src={image} alt="Hoja HTP" fill unoptimized className="object-contain rounded-lg border border-slate-200" />
                    <button
                      onClick={() => { setImage(null); setResult(null) }}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 text-lg font-bold shadow-lg z-10"
                    >
                      &times;
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(Object.keys(CONTEXT_INFO) as AnalysisContext[]).map((ctx) => (
                      <button
                        key={ctx}
                        onClick={() => analyzeImage(ctx)}
                        disabled={loading !== null}
                        className={`py-3 px-4 rounded-lg font-medium text-sm transition ${
                          loading === ctx
                            ? 'bg-yellow-100 text-yellow-700 cursor-wait'
                            : loading !== null
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : CONTEXT_INFO[ctx].color
                        }`}
                      >
                        {loading === ctx ? 'Analizando...' : CONTEXT_INFO[ctx].label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><span className="font-medium text-blue-600">Clinica:</span> {CONTEXT_INFO.clinica.description}</p>
                    <p><span className="font-medium text-green-600">Laboral:</span> {CONTEXT_INFO.laboral.description}</p>
                    <p><span className="font-medium text-red-600">Forense:</span> {CONTEXT_INFO.forense.description}</p>
                  </div>
                </div>
              ) : (
                <div className="border-3 border-dashed border-slate-300 rounded-xl p-8 text-center">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-slate-500 mb-6">Suba una imagen de la hoja completa con los tres dibujos</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                    >
                      Subir Archivo
                    </button>
                    <button
                      onClick={startCamera}
                      className="py-3 px-6 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition"
                    >
                      Usar Camara
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {cameraActive && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-4 max-w-lg w-full">
              <video ref={videoRef} className="w-full rounded-lg" autoPlay playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-2 mt-4">
                <button onClick={capturePhoto} className="flex-1 py-2 bg-green-500 text-white rounded-lg font-medium">
                  Capturar
                </button>
                <button onClick={stopCamera} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-slate-700">Resultados del Analisis HTP</h2>
              <button
                onClick={generateReport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Generar PDF
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg p-4">
              <div className="flex flex-col md:flex-row items-start gap-4">
                {result.imageData && (
                  <div className="relative w-full md:w-48 h-48 flex-shrink-0">
                    <NextImage src={result.imageData} alt="Hoja HTP" fill unoptimized className="object-contain rounded-lg border border-slate-100" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-semibold text-gray-900 m-0">Analisis Completo HTP</h3>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">{result.model}</span>
                    <span className={`text-xs px-2 py-1 rounded text-white ${
                      result.context === 'clinica' ? 'bg-blue-500' :
                      result.context === 'laboral' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {result.context === 'clinica' ? 'Clinica' : result.context === 'laboral' ? 'Laboral' : 'Forense'}
                    </span>
                  </div>
                  <div className="markdown-content text-gray-900">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2 border-b border-gray-200 pb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-semibold text-gray-800 mt-3 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="text-gray-800 mb-3 leading-relaxed">{children}</p>,
                        li: ({ children }) => <li className="text-gray-800 ml-4 mb-1">{children}</li>,
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-3 text-gray-800">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-4 mb-3 text-gray-800">{children}</ol>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-700">{children}</em>,
                        hr: () => <hr className="border-gray-300 my-4" />,
                      }}
                    >
                      {result.result}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <ChatPanel
            originalAnalysis={result.result}
            patientData={patientData}
            context={result.context}
            imageData={result.imageData}
          />
        )}
      </div>
    </main>
  )
}
