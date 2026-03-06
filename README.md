# NeuroView HTP — Análisis Proyectivo Asistido por Inteligencia Artificial

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Groq](https://img.shields.io/badge/Groq-Llama_4_Scout-orange?style=flat)](https://groq.com/)

*Plataforma de evaluación psicológica proyectiva con asistencia de modelos multimodales*

</div>

---

## Descripción del Proyecto

**NeuroView HTP** es una aplicación web diseñada para digitalizar y asistir en el análisis del **Test Proyectivo HTP (Casa-Árbol-Persona)**, una de las herramientas más utilizadas en la evaluación psicológica clínica, forense y laboral para explorar la estructura de personalidad, la autoimagen y la dinámica vincular del evaluado.

La aplicación permite cargar imágenes de dibujos realizados por el paciente y utiliza un modelo de visión por computadora de última generación para generar análisis cualitativos basados en indicadores proyectivos clásicos. El sistema no reemplaza el juicio clínico del profesional, sino que actúa como una herramienta de apoyo que acelera el proceso de formulación de hipótesis diagnósticas preliminares.

### ¿Qué es el Test HTP?

El HTP es una técnica proyectiva desarrollada por C. M. Burkhart, J. E. H. Buck y Emanuel Hammer en la década de 1940-1950. Se basa en el principio de que, al solicitar al sujeto que dibuje una casa, un árbol y una persona, proyectará en estos estímulos gráficos elementos de su mundo interno, sus relaciones familiares, su autoimagen y su ajuste emocional.

---

## Fundamentación Psicológica

El análisis proporcionado por **NeuroView HTP** se fundamenta en la teoría y metodología de los autores clásicos del test:

| Autor | Aportación Principal |
|-------|----------------------|
| **Emanuel Hammer** | Desarrolló la interpretación sistemática del test, estableciendo correlaciones entre indicadores formales y dinámicos con constructos clínicos específicos [1] |
| **John E. Buck** | Sistematizó las normas de aplicación y la interpretación basada en la teoría del Yo, identificando indicadores de defendedness y controles defensivos [2] |
| **Cyril M. Burkhart** | Contribuyó al análisis cuantitativo de elementos formales como tamaño, ubicación, presión de trazo y detalles omitidos [3] |

### Dimensiones Evaluadas

- **Yo (Self)**: Representado principalmente por el dibujo de la Persona — refleja autoimagen, identidad, autoconcepto y ideal del yo.
- **Familia y Ambiente**: Simbolizado por la Casa — expresa la percepción del entorno familiar, seguridad emocional y experiencias early object relations.
- **Vida Vegetal/Biológica**: El Árbol funciona como indicador del yo profundo, la vitalidad, el desarrollo y la estabilidad emocional.
- **Dinámica Proyectiva**: Se analizan recurrencias entre los tres dibujos para identificar patrones consolidados de personalidad.

### Referencias

[1] Hammer, E. F. (1958). *The Clinical Use of the "House-Tree-Person" Drawing Test*. Charles C Thomas.

[2] Buck, J. N. (1948). The H-T-P Technique: A Qualitative and Quantitative Scoring Manual. *Journal of Clinical Psychology*.

[3] Burkhart, B. R., & Merenda, P. F. (1985). The House-Tree-Person Quick Scoring Manual. Western Psychological Services.

---

## Stack Técnico

| Tecnología | Función |
|------------|---------|
| **Next.js 16** | Framework full-stack con App Router |
| **TypeScript 5** | Tipado estático para seguridad del código |
| **Tailwind CSS 4** | Framework de estilos utility-first |
| **Groq API** | Motor de inferencia de bajo costo y latencia ultra-baja |
| **Llama 4 Scout** | Modelo multimodal (visión + texto) de Meta |
| **jsPDF** | Generación de reportes en formato PDF |
| **React Markdown** | Renderizado de contenido estructurado |

---

## Features

### Funcionalidades Principales

- **Carga de imágenes**: El usuario puede subir una imagen del dibujo HTP (puede incluir los tres elementos en una misma hoja o dibujos individuales) mediante archivo local o captura con cámara del dispositivo.
- **Selección de contexto clínico**: Tres modalidades de análisis — Clínico, Laboral o Forense — cada una con prompts optimizados para el enfoque requerido.
- **Análisis psicométrico asistido**: El modelo procesa la imagen y genera un informe estructurado siguiendo el formato clínico tradicional (Impresión Global, Análisis por Dibujos, Indicadores de Personalidad, Conclusión).
- **Base de conocimiento integrada**: El sistema incorpora un knowledge base con interpretaciones sistemáticas que el modelo utiliza como referencia para fundamentar sus interpretaciones.
- **Generación de PDF**: Exportación profesional del informe de análisis con formato estandarizado, listo para ser adjuntado al expediente clínico.
- **Diseño responsivo**: Interfaz adaptativa que funciona en dispositivos móviles, tablets y escritorio.

### Features Técnicos

- Manejo de imágenes en formato Base64 para procesamiento directo
- Timeouts configurables para llamadas a la API
- Sistema de fallback automático entre modelos (cuando aplica)
- Parseo de markdown con soporte para negritas, cursivas, encabezados y listas
- Rendering de contenido con estilos diferenciados en el PDF

---

## Advertencia Ética (Disclaimer)

> **⚠️ AVISO IMPORTANTE**
>
> Los resultados generados por **NeuroView HTP** son de carácter **orientativo y辅助**. El análisis proporcionado por el sistema constituye una hipótesis diagnóstica preliminar basada en indicadores cualitativos proyectivos y debe ser validado, interpretado y contextualizado por un profesional cualificado en psicología clínica.
>
> El test HTP, como toda técnica proyectiva, requiere integración con otros datos del evaluado (entrevista clínica, historia psicobiográfica, pruebas complementarias) para formular conclusiones diagnósticas válidas. La interpretación aislada de los resultados automatizados sin el juicio clínico del profesional puede llevar a errores de categorización.
>
> **El uso de esta herramienta no sustituye la evaluación clínica profesional.** El desarrollador y el proyecto no asumen responsabilidad por decisiones clínicas tomadas en base a los resultados generados automáticamente.

---

## Requisitos Previos

- Node.js 18.17 o superior
- npm o yarn
- Cuenta en [Groq Cloud](https://groq.com) con API Key válida

---

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/test_HTP.git
cd test_HTP
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con tu API Key de Groq:

```env
GROQ_API_KEY=gsk_tu_api_key_aqui
```

### 4. Ejecutar el servidor de desarrollo

```bash
npm run dev
```

### 5. Acceder a la aplicación

Abre tu navegador en: `http://localhost:3000`

---

## Estructura del Proyecto

```
test_HTP/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts       # Endpoint de análisis con IA
│   ├── layout.tsx             # Layout raíz de Next.js
│   └── page.tsx               # Página principal de la app
├── utils/
│   └── pdfGenerator.ts        # Utilidad de generación de PDFs
├── data/
│   └── htp_knowledge_base.json  # Base de conocimiento clínico
├── public/                    # Assets estáticos
├── .env.local                 # Variables de entorno
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Uso

1. **Ingresa los datos del paciente**: Nombre, edad y sexo.
2. **Carga el dibujo HTP**: Sube una imagen del dibujo (casa, árbol, persona) o tómala con la cámara.
3. **Selecciona el contexto de análisis**:
   - **Clínico**: Enfocado en rasgos de personalidad, estabilidad emocional y autoimagen.
   - **Laboral**: Enfocado en adaptabilidad, liderazgo y habilidades sociales.
   - **Forense**: Enfocado en indicadores de impulsividad, agresividad y trauma.
4. **Recibe el análisis**: El sistema procesa la imagen y devuelve un informe estructurado.
5. **Exporta el reporte**: Genera un PDF profesional para integrar al expediente.

---

## Contribución

Las contribuciones son bienvenidas. Por favor, lee las guías de estilo del proyecto antes de enviar un Pull Request.

---

## Licencia

MIT License — Consulta el archivo `LICENSE` para más información.

---

## Contacto

Para consultas técnicas o colaboraciones:
- GitHub: [tu-usuario/test_HTP](https://github.com/budasun/test_HTP)

---

*Desarrollado con el objetivo de asistir a profesionales de la salud mental en el proceso de evaluación psicológica proyectiva. La tecnología al servicio de la clínica.*
