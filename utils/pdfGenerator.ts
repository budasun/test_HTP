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

function parseMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = []

  const cleanedText = text
    .replace(/---?\s*PAGE\s*\d+\s*---?/gi, '')
    .replace(/\[PAGE\s*\d+\]/gi, '')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\r\n/g, '\n')

  const lines = cleanedText.split('\n')
  let paragraphBuffer = ""

  const flushBuffer = () => {
    let content = paragraphBuffer.trim()
    if (content) {
      content = content.replace(/\s+:/g, ':')
      segments.push(...processInlineStyles(content))
      segments.push({ text: '\n', style: 'normal' })
      paragraphBuffer = ""
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') { flushBuffer(); continue }

    if (line.startsWith('#')) {
      flushBuffer()
      if (line.startsWith('### ')) segments.push({ text: line.substring(4), style: 'heading3' })
      else if (line.startsWith('## ')) segments.push({ text: line.substring(3), style: 'heading2' })
      else segments.push({ text: line.substring(2), style: 'heading1' })
    }
    else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      flushBuffer()
      const bulletContent = line.replace(/^[-*]\s|^\d+\.\s/, '')
      segments.push({ text: bulletContent, style: 'bullet' })
    }
    else {
      paragraphBuffer += (paragraphBuffer ? " " : "") + line
    }
  }
  flushBuffer()
  return segments
}

function processInlineStyles(text: string): TextSegment[] {
  const segments: TextSegment[] = []
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

export async function generatePDF(patientData: PatientData, results: AnalysisResult[]): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  const addNewPageIfNeeded = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
    }
  }

  pdf.setFontSize(18).setFont('helvetica', 'bold')
  pdf.text('REPORTE DE EVALUACIÓN PSICOMÉTRICA HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  pdf.setFontSize(10).setFont('helvetica', 'bold')
  pdf.text(`PACIENTE: ${patientData.name.toUpperCase()}`, margin, yPosition)
  pdf.text(`FECHA: ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin - 40, yPosition)
  yPosition += 6
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Edad: ${patientData.age} años | Sexo: ${patientData.sex}`, margin, yPosition)
  yPosition += 8
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 12

  for (const item of results) {
    addNewPageIfNeeded(20)
    pdf.setFontSize(13).setFont('helvetica', 'bold')
    pdf.text(item.imageType.toUpperCase().replace(/-/g, ' '), margin, yPosition)
    yPosition += 8

    if (item.imageData) {
      const imgW = 90, imgH = 65
      addNewPageIfNeeded(imgH + 5)
      pdf.addImage(item.imageData, 'JPEG', (pageWidth - imgW) / 2, yPosition, imgW, imgH)
      yPosition += imgH + 10
    }

    const segments = parseMarkdown(item.result)
    const maxWidth = pageWidth - (margin * 2)
    let currentX = margin

    for (const seg of segments) {
      if (seg.text === '\n') {
        yPosition += 6
        currentX = margin
        continue
      }

      let fontStyle = 'normal'
      if (seg.style === 'bold' || seg.style.includes('heading')) fontStyle = 'bold'
      if (seg.style === 'italic') fontStyle = 'italic'

      pdf.setFont('helvetica', fontStyle).setFontSize(seg.style.includes('heading') ? 12 : 10)

      if (seg.style === 'bullet') {
        const bLines = pdf.splitTextToSize("• " + seg.text, maxWidth - 6)
        for (const bl of bLines) {
          addNewPageIfNeeded(6)
          pdf.text(bl, margin + 6, yPosition)
          yPosition += 5.5
        }
        currentX = margin
      } else {
        const words = seg.text.split(/(\s+)/)
        for (const word of words) {
          const wordWidth = pdf.getTextWidth(word)
          if (currentX + wordWidth > pageWidth - margin && word.trim() !== "") {
            yPosition += 5.5
            currentX = margin
            addNewPageIfNeeded(6)
          }
          pdf.text(word, currentX, yPosition)
          currentX += wordWidth
        }
      }
    }
    yPosition += 4
  }

  pdf.save(`HTP_Report_${patientData.name.replace(/\s+/g, '_')}.pdf`)
}

/**
 * CORRECCIÓN PARA MÓVIL: WhatsApp
 * Usa wa.me y asignación directa para evitar bloqueos de popups.
 */
export function shareWhatsApp(patientData: PatientData, summary: string): void {
  const cleanSummary = summary.replace(/\n/g, ' ').slice(0, 600);
  const text = encodeURIComponent(
    `*REPORTE HTP - ${patientData.name.toUpperCase()}*\n\n${cleanSummary}...\n\n_Generado por HTP AI Analyst_`
  );

  // En móvil, href directo es más fiable que window.open
  window.location.href = `https://wa.me/?text=${text}`;
}

/**
 * CORRECCIÓN PARA MÓVIL: Email
 * Usa un link temporal y saltos de línea codificados para clientes nativos.
 */
export function shareEmail(patientData: PatientData, summary: string): void {
  const subject = encodeURIComponent(`Reporte HTP - ${patientData.name}`);
  // %0D%0A es el estándar para saltos de línea en mailto
  const bodyText = encodeURIComponent(
    `Reporte de Evaluación HTP\n\nPaciente: ${patientData.name}\nEdad: ${patientData.age}\n\nResumen:\n${summary.slice(0, 800)}...`
  ).replace(/%0A/g, '%0D%0A');

  const mailtoUrl = `mailto:?subject=${subject}&body=${bodyText}`;

  // Crear un elemento invisible para disparar la acción
  const link = document.createElement('a');
  link.href = mailtoUrl;
  link.target = '_self';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}