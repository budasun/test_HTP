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
 * PARSER OPTIMIZADO: Unifica párrafos, limpia basura de la IA y 
 * evita cortes de prosa inconsistentes.
 */
function parseMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = []

  // 1. Limpieza profunda de ruido de la IA
  const cleanedText = text
    .replace(/---?\s*PAGE\s*\d+\s*---?/gi, '') // Elimina --- PAGE 1 ---
    .replace(/\[PAGE\s*\d+\]/gi, '')           // Elimina [PAGE 1]
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')      // Elimina citas tipo [34, 78]
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')       // Elimina líneas de separación
    .replace(/\r\n/g, '\n')

  const lines = cleanedText.split('\n')
  let paragraphBuffer = ""

  const flushBuffer = () => {
    if (paragraphBuffer.trim()) {
      segments.push(...processInlineStyles(paragraphBuffer.trim()))
      segments.push({ text: '\n', style: 'normal' }) // Marcador de fin de párrafo
      paragraphBuffer = ""
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line === '') {
      flushBuffer()
      continue
    }

    // Detectar estructuras que NO son párrafos (Headers y Bullets)
    if (line.startsWith('#') || line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      flushBuffer()

      if (line.startsWith('### ')) segments.push({ text: line.substring(4), style: 'heading3' })
      else if (line.startsWith('## ')) segments.push({ text: line.substring(3), style: 'heading2' })
      else if (line.startsWith('# ')) segments.push({ text: line.substring(2), style: 'heading1' })
      else {
        // Normalizar bullets
        const bulletContent = line.replace(/^[-*]\s|^\d+\.\s/, '')
        segments.push({ text: bulletContent, style: 'bullet' })
      }
    } else {
      // Es parte de un párrafo: lo unimos con un espacio
      paragraphBuffer += (paragraphBuffer ? " " : "") + line
    }
  }
  flushBuffer()

  return segments
}

function processInlineStyles(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  // Regex simplificada para capturar negritas (prioritario)
  const parts = text.split(/(\*\*.*?\*\*)/g)

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      segments.push({ text: part.slice(2, -2), style: 'bold' })
    } else if (part.length > 0) {
      // Manejo simple de itálicas dentro de lo normal
      if (part.startsWith('*') && part.endsWith('*')) {
        segments.push({ text: part.slice(1, -1), style: 'italic' })
      } else {
        segments.push({ text: part, style: 'normal' })
      }
    }
  }
  return segments
}

export async function generatePDF(
  patientData: PatientData,
  results: AnalysisResult[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20 // Margen más amplio y profesional
  let yPosition = margin

  const addNewPageIfNeeded = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // Encabezado del Reporte
  pdf.setFontSize(18).setFont('helvetica', 'bold')
  pdf.text('REPORTE DE EVALUACIÓN PSICOMÉTRICA HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Datos del Paciente en bloque
  pdf.setFontSize(10).setFont('helvetica', 'bold')
  pdf.text('DATOS DEL PACIENTE', margin, yPosition)
  yPosition += 6
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Nombre: ${patientData.name}`, margin, yPosition)
  pdf.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin - 40, yPosition)
  yPosition += 5
  pdf.text(`Edad: ${patientData.age} años | Sexo: ${patientData.sex}`, margin, yPosition)
  yPosition += 10

  pdf.setDrawColor(180).line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 12

  for (const item of results) {
    addNewPageIfNeeded(40)

    // Título de Sección
    pdf.setFontSize(14).setFont('helvetica', 'bold')
    const title = item.imageType === 'htp-complete' ? 'ANÁLISIS INTEGRAL HTP' : `ANÁLISIS: ${item.imageType.toUpperCase()}`
    pdf.text(title, margin, yPosition)
    yPosition += 8

    // Imagen (si existe)
    if (item.imageData) {
      try {
        const imgW = 100, imgH = 75
        addNewPageIfNeeded(imgH + 10)
        pdf.addImage(item.imageData, 'JPEG', (pageWidth - imgW) / 2, yPosition, imgW, imgH)
        yPosition += imgH + 12
      } catch (e) { console.error(e) }
    }

    const segments = parseMarkdown(item.result)
    const maxWidth = pageWidth - (margin * 2)

    // RENDERIZADO DE BLOQUES
    for (const seg of segments) {
      if (seg.text === '\n') {
        yPosition += 4 // Espacio entre párrafos
        continue
      }

      // Configuración de Estilos
      let fontSize = 10
      let fontStyle = 'normal'
      let indent = 0
      let prefix = ""

      switch (seg.style) {
        case 'heading1': fontSize = 14; fontStyle = 'bold'; yPosition += 4; break
        case 'heading2': fontSize = 12; fontStyle = 'bold'; yPosition += 2; break
        case 'heading3': fontSize = 11; fontStyle = 'bold'; break
        case 'bold': fontStyle = 'bold'; break
        case 'italic': fontStyle = 'italic'; break
        case 'bullet': indent = 6; prefix = "• "; break
      }

      pdf.setFontSize(fontSize).setFont('helvetica', fontStyle)

      // Ajuste de texto al ancho
      const lines = pdf.splitTextToSize(prefix + seg.text, maxWidth - indent)

      for (const line of lines) {
        addNewPageIfNeeded(6)
        pdf.text(line, margin + indent, yPosition)
        yPosition += 5.5 // Interlineado
      }
    }

    yPosition += 10 // Separación entre resultados de imágenes
  }

  // Pie de página ético
  pdf.setFontSize(8).setFont('helvetica', 'italic').setTextColor(100)
  const footerText = "Nota: Este reporte es una hipótesis diagnóstica generada por IA y debe ser validada por un psicólogo colegiado."
  pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' })

  const fileName = `HTP_Report_${patientData.name.replace(/\s+/g, '_')}.pdf`
  pdf.save(fileName)
}

// WhatsApp y Email (se mantienen igual pero con mejor encoding)
export function shareWhatsApp(patientData: PatientData, summary: string): void {
  const text = encodeURIComponent(`*REPORTE HTP - ${patientData.name}*\n\n${summary.slice(0, 500)}...\n\n_Generado por HTP AI Analyst_`)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

export function shareEmail(patientData: PatientData, summary: string): void {
  const subject = encodeURIComponent(`Reporte HTP - ${patientData.name}`)
  const body = encodeURIComponent(`Paciente: ${patientData.name}\n\n${summary}\n\nGenerado por HTP AI Analyst`)
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}