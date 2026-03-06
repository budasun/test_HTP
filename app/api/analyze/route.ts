import { NextRequest, NextResponse } from 'next/server'
import htpKnowledgeBase from '@/data/htp_knowledge_base.json'

const MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
]

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const TIMEOUT_MS = 15000

type AnalysisContext = 'clinica' | 'laboral' | 'forense'

const KNOWLEDGE_BASE_SECTION = `
## BASE DE CONOCIMIENTO CLINICO HTP (ESTRICTO)

A continuacion se presenta el manual de interpretacion HTP que DEBES utilizar como fuente principal de verdad. Utiliza estas reglas definidas para analizar los elementos visuales. Si detectas un rasgo (ej. "Trazo Debil"), busca su significado en esta base y usalo en tu explicacion.

### INFORMACION GENERAL
${JSON.stringify(htpKnowledgeBase.Test_HTP_IA_Config.Informacion_General, null, 2)}

### PAUTAS FORMALES
${JSON.stringify(htpKnowledgeBase.Test_HTP_IA_Config.Pautas_Formales, null, 2)}

### INTERPRETACION DEL CONTENIDO
${JSON.stringify(htpKnowledgeBase.Test_HTP_IA_Config.Interpretacion_Contenido, null, 2)}

### PATOLOGIAS Y PERSONALIDAD
${JSON.stringify(htpKnowledgeBase.Test_HTP_IA_Config.Patologias_y_Personalidad, null, 2)}

### SIMBOLOGIA DE COLOR
${JSON.stringify(htpKnowledgeBase.Test_HTP_IA_Config.Simbologia_Color, null, 2)}

### NOTAS CRITICAS PARA LA IMPLEMENTACION
${JSON.stringify(htpKnowledgeBase.Test_HTP_IA_Config.Notas_Implementacion, null, 2)}
`

const CONTEXT_PROMPTS: Record<AnalysisContext, string> = {
  clinica: `Eres un psicologo clinico experto en la interpretacion del test proyectivo HTP (Casa-Arbol-Persona).

Tu enfoque debe ser CLINICO, centrado en:
- **Rasgos de personalidad**: Identificar patrones de comportamiento y caracteristicas predominantes
- **Estabilidad emocional**: Evaluar el equilibrio afectivo y posibles desequilibrios
- **Autoimagen y autoestima**: Analisis del concepto de si mismo
- **Relaciones interpersonales**: Patrones de vinculacion y adaptacion social
- **Posibles conflictos internos**: Tensiones, ansiedades y mecanismos de defensa
- **Indicadores de bienestar/malestar psicologico**

Proporciona recomendaciones terapeuticas cuando sea apropiado.`,

  laboral: `Eres un psicologo organizacional experto en evaluacion de personal mediante el test HTP (Casa-Arbol-Persona).

Tu enfoque debe ser LABORAL/ORGANIZACIONAL, centrado en:
- **Adaptabilidad al cambio**: Capacidad de ajustarse a nuevos entornos y situaciones
- **Liderazgo y toma de decisiones**: Iniciativa, responsabilidad y habilidades directivas
- **Habilidades sociales y trabajo en equipo**: Cooperacion, comunicacion y relacion con colegas
- **Confiabilidad y responsabilidad**: Compromiso, puntualidad y seguimiento de normas
- **Manejo del estres**: Resiliencia frente a presiones laborales
- **Creatividad y resolucion de problemas**: Enfoque innovador y pensamiento practico
- **Motivacion y orientacion a metas**: Nivel de energia y pursuit de objetivos

Proporciona una evaluacion de idoneidad para el entorno laboral.`,

  forense: `Eres un psicologo forense experto en la interpretacion del test HTP (Casa-Arbol-Persona) para contextos legales y criminologicos.

Tu enfoque debe ser FORENSE, centrado en:
- **Impulsividad y control de impulsos**: Capacidad de autocontrol y regulacion conductual
- **Indicadores de agresividad**: Senales de hostilidad, irritabilidad o potencial violento
- **Senales de trauma**: Evidencia de experiencias traumaticas o abuso
- **Credibilidad y veracidad**: Coherencia en la expresion y posibles indicadores de disimulacion
- **Riesgo de conducta antisocial**: Patrones que sugieran desapego a normas sociales
- **Estructura de personalidad**: Organizacion psiquica y posibles trastornos
- **Capacidad de insight**: Nivel de conciencia sobre si mismo y la situacion

Manten un tono objetivo y basado en evidencia. Indica limitaciones del analisis cuando sea pertinente.`,
}

function getAgeCategory(age: number): string {
  if (age < 12) return 'nino'
  if (age < 18) return 'adolescente'
  return 'adulto'
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

async function analyzeWithModel(
  model: string,
  imageData: string,
  patientData: { name: string; age: string; sex: string },
  context: AnalysisContext
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error('API Key no configurada')
  }

  const contextPrompt = CONTEXT_PROMPTS[context]
  const ageNum = parseInt(patientData.age) || 25
  const ageCategory = getAgeCategory(ageNum)

  const prompt = `${contextPrompt}

${KNOWLEDGE_BASE_SECTION}

---

## INSTRUCCIONES DE ANALISIS

**DATOS DEL PACIENTE:**
- Nombre: ${patientData.name}
- Edad: ${patientData.age} anos (Categoria: ${ageCategory})
- Sexo: ${patientData.sex}

**IMPORTANTE - FILTRO DE EDAD:**
El paciente tiene ${ageNum} anos. Segun las "Notas de Implementacion" de la base de conocimiento:
${ageCategory === 'nino' ? '- Las transparencias y omisiones son NORMALES en ninos pequenos. NO interpretar como patologia.' : ''}
${ageCategory === 'adolescente' ? '- Mayor variabilidad en la expresion grafica es esperable. Considerar conflicto de identidad como normal.' : ''}
${ageCategory === 'adulto' ? '- Las transparencias, omisiones de partes corporales y desproporciones severas SI son indicadores patologicos.' : ''}

**IMAGEN A ANALIZAR:**
El usuario ha subido una UNICA imagen que contiene los tres elementos del test HTP: una Casa, un Arbol y una Persona dibujados en la misma hoja.

**METODOLOGIA DE ANALISIS (OBLIGATORIA):**

1. **PRIORIDAD GESTALTICA**: Primero describe la impresion global (gestalt) del dibujo completo. La primera impresion es clinicamente relevante.

2. **DETECCION DE RECURRENCIAS**: Si observas el mismo patron en Casa, Arbol y Persona (ej. trazos debiles en los 3, ubicacion inferior en los 3, tamano pequeno en los 3), DEBES marcarlo como un rasgo de personalidad consolidado y consistente.

3. **INTEGRACION INTERPRETATIVA**: Los indicadores NO deben interpretarse de forma aislada. Busca convergencia de multiples senales antes de establecer una interpretacion.

4. **USO DE LA BASE DE CONOCIMIENTO**: Cuando identifiques un rasgo visual (ej. "techo grande", "tronco delgado", "brazos omitidos"), BUSCA su significado en la Base de Conocimiento Clinico y cita el significado tal cual aparece, con sus referencias [x, y].

---

## ESTRUCTURA DEL INFORME (SIGUE ESTE FORMATO)

### IMPRESION GLOBAL (GESTALT)
[Describe la primera impresion del dibujo completo: armonia, tension, organizacion, etc.]

---

### ANALISIS DE LA CASA

**Simbolismo**: La Casa simboliza la situacion familiar y la vida hogarena.

**Caracteristicas formales observadas**:
- [Tamano y ubicacion en la hoja - interpreta segun Pautas_Formales]
- [Calidad del trazo y presion - interpreta segun Trazo_y_Presion]
- [Elementos especificos: techo, paredes, puerta, complementos]

**Interpretacion clinica**:
[Usa la Base de Conocimiento para interpretar cada elemento observado]

---

### ANALISIS DEL ARBOL

**Simbolismo**: El Arbol representa lo mas profundo, primitivo e inconsciente de la personalidad.

**Caracteristicas formales observadas**:
- [Tipo de arbol si es identificable]
- [Tronco: grosor, agujeros, marcas - interpreta segun El_Arbol.Tronco]
- [Copa: tamano, sombreado, forma]
- [Ramas: direccion, forma, estado]
- [Raices: presencia, forma]

**Interpretacion clinica**:
[Usa la Base de Conocimiento para interpretar cada elemento observado]

---

### ANALISIS DE LA PERSONA

**Simbolismo**: La Persona refleja la autoimagen, el autoconcepto y el ideal del YO.

**Caracteristicas formales observadas**:
- [Tamano y ubicacion]
- [Cabeza: proporcion, detalles]
- [Cuello: proporcion o omision]
- [Brazos y manos: posicion, detalles, omisiones]
- [Piernas y pies: proporcion, posicion]
- [Ropa y accesorios]

**Interpretacion clinica**:
[Usa la Base de Conocimiento para interpretar cada elemento observado]

---

### PATRONES RECURRENTES DETECTADOS

[Si encontraste el mismo patron en los 3 dibujos, describelo aqui y explica su significado como rasgo consolidado de personalidad]

---

### INDICADORES DE PERSONALIDAD

[Segun Patologias_y_Personalidad, indica si observas senales de:]
- Personalidad Obsesiva
- Personalidad Depresiva  
- Personalidad Paranoide
- Indicadores Psicoticos
- Indicadores Neuroticos

---

### CONCLUSION GENERAL

**Sintesis del perfil**: [Integracion de los hallazgos]

**Fortalezas observadas**: [Aspectos positivos identificados]

**Areas de atencion**: [Aspectos que merecen atencion o seguimiento]

**Recomendaciones para el evaluador**: [Sugerencias especificas segun el contexto ${context}]

---

**NOTA FINAL**: Este analisis se basa en el Manual de Interpretacion H.T.P. (IA) y debe ser validado por un profesional de la psicologia clinica. Los indicadores aislados no constituyen diagnostico; la interpretacion requiere convergencia de multiples senales y consideracion del contexto del paciente.`

  const isVisionModel = model.includes('vision') || model.includes('llama-4-scout') || model.includes('llama-4')
  const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = []

  if (isVisionModel && imageData) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: imageData } },
      ],
    })
  } else {
    messages.push({
      role: 'user',
      content: `${prompt}\n\nNota: Este modelo no procesa imagenes. Proporciona una interpretacion general basada en los datos del paciente para un test HTP en contexto ${context}.`,
    })
  }

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
    const { imageData, patientData, context = 'clinica' } = body

    if (!imageData || !patientData) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    const validContexts: AnalysisContext[] = ['clinica', 'laboral', 'forense']
    const analysisContext: AnalysisContext = validContexts.includes(context) ? context : 'clinica'

    for (const model of MODELS) {
      try {
        console.log(`Intentando con modelo: ${model} | Contexto: ${analysisContext} | Paciente: ${patientData.name}`)
        const result = await analyzeWithModel(model, imageData, patientData, analysisContext)
        console.log(`Exito con modelo: ${model}`)
        return NextResponse.json({ result, model, context: analysisContext })
      } catch (error) {
        console.error(`Error con modelo ${model}:`, error)
        continue
      }
    }

    return NextResponse.json(
      { error: 'El servicio de IA esta saturado, por favor intenta en un momento.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Error general:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
