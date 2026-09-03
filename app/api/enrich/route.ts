import { NextRequest, NextResponse } from 'next/server'
import enrichmentData from '@/data/htp_enrichment.json'

const MODELS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
]

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const TIMEOUT_MS = 20000

const ENRICHMENT_PROMPT = `Eres un experto en psicologia proyectiva especializado en la tecnica HTP (Casa-Arbol-Persona). Tu tarea es ENRIQUECER el siguiente analisis HTP integrando criterios bibliograficos reales de autores reconocidos.

BASE BIBLIOGRAFICA DISPONIBLE (SOLO PUEDES CITAR ESTOS AUTORES Y OBRAS):

1. Buck, J. N. (1948). The House-Tree-Person Technique. Western Psychological Services.
2. Buck, J. N. (1966). House-Tree-Person Technique: Revised Manual. Western Psychological Services.
3. Jolles, I. L. (1964). A Catalogue for the Qualitative Interpretation of the H-T-P. Western Psychological Services.
4. Machover, K. (1949). Personality Projection in the Drawing of the Human Figure. Charles C Thomas Publisher.
5. Burns, R. C. (1982). Kinetic-House-Tree-Person Drawings (K-H-T-P). Brunner/Mazel.
6. Hammer, E. F. (1954). The Clinical Application of Projective Drawings. Charles C Thomas Publisher.
7. Hammer, E. F. (1958). Projective Drawings. American Psychological Association.
8. Koppitz, E. M. (1968). Psychological Evaluation of Children's Human Figure Drawings. Grune & Stratton.
9. Hartman, C. (1965). Handbook of Projective Techniques. Basic Books.

CRITERIOS ESPECIFICOS POR AUTOR:

${JSON.stringify(enrichmentData.bibliografia, null, 2)}

REGLAS ESTRICTAS:
1. SOLO cites autores y obras que aparezcan en la base bibliografica de arriba
2. Formato de cita: (Autor, Ano, p.XX) o (Autor, Ano, Cap. X)
3. NO inventes referencias que no esten en la base
4. NO inventes paginas o capitulos que no existan
5. Integra las citas de forma natural en el texto
6. Si un elemento del dibujo NO tiene correspondencia en la base, NO lo cites
7. Prioriza las fuentes primarias (Buck, Jolles, Machover, Burns) sobre las secundarias

FORMATO DE SALIDA:
- Responde COMPLETAMENTE en espanol
- Estructura el texto con headers claros
- Al final, incluye una seccion "REFERENCIAS UTILIZADAS" con las obras que citaste
- NO uses "--- PAGE ---" ni separadores prohibidos

ANALISIS ACTUAL A ENRIQUECER:
`

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

async function enrichWithModel(model: string, prompt: string): Promise<string> {
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
        max_tokens: 6000,
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
    const { originalAnalysis, context = 'clinica', patientData } = body

    if (!originalAnalysis) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos (originalAnalysis)' },
        { status: 400 }
      )
    }

    const prompt = `${ENRICHMENT_PROMPT}\n${originalAnalysis}`

    let lastError: Error | null = null

    for (const model of MODELS) {
      try {
        console.log(`Enrich - Intentando con modelo: ${model}`)
        const response = await enrichWithModel(model, prompt)
        console.log(`Enrich - Exito con modelo: ${model}`)
        return NextResponse.json({ response, model, context })
      } catch (error) {
        console.error(`Enrich - Error con modelo ${model}:`, error)
        lastError = error instanceof Error ? error : new Error(String(error))
        continue
      }
    }

    return NextResponse.json(
      { error: 'El servicio de IA esta saturado, por favor intenta en un momento.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Enrich - Error general:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
