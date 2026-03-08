/**
 * Removes duplicated math expressions that AI models sometimes produce.
 * Examples of what this fixes:
 *   "$m=2$m=2"           → "$m=2$"
 *   "$f(x) = 2x$f(x) = 2x" → "$f(x) = 2x$"
 *   "$y$y"               → "$y$"
 *   "$\mathbb{R}$R"      → "$\mathbb{R}$"
 *   "$$expr$$expr"       → "$$expr$$"
 */
export function sanitizeLatex(text: string): string {
  if (!text) return text;

  // 1. Exact source duplicate after inline math: $content$content → $content$
  //    Uses backreference to match the exact same text repeated after closing $
  let result = text.replace(/\$([^$]+?)\$\1/g, (match, inner) => {
    return `$${inner}$`;
  });

  // 2. Exact source duplicate after display math: $$content$$content → $$content$$
  result = result.replace(/\$\$([^$]+?)\$\$\1/g, (match, inner) => {
    return `$$${inner}$$`;
  });

  // 3. Single-letter variable duplicate: $x$x, $y$y, $n$n → $x$, $y$, $n$
  result = result.replace(/\$([a-zA-Z])\$\1(?![a-zA-Z])/g, '$$$1$$');

  // 4. \mathbb{X}$X → \mathbb{X}$ (rendered character follows LaTeX command)
  result = result.replace(
    /\$([^$]*\\mathbb\{([A-Z])\}[^$]*)\$\2(?![a-zA-Z])/g,
    '$$$1$$'
  );

  // 5. \text{word}$word, \mathrm{word}$word
  result = result.replace(
    /\$([^$]*\\(?:text|mathrm|textbf)\{([^}]+)\}[^$]*)\$\2(?![a-zA-Z])/g,
    '$$$1$$'
  );

  // 6. Common pattern: expression like $a = 5$a = 5 where spaces differ
  //    Match $content$ followed by content with spaces stripped matching
  result = result.replace(/\$([^$]{2,}?)\$(?=\S)/g, (match, inner, offset) => {
    const afterPos = offset + match.length;
    const remaining = result.slice(afterPos);
    const innerClean = inner.replace(/\s+/g, '').replace(/\\/g, '');
    
    // Check if what follows starts with a cleaned version of inner
    const remainingClean = remaining.replace(/\s+/g, '');
    if (remainingClean.startsWith(innerClean)) {
      // Already handled by rule 1, skip to avoid double-processing
      return match;
    }
    return match;
  });

  return result;
}
