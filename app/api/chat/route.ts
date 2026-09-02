import { NextRequest, NextResponse } from 'next/server'

const MODELS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
]

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const TIMEOUT_MS = 15000

type AnalysisContext = 'clinica' | 'laboral' | 'forense'

const CONTEXT_INSTRUCTIONS: Record<AnalysisContext, string> = {
  clinica: `Eres un psicólogo clínico experto en HTP. Estás refinando un análisis clínico previo. 
    Enfócate en: rasgos de personalidad, estabilidad emocional, autoimagen, relaciones interpersonales y conflictos internos.
    Cuando el usuario proporcione información adicional, ACTUALIZA tu análisis integrando esos datos de forma profesional.`,
  
  laboral: `Eres un psicólogo organizacional experto en HTP. Estás refinando un análisis laboral previo.
    Enfócate en: adaptabilidad, liderazgo, habilidades sociales, confiabilidad y manejo del estrés.
    Cuando el usuario proporcione información adicional, ACTUALIZA tu análisis integrando esos datos de forma profesional.`,
  
  forense: `Eres un psicólogo forense experto en HTP. Estás refinando un análisis forense previo.
    Enfócate en: impulsividad, agresividad, trauma, credibilidad, conducta antisocial y estructura de personalidad.
    Cuando el usuario proporcione información adicional, ACTUALIZA tu análisis integrando esos datos de forma profesional. Mantén tono objetivo y basado en evidencia.`
}

function buildChatPrompt(
  originalAnalysis: string,
  chatHistory: Array<{ role: string; content: string }>,
  context: AnalysisContext
): string {
  const contextInstructions = CONTEXT_INSTRUCTIONS[context]
  
  const historyText = chatHistory
    .map(msg => `${msg.role === 'user' ? 'Usuario' : 'Tú'}: ${msg.content}`)
    .join('\n')

  return `IMPORTANTE: Responde COMPLETAMENTE en español. NO uses inglés en ninguna parte de tu respuesta.

${contextInstructions}

---

## ANÁLISIS ORIGINAL HTP (CONTEXTO)

${originalAnalysis}

---

## HISTORIAL DE LA CONVERSACIÓN

${historyText || '(Inicio de conversación)'}

---

## INSTRUCCIONES PARA ESTA RESPUESTA

1. **Mantén el contexto**: Estás continuando un análisis HTP ya realizado
2. **Integra información**: Si el usuario proporciona datos que corregen o amplían el análisis, INTEGRALOS profesionalmente
3. **Refina hallazgos**: Puedes matizar o ajustar interpretaciones previas con la nueva información
4. **Formato de respuesta**: 
   - Primero reconoce la aportación del usuario
   - Luego proporciona el ANÁLISIS ACTUALIZADO completo (no solo los cambios)
   - Marca con **[ACTUALIZADO]** las secciones que cambiaron significativamente

5. **Estructura del análisis actualizado**:
   - IMPRESION GLOBAL
   - ANÁLISIS DE LA CASA
   - ANÁLISIS DEL ÁRBOL  
   - ANÁLISIS DE LA PERSONA
   - PATRONES RECURRENTES
   - INDICADORES DE PERSONALIDAD
   - CONCLUSIÓN GENERAL

Responde ahora:`
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

async function chatWithModel(
  model: string,
  prompt: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('API Key no configurada')
  }

  const messages = [
    {
      role: 'user',
      content: prompt,
    }
  ]

  const response = await fetchWithTimeout(
    GROQ_API_URL,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 5000,
        temperature: 0.5,
        reasoning_effort: 'none',
      }),
    },
    TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Error del modelo ${model}: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || 'Sin respuesta del modelo'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, originalAnalysis, chatHistory = [], context = 'clinica', patientData } = body

    if (!message || !originalAnalysis) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (message, originalAnalysis)' },
        { status: 400 }
      )
    }

    const validContexts: AnalysisContext[] = ['clinica', 'laboral', 'forense']
    const analysisContext: AnalysisContext = validContexts.includes(context) ? context : 'clinica'

    const prompt = buildChatPrompt(originalAnalysis, chatHistory, analysisContext)

    let lastError: Error | null = null

    for (const model of MODELS) {
      try {
        console.log(`Chat - Intentando con modelo: ${model} | Contexto: ${analysisContext}`)
        
        const fullPrompt = `${prompt}\n\n---\n\n## MENSAJE DEL USUARIO\n\n${message}`
        const response = await chatWithModel(model, fullPrompt)
        
        console.log(`Chat - Éxito con modelo: ${model}`)
        return NextResponse.json({ 
          response, 
          model, 
          context: analysisContext 
        })
      } catch (error) {
        console.error(`Chat - Error con modelo ${model}:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        continue
      }
    }

    return NextResponse.json(
      { error: 'El servicio de IA está saturado, por favor intenta en un momento.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Chat - Error general:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
