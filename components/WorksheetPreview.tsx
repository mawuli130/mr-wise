
import React, { useRef, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import Button from './Button';
import { AppMode, ExamBoard, BulkOptions } from '../types';

interface WorksheetPreviewProps {
  mode: AppMode;
  year: string;
  board: ExamBoard;
  subject: string;
  content: string;
  packOptions: BulkOptions;
  onClose: () => void;
}

const WorksheetPreview: React.FC<WorksheetPreviewProps> = ({ 
  mode, 
  year, 
  board, 
  subject, 
  content, 
  packOptions,
  onClose 
}) => {
  const [pages, setPages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);

  const getCleanSubject = () => subject.trim().replace(/\s+/g, '-') || 'General-Studies';
  
  const getFileName = () => {
    const base = getCleanSubject();
    const parts: string[] = [];
    if (packOptions.questions) parts.push('Trials');
    if (packOptions.solutions) parts.push('Solutions');
    if (packOptions.guide) parts.push('Guide');
    
    return `${parts.join('-')}-${base}`;
  };

  useEffect(() => {
    const generatePages = async () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = 1000;
      const height = 1414; 
      const margin = 80;
      const maxWidth = width - (margin * 2);
      const lineHeight = 34;
      const headerSpace = 180; 
      const footerSpace = 120;
      const contentHeightPerPage = height - headerSpace - footerSpace;

      const rawLines = content.split('\n');
      const processedLines: { segments: { text: string, bold: boolean, code: boolean }[], isDivider?: boolean, isItemSeparator?: boolean }[] = [];
      let isCodeBlock = false;

      rawLines.forEach(line => {
        if (line.startsWith('```')) {
          isCodeBlock = !isCodeBlock;
          return;
        }

        if (line.trim() === '----------------------------------------') {
          processedLines.push({ segments: [], isItemSeparator: true });
          return;
        }

        const isMajorHeader = line.trim().startsWith('*QUESTIONS*') || 
                             line.trim().startsWith('*SOLUTIONS*') || 
                             line.trim().startsWith('*TUTOR GUIDE*');

        if (isMajorHeader && processedLines.length > 0) {
          processedLines.push({ segments: [], isDivider: true });
        }

        if (isCodeBlock) {
          processedLines.push({ segments: [{ text: line, bold: false, code: true }] });
        } else {
          const parts = line.split('*');
          let currentLineSegments: { text: string, bold: boolean, code: boolean }[] = [];
          let currentLineWidth = 0;

          parts.forEach((part, idx) => {
            const isBold = idx % 2 === 1;
            const words = part.split(' ');
            
            words.forEach((word, wordIdx) => {
              const text = word + (wordIdx === words.length - 1 ? '' : ' ');
              ctx.font = isBold ? 'bold 20px Inter, sans-serif' : '20px Inter, sans-serif';
              const wordWidth = ctx.measureText(text).width;

              if (currentLineWidth + wordWidth > maxWidth && currentLineSegments.length > 0) {
                processedLines.push({ segments: currentLineSegments });
                currentLineSegments = [];
                currentLineWidth = 0;
              }

              currentLineSegments.push({ text, bold: isBold, code: false });
              currentLineWidth += wordWidth;
            });
          });

          if (currentLineSegments.length > 0) {
            processedLines.push({ segments: currentLineSegments });
          } else {
            processedLines.push({ segments: [{ text: '', bold: false, code: false }] });
          }
        }
      });

      const linesPerPage = Math.floor(contentHeightPerPage / lineHeight);
      const totalPages = Math.ceil(processedLines.length / (linesPerPage || 1));
      const generatedPages: string[] = [];

      for (let p = 0; p < totalPages; p++) {
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Watermark
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(5, 150, 105, 0.03)';
        ctx.font = 'bold 160px Inter, sans-serif';
        ctx.fillText('MR. WISE LEGIT', 0, 0);
        ctx.restore();

        // Header
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 42px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Mr. Wise Legit Source', width / 2, 80);
        
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.fillStyle = '#059669';
        ctx.fillText(`${board.toUpperCase()} ${year} • ${subject.split(' - ')[0]}`, width / 2, 115);
        
        ctx.font = 'italic 14px Inter, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(`Official Sheet • Page ${p + 1} of ${totalPages}`, width / 2, 145);

        // Content
        const pageLines = processedLines.slice(p * linesPerPage, (p + 1) * linesPerPage);
        pageLines.forEach((line, idx) => {
          let currentX = margin;
          const y = headerSpace + (idx * lineHeight);

          if (line.isItemSeparator) {
            ctx.strokeStyle = '#059669';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(margin, y - 10);
            ctx.lineTo(width - margin, y - 10);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillStyle = '#059669';
            ctx.textAlign = 'center';
            ctx.fillText('NEXT ITEM IN PACK', width / 2, y + 15);
            return;
          }

          if (line.isDivider) {
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margin, y - 10);
            ctx.lineTo(width - margin, y - 10);
            ctx.stroke();
            return;
          }

          line.segments.forEach(seg => {
            ctx.font = seg.code ? '16px "Courier New", monospace' : (seg.bold ? 'bold 21px Inter, sans-serif' : '20px Inter, sans-serif');
            ctx.fillStyle = seg.code ? '#065f46' : '#111827';
            ctx.textAlign = 'left';
            ctx.fillText(seg.text, currentX, y);
            currentX += ctx.measureText(seg.text).width;
          });
        });

        // Footer
        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`THE LEGIT SOURCE FOR ${year} EXAMS • PREPARED BY MR. WISE LEGIT SOURCE`, width / 2, height - 70);
        ctx.fillText('+233 20 768 9520 | +233 25 631 1834', width / 2, height - 50);

        generatedPages.push(canvas.toDataURL('image/png'));
      }

      setPages(generatedPages);
      setIsGenerating(false);
    };

    generatePages();
  }, [content, subject, mode, year, board, packOptions]);

  const downloadAsPDF = () => {
    const pdf = new jsPDF('p', 'px', [1000, 1414]);
    pages.forEach((data, idx) => {
      if (idx > 0) pdf.addPage();
      pdf.addImage(data, 'PNG', 0, 0, 1000, 1414);
    });
    pdf.save(`${getFileName()}.pdf`);
  };

  const downloadAllImages = () => {
    const fileNameBase = getFileName();
    pages.forEach((p, i) => {
      const a = document.createElement('a');
      a.href = p;
      a.download = `${fileNameBase}-Page${i + 1}.png`;
      a.click();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-white">
          <div>
            <h3 className="font-black text-xl text-gray-900 uppercase tracking-tight">Bulk Package Preview</h3>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Multi-Item Compilation</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-400">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-zinc-100">
          {isGenerating ? (
             <div className="h-full flex flex-col items-center justify-center">
               <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
               <p className="font-black text-emerald-600 uppercase animate-pulse">Building Official Pack...</p>
             </div>
          ) : (
            <div className="space-y-12 max-w-3xl mx-auto">
              {pages.map((data, idx) => (
                <div key={idx} className="bg-white shadow-2xl rounded-sm overflow-hidden">
                  <img src={data} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 border-t bg-white flex flex-col sm:flex-row gap-4">
          <Button onClick={downloadAsPDF} variant="danger" className="flex-1 py-5 uppercase font-black tracking-tight text-lg shadow-lg shadow-red-100">Download PDF Pack</Button>
          <Button onClick={downloadAllImages} variant="success" className="flex-1 py-5 uppercase font-black tracking-tight text-lg shadow-lg shadow-emerald-100">Download PNG Images</Button>
        </div>
      </div>
    </div>
  );
};

export default WorksheetPreview;
