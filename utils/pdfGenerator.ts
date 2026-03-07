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

// --- PARSER LÓGICO ---

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
      if (trimmed.startsWith('### ')) segments.push({ text: trimmed.substring(4), style: 'heading3' })
      else if (trimmed.startsWith('## ')) segments.push({ text: trimmed.substring(3), style: 'heading2' })
      else segments.push({ text: trimmed.substring(2), style: 'heading1' })
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
      flushBuffer()
      segments.push({ text: trimmed.replace(/^[-*]\s|^\d+\.\s/, ''), style: 'bullet' })
    } else {
      paragraphBuffer += (paragraphBuffer ? " " : "") + trimmed
    }
  }
  flushBuffer()
  return segments
}

// --- MOTOR DE CONSTRUCCIÓN DEL PDF ---

/**
 * Esta función centraliza toda la estética y contenido del reporte.
 * Se usa tanto para descargar como para compartir.
 */
function buildPDFContent(pdf: jsPDF, patientData: PatientData, results: AnalysisResult[]) {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 20
  let yPosition = margin

  const checkPage = (h: number) => {
    if (yPosition + h > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
    }
  }

  // Header
  pdf.setFontSize(18).setFont('helvetica', 'bold')
  pdf.text('REPORTE DE EVALUACIÓN PSICOMÉTRICA HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  // Datos
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
    checkPage(20)
    pdf.setFontSize(13).setFont('helvetica', 'bold')
    pdf.text(item.imageType.toUpperCase().replace(/-/g, ' '), margin, yPosition)
    yPosition += 8

    if (item.imageData) {
      const imgW = 90, imgH = 65
      checkPage(imgH + 5)
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
      pdf.setFont('helvetica', fontStyle).setFontSize(seg.style.includes('heading') ? 12 : 10)

      if (seg.style === 'bullet') {
        const bLines = pdf.splitTextToSize("• " + seg.text, maxWidth - 6)
        for (const bl of bLines) {
          checkPage(6)
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
            checkPage(6)
          }
          pdf.text(word, currentX, yPosition)
          currentX += wordWidth
        }
      }
    }
    yPosition += 4
  }
}

// --- FUNCIONES DE EXPORTACIÓN ---

export async function generatePDF(patientData: PatientData, results: AnalysisResult[]): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  buildPDFContent(pdf, patientData, results)
  pdf.save(`HTP_Report_${patientData.name.replace(/\s+/g, '_')}.pdf`)
}

/**
 * COMPARTE EL ARCHIVO PDF REAL
 * En móvil abre el menú nativo (WhatsApp, Telegram, etc).
 * En escritorio descarga el archivo.
 */
export async function shareWhatsApp(patientData: PatientData, results: AnalysisResult[]): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  buildPDFContent(pdf, patientData, results)

  const fileName = `Reporte_HTP_${patientData.name.replace(/\s+/g, '_')}.pdf`
  const pdfBlob = pdf.output('blob')
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

  // Web Share API (Mobile native)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Reporte Psicodiagnóstico HTP',
        text: `Adjunto reporte HTP de ${patientData.name}`,
      })
    } catch (err) {
      console.error("Error al compartir:", err)
      pdf.save(fileName)
    }
  } else {
    // Fallback escritorio: Descarga y aviso
    alert("Para enviar por WhatsApp en escritorio, el archivo se descargará. Luego podrás adjuntarlo en WhatsApp Web.")
    pdf.save(fileName)
  }
}

export async function shareEmail(patientData: PatientData, results: AnalysisResult[]): Promise<void> {
  // Reutilizamos el sistema de compartir nativo ya que permite elegir Email
  await shareWhatsApp(patientData, results)
}