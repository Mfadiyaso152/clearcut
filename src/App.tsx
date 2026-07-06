import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  Trash2,
  Sliders,
  RefreshCw,
  Pipette,
  Check,
  Download,
  AlertCircle,
  Undo,
  Brush,
  Crop,
  FileText
} from "lucide-react";
import {
  detectBackgroundColor,
  removeBackground,
  cropTransparentMargins,
  rgbToHex,
  hexToRgb,
  RGBColor
} from "./utils/imageProcessor";
import { SAMPLE_LOGOS } from "./constants";

export default function App() {
  // Main states
  const [fileMeta, setFileMeta] = useState<{ name: string; size: string; type: string } | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string>("");
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>("");

  // Background removal states
  const [bgColor, setBgColor] = useState<RGBColor>({ r: 255, g: 255, b: 255 });
  const [tolerance, setTolerance] = useState<number>(35);
  const [feather, setFeather] = useState<number>(1);
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);

  // Restore brush states
  const [brushSize, setBrushSize] = useState<number>(30);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });

  // Download states
  const [downloadFormat, setDownloadFormat] = useState<"png" | "jpg-white" | "jpg-black" | "webp">("png");

  // Magic step state (0 = inactive, 1 to 4 are sequential steps)
  const [magicLoadingStep, setMagicLoadingStep] = useState<number>(0);

  // Notifications HUD
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // References
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Flash message timeouts
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Convert base64 SVG to data URL
  const convertSvgToDataUrl = (svgStr: string): string => {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgStr)))}`;
  };

  // Main canvas rendering & color-keying effect
  const processAndDraw = () => {
    const origCanvas = originalCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const displayCanvas = displayCanvasRef.current;
    const procCanvas = processedCanvasRef.current;
    
    if (!origCanvas || !maskCanvas || !displayCanvas || !procCanvas) return;

    const origCtx = origCanvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    const displayCtx = displayCanvas.getContext("2d");
    const procCtx = procCanvas.getContext("2d");

    if (!origCtx || !maskCtx || !displayCtx || !procCtx) return;

    const width = origCanvas.width;
    const height = origCanvas.height;

    // Adjust sizes for processed and display canvases to fit original high resolution
    displayCanvas.width = width;
    displayCanvas.height = height;
    procCanvas.width = width;
    procCanvas.height = height;

    // 1. Get original image data
    const origData = origCtx.getImageData(0, 0, width, height);

    // 2. Run Euclidean color thresholding algorithm
    const removedData = removeBackground(origData, bgColor, tolerance, feather);

    // 3. Blend the manual restore drawing mask on top
    const maskData = maskCtx.getImageData(0, 0, width, height);
    const dest = removedData.data;
    const src = origData.data;
    const mask = maskData.data;

    for (let i = 0; i < dest.length; i += 4) {
      // If the user manually painted over this pixel (mask alpha > 0)
      if (mask[i + 3] > 0) {
        dest[i] = src[i];
        dest[i + 1] = src[i + 1];
        dest[i + 2] = src[i + 2];
        dest[i + 3] = src[i + 3]; // Restore original pixel and original alpha
      }
    }

    // 4. Save clean processed version in the offscreen canvas
    procCtx.clearRect(0, 0, width, height);
    procCtx.putImageData(removedData, 0, 0);

    // 5. Output to display canvas
    displayCtx.clearRect(0, 0, width, height);
    displayCtx.putImageData(removedData, 0, 0);
  };

  // Trigger processAndDraw whenever background removal inputs change
  useEffect(() => {
    if (originalSrc) {
      processAndDraw();
    }
  }, [bgColor, tolerance, feather, originalSrc]);

  // Magic background removal automatic trigger
  const triggerMagicProcessing = (dataUrl: string, fileName: string, fileSize: string, fileType: string) => {
    setMagicLoadingStep(1);
    setFileMeta({ name: fileName, size: fileSize, type: fileType });

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // 1. Setup offscreen original canvas
      const origCanvas = originalCanvasRef.current;
      if (origCanvas) {
        origCanvas.width = width;
        origCanvas.height = height;
        const ctx = origCanvas.getContext("2d");
        ctx?.clearRect(0, 0, width, height);
        ctx?.drawImage(img, 0, 0);
      }

      // 2. Setup offscreen mask canvas (initially clean/blank)
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas) {
        maskCanvas.width = width;
        maskCanvas.height = height;
        const ctx = maskCanvas.getContext("2d");
        ctx?.clearRect(0, 0, width, height);
      }

      // 3. Detect background color
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const detected = detectBackgroundColor(imgData);
        setBgColor(detected);
      }

      setOriginalSrc(dataUrl);

      // Play the step-by-step sequential loader
      setTimeout(() => {
        setMagicLoadingStep(2);
        setTimeout(() => {
          setMagicLoadingStep(3);
          setTimeout(() => {
            setMagicLoadingStep(4);
            setTimeout(() => {
              setMagicLoadingStep(0); // Finished!
              setSuccessMessage("تمت إزالة خلفية الشعار تلقائياً بنجاح! 🪄");
            }, 400);
          }, 400);
        }, 400);
      }, 400);
    };
    img.onerror = () => {
      setMagicLoadingStep(0);
      setErrorMessage("عذراً، فشل في قراءة محتوى الملف الصوري.");
    };
    img.src = dataUrl;
  };

  // Handle uploaded images (PNG/JPG)
  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      triggerMagicProcessing(
        dataUrl,
        file.name,
        `${(file.size / 1024).toFixed(1)} KB`,
        file.type || "image/png"
      );
    };
    reader.readAsDataURL(file);
  };

  // Handle uploaded PDF files via PDF.js on client-side
  const handlePdfFile = async (file: File) => {
    setIsRenderingPdf(true);
    setLoadingProgress("جاري استيراد ملف PDF وتحويل الصفحة الأولى...");
    try {
      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore
      if (!window.pdfjsLib) {
        throw new Error("مكتبة قراءة PDF غير متوفرة حالياً.");
      }
      // @ts-ignore
      const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2.0 }); // sharpr rendering
      
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        const pageDataUrl = canvas.toDataURL("image/png");
        
        triggerMagicProcessing(
          pageDataUrl,
          file.name,
          `PDF صفحة ١ / ${(file.size / 1024).toFixed(1)} KB`,
          "image/png"
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("حدث خطأ أثناء فك مستند الـ PDF.");
    } finally {
      setIsRenderingPdf(false);
      setLoadingProgress("");
    }
  };

  // File input picker handler
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      handlePdfFile(file);
    } else {
      handleImageFile(file);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      handlePdfFile(file);
    } else {
      handleImageFile(file);
    }
  };

  // Load preset sample logo
  const loadSampleLogo = (logoId: string) => {
    const sample = SAMPLE_LOGOS.find((l) => l.id === logoId);
    if (!sample) return;

    const dataUrl = convertSvgToDataUrl(sample.svg);
    triggerMagicProcessing(
      dataUrl,
      `نموذج_${sample.id}.png`,
      "شعار افتراضي",
      "image/svg+xml"
    );
  };

  // Pipette Manual Color Picking
  const handlePipetteClick = () => {
    setIsPickingColor(!isPickingColor);
    if (!isPickingColor) {
      setSuccessMessage("انقر الآن في أي مكان داخل لوحة الشعار لاختيار لون الخلفية المستهدف!");
    }
  };

  const handleDisplayCanvasClickForColor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor) return;
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale back to natural high-res width
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const imgData = ctx.getImageData(x, y, 1, 1).data;
    setBgColor({
      r: imgData[0],
      g: imgData[1],
      b: imgData[2]
    });
    setIsPickingColor(false);
    setSuccessMessage("تم التقاط لون الخلفية بنجاح وتصفيته! 🪄");
  };

  // Restore brush drawing math
  const startDrawing = (clientX: number, clientY: number, target: HTMLCanvasElement) => {
    if (!originalSrc || magicLoadingStep || isPickingColor) return;
    setIsDrawing(true);
    
    const rect = target.getBoundingClientRect();
    const scaleX = target.width / rect.width;
    const scaleY = target.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    lastPosRef.current = { x, y };
    drawOnMask(x, y, x, y);
  };

  const draw = (clientX: number, clientY: number, target: HTMLCanvasElement) => {
    if (!isDrawing || !lastPosRef.current) return;
    
    const rect = target.getBoundingClientRect();
    const scaleX = target.width / rect.width;
    const scaleY = target.height / rect.height;
    
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    drawOnMask(lastPosRef.current.x, lastPosRef.current.y, x, y);
    lastPosRef.current = { x, y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const drawOnMask = (x1: number, y1: number, x2: number, y2: number) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = "rgba(255, 255, 255, 1.0)"; // Pure white indicates restore pixels

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Redraw final output
    processAndDraw();
  };

  const handleMouseMoveWithRing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      show: true
    });
    draw(e.clientX, e.clientY, e.currentTarget);
  };

  const handleMouseLeave = () => {
    setMousePos((prev) => ({ ...prev, show: false }));
    stopDrawing();
  };

  // Mobile/Tablet touch events mapping
  const getTouchCoords = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    return { clientX: touch.clientX, clientY: touch.clientY };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getTouchCoords(e);
    startDrawing(coords.clientX, coords.clientY, e.currentTarget);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) {
      e.preventDefault();
    }
    const coords = getTouchCoords(e);
    draw(coords.clientX, coords.clientY, e.currentTarget);
  };

  // Reset restore modifications
  const handleResetMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    processAndDraw();
    setSuccessMessage("تم حذف تعديلات الفرشاة وتصفية الشعار بالكامل!");
  };

  // Final export download generator
  const handleDownload = () => {
    const procCanvas = processedCanvasRef.current;
    if (!procCanvas) return;

    // Refresh calculations just in case
    processAndDraw();

    // Determine cropped bounds if Auto-Crop is checked
    let exportCanvas: HTMLCanvasElement = procCanvas;
    if (autoCrop) {
      exportCanvas = cropTransparentMargins(procCanvas);
    }

    const finalCanvas = document.createElement("canvas");
    const ctx = finalCanvas.getContext("2d");
    if (!ctx) return;

    finalCanvas.width = exportCanvas.width;
    finalCanvas.height = exportCanvas.height;

    // Render background colors if solid JPG selected
    if (downloadFormat === "jpg-white") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    } else if (downloadFormat === "jpg-black") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    }

    // Draw the transparent logo
    ctx.drawImage(exportCanvas, 0, 0);

    // Save
    let extension = "png";
    let mimeType = "image/png";
    if (downloadFormat === "webp") {
      mimeType = "image/webp";
      extension = "webp";
    } else if (downloadFormat.startsWith("jpg")) {
      mimeType = "image/jpeg";
      extension = "jpg";
    }

    const dataUrl = finalCanvas.toDataURL(mimeType, 0.95);
    const link = document.createElement("a");
    link.download = `ClearCut_${fileMeta?.name.split(".")[0] || "logo"}.${extension}`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMessage(`تم تنزيل الشعار بصيغة ${extension.toUpperCase()} بنجاح! 💾`);
  };

  // Reset entire page state
  const handleResetApp = () => {
    setOriginalSrc("");
    setFileMeta(null);
    setSuccessMessage("تم تصفير المحرر بالكامل.");
  };

  return (
    <div id="clear-cut-app" className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-slate-900">
      
      {/* Toast HUD */}
      {successMessage && (
        <div id="toast-success" className="fixed top-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 border border-emerald-500 font-semibold animate-bounce">
          <Check className="w-5 h-5 bg-white text-emerald-600 rounded-full p-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div id="toast-error" className="fixed top-6 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-6 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 border border-rose-500 font-semibold animate-pulse">
          <AlertCircle className="w-5 h-5 bg-white text-rose-600 rounded-full p-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Magical Checklist Loader Overlay */}
      {magicLoadingStep > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl text-center flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-indigo-600/10 text-indigo-600 flex items-center justify-center text-2xl font-bold animate-spin duration-1000">
                🪄
              </div>
              <div className="absolute inset-0 border-2 border-dashed border-indigo-600 rounded-full animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">🪄 جاري معالجة الشعار...</h3>
              <p className="text-xs text-slate-500 mt-1">عزل وتصفية خلفية الشعار تلقائياً</p>
            </div>
            
            <div className="w-full flex flex-col gap-2.5 text-right mt-2 bg-slate-50 p-4 rounded-xl border border-slate-100/50">
              <div className="flex items-center gap-2.5 text-xs">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${magicLoadingStep >= 1 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {magicLoadingStep > 1 ? "✓" : "١"}
                </div>
                <span className={`font-semibold ${magicLoadingStep >= 1 ? "text-slate-800" : "text-slate-400"}`}>🔮 جاري استكشاف أبعاد الشعار...</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${magicLoadingStep >= 2 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {magicLoadingStep > 2 ? "✓" : "٢"}
                </div>
                <span className={`font-semibold ${magicLoadingStep >= 2 ? "text-slate-800" : "text-slate-400"}`}>✨ فك الترميز اللوني واستخلاص الخلفية...</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${magicLoadingStep >= 3 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {magicLoadingStep > 3 ? "✓" : "٣"}
                </div>
                <span className={`font-semibold ${magicLoadingStep >= 3 ? "text-slate-800" : "text-slate-400"}`}>🪄 عزل وتصفية الخلفية بدقة...</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${magicLoadingStep >= 4 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {magicLoadingStep > 4 ? "✓" : "٤"}
                </div>
                <span className={`font-semibold ${magicLoadingStep >= 4 ? "text-slate-800" : "text-slate-400"}`}>🎨 تهيئة وتثبيت فرشاة الاسترجاع...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Generation Loader */}
      {isRenderingPdf && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center flex flex-col items-center gap-3 border border-slate-100 shadow-xl">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="font-bold text-sm text-slate-800">{loadingProgress}</p>
          </div>
        </div>
      )}

      {/* Header Row */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center shadow-md">
              <span className="font-extrabold text-xl text-slate-950">✂️</span>
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight">Clear Cut</h1>
              <p className="text-[10px] text-slate-500 font-medium">Professional logo background remover</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-6 flex-1">
        
        {/* Hidden canvases for offscreen pipeline calculations */}
        <canvas ref={originalCanvasRef} className="hidden" />
        <canvas ref={maskCanvasRef} className="hidden" />
        <canvas ref={processedCanvasRef} className="hidden" />

        {/* View 1: If No File Uploaded, Show the Big Dropzone */}
        {!originalSrc ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-10 shadow-xs flex flex-col gap-6 animate-fadeIn">
            
            <div className="text-center max-w-md mx-auto">
              <h2 className="text-xl font-extrabold text-slate-900">مرحباً بك في Clear Cut!</h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                ارفع صورة شعارك (PNG أو JPG أو PDF) وسيقوم التطبيق بإلغاء الخلفية فوراً مع إمكانية تلوين الأجزاء لاستعادتها وتحميل الملف بالصيغة المفضلة.
              </p>
            </div>

            {/* Dotted Uploader Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-600/60 rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-slate-50 group relative"
            >
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileInputChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-indigo-600/10 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-extrabold text-slate-800">اسحب وأسقط ملف الشعار هنا</p>
                  <p className="text-xs text-slate-400 mt-1">يدعم ملفات الصور PNG ، JPG ومستندات PDF</p>
                </div>
                <button className="text-xs bg-white text-slate-700 hover:bg-indigo-600 hover:text-white font-bold px-4 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-xs">
                  تصفح ملفات جهازك
                </button>
              </div>
            </div>

          </div>
        ) : (
          
          /* View 2: If File Loaded, Display Workspace */
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* Top Info Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-slate-800">{fileMeta?.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{fileMeta?.size}</p>
                </div>
              </div>
              
              <button
                onClick={handleResetApp}
                className="text-xs text-rose-600 hover:bg-rose-50 border border-rose-200/60 font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف وتغيير الملف</span>
              </button>
            </div>

            {/* Core Two-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: Interactive Drawing Canvas (7 cols) */}
              <div className="md:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col gap-4 relative overflow-hidden">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Brush className="w-4 h-4 text-indigo-600" />
                    <span>لوحة العرض التفاعلية وفرشاة الاسترجاع</span>
                  </span>
                  
                  {isPickingColor && (
                    <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-full font-extrabold animate-pulse">
                      القطارة نشطة 🎯
                    </span>
                  )}
                </div>

                {/* Display Frame Wrap with checkerboard representation */}
                <div className="relative w-full aspect-square max-w-md mx-auto rounded-xl overflow-hidden shadow-inner border border-slate-100 transition-all flex items-center justify-center bg-checkerboard select-none">
                  
                  <canvas
                    ref={displayCanvasRef}
                    onClick={handleDisplayCanvasClickForColor}
                    onMouseDown={(e) => startDrawing(e.clientX, e.clientY, e.currentTarget)}
                    onMouseMove={handleMouseMoveWithRing}
                    onMouseUp={stopDrawing}
                    onMouseLeave={handleMouseLeave}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={stopDrawing}
                    className={`block w-full h-auto max-h-[400px] object-contain ${
                      isPickingColor ? "cursor-crosshair" : "cursor-none"
                    }`}
                  />

                  {/* Pipette instructions overlay */}
                  {isPickingColor && (
                    <div className="absolute inset-x-0 bottom-4 mx-auto max-w-xs bg-slate-900/90 text-white p-2.5 rounded-xl text-center text-[10px] font-bold shadow-lg pointer-events-none z-40 animate-bounce">
                      انقر على أي لون لإزالته تلقائياً 🪄
                    </div>
                  )}

                  {/* Accurate Screen Brush Size Ring */}
                  {mousePos.show && displayCanvasRef.current && !isPickingColor && (
                    <div
                      className="absolute rounded-full border-2 border-indigo-600 bg-indigo-600/15 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-40 shadow-[0_0_8px_rgba(79,70,229,0.3)]"
                      style={{
                        left: mousePos.x,
                        top: mousePos.y,
                        width: `${brushSize * (displayCanvasRef.current.clientWidth / displayCanvasRef.current.width)}px`,
                        height: `${brushSize * (displayCanvasRef.current.clientWidth / displayCanvasRef.current.width)}px`,
                      }}
                    />
                  )}
                </div>

                {/* Hint Text */}
                <div className="bg-indigo-50/50 border border-indigo-200/40 p-3 rounded-xl">
                  <p className="text-[11px] text-indigo-900 leading-relaxed text-right font-medium">
                    💡 <strong>طريقة الاسترجاع:</strong> هل انحذف جزء من الشعار بالخطأ؟ ما عليك سوى تمرير إصبعك أو الفأرة فوق الأجزاء المحذوفة لتقوم <strong>الفرشاة الذكية</strong> باستعادتها فوراً وبأقصى دقة!
                  </p>
                </div>

              </div>

              {/* Right Column: Controls & Downloads (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-6">
                
                {/* Panel 1: Adjust Transparency */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-50 pb-2">
                    <span>إعدادات الشفافية والعزل</span>
                    <Sliders className="w-4 h-4 text-slate-400" />
                  </h3>

                  {/* Target background and Picker */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg border border-slate-300 shadow-xs flex-shrink-0"
                        style={{ backgroundColor: rgbToHex(bgColor.r, bgColor.g, bgColor.b) }}
                      />
                      <div>
                        <p className="text-[11px] font-extrabold text-slate-800 font-mono">
                          {rgbToHex(bgColor.r, bgColor.g, bgColor.b).toUpperCase()}
                        </p>
                        <p className="text-[9px] text-slate-400">اللون المعزول حالياً</p>
                      </div>
                    </div>

                    <button
                      onClick={handlePipetteClick}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        isPickingColor
                          ? "bg-indigo-600 text-white animate-pulse"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                      title="انقر لتفعيل القطارة واختيار لون مخصص من الشعار"
                    >
                      <Pipette className="w-3.5 h-3.5" />
                      <span>قطارة مخصصة</span>
                    </button>
                  </div>

                  {/* Tolerance Threshold */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-extrabold text-slate-600">درجة الحساسية (Tolerance):</label>
                      <span className="text-xs text-indigo-600 font-black">{tolerance}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[9px] text-slate-400 block mt-1">حرك يميناً لزيادة كمية الخلفية المعزولة</span>
                  </div>

                  {/* Edge Feathering */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-extrabold text-slate-600">تنعيم الحواف (Feathering):</label>
                      <span className="text-xs text-indigo-600 font-black">{feather}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={feather}
                      onChange={(e) => setFeather(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[9px] text-slate-400 block mt-1">تنعيم وإخفاء نتوءات أطراف الشعار المعزول</span>
                  </div>

                </div>

                {/* Panel 2: Brush Settings */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-50 pb-2">
                    <span>إعدادات فرشاة الاسترجاع</span>
                    <Brush className="w-4 h-4 text-slate-400" />
                  </h3>

                  {/* Brush Size Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-extrabold text-slate-600">حجم الفرشاة (Brush Size):</label>
                      <span className="text-xs text-indigo-600 font-black">{brushSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-[9px] text-slate-400 block mt-1">تحكم بحجم دائرة الرسم لتسهيل استرجاع الأجزاء الدقيقة</span>
                  </div>

                  {/* Reset Brush edits */}
                  <button
                    onClick={handleResetMask}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100/80 text-slate-600 hover:text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    <span>حذف تعديلات الفرشاة (تصفية كاملة)</span>
                  </button>
                </div>

                {/* Panel 3: Choose Format & Download */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-50 pb-2">
                    <span>صيغة الشعار وحفظ الملف</span>
                    <Download className="w-4 h-4 text-slate-400" />
                  </h3>

                  {/* Auto Crop Switch */}
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">قص الهوامش الشفافة (Auto-Crop)</span>
                      <span className="text-[9px] text-slate-400">إزالة الفراغات الميتة حول الشعار</span>
                    </div>
                    <button
                      onClick={() => setAutoCrop(!autoCrop)}
                      className={`w-12 h-6 rounded-full p-1 transition-all cursor-pointer ${
                        autoCrop ? "bg-indigo-600 flex justify-end" : "bg-slate-200 flex justify-start"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full transition-all ${autoCrop ? "bg-white shadow-xs" : "bg-slate-400"}`} />
                    </button>
                  </div>

                  {/* Formats segment control */}
                  <div>
                    <label className="text-[11px] font-extrabold text-slate-600 block mb-2">اختر صيغة التصدير المطلوبة:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setDownloadFormat("png")}
                        className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                          downloadFormat === "png"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
                        }`}
                      >
                        PNG (شفاف)
                      </button>
                      
                      <button
                        onClick={() => setDownloadFormat("webp")}
                        className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                          downloadFormat === "webp"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
                        }`}
                      >
                        WEBP (شفاف)
                      </button>

                      <button
                        onClick={() => setDownloadFormat("jpg-white")}
                        className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                          downloadFormat === "jpg-white"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
                        }`}
                      >
                        JPG (خلفية بيضاء)
                      </button>

                      <button
                        onClick={() => setDownloadFormat("jpg-black")}
                        className={`p-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                          downloadFormat === "jpg-black"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200/60"
                        }`}
                      >
                        JPG (خلفية سوداء)
                      </button>
                    </div>
                  </div>

                  {/* Mega Download Button */}
                  <button
                    onClick={handleDownload}
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all text-sm cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>تحميل الشعار النهائي</span>
                  </button>

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

      {/* Simplified, Humble Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-slate-400 text-[11px] mt-auto">
        <p>© 2026 Clear Cut. كافة الحقوق محفوظة. أداة ممحاة خلفيات الشعارات الذكية وبلمسات سريعة.</p>
      </footer>

    </div>
  );
}
