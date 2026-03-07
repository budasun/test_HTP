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
    .replace(/Pagina\s*\d+/gi, '')
    .replace(/Page\s*\d+/gi, '')
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n')
  
  const lines = cleanedText.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed === '' || trimmed.length === 0) {
      continue
    }
    
    if (trimmed.startsWith('### ')) {
      segments.push({ text: trimmed.substring(4), style: 'heading3' })
    } else if (trimmed.startsWith('## ')) {
      segments.push({ text: trimmed.substring(3), style: 'heading2' })
    } else if (trimmed.startsWith('# ')) {
      segments.push({ text: trimmed.substring(2), style: 'heading1' })
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      segments.push({ text: trimmed.substring(2), style: 'bullet' })
    } else if (/^\d+\.\s/.test(trimmed)) {
      segments.push({ text: trimmed.replace(/^\d+\.\s/, ''), style: 'bullet' })
    } else if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      continue
    } else if (trimmed.length > 0) {
      const processed = processInlineStyles(trimmed)
      if (processed.length > 0) {
        segments.push(...processed)
      } else {
        segments.push({ text: trimmed, style: 'normal' })
      }
    }
  }
  
  return segments
}

function processInlineStyles(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  let remaining = text
  
  const boldRegex = /\*\*(.+?)\*\*/g
  const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
  
  let match
  let lastIndex = 0
  const partMatches: { type: 'bold' | 'italic' | 'normal'; text: string; start: number; end: number }[] = []
  
  boldRegex.lastIndex = 0
  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      partMatches.push({ type: 'normal', text: text.slice(lastIndex, match.index), start: lastIndex, end: match.index })
    }
    partMatches.push({ type: 'bold', text: match[1], start: match.index, end: match.index + match[0].length })
    lastIndex = match.index + match[0].length
  }
  
  if (lastIndex < text.length) {
    partMatches.push({ type: 'normal', text: text.slice(lastIndex), start: lastIndex, end: text.length })
  }
  
  if (partMatches.length === 0) {
    partMatches.push({ type: 'normal', text: text, start: 0, end: text.length })
  }
  
  for (const part of partMatches) {
    if (part.type === 'bold') {
      segments.push({ text: part.text, style: 'bold' })
    } else if (part.type === 'normal') {
      italicRegex.lastIndex = 0
      let italicLastIndex = 0
      let innerMatch
      const italicMatches: { text: string; start: number; end: number }[] = []
      
      while ((innerMatch = italicRegex.exec(part.text)) !== null) {
        if (innerMatch.index > italicLastIndex) {
          italicMatches.push({ text: part.text.slice(italicLastIndex, innerMatch.index), start: italicLastIndex, end: innerMatch.index })
        }
        italicMatches.push({ text: innerMatch[1], start: innerMatch.index, end: innerMatch.index + innerMatch[0].length })
        italicLastIndex = innerMatch.index + innerMatch[0].length
      }
      
      if (italicLastIndex < part.text.length) {
        italicMatches.push({ text: part.text.slice(italicLastIndex), start: italicLastIndex, end: part.text.length })
      }
      
      if (italicMatches.length === 0) {
        segments.push({ text: part.text, style: 'normal' })
      } else {
        for (const im of italicMatches) {
          segments.push({ text: im.text, style: im.text !== part.text.slice(im.start, im.end) ? 'italic' : 'normal' })
        }
      }
    }
  }
  
  return segments.filter(s => s.text.length > 0)
}

export async function generatePDF(
  patientData: PatientData,
  results: AnalysisResult[]
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  let yPosition = margin

  const addNewPageIfNeeded = (neededHeight: number) => {
    if (yPosition + neededHeight > pageHeight - margin) {
      pdf.addPage()
      yPosition = margin
    }
  }

  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text('REPORTE DE EVALUACION HTP', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 15

  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Fecha: ${new Date().toLocaleDateString('es-ES')}`, margin, yPosition)
  yPosition += 8
  pdf.text(`Paciente: ${patientData.name}`, margin, yPosition)
  yPosition += 8
  pdf.text(`Edad: ${patientData.age} anos`, margin, yPosition)
  yPosition += 8
  pdf.text(`Sexo: ${patientData.sex}`, margin, yPosition)
  yPosition += 15

  pdf.setDrawColor(200, 200, 200)
  pdf.line(margin, yPosition, pageWidth - margin, yPosition)
  yPosition += 10

  const typeNames: Record<string, string> = {
    'htp-complete': 'Hoja Completa HTP',
    casa: 'Casa',
    arbol: 'Arbol',
    persona1: 'Persona 1',
    persona2: 'Persona 2',
  }

  const contextNames: Record<string, string> = {
    clinica: 'Contexto Clinico',
    laboral: 'Contexto Laboral',
    forense: 'Contexto Forense',
  }

  for (const item of results) {
    addNewPageIfNeeded(80)

    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`ANALISIS: ${typeNames[item.imageType] || item.imageType}`, margin, yPosition)
    yPosition += 8

    if (item.context) {
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'italic')
      pdf.text(`Tipo: ${contextNames[item.context] || item.context}`, margin, yPosition)
      yPosition += 6
    }

    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Modelo: ${item.model}`, margin, yPosition)
    yPosition += 8

    if (item.imageData) {
      try {
        const imgWidth = item.imageType === 'htp-complete' ? 100 : 60
        const imgHeight = item.imageType === 'htp-complete' ? 75 : 45
        pdf.addImage(item.imageData, 'JPEG', margin, yPosition, imgWidth, imgHeight)
        yPosition += imgHeight + 10
      } catch (e) {
        console.error('Error adding image to PDF:', e)
      }
    }

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    const segments = parseMarkdown(item.result)
    const maxWidth = pageWidth - 2 * margin

    let currentLineSegments: TextSegment[] = []
    
    const renderCurrentLine = () => {
      if (currentLineSegments.length === 0) return
      
      const lineHeight = 5
      let allLines: { text: string; style: string }[] = []
      
      for (const seg of currentLineSegments) {
        if (seg.text === '') continue
        
        pdf.setFontSize(seg.style === 'bold' || seg.style === 'italic' ? 10 : 10)
        pdf.setFont('helvetica', seg.style === 'bold' ? 'bold' : seg.style === 'italic' ? 'italic' : 'normal')
        
        const segLines = pdf.splitTextToSize(seg.text, maxWidth)
        
        for (let i = 0; i < segLines.length; i++) {
          allLines.push({
            text: segLines[i],
            style: seg.style
          })
        }
      }
      
      if (allLines.length > 1) {
        const lastLine = allLines[allLines.length - 1].text.trim()
        const MIN_ORPHAN_CHARS = 3
        
        if (lastLine.length < MIN_ORPHAN_CHARS && lastLine.length > 0) {
          const secondLastLine = allLines[allLines.length - 2]
          secondLastLine.text = secondLastLine.text + ' ' + lastLine
          allLines.pop()
        }
      }
      
      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i]
        addNewPageIfNeeded(6)
        
        const style = line.style as 'normal' | 'bold' | 'italic'
        switch (style) {
          case 'bold':
            pdf.setFont('helvetica', 'bold')
            break
          case 'italic':
            pdf.setFont('helvetica', 'italic')
            break
          default:
            pdf.setFont('helvetica', 'normal')
        }
        
        pdf.text(line.text, margin, yPosition)
        yPosition += lineHeight
      }
      
      yPosition += 4
      currentLineSegments = []
    }

    for (const segment of segments) {
      if (segment.text === '') {
        renderCurrentLine()
        yPosition += 4
        continue
      }

      if (segment.style === 'heading1' || segment.style === 'heading2' || segment.style === 'heading3') {
        renderCurrentLine()
        addNewPageIfNeeded(10)
        
        if (segment.style === 'heading1') {
          pdf.setFontSize(16)
          pdf.setFont('helvetica', 'bold')
          yPosition += 4
        } else if (segment.style === 'heading2') {
          pdf.setFontSize(14)
          pdf.setFont('helvetica', 'bold')
          yPosition += 2
        } else {
          pdf.setFontSize(12)
          pdf.setFont('helvetica', 'bold')
        }
        
        const lines = pdf.splitTextToSize(segment.text, maxWidth)
        for (const line of lines) {
          addNewPageIfNeeded(10)
          pdf.text(line, margin, yPosition)
          yPosition += 7
        }
        continue
      }

      if (segment.style === 'bullet') {
        renderCurrentLine()
        addNewPageIfNeeded(6)
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        const lines = pdf.splitTextToSize(segment.text, maxWidth - 10)
        for (const line of lines) {
          addNewPageIfNeeded(6)
          pdf.text('• ' + line, margin + 5, yPosition)
          yPosition += 5
        }
        continue
      }

      currentLineSegments.push(segment)
    }

    renderCurrentLine()

    yPosition += 10
    pdf.setDrawColor(220, 220, 220)
    pdf.line(margin, yPosition, pageWidth - margin, yPosition)
    yPosition += 10
  }

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'italic')
  pdf.text(
    'Reporte generado por HTP AI Analyst - Uso exclusivo para fines profesionales',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  const fileName = `HTP_Report_${patientData.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(fileName)
}

export function shareWhatsApp(patientData: PatientData, summary: string): void {
  const text = encodeURIComponent(
    `*REPORTE HTP - ${patientData.name}*\n\n${summary}\n\n_Generado por HTP AI Analyst_`
  )
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

export function shareEmail(patientData: PatientData, summary: string): void {
  const subject = encodeURIComponent(`Reporte HTP - ${patientData.name}`)
  const body = encodeURIComponent(
    `Reporte de Evaluacion HTP\n\nPaciente: ${patientData.name}\nEdad: ${patientData.age}\nSexo: ${patientData.sex}\n\n${summary}\n\nGenerado por HTP AI Analyst`
  )
  window.location.href = `mailto:?subject=${subject}&body=${body}`
}
