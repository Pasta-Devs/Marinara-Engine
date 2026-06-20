const BASIC_LATEX_SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ϵ",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  varpi: "ϖ",
  rho: "ρ",
  varrho: "ϱ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "ϕ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Upsilon: "Υ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  rightarrow: "→",
  to: "→",
  gets: "←",
  leftarrow: "←",
  leftrightarrow: "↔",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  mapsto: "↦",
  uparrow: "↑",
  downarrow: "↓",
  pm: "±",
  mp: "∓",
  times: "×",
  cdot: "⋅",
  ast: "∗",
  div: "÷",
  neq: "≠",
  ne: "≠",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ll: "≪",
  gg: "≫",
  approx: "≈",
  sim: "∼",
  simeq: "≃",
  equiv: "≡",
  congruent: "≅",
  propto: "∝",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  in: "∈",
  notin: "∉",
  ni: "∋",
  subset: "⊂",
  superset: "⊃",
  subseteq: "⊆",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  varnothing: "∅",
  forall: "∀",
  exists: "∃",
  nexists: "∄",
  land: "∧",
  wedge: "∧",
  lor: "∨",
  vee: "∨",
  neg: "¬",
  lnot: "¬",
  therefore: "∴",
  because: "∵",
  perpendicular: "⟂",
  perp: "⟂",
  parallel: "∥",
  angle: "∠",
  degree: "°",
  circ: "°",
};

const LATEX_COMMAND_RE = /\\+([A-Za-z]+)\b/g;
const INLINE_PAREN_MATH_RE = /\\\(([\s\S]{1,400}?)\\\)/g;
const INLINE_BRACKET_MATH_RE = /\\\[([\s\S]{1,1000}?)\\\]/g;
const INLINE_DOLLAR_MATH_RE = /(^|[^\\$])\$([^$\n]{1,400})\$/g;

function hasKnownLatexSymbol(text: string): boolean {
  const regex = new RegExp(LATEX_COMMAND_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (BASIC_LATEX_SYMBOLS[match[1]!]) return true;
  }
  return false;
}

function hasAnyLatexCommand(text: string): boolean {
  return new RegExp(LATEX_COMMAND_RE.source).test(text);
}

function replaceLatexCommands(text: string): string {
  return text.replace(LATEX_COMMAND_RE, (match, command: string) => BASIC_LATEX_SYMBOLS[command] ?? match);
}

function convertDelimitedLatexSymbols(inner: string, open: string, close: string): string {
  if (!hasKnownLatexSymbol(inner)) return `${open}${inner}${close}`;
  const converted = replaceLatexCommands(inner);
  return hasAnyLatexCommand(converted) ? `${open}${converted}${close}` : converted;
}

export function convertBasicLatexSymbols(text: string): string {
  if (!text.includes("\\")) return text;

  const converted = text
    .replace(INLINE_BRACKET_MATH_RE, (_match, inner: string) =>
      convertDelimitedLatexSymbols(inner, "\\[", "\\]"),
    )
    .replace(INLINE_PAREN_MATH_RE, (_match, inner: string) => convertDelimitedLatexSymbols(inner, "\\(", "\\)"))
    .replace(INLINE_DOLLAR_MATH_RE, (_match, prefix: string, inner: string) =>
      `${prefix}${convertDelimitedLatexSymbols(inner, "$", "$")}`,
    );

  return replaceLatexCommands(converted);
}

export function convertBasicLatexSymbolsInHtml(html: string): string {
  if (!html.includes("\\")) return html;

  const chunks = html.split(/(<[^>]+>)/g);
  const skipStack: string[] = [];
  return chunks
    .map((chunk) => {
      if (!chunk) return chunk;
      if (chunk.startsWith("<") && chunk.endsWith(">")) {
        const close = chunk.match(/^<\s*\/\s*(code|pre|script|style)\b/i);
        if (close) {
          const tag = close[1]!.toLowerCase();
          const index = skipStack.lastIndexOf(tag);
          if (index !== -1) skipStack.splice(index, 1);
          return chunk;
        }

        const open = chunk.match(/^<\s*(code|pre|script|style)\b/i);
        if (open && !/\/\s*>$/.test(chunk)) {
          skipStack.push(open[1]!.toLowerCase());
        }
        return chunk;
      }

      return skipStack.length > 0 ? chunk : convertBasicLatexSymbols(chunk);
    })
    .join("");
}
