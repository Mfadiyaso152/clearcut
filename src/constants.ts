// Dynamic SVG logo templates for instant testing
export const SAMPLE_LOGOS = [
  {
    id: "tech",
    name: "شعار NexLabs (خلفية بيضاء)",
    bg: "#FFFFFF",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
      <rect width="100%" height="100%" fill="#FFFFFF"/>
      <g transform="translate(150, 130)">
        <circle cx="100" cy="100" r="80" fill="none" stroke="#0F172A" stroke-width="12"/>
        <polygon points="100,45 145,135 55,135" fill="#3B82F6"/>
        <circle cx="100" cy="105" r="25" fill="#0F172A"/>
      </g>
      <text x="250" y="375" font-family="'Cairo', sans-serif" font-size="32" font-weight="900" fill="#0F172A" text-anchor="middle" letter-spacing="1">NEXUS LABS</text>
      <text x="250" y="410" font-family="'Cairo', sans-serif" font-size="16" font-weight="600" fill="#64748B" text-anchor="middle" letter-spacing="4">FUTURE PROTOCOLS</text>
    </svg>`
  },
  {
    id: "organic",
    name: "شعار EcoLife (خلفية غامقة)",
    bg: "#0A192F",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
      <rect width="100%" height="100%" fill="#0A192F"/>
      <g transform="translate(150, 110)">
        <path d="M100,20 C145,70 175,120 100,185 C80,165 45,120 100,20 Z" fill="#10B981" opacity="0.85"/>
        <path d="M100,40 C55,90 25,140 100,185 C120,165 155,120 100,40 Z" fill="#34D399" opacity="0.95"/>
        <circle cx="100" cy="115" r="14" fill="#FBBF24"/>
      </g>
      <text x="250" y="365" font-family="'Cairo', sans-serif" font-size="34" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">ECO LIFE</text>
      <text x="250" y="400" font-family="'Cairo', sans-serif" font-size="15" font-weight="600" fill="#34D399" text-anchor="middle" letter-spacing="3">100% ORGANIC PRODUCTS</text>
    </svg>`
  },
  {
    id: "coffee",
    name: "شعار RoastCo (خلفية كريمية)",
    bg: "#F7EBE1",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
      <rect width="100%" height="100%" fill="#F7EBE1"/>
      <g transform="translate(150, 110)">
        <polygon points="100,15 175,60 175,150 100,195 25,150 25,60" fill="#78350F" stroke="#B45309" stroke-width="10"/>
        <path d="M70,80 Q100,50 130,80 T130,130" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round"/>
        <circle cx="100" cy="115" r="32" fill="#F59E0B"/>
        <path d="M85,115 L115,115 M100,100 L100,130" stroke="#78350F" stroke-width="5" stroke-linecap="round"/>
      </g>
      <text x="250" y="370" font-family="'Cairo', sans-serif" font-size="30" font-weight="900" fill="#78350F" text-anchor="middle" letter-spacing="1">ROAST &amp; CO.</text>
      <text x="250" y="405" font-family="'Cairo', sans-serif" font-size="14" font-weight="700" fill="#B45309" text-anchor="middle" letter-spacing="2">PREMIUM CAFÉ BREW</text>
    </svg>`
  }
];

// Creative preset gradients to showcase extracted logos
export const PRESET_GRADIENTS = [
  { name: "أفق الغروب", class: "bg-gradient-to-tr from-orange-500 to-rose-600" },
  { name: "العمق السيبراني", class: "bg-gradient-to-tr from-indigo-900 via-purple-800 to-pink-600" },
  { name: "الغابة الهادئة", class: "bg-gradient-to-tr from-emerald-800 to-teal-500" },
  { name: "استوديو احترافي", class: "bg-gradient-to-tr from-gray-900 to-gray-700" },
  { name: "وهج النيون", class: "bg-gradient-to-tr from-blue-600 to-cyan-400" },
  { name: "العصرية الفاخرة", class: "bg-gradient-to-tr from-amber-600 to-yellow-400" }
];

// Dynamic cycling loader messages for Gemini AI analysis
export const loaderMessages = [
  "جاري تحليل الهيكل الفني والنمط البصري...",
  "جاري فك الترميز اللوني ومطابقة التباين...",
  "جاري تصميم لوحة الألوان السائدة مع أكواد الـ HEX...",
  "جاري صياغة المطالب الوصفية لمحركات الـ Vector...",
  "جاري توليد توصيات تحسين الدقة الفنية..."
];

