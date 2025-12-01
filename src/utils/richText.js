function normalizeParagraphs(html = "") {
  if (!html || typeof html !== "string") return "";
  const working = html.trim().replace(/\r\n/g, "\n");
  if (!working) return "";

  // Plain text → превращаем в параграфы с <br />
  const paragraphs = [];
  const lines = working.split(/\n/);
  const flush = buffer => {
    if (!buffer.length) return;
    const content = buffer.join("<br />");
    if (content.trim()) {
      paragraphs.push(`<p>${content}</p>`);
    }
    buffer.length = 0;
  };

  const buffer = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    if (!line.trim()) {
      flush(buffer);
    } else {
      buffer.push(line);
    }
  }
  flush(buffer);
  return paragraphs.join("").trim();
}

function convertBulletParagraphs(html = "") {
  if (!html) return "";

  return html.replace(
    /(?:<p>[\s\u00a0]*[-•\u2022]\s*[\s\S]*?<\/p>)+/gis,
    block => {
      const paragraphRegex = /<p>([\s\S]*?)<\/p>/gi;
      const items = [];
      let match;

      while ((match = paragraphRegex.exec(block))) {
        const paragraphContent = (match[1] || "").trim();
        if (!paragraphContent) continue;

        const segments = paragraphContent
          .split(/<br\s*\/?>/gi)
          .map(segment => segment.replace(/^(?:&nbsp;|\s|\u00a0)+/gi, "").trim())
          .filter(Boolean);

        if (!segments.length) {
          return block;
        }

        for (const segment of segments) {
          const bulletMatch = segment.match(/^[-•\u2022]\s*(.*)$/s);
          if (!bulletMatch) {
            return block;
          }
          const itemContent = bulletMatch[1].trim();
          items.push(itemContent);
        }
      }

      if (!items.length) {
        return block;
      }

      return `<ul>${items.map(text => `<li>${text}</li>`).join("")}</ul>`;
    }
  );
}

function splitMixedBulletParagraphs(html = "") {
  if (!html) return "";

  return html.replace(/<p>([\s\S]*?)<\/p>/gi, (match, content) => {
    if (!content || content.indexOf("<br") === -1) {
      return match;
    }

    const segments = content
      .split(/<br\s*\/?>/gi)
      .map(segment => segment.replace(/\s+$/g, ""))
      .filter(segment => segment.replace(/^(?:&nbsp;|\s|\u00a0)+/gi, "").length > 0);

    if (segments.length <= 1) {
      return match;
    }

    const groups = [];
    for (const raw of segments) {
      const trimmedLeading = raw.replace(/^(?:&nbsp;|\s|\u00a0)+/gi, "");
      const bulletMatch = trimmedLeading.match(/^([-•\u2022])\s*(.*)$/s);
      const type = bulletMatch ? "bullet" : "text";
      const value = bulletMatch ? bulletMatch[2] : trimmedLeading;
      const marker = bulletMatch ? bulletMatch[1] : null;

      if (!groups.length || groups[groups.length - 1].type !== type) {
        groups.push({ type, items: [] });
      }
      groups[groups.length - 1].items.push({
        marker,
        value: value.trim(),
        original: trimmedLeading
      });
    }

    const hasBulletGroup = groups.some(group => group.type === "bullet");
    const hasTextGroup = groups.some(group => group.type === "text");
    if (!hasBulletGroup || !hasTextGroup) {
      return match;
    }

    return groups
      .map(group => {
        if (group.type === "bullet") {
          return group.items
            .map(item => `<p>${item.marker || "-"} ${item.value}</p>`)
            .join("");
        }

        const paragraphContent = group.items
          .map(item => item.value)
          .join("<br />");
        return `<p>${paragraphContent}</p>`;
      })
      .join("");
  });
}

export function convertHtmlToRichText(html = "") {
  const hasBlocks = /<(p|ul|ol|li|h[1-6]|table|blockquote)/i.test(html || "");
  const hasTags = /<\/?[a-z][^>]*>/i.test(html || "");

  // Сначала нормализуем plain-text; если теги есть, оставляем строки как есть.
  const normalized = hasTags ? (html || "").trim() : normalizeParagraphs(html);

  // Если нет блочных тегов, попробуем разорвать по двойным <br> в параграфы.
  let withParagraphs = normalized;
  if (!hasBlocks) {
    const parts = normalized
      .split(/(?:<br\s*\/?>\s*){2,}/gi)
      .map(part => part.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      withParagraphs = parts
        .map(part => `<p>${part.replace(/<br\s*\/?>/gi, "<br />")}</p>`)
        .join("");
    }
  }

  const separated = splitMixedBulletParagraphs(withParagraphs);
  return convertBulletParagraphs(separated);
}
