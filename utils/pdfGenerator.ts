'use client'

import jsPDF from 'jspdf'

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
  context?: string
}

interface TextSegment {
  text: string
  style: 'normal' | 'bold' | 'italic' | 'heading1' | 'heading2' | 'heading3' | 'bullet'
}

/**
 * PARSER DE TEXTO:
 * Une líneas huérfanas, limpia ruido de IA y detecta estilos Markdown.
 */
function parseMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const cleanedText = text
    .replace(/---?\s*PAGE\s*\d+\s*---?/gi, '')
    .replace(/\[PAGE\s*\d+\]/gi, '')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\[ACTUALIZADO\]/gi, '')
    .replace(/\[Actualizado\]/gi, '')
    .replace(/\[ACTUALIZADO\s*:\s*\]/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  const lines = cleanedText.split('\n')
  let paragraphBuffer = ""

  const flushBuffer = () => {
    let content = paragraphBuffer.trim()
    if (content) {
      content = content.replace(/\s+:/g, ':')
      content = content.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      const parts = content.split(/(\*\*.*?\*\*)/g)
      for (const part of parts) {
        if (part.startsWith('**') && part.endsWith('**')) {
          segments.push({ text: part.slice(2, -2), style: 'bold' })
        } else if (part.length > 0) {
          segments.push({ text: part, style: 'normal' })
        }
      }
      segments.push({ text: '\n', style: 'normal' })
      paragraphBuffer = ""
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') { flushBuffer(); continue }

    if (trimmed.startsWith('#')) {
      flushBuffer()
      if (trimmed.startsWith('### ')) segments.push({ text: trimmed.substring(4).replace(/\*{1,2}/g, ''), style: 'heading3' })
      else if (trimmed.startsWith('## ')) segments.push({ text: trimmed.substring(3).replace(/\*{1,2}/g, ''), style: 'heading2' })
      else segments.push({ text: trimmed.substring(2).replace(/\*{1,2}/g, ''), style: 'heading1' })
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      flushBuffer()
      segments.push({ text: trimmed.replace(/^[-*]\s|^\d+\.\s/, '').replace(/\*{1,2}/g, ''), style: 'bullet' })
    } else {
      paragraphBuffer += (paragraphBuffer ? " " : "") + trimmed
    }
  }
  flushBuffer()
  return segments
}

/**
 * GENERADOR ÚNICO DE PDF:
 * Optimizado para lectura en pantallas móviles y monitores de PC.
 */
export async function generatePDF(patientData: PatientData, results: AnalysisResult[]): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  const checkPage = (h: number) => {
    if (yPosition + h > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // --- ENCABEZADO PROFESIONAL ---
  pdf.setFontSize(18).setFont('helvetica', 'bold')
  pdf.setTextColor(40, 40, 40)
  pdf.text('REPORTE DE EVALUACIÓN PSICOMÉTRICA HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Bloque de datos del paciente
  pdf.setFillColor(245, 245, 245)
  pdf.rect(margin, yPosition, pageWidth - (margin * 2), 22, 'F')

  pdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0)
  pdf.text(`PACIENTE: ${patientData.name.toUpperCase()}`, margin + 5, yPosition + 7)
  pdf.text(`FECHA: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin - 45, yPosition + 7)

  pdf.setFont('helvetica', 'normal')
  pdf.text(`Edad: ${patientData.age} años | Sexo: ${patientData.sex}`, margin + 5, yPosition + 14)
  yPosition += 30

  // --- RENDERIZADO DE RESULTADOS ---
  for (const item of results) {
    checkPage(20)

    // Título de la sección (Casa, Árbol, Persona o Integral)
    pdf.setFontSize(14).setFont('helvetica', 'bold').setTextColor(0, 51, 102) // Azul oscuro clínico
    pdf.text(item.imageType.toUpperCase().replace(/-/g, ' '), margin, yPosition)
    yPosition += 8

    // Imagen del dibujo
    if (item.imageData) {
      const imgW = 100
      const imgH = 75
      checkPage(imgH + 10)
      try {
        pdf.addImage(item.imageData, 'JPEG', (pageWidth - imgW) / 2, yPosition, imgW, imgH)
        yPosition += imgH + 12
      } catch (e) {
        console.warn("No se pudo cargar la imagen en el PDF", e)
      }
    }

    const segments = parseMarkdown(item.result)
    const maxWidth = pageWidth - (margin * 2)
    let currentX = margin

    pdf.setTextColor(0) // Reset a negro para el texto

    for (const seg of segments) {
      if (seg.text === '\n') {
        yPosition += 6
        currentX = margin
        continue
      }

      // Configuración de fuentes según estilo
      let fontStyle = 'normal'
      let fontSize = 10
      if (seg.style === 'bold') fontStyle = 'bold'
      if (seg.style.includes('heading')) {
        fontStyle = 'bold'
        fontSize = seg.style === 'heading1' ? 13 : 11
      }

      pdf.setFont('helvetica', fontStyle).setFontSize(fontSize)

      if (seg.style === 'bullet') {
        const bLines = pdf.splitTextToSize("• " + seg.text, maxWidth - 8)
        for (const bl of bLines) {
          checkPage(6)
          pdf.text(bl, margin + 8, yPosition)
          yPosition += 5.8
        }
        currentX = margin
      } else {
        // Renderizado palabra por palabra para evitar saltos tras los ":"
        const words = seg.text.split(/(\s+)/)
        for (const word of words) {
          const wordWidth = pdf.getTextWidth(word)
          if (currentX + wordWidth > pageWidth - margin && word.trim() !== "") {
            yPosition += 5.8
            currentX = margin
            checkPage(6)
          }
          pdf.text(word, currentX, yPosition)
          currentX += wordWidth
        }
      }
    }
    yPosition += 10 // Espacio entre secciones
  }

  // --- PIE DE PÁGINA ---
  pdf.setFontSize(8).setFont('helvetica', 'italic').setTextColor(120)
  const footerNote = "Nota: Este reporte es una hipótesis diagnóstica generada por IA y debe ser validada por un psicólogo colegiado."
  pdf.text(footerNote, pageWidth / 2, pageHeight - 10, { align: 'center' })

  // Guardar archivo
  const safeName = patientData.name.replace(/\s+/g, '_')
  pdf.save(`HTP_Reporte_${safeName}.pdf`)
}

/**
 * GENERADOR DE PDF INTEGRADO:
 * Incluye imagen + análisis original + observaciones del chat + versión final integrada.
 */
export async function generateIntegratedPDF(
  patientData: PatientData,
  originalAnalysis: string,
  refinements: string[],
  context: string,
  finalAnalysis: string,
  imageData?: string
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  const checkPage = (h: number) => {
    if (yPosition + h > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  const contextLabel = context === 'clinica' ? 'CLINICA' :
                       context === 'laboral' ? 'LABORAL' : 'FORENSE'

  // --- ENCABEZADO PROFESIONAL ---
  pdf.setFontSize(18).setFont('helvetica', 'bold')
  pdf.setTextColor(40, 40, 40)
  pdf.text('REPORTE DE EVALUACION PSICOMETRICA HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 8

  pdf.setFontSize(12).setFont('helvetica', 'normal')
  pdf.setTextColor(80, 80, 80)
  pdf.text(`Version Integrada - Contexto ${contextLabel}`, pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 12

  // Bloque de datos del paciente
  pdf.setFillColor(245, 245, 245)
  pdf.rect(margin, yPosition, pageWidth - (margin * 2), 22, 'F')

  pdf.setFontSize(10).setFont('helvetica', 'bold').setTextColor(0)
  pdf.text(`PACIENTE: ${patientData.name.toUpperCase()}`, margin + 5, yPosition + 7)
  pdf.text(`FECHA: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin - 45, yPosition + 7)

  pdf.setFont('helvetica', 'normal')
  pdf.text(`Edad: ${patientData.age} anos | Sexo: ${patientData.sex}`, margin + 5, yPosition + 14)
  yPosition += 30

  // --- IMAGEN DEL DIBUJO ---
  if (imageData) {
    const imgW = 100
    const imgH = 75
    checkPage(imgH + 10)
    try {
      pdf.addImage(imageData, 'JPEG', (pageWidth - imgW) / 2, yPosition, imgW, imgH)
      yPosition += imgH + 12
    } catch (e) {
      console.warn("No se pudo cargar la imagen en el PDF", e)
    }
  }

  // --- SECCION 1: ANALISIS ORIGINAL ---
  checkPage(30)
  pdf.setFontSize(14).setFont('helvetica', 'bold').setTextColor(0, 51, 102)
  pdf.text('1. ANALISIS INICIAL', margin, yPosition)
  yPosition += 10

  const renderTextSection = (text: string) => {
    const segments = parseMarkdown(text)
    const maxWidth = pageWidth - (margin * 2)
    let currentX = margin

    pdf.setTextColor(0)

    for (const seg of segments) {
      if (seg.text === '\n') {
        yPosition += 6
        currentX = margin
        continue
      }

      let fontStyle = 'normal'
      let fontSize = 10
      if (seg.style === 'bold') fontStyle = 'bold'
      if (seg.style.includes('heading')) {
        fontStyle = 'bold'
        fontSize = seg.style === 'heading1' ? 12 : 11
      }

      pdf.setFont('helvetica', fontStyle).setFontSize(fontSize)

      if (seg.style === 'bullet') {
        const bLines = pdf.splitTextToSize("- " + seg.text, maxWidth - 8)
        for (const bl of bLines) {
          checkPage(6)
          pdf.text(bl, margin + 8, yPosition)
          yPosition += 5.8
        }
        currentX = margin
      } else {
        const words = seg.text.split(/(\s+)/)
        for (const word of words) {
          const wordWidth = pdf.getTextWidth(word)
          if (currentX + wordWidth > pageWidth - margin && word.trim() !== "") {
            yPosition += 5.8
            currentX = margin
            checkPage(6)
          }
          pdf.text(word, currentX, yPosition)
          currentX += wordWidth
        }
      }
    }
    yPosition += 8
  }

  renderTextSection(originalAnalysis)

  // --- SECCION 2: OBSERVACIONES ADICIONALES ---
  if (refinements.length > 0) {
    checkPage(30)

    // Linea separadora
    pdf.setDrawColor(200, 200, 200)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 8

    pdf.setFontSize(14).setFont('helvetica', 'bold').setTextColor(0, 102, 51)
    pdf.text('2. OBSERVACIONES ADICIONALES', margin, yPosition)
    yPosition += 6

    pdf.setFontSize(9).setFont('helvetica', 'italic').setTextColor(100, 100, 100)
    pdf.text('Informacion agregada o corregida mediante chat de seguimiento:', margin, yPosition)
    yPosition += 8

    pdf.setTextColor(0)
    for (let i = 0; i < refinements.length; i++) {
      checkPage(15)

      pdf.setFontSize(9).setFont('helvetica', 'bold').setTextColor(0, 102, 51)
      pdf.text(`Refinamiento ${i + 1}:`, margin, yPosition)
      yPosition += 5

      // Extraer solo los puntos clave del refinamiento (no todo el texto)
      const lines = refinements[i].split('\n').filter(l => l.trim().length > 0).slice(0, 15)
      pdf.setFontSize(9).setFont('helvetica', 'normal').setTextColor(60, 60, 60)

      for (const line of lines) {
        const cleanLine = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()
        if (cleanLine.length > 0) {
          const wrappedLines = pdf.splitTextToSize(cleanLine, pageWidth - (margin * 2) - 8)
          for (const wl of wrappedLines) {
            checkPage(5)
            pdf.text(wl, margin + 5, yPosition)
            yPosition += 4.5
          }
        }
      }
      yPosition += 5
    }
  }

  // --- SECCION 3: CONCLUSION FINAL ---
  checkPage(30)

  pdf.setDrawColor(0, 51, 102)
  pdf.setLineWidth(0.5)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 8

  pdf.setFontSize(14).setFont('helvetica', 'bold').setTextColor(0, 51, 102)
  pdf.text('3. CONCLUSION FINAL', margin, yPosition)
  yPosition += 6

  pdf.setFontSize(9).setFont('helvetica', 'italic').setTextColor(100, 100, 100)
  pdf.text('Version integrada del analisis considerando toda la informacion disponible:', margin, yPosition)
  yPosition += 8

  renderTextSection(finalAnalysis)

  // --- PIE DE PAGINA ---
  pdf.setFontSize(8).setFont('helvetica', 'italic').setTextColor(120)
  const footerNote = "Nota: Este reporte es una hipotesis diagnostica generada por IA y debe ser validada por un psicologo colegiado. Incluye refinamientos del chat de seguimiento."
  pdf.text(footerNote, pageWidth / 2, pageHeight - 10, { align: 'center' })

  // Guardar archivo
  const safeName = patientData.name.replace(/\s+/g, '_')
  pdf.save(`HTP_Reporte_Integrado_${safeName}.pdf`)
}