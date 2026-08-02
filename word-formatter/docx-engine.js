/*
 * Word 文档格式化 —— 纯浏览器端实现（JSZip 读写 docx，DOMParser 操作内部 XML）
 * 规则式关键词匹配，逻辑与桌面 Python 版本（docx_formatter_engine.py）保持一致。
 */

// ---------- 中文字号 -> 磅值（与 Python 版一致） ----------
const CN_FONT_SIZE = {
  "初号": 42, "小初": 36, "一号": 26, "小一": 24, "二号": 22, "小二": 18,
  "三号": 16, "小三": 15, "四号": 14, "小四": 12, "五号": 10.5, "小五": 9,
  "六号": 7.5, "小六": 6.5, "七号": 5.5, "八号": 5,
};

const COLOR_NAMES = {
  "红色": "FF0000", "蓝色": "0000FF", "黑色": "000000", "绿色": "008000",
  "黄色": "FFFF00", "橙色": "FFA500", "紫色": "800080", "灰色": "808080",
  "深蓝": "00008B", "深蓝色": "00008B", "白色": "FFFFFF", "棕色": "A52A2A",
};

const ALIGN_MAP = {
  "居中": "center", "左对齐": "left", "右对齐": "right",
  "两端对齐": "both", "分散对齐": "distribute",
};

const FONT_NAMES = ["宋体", "黑体", "微软雅黑", "楷体", "仿宋", "隶书", "幼圆", "华文中宋",
  "Times New Roman", "Arial", "Calibri", "Cambria"];

const TARGET_MAP = {
  "正文": "Normal", "全文": "Normal", "全部": "Normal", "body": "Normal",
  "标题": "Heading1", "一级标题": "Heading1", "标题1": "Heading1",
  "二级标题": "Heading2", "标题2": "Heading2",
  "三级标题": "Heading3", "标题3": "Heading3",
};
// 必须按关键词长度从长到短匹配，否则"二级标题"会被子串"标题"抢先命中
// （这是移植 Python 版时已经踩过并修复过的坑，这里直接按正确顺序实现）
const TARGET_KEYWORDS_BY_LENGTH = Object.keys(TARGET_MAP).sort((a, b) => b.length - a.length);

function splitClauses(text) {
  return text.split(/[，,、;；\n]+/).map(s => s.trim()).filter(Boolean);
}

function findTarget(clause) {
  for (const kw of TARGET_KEYWORDS_BY_LENGTH) {
    if (clause.includes(kw)) return [TARGET_MAP[kw], kw];
  }
  return [null, null];
}

// ---------- 解析自然语言格式描述 ----------
function parseDescription(text) {
  const operations = [];
  const unmatched = [];
  const marginOps = [];
  let addPageNumber = false;

  for (const clause of splitClauses(text)) {
    let [targetStyle, targetLabel] = findTarget(clause);
    let foundAny = false;
    if (targetStyle === null) { targetStyle = "Normal"; targetLabel = "正文（默认）"; }

    // 页边距
    let m = clause.match(/(上|下|左|右)(边距|页边距)\s*([\d.]+)\s*(cm|厘米|公分)?/);
    if (m) {
      const sideMap = { "上": "top", "下": "bottom", "左": "left", "右": "right" };
      marginOps.push([sideMap[m[1]], parseFloat(m[3])]);
      foundAny = true;
    }

    // 页码
    if (/(加|插入|添加).{0,4}页码/.test(clause)) {
      addPageNumber = true;
      foundAny = true;
    }

    // 字体
    for (const name of FONT_NAMES) {
      if (clause.includes(name)) {
        operations.push({ target: targetStyle, targetLabel, kind: "font_name", value: name, raw: clause });
        foundAny = true;
        break;
      }
    }

    // 段前/段后间距、首行缩进 —— 必须先于字号数字兜底规则处理
    let numericConsumed = false;
    m = clause.match(/段前(?:间距)?\s*([\d.]+)\s*(磅|pt)/);
    if (m) {
      operations.push({ target: targetStyle, targetLabel, kind: "space_before", value: parseFloat(m[1]), raw: clause });
      foundAny = true; numericConsumed = true;
    }
    m = clause.match(/段后(?:间距)?\s*([\d.]+)\s*(磅|pt)/);
    if (m) {
      operations.push({ target: targetStyle, targetLabel, kind: "space_after", value: parseFloat(m[1]), raw: clause });
      foundAny = true; numericConsumed = true;
    }
    if (/首行缩进/.test(clause)) numericConsumed = true;

    // 字号：中文号数优先，找不到再用数字兜底（但要避开已被间距规则认领的数字）
    let sizeFound = false;
    for (const [name, pt] of Object.entries(CN_FONT_SIZE)) {
      if (clause.includes(name)) {
        operations.push({ target: targetStyle, targetLabel, kind: "font_size", value: pt, raw: clause });
        foundAny = true; sizeFound = true;
        break;
      }
    }
    if (!sizeFound && !numericConsumed) {
      m = clause.match(/(\d+(?:\.\d+)?)\s*(磅|pt|号字)/);
      if (m) {
        operations.push({ target: targetStyle, targetLabel, kind: "font_size", value: parseFloat(m[1]), raw: clause });
        foundAny = true;
      }
    }

    // 加粗/斜体/下划线
    if (/加粗|粗体/.test(clause) && !/不(加粗|要粗体)|取消加粗/.test(clause)) {
      operations.push({ target: targetStyle, targetLabel, kind: "bold", value: true, raw: clause });
      foundAny = true;
    } else if (/不(加粗|要粗体)|取消加粗/.test(clause)) {
      operations.push({ target: targetStyle, targetLabel, kind: "bold", value: false, raw: clause });
      foundAny = true;
    }
    if (/斜体/.test(clause)) {
      operations.push({ target: targetStyle, targetLabel, kind: "italic", value: true, raw: clause });
      foundAny = true;
    }
    if (/下划线/.test(clause)) {
      operations.push({ target: targetStyle, targetLabel, kind: "underline", value: true, raw: clause });
      foundAny = true;
    }

    // 颜色
    let colorFound = false;
    for (const [name, hex] of Object.entries(COLOR_NAMES)) {
      if (clause.includes(name)) {
        operations.push({ target: targetStyle, targetLabel, kind: "color", value: hex, raw: clause });
        foundAny = true; colorFound = true;
        break;
      }
    }
    if (!colorFound) {
      m = clause.match(/#?([0-9A-Fa-f]{6})\b/);
      if (m && (clause.includes("颜色") || clause.includes("色"))) {
        operations.push({ target: targetStyle, targetLabel, kind: "color", value: m[1], raw: clause });
        foundAny = true;
      }
    }

    // 对齐
    for (const [name, align] of Object.entries(ALIGN_MAP)) {
      if (clause.includes(name)) {
        operations.push({ target: targetStyle, targetLabel, kind: "align", value: align, raw: name });
        foundAny = true;
        break;
      }
    }

    // 行距
    m = clause.match(/([\d.]+)\s*倍行距/) || clause.match(/行距\s*([\d.]+)\s*倍/);
    if (m) {
      operations.push({ target: targetStyle, targetLabel, kind: "line_spacing", value: parseFloat(m[1]), raw: clause });
      foundAny = true;
    } else if (clause.includes("单倍行距")) {
      operations.push({ target: targetStyle, targetLabel, kind: "line_spacing", value: 1.0, raw: clause });
      foundAny = true;
    } else if (clause.includes("双倍行距") || clause.includes("两倍行距")) {
      operations.push({ target: targetStyle, targetLabel, kind: "line_spacing", value: 2.0, raw: clause });
      foundAny = true;
    }

    // 首行缩进
    m = clause.match(/首行缩进\s*([\d.]+)\s*(字符|字)/);
    if (m) {
      operations.push({ target: targetStyle, targetLabel, kind: "first_line_indent_chars", value: parseFloat(m[1]), raw: clause });
      foundAny = true;
    } else {
      m = clause.match(/首行缩进\s*([\d.]+)\s*(cm|厘米)/);
      if (m) {
        operations.push({ target: targetStyle, targetLabel, kind: "first_line_indent_cm", value: parseFloat(m[1]), raw: clause });
        foundAny = true;
      }
    }

    if (!foundAny) unmatched.push(clause);
  }

  return { operations, unmatched, marginOps, addPageNumber };
}

// ---------- AI 输出内容解析（标签格式） ----------
const CONTENT_TAG_STYLE = {
  "标题": "Title", "一级标题": "Heading1", "二级标题": "Heading2",
  "三级标题": "Heading3", "正文": "Normal",
};
const TAG_PATTERN = /\[(标题|一级标题|二级标题|三级标题|正文|格式)\]\s*([\s\S]*?)\s*\[\/\1\]/g;

function parseAiOutput(text) {
  const blocks = [];
  let formatText = "";
  const consumedSpans = [];
  let m;
  TAG_PATTERN.lastIndex = 0;
  while ((m = TAG_PATTERN.exec(text)) !== null) {
    const tag = m[1], inner = m[2].trim();
    consumedSpans.push([m.index, m.index + m[0].length]);
    if (tag === "格式") {
      formatText += (formatText ? "\n" : "") + inner;
    } else {
      const styleName = CONTENT_TAG_STYLE[tag];
      if (tag === "正文") {
        for (const line of inner.split("\n")) {
          const t = line.trim();
          if (t) blocks.push([styleName, t]);
        }
      } else {
        blocks.push([styleName, inner]);
      }
    }
  }

  let lastEnd = 0;
  const leftoverParts = [];
  for (const [start, end] of consumedSpans) {
    const chunk = text.slice(lastEnd, start).trim();
    if (chunk) leftoverParts.push(chunk);
    lastEnd = end;
  }
  const tail = text.slice(lastEnd).trim();
  if (tail) leftoverParts.push(tail);

  return { blocks, formatText, leftover: leftoverParts.join("\n") };
}

// ==================== OOXML 操作层 ====================

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function getOrAddChild(parent, tagName) {
  let el = parent.getElementsByTagName(tagName)[0];
  if (!el) {
    el = parent.ownerDocument.createElementNS(W_NS, tagName);
    parent.insertBefore(el, parent.firstChild);
  }
  return el;
}

function getOrAddGrandchild(parent, tagName) {
  let el = parent.getElementsByTagName(tagName)[0];
  if (!el) {
    el = parent.ownerDocument.createElementNS(W_NS, tagName);
    parent.appendChild(el);
  }
  return el;
}

function findStyleElement(stylesDoc, styleId) {
  const styles = stylesDoc.getElementsByTagName("w:style");
  for (const s of styles) {
    if (s.getAttribute("w:styleId") === styleId) return s;
  }
  return null;
}

function applyOperationsToStylesXml(stylesDoc, parsed) {
  const log = [];
  for (const op of parsed.operations) {
    const styleEl = findStyleElement(stylesDoc, op.target);
    if (!styleEl) {
      log.push(`!! 找不到样式「${op.targetLabel}」，跳过：${op.raw}`);
      continue;
    }
    const rPr = getOrAddChild(styleEl, "w:rPr");
    const pPr = getOrAddChild(styleEl, "w:pPr");

    switch (op.kind) {
      case "font_name": {
        const rFonts = getOrAddGrandchild(rPr, "w:rFonts");
        rFonts.setAttribute("w:ascii", op.value);
        rFonts.setAttribute("w:hAnsi", op.value);
        rFonts.setAttribute("w:eastAsia", op.value); // 中文字体关键槽位
        log.push(`${op.targetLabel}：字体 -> ${op.value}`);
        break;
      }
      case "font_size": {
        const halfPt = String(Math.round(op.value * 2));
        getOrAddGrandchild(rPr, "w:sz").setAttribute("w:val", halfPt);
        getOrAddGrandchild(rPr, "w:szCs").setAttribute("w:val", halfPt);
        log.push(`${op.targetLabel}：字号 -> ${op.value}pt`);
        break;
      }
      case "bold": {
        const b = getOrAddGrandchild(rPr, "w:b");
        b.setAttribute("w:val", op.value ? "1" : "0");
        log.push(`${op.targetLabel}：加粗 -> ${op.value}`);
        break;
      }
      case "italic": {
        const i = getOrAddGrandchild(rPr, "w:i");
        i.setAttribute("w:val", "1");
        log.push(`${op.targetLabel}：斜体 -> true`);
        break;
      }
      case "underline": {
        const u = getOrAddGrandchild(rPr, "w:u");
        u.setAttribute("w:val", "single");
        log.push(`${op.targetLabel}：下划线 -> true`);
        break;
      }
      case "color": {
        const color = getOrAddGrandchild(rPr, "w:color");
        color.setAttribute("w:val", op.value);
        log.push(`${op.targetLabel}：颜色 -> #${op.value}`);
        break;
      }
      case "align": {
        const jc = getOrAddGrandchild(pPr, "w:jc");
        jc.setAttribute("w:val", op.value);
        log.push(`${op.targetLabel}：对齐 -> ${op.raw}`);
        break;
      }
      case "line_spacing": {
        const spacing = getOrAddGrandchild(pPr, "w:spacing");
        spacing.setAttribute("w:line", String(Math.round(op.value * 240)));
        spacing.setAttribute("w:lineRule", "auto");
        log.push(`${op.targetLabel}：行距 -> ${op.value} 倍`);
        break;
      }
      case "space_before": {
        const spacing = getOrAddGrandchild(pPr, "w:spacing");
        spacing.setAttribute("w:before", String(Math.round(op.value * 20)));
        log.push(`${op.targetLabel}：段前间距 -> ${op.value}pt`);
        break;
      }
      case "space_after": {
        const spacing = getOrAddGrandchild(pPr, "w:spacing");
        spacing.setAttribute("w:after", String(Math.round(op.value * 20)));
        log.push(`${op.targetLabel}：段后间距 -> ${op.value}pt`);
        break;
      }
      case "first_line_indent_chars": {
        // 按当前样式字号换算（跟桌面版逻辑一致，找不到字号就按 12pt 估算）
        const szEl = rPr.getElementsByTagName("w:sz")[0];
        const basePt = szEl ? parseInt(szEl.getAttribute("w:val"), 10) / 2 : 12;
        const ind = getOrAddGrandchild(pPr, "w:ind");
        ind.setAttribute("w:firstLine", String(Math.round(basePt * op.value * 20)));
        log.push(`${op.targetLabel}：首行缩进 -> 约 ${op.value} 字符（按当前字号换算）`);
        break;
      }
      case "first_line_indent_cm": {
        const ind = getOrAddGrandchild(pPr, "w:ind");
        ind.setAttribute("w:firstLine", String(Math.round(op.value * 566.929)));
        log.push(`${op.targetLabel}：首行缩进 -> ${op.value} cm`);
        break;
      }
    }
  }
  return log;
}

function applyMarginsToDocumentXml(documentDoc, marginOps, log) {
  const pgMar = documentDoc.getElementsByTagName("w:pgMar")[0];
  if (!pgMar) return;
  for (const [side, cm] of marginOps) {
    pgMar.setAttribute(`w:${side}`, String(Math.round(cm * 566.929)));
    log.push(`页边距 ${side} 设为 ${cm} cm`);
  }
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

function serializeXml(doc) {
  return XML_HEADER + new XMLSerializer().serializeToString(doc.documentElement);
}

async function readXmlFromZip(zip, path) {
  const text = await zip.file(path).async("string");
  return new DOMParser().parseFromString(text, "application/xml");
}

/**
 * 给已有 docx 追加一个带 PAGE 域的页脚（如果原文档本来就没有页脚的话）。
 * 严格按照 python-docx 实际生成的文件结构模式操作三个部件：
 * document.xml 的 sectPr、document.xml.rels、[Content_Types].xml。
 */
async function ensurePageNumberFooter(zip, documentDoc, log) {
  const sectPr = documentDoc.getElementsByTagName("w:sectPr")[0];
  if (sectPr.getElementsByTagName("w:footerReference").length > 0) {
    log.push("已添加页码（复用文档原有页脚）");
    // 文档已有页脚：直接在该页脚里插入 PAGE 域（如果还没有的话）
    const rels = await readXmlFromZip(zip, "word/_rels/document.xml.rels");
    const footerRef = sectPr.getElementsByTagName("w:footerReference")[0];
    const rId = footerRef.getAttribute("r:id");
    const relEls = rels.getElementsByTagName("Relationship");
    let target = null;
    for (const r of relEls) { if (r.getAttribute("Id") === rId) { target = r.getAttribute("Target"); break; } }
    if (!target) return;
    const footerPath = "word/" + target.replace(/^\/?word\//, "");
    const footerDoc = await readXmlFromZip(zip, footerPath);
    if (footerDoc.getElementsByTagName("w:fldChar").length === 0) {
      const body = footerDoc.documentElement;
      const p = footerDoc.createElementNS(W_NS, "w:p");
      appendPageFieldRun(footerDoc, p);
      body.appendChild(p);
    }
    zip.file(footerPath, serializeXml(footerDoc));
    return;
  }

  // 文档没有页脚：新建一个页脚部件 + 三处登记（rels / content-types / sectPr 引用）
  const footerXmlDoc = new DOMParser().parseFromString(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <w:ftr xmlns:w="${W_NS}"></w:ftr>`, "application/xml");
  const p = footerXmlDoc.createElementNS(W_NS, "w:p");
  const pPr = footerXmlDoc.createElementNS(W_NS, "w:pPr");
  const jc = footerXmlDoc.createElementNS(W_NS, "w:jc");
  jc.setAttribute("w:val", "center");
  pPr.appendChild(jc);
  p.appendChild(pPr);
  appendPageFieldRun(footerXmlDoc, p);
  footerXmlDoc.documentElement.appendChild(p);

  const existingFooters = Object.keys(zip.files).filter(n => /^word\/footer\d+\.xml$/.test(n));
  const nextIdx = existingFooters.length + 1;
  const footerFileName = `footer${nextIdx}.xml`;
  zip.file(`word/${footerFileName}`, serializeXml(footerXmlDoc));

  const relsDoc = await readXmlFromZip(zip, "word/_rels/document.xml.rels");
  const relsRoot = relsDoc.documentElement;
  const existingIds = Array.from(relsRoot.getElementsByTagName("Relationship")).map(r => parseInt(r.getAttribute("Id").replace("rId", ""), 10));
  const newRid = "rId" + (Math.max(0, ...existingIds) + 1);
  const rel = relsDoc.createElementNS("http://schemas.openxmlformats.org/package/2006/relationships", "Relationship");
  rel.setAttribute("Id", newRid);
  rel.setAttribute("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer");
  rel.setAttribute("Target", footerFileName);
  relsRoot.appendChild(rel);
  zip.file("word/_rels/document.xml.rels", serializeXml(relsDoc));

  const ctDoc = await readXmlFromZip(zip, "[Content_Types].xml");
  const override = ctDoc.createElementNS("http://schemas.openxmlformats.org/package/2006/content-types", "Override");
  override.setAttribute("PartName", `/word/${footerFileName}`);
  override.setAttribute("ContentType", "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml");
  ctDoc.documentElement.appendChild(override);
  zip.file("[Content_Types].xml", serializeXml(ctDoc));

  const footerReference = documentDoc.createElementNS(W_NS, "w:footerReference");
  footerReference.setAttribute("w:type", "default");
  footerReference.setAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "r:id", newRid);
  sectPr.insertBefore(footerReference, sectPr.firstChild);

  log.push("已添加页码（新建页脚）");
}

function appendPageFieldRun(ownerDoc, pEl) {
  const run = ownerDoc.createElementNS(W_NS, "w:r");
  const fldBegin = ownerDoc.createElementNS(W_NS, "w:fldChar");
  fldBegin.setAttribute("w:fldCharType", "begin");
  const instr = ownerDoc.createElementNS(W_NS, "w:instrText");
  instr.setAttribute("xml:space", "preserve");
  instr.textContent = "PAGE";
  const fldEnd = ownerDoc.createElementNS(W_NS, "w:fldChar");
  fldEnd.setAttribute("w:fldCharType", "end");
  run.appendChild(fldBegin);
  run.appendChild(instr);
  run.appendChild(fldEnd);
  pEl.appendChild(run);
}

// ==================== 对外主入口 ====================

/** Tab 1：给已有 docx（ArrayBuffer）套用格式描述，返回 {blob, log, unmatched} */
async function formatExistingDocx(arrayBuffer, description) {
  const parsed = parseDescription(description);
  const zip = await JSZip.loadAsync(arrayBuffer);

  const stylesDoc = await readXmlFromZip(zip, "word/styles.xml");
  const documentDoc = await readXmlFromZip(zip, "word/document.xml");

  const log = [];
  applyMarginsToDocumentXml(documentDoc, parsed.marginOps, log);
  if (parsed.addPageNumber) {
    await ensurePageNumberFooter(zip, documentDoc, log);
  }
  log.push(...applyOperationsToStylesXml(stylesDoc, parsed));

  zip.file("word/styles.xml", serializeXml(stylesDoc));
  zip.file("word/document.xml", serializeXml(documentDoc));

  // JSZip 默认不压缩（STORE），docx 里全是可高度压缩的 XML，
  // 不指定 DEFLATE 会导致文件比原本大一个数量级
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { blob, log, parsed };
}

/** Tab 2：解析 AI 标签输出，基于空白模板生成新文档，返回 {blob, log, aiResult} */
async function generateFromAiOutput(aiText, blankTemplateArrayBuffer) {
  const aiResult = parseAiOutput(aiText);
  const zip = await JSZip.loadAsync(blankTemplateArrayBuffer);
  const documentDoc = await readXmlFromZip(zip, "word/document.xml");

  const body = documentDoc.getElementsByTagName("w:body")[0];
  // 保留原有的 sectPr（页面设置/页脚引用），把内容段落插到它前面
  const sectPr = body.getElementsByTagName("w:sectPr")[0];

  for (const [styleName, text] of aiResult.blocks) {
    const p = documentDoc.createElementNS(W_NS, "w:p");
    const pPr = documentDoc.createElementNS(W_NS, "w:pPr");
    const pStyle = documentDoc.createElementNS(W_NS, "w:pStyle");
    pStyle.setAttribute("w:val", styleName);
    pPr.appendChild(pStyle);
    p.appendChild(pPr);
    const r = documentDoc.createElementNS(W_NS, "w:r");
    const t = documentDoc.createElementNS(W_NS, "w:t");
    t.setAttribute("xml:space", "preserve");
    t.textContent = text;
    r.appendChild(t);
    p.appendChild(r);
    body.insertBefore(p, sectPr);
  }

  const log = [];
  if (aiResult.formatText) {
    const parsed = parseDescription(aiResult.formatText);
    const stylesDoc = await readXmlFromZip(zip, "word/styles.xml");
    log.push(...applyOperationsToStylesXml(stylesDoc, parsed));
    applyMarginsToDocumentXml(documentDoc, parsed.marginOps, log);
    zip.file("word/styles.xml", serializeXml(stylesDoc));
    aiResult.formatUnmatched = parsed.unmatched;
  }

  zip.file("word/document.xml", serializeXml(documentDoc));

  // JSZip 默认不压缩（STORE），docx 里全是可高度压缩的 XML，
  // 不指定 DEFLATE 会导致文件比原本大一个数量级
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { blob, log, aiResult };
}
