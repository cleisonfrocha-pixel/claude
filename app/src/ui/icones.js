// Ícones (Sprint 6, pós-auditoria de UX/UI). SVG embutido, desenhado no
// próprio projeto, sem carregar fonte de ícone nem pacote externo — só
// scripts de cdnjs/jsdelivr são permitidos (CLAUDE.md), e um ícone
// desenhado aqui é "arquivo nosso, mesma origem", não um script. Traço
// simples de 1.8px, 24x24, cor herdada de `currentColor`: troca de cor
// (inclusive dia/noite) é automática, sem precisar de duas versões do
// mesmo ícone.

const CAMINHOS = {
  // navegação / módulos
  inicio: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9"/>',
  dinheiro: '<rect x="3" y="6.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.4"/>',
  planejamento: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/>',
  dividas: '<path d="M1 6 8.5 13.5 13.5 8.5 23 18"/><path d="M17 18h6v-6"/>',
  renda: '<path d="M1 18 8.5 10.5 13.5 15.5 23 6"/><path d="M17 6h6v6"/>',
  patrimonio: '<path d="M4 20V13"/><path d="M10 20V9"/><path d="M16 20V5"/><path d="M20 20V11"/><path d="M2.5 20h19"/>',
  objetivos: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/>',
  plano: '<rect x="5" y="4" width="14" height="17" rx="2.3"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z"/><path d="m8.7 12.5 2 2 4.3-4.3"/><path d="M8.5 17h7"/>',
  openfinance: '<path d="M8.5 12h7"/><path d="M9 8.2 6.6 6a3 3 0 1 0-4.1 4.4L5 12.6"/><path d="M15 15.8l2.4 2.2a3 3 0 1 0 4.1-4.4L19 11.4"/>',
  ia: '<path d="M12 3v3.2M12 17.8V21M3 12h3.2M17.8 12H21"/><path d="m6.3 6.3 2.2 2.2M15.5 15.5l2.2 2.2M6.3 17.7l2.2-2.2M15.5 8.5l2.2-2.2"/><circle cx="12" cy="12" r="3"/>',
  configuracoes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.5a1.7 1.7 0 0 0 1.04-1.56V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10.5a1.7 1.7 0 0 0 1.56 1.04h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z"/>',
  mais: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  // estados e ações
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  olhoFechado: '<path d="M3.5 3.5l17 17"/><path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-3.2 3.8M7 7.6C4.4 9.2 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"/><path d="M9.9 14.1a3 3 0 0 0 4.2-4.2"/>',
  ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.8 2.8 0 1 1 4.4 2.3c-.9.7-1.6 1.2-1.6 2.4"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
  perfil: '<circle cx="12" cy="8.3" r="3.5"/><path d="M4.5 20c1.3-3.7 4.2-5.8 7.5-5.8S18.7 16.3 20 20"/>',
  loja: '<path d="M4 9.5 5 4h14l1 5.5"/><path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.8 20v-5.2a2.2 2.2 0 0 1 4.4 0V20"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  editar: '<path d="M4 20l.9-3.9L16.6 4.4a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8 19.1 4 20Z"/><path d="m14.7 6.3 3 3"/>',
  apagar: '<path d="M5 7h14"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"/>',
  adicionar: '<path d="M12 5v14M5 12h14"/>',
  pausar: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  retomar: '<path d="M7 5v14l12-7Z"/>',
  alerta: '<path d="M12 3.5 21.5 20h-19Z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
};

/** Devolve o SVG do ícone `nome` pronto pra ir no innerHTML. `tamanho` em
 * px (padrão 20); herda a cor do texto ao redor via currentColor, então
 * nunca precisa escolher cor aqui, só no CSS de quem chama. */
export function icone(nome, tamanho = 20) {
  const miolo = CAMINHOS[nome];
  if (!miolo) return "";
  return `<svg class="icone" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${miolo}</svg>`;
}
