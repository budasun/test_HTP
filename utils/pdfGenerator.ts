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
 * PARSER REPARADO: Elimina saltos innecesarios después de ":"
 * y unifica la prosa para que no parezca una lista vertical.
 */
function parseMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = []

  const cleanedText = text
    .replace(/---?\s*PAGE\s*\d+\s*---?/gi, '')
    .replace(/\[PAGE\s*\d+\]/gi, '')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')      // Limpia citas [12, 14]
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\r\n/g, '\n')

  const lines = cleanedText.split('\n')
  let paragraphBuffer = ""

  const flushBuffer = () => {
    if (paragraphBuffer.trim()) {
      // PROCESO ESPECIAL: Si el buffer termina en ":" o tiene ":" cerca del inicio, 
      // nos aseguramos de que lo que sigue no se separe.
      segments.push(...processInlineStyles(paragraphBuffer.trim()))
      segments.push({ text: '\n', style: 'normal' })
      paragraphBuffer = ""
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line === '') {
      flushBuffer()
      continue
    }

    // 1. Detectar Headers (estos siempre limpian el buffer)
    if (line.startsWith('#')) {
      flushBuffer()
      if (line.startsWith('### ')) segments.push({ text: line.substring(4), style: 'heading3' })
      else if (line.startsWith('## ')) segments.push({ text: line.substring(3), style: 'heading2' })
      else segments.push({ text: line.substring(2), style: 'heading1' })
    }
    // 2. Detectar Listas/Bullets
    else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      flushBuffer()
      const bulletContent = line.replace(/^[-*]\s|^\d+\.\s/, '')
      segments.push({ text: bulletContent, style: 'bullet' })
    }
    // 3. TEXTO NORMAL (PROSA): Aquí es donde evitamos el salto tras los ":"
    else {
      // Si la línea anterior terminaba en ":" o esta línea parece la continuación de una etiqueta
      paragraphBuffer += (paragraphBuffer ? " " : "") + line
    }
  }
  flushBuffer()

  return segments
}

function processInlineStyles(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  // Buscamos negritas pero mantenemos los dos puntos pegados al texto si existen
  const parts = text.split(/(\*\*.*?\*\*)/g)

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      segments.push({ text: part.slice(2, -2), style: 'bold' })
    } else if (part.length > 0) {
      segments.push({ text: part, style: 'normal' })
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
  const margin = 20
  let yPosition = margin

  const addNewPageIfNeeded = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
      return true
    }
    return false
  }

  // --- CABECERA ---
  pdf.setFontSize(18).setFont('helvetica', 'bold')
  pdf.text('REPORTE DE EVALUACIÓN HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  pdf.setFontSize(10).setFont('helvetica', 'bold')
  pdf.text(`PACIENTE: ${patientData.name.toUpperCase()}`, margin, yPosition)
  pdf.text(`FECHA: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin - 40, yPosition)
  yPosition += 6
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Edad: ${patientData.age} años | Sexo: ${patientData.sex}`, margin, yPosition)
  yPosition += 8

  pdf.setDrawColor(200).line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 12

  for (const item of results) {
    addNewPageIfNeeded(60)

    pdf.setFontSize(13).setFont('helvetica', 'bold')
    pdf.text(item.imageType.toUpperCase().replace(/-/g, ' '), margin, yPosition)
    yPosition += 8

    if (item.imageData) {
      try {
        const imgW = 80, imgH = 60 // Un poco más pequeñas para ahorrar espacio
        addNewPageIfNeeded(imgH + 10)
        pdf.addImage(item.imageData, 'JPEG', (pageWidth - imgW) / 2, yPosition, imgW, imgH)
        yPosition += imgH + 10
      } catch (e) { console.error(e) }
    }

    const segments = parseMarkdown(item.result)
    const maxWidth = pageWidth - (margin * 2)

    // BUFFER PARA LÍNEAS DE UN MISMO PÁRRAFO
    let currentLineX = margin

    for (const seg of segments) {
      if (seg.text === '\n') {
        yPosition += 6 // Salto de párrafo real
        currentLineX = margin
        continue
      }

      // Estilos
      let fontSize = 10
      let fontStyle = 'normal'
      let indent = 0

      if (seg.style.includes('heading')) {
        fontSize = seg.style === 'heading1' ? 14 : seg.style === 'heading2' ? 12 : 11
        fontStyle = 'bold'
        yPosition += 2
      } else if (seg.style === 'bold') {
        fontStyle = 'bold'
      } else if (seg.style === 'bullet') {
        indent = 6
      }

      pdf.setFontSize(fontSize).setFont('helvetica', fontStyle)

      if (seg.style === 'bullet') {
        const bulletLines = pdf.splitTextToSize("• " + seg.text, maxWidth - indent)
        for (const bl of bulletLines) {
          addNewPageIfNeeded(6)
          pdf.text(bl, margin + indent, yPosition)
          yPosition += 5.5
        }
        yPosition += 1 // Mini espacio entre bullets
      } else if (seg.style.includes('heading')) {
        const hLines = pdf.splitTextToSize(seg.text, maxWidth)
        for (const hl of hLines) {
          addNewPageIfNeeded(7)
          pdf.text(hl, margin, yPosition)
          yPosition += 6
        }
      } else {
        // TEXTO FLUIDO (Inline)
        // Aquí tratamos de imprimir el segmento en la misma línea si cabe
        const words = seg.text.split(' ')
        for (const word of words) {
          const wordWidth = pdf.getTextWidth(word + " ")
          if (currentLineX + wordWidth > pageWidth - margin) {
            yPosition += 5.5
            currentLineX = margin
            addNewPageIfNeeded(6)
          }
          pdf.text(word + " ", currentLineX, yPosition)
          currentLineX += wordWidth
        }
      }
    }
    yPosition += 6
  }

  // Footer
  pdf.setFontSize(8).setFont('helvetica', 'italic').setTextColor(120)
  pdf.text("Uso exclusivo profesional - Generado por HTP AI Analyst", pageWidth / 2, pageHeight - 10, { align: 'center' })

  pdf.save(`Reporte_HTP_${patientData.name}.pdf`)
}

export function shareWhatsApp(patientData: PatientData, summary: string): void {
  const text = encodeURIComponent(`*REPORTE HTP - ${patientData.name}*\n\n${summary.slice(0, 300)}...`)
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

export function shareEmail(patientData: PatientData, summary: string): void {
  const subject = encodeURIComponent(`Reporte HTP - ${patientData.name}`)
  const body = encodeURIComponent(`Reporte adjunto de ${patientData.name}\n\n${summary}`)
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}