/**
 * ORBE PDF Template System
 * Brutalist dark design with amber accents matching the landing page aesthetic.
 * Uses jsPDF with manual drawing for the branded layout.
 */
import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";

// ── Design tokens ──
const C = {
  black: "#080808",
  dark: "#0e0e0e",
  card: "#141414",
  card2: "#1a1a1a",
  amber: "#E87C1E",
  amber2: "#F5A623",
  white: "#F5F0E8",
  grey: "#6B6B6B",
  text: "#C8BFB0",
  border: "#1F1F1F",
  red: "#F87171",
  green: "#4ADE80",
  blue: "#60A5FA",
};

// ── Helpers ──
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function setColor(doc: jsPDF, hex: string, type: "fill" | "text" | "draw" = "text") {
  const [r, g, b] = hexToRgb(hex);
  if (type === "fill") doc.setFillColor(r, g, b);
  else if (type === "draw") doc.setDrawColor(r, g, b);
  else doc.setTextColor(r, g, b);
}

// ── Page background ──
function drawPageBg(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  setColor(doc, C.black, "fill");
  doc.rect(0, 0, w, h, "F");
}

// ── Header with ORBE branding ──
function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();

  // Top amber accent line
  setColor(doc, C.amber, "fill");
  doc.rect(0, 0, w, 2, "F");

  // Background card strip for header
  setColor(doc, C.card, "fill");
  doc.rect(0, 2, w, 40, "F");

  // Bottom border
  setColor(doc, C.border, "fill");
  doc.rect(0, 42, w, 0.5, "F");

  // Logo "ORBE"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  setColor(doc, C.white);
  doc.text("OR", 14, 22);
  const orWidth = doc.getTextWidth("OR");
  setColor(doc, C.amber);
  doc.text("BE", 14 + orWidth, 22);

  // Subtitle label (like the section labels)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(doc, C.amber);
  // Draw a small dash before label
  setColor(doc, C.amber, "fill");
  doc.rect(14, 28.5, 12, 0.4, "F");
  doc.text(subtitle.toUpperCase(), 28, 29);

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  setColor(doc, C.white);
  doc.text(title, 14, 38);

  // Date on right
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setColor(doc, C.grey);
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const dateW = doc.getTextWidth(dateStr);
  doc.text(dateStr, w - 14 - dateW, 38);

  return 52; // next Y position
}

// ── Section title ──
function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  if (y > 260) { doc.addPage(); drawPageBg(doc); y = 20; }

  // Amber bar
  setColor(doc, C.amber, "fill");
  doc.rect(14, y, 3, 12, "F");

  // Background
  setColor(doc, C.card, "fill");
  doc.rect(17, y, doc.internal.pageSize.getWidth() - 31, 12, "F");

  // Text
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(doc, C.white);
  doc.text(title.toUpperCase(), 22, y + 8);

  return y + 18;
}

// ── Stat card ──
function drawStatCard(doc: jsPDF, x: number, y: number, width: number, label: string, value: string, color: string = C.amber) {
  // Card bg
  setColor(doc, C.card, "fill");
  doc.rect(x, y, width, 28, "F");

  // Top accent
  setColor(doc, color, "fill");
  doc.rect(x, y, width, 1.5, "F");

  // Label
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  setColor(doc, C.grey);
  doc.text(label.toUpperCase(), x + 8, y + 10);

  // Value
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  setColor(doc, color);
  doc.text(value, x + 8, y + 22);
}

// ── Styled autoTable with ORBE theme ──
function drawTable(doc: jsPDF, startY: number, head: string[], body: string[][], options?: Partial<UserOptions>): number {
  autoTable(doc, {
    startY,
    head: [head],
    body,
    theme: "plain",
    styles: {
      fillColor: hexToRgb(C.card),
      textColor: hexToRgb(C.text),
      lineColor: hexToRgb(C.border),
      lineWidth: 0.3,
      fontSize: 8,
      cellPadding: 5,
      font: "helvetica",
    },
    headStyles: {
      fillColor: hexToRgb(C.card2),
      textColor: hexToRgb(C.grey),
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: hexToRgb(C.dark),
    },
    columnStyles: {},
    didParseCell: (data) => {
      // Status column highlighting
      const text = data.cell.text?.[0];
      if (text === "Pago" || text === "✓") {
        data.cell.styles.textColor = hexToRgb(C.green);
        data.cell.styles.fontStyle = "bold";
      } else if (text === "Pendente" || text === "✗") {
        data.cell.styles.textColor = hexToRgb(C.amber);
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: 14, right: 14 },
    ...options,
  });
  return (doc as any).lastAutoTable?.finalY || startY + 20;
}

// ── Footer ──
function drawFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);

    // Bottom line
    setColor(doc, C.border, "fill");
    doc.rect(14, h - 16, w - 28, 0.3, "F");

    // Left: branding
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    setColor(doc, C.grey);
    doc.text("ORBE", 14, h - 8);
    setColor(doc, C.amber);
    const orbeW = doc.getTextWidth("ORBE");
    doc.text(" — Seu universo pessoal", 14 + orbeW, h - 8);

    // Right: page number
    setColor(doc, C.grey);
    doc.setFont("helvetica", "normal");
    const pageText = `${i}/${pages}`;
    const tw = doc.getTextWidth(pageText);
    doc.text(pageText, w - 14 - tw, h - 8);
  }
}

// ── Progress bar ──
function drawProgressBar(doc: jsPDF, x: number, y: number, width: number, percent: number, label?: string) {
  // Track
  setColor(doc, C.card2, "fill");
  doc.rect(x, y, width, 4, "F");

  // Fill
  const clampedPct = Math.min(Math.max(percent, 0), 100);
  const fillColor = clampedPct > 80 ? C.red : clampedPct > 50 ? C.amber : C.green;
  setColor(doc, fillColor, "fill");
  doc.rect(x, y, width * (clampedPct / 100), 4, "F");

  // Label
  if (label) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(doc, C.grey);
    doc.text(label, x, y + 10);
  }
}

// ── List item (bullet point) ──
function drawListItem(doc: jsPDF, y: number, text: string, indent: number = 20): number {
  if (y > 275) { doc.addPage(); drawPageBg(doc); y = 20; }

  // Amber dot
  setColor(doc, C.amber, "fill");
  doc.circle(indent - 4, y - 1.2, 1, "F");

  // Text
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setColor(doc, C.text);
  const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - indent - 14);
  doc.text(lines, indent, y);

  return y + (lines.length * 5) + 2;
}

// ── Checklist item ──
function drawChecklistItem(doc: jsPDF, y: number, text: string, checked: boolean = false): number {
  if (y > 275) { doc.addPage(); drawPageBg(doc); y = 20; }

  // Checkbox
  setColor(doc, C.border, "draw");
  doc.rect(18, y - 3.5, 4, 4);
  if (checked) {
    setColor(doc, C.amber, "fill");
    doc.rect(18.5, y - 3, 3, 3, "F");
  }

  // Text
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setColor(doc, checked ? C.grey : C.text);
  doc.text(text, 26, y);

  return y + 7;
}

// ── Key-value pair ──
function drawKeyValue(doc: jsPDF, y: number, key: string, value: string, valueColor: string = C.amber): number {
  if (y > 275) { doc.addPage(); drawPageBg(doc); y = 20; }

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  setColor(doc, C.grey);
  doc.text(key.toUpperCase(), 14, y);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  setColor(doc, valueColor);
  doc.text(value, 14, y + 8);

  return y + 14;
}

// ── Create a new ORBE-styled document ──
export function createOrbeDoc(): jsPDF {
  const doc = new jsPDF();
  drawPageBg(doc);
  return doc;
}

// ── Finalize (add footers to all pages, apply bg to all pages) ──
export function finalizeDoc(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    drawPageBg(doc);
  }
  drawFooter(doc);
}

// ── Ensure we don't overflow the page ──
export function checkPage(doc: jsPDF, y: number, needed: number = 30): number {
  if (y + needed > 275) {
    doc.addPage();
    drawPageBg(doc);
    return 20;
  }
  return y;
}

export {
  drawHeader,
  drawSectionTitle,
  drawStatCard,
  drawTable,
  drawFooter,
  drawPageBg,
  drawProgressBar,
  drawListItem,
  drawChecklistItem,
  drawKeyValue,
  C as PDF_COLORS,
};
