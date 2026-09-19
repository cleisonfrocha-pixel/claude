// Camada de dados: encapsula a capability `db` do artefato (ver
// docs/ARQUITETURA.md, D2). Nenhum outro arquivo de `ui/` ou `dados/` toca
// `window.claude` diretamente — só este módulo.
//
// MODO LOCAL: quando a capability `db` não está disponível — página aberta
// fora do claude.ai, capability não concedida nesta view, ou visualização
// somente-leitura — este módulo cai para um armazenamento local no
// navegador (localStorage), isolado por artefato. Não é o modelo de dados
// definitivo (D2 é claro: `db` é a fonte da verdade, localStorage é
// conveniência de um único aparelho) — é uma degradação honesta para que
// o produto continue funcionável, com aviso visível, em vez de quebrar.

const PREFIXO_LOCAL = "gedi_fin_local_v1:";

let dbPromise = null;
let modo = "verificando"; // 'db' | 'local' | 'verificando'

function temClaude() {
  return typeof window !== "undefined" && window.claude && typeof window.claude.use === "function";
}

async function resolverDb() {
  if (!temClaude()) return null;
  try {
    return await window.claude.use("db");
  } catch {
    return null;
  }
}

/** Garante que a resolução da capability aconteceu; idempotente. */
export async function inicializar() {
  if (!dbPromise) dbPromise = resolverDb();
  const db = await dbPromise;
  modo = db ? "db" : "local";
  return modo;
}

/** 'db' quando a capability real está ativa, 'local' quando caiu no modo local. */
export function modoAtual() {
  return modo;
}

// ---------- Implementação local (fallback) ----------

function lerColecaoLocal(caminho) {
  try {
    const bruto = window.localStorage.getItem(PREFIXO_LOCAL + caminho);
    return bruto ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}

function escreverColecaoLocal(caminho, mapa) {
  try {
    window.localStorage.setItem(PREFIXO_LOCAL + caminho, JSON.stringify(mapa));
  } catch {
    // Sem espaço ou sem acesso a localStorage: a sessão continua em memória
    // para esta aba, mas não sobrevive a um recarregamento. Degradação
    // silenciosa é aceitável aqui — já estamos no fallback do fallback.
  }
  disparar(caminho);
}

const ouvintesLocais = new Map(); // caminho -> Set<fn>

function disparar(caminho) {
  const ouvintes = ouvintesLocais.get(caminho);
  if (!ouvintes) return;
  const mapa = lerColecaoLocal(caminho);
  const docs = Object.keys(mapa)
    .sort()
    .map((id) => ({ id, exists: true, data: () => mapa[id] }));
  ouvintes.forEach((fn) => fn({ docs, size: docs.length, empty: docs.length === 0 }));
}

let contadorId = 0;
function idLocal() {
  contadorId += 1;
  return `l${Date.now().toString(36)}${contadorId.toString(36)}`;
}

// ---------- API pública, igual nos dois modos ----------

/**
 * Lê uma coleção inteira uma vez. Retorna lista de { id, dados }.
 * Coleções da Fase 0 são pequenas (cadastros), então ler tudo de uma vez
 * é aceitável — nada de paginação ainda.
 */
export async function listar(caminho) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    const snap = await db.collection(caminho).get();
    return snap.docs.filter((d) => d.exists).map((d) => ({ id: d.id, dados: d.data() }));
  }
  const mapa = lerColecaoLocal(caminho);
  return Object.keys(mapa)
    .sort()
    .map((id) => ({ id, dados: mapa[id] }));
}

/**
 * Assina uma coleção; `cb` recebe a lista atual a cada mudança.
 * Retorna uma função de cancelamento. Uma assinatura por tela, nunca por
 * render — ver a regra em claude.d.ts / db.d.ts.
 */
export function assinar(caminho, cb) {
  let cancelada = false;
  let pararReal = () => {};
  (async () => {
    await inicializar();
    if (cancelada) return;
    if (modo === "db") {
      const db = await dbPromise;
      pararReal = db.collection(caminho).onSnapshot(
        (snap) => {
          const lista = snap.docs.filter((d) => d.exists).map((d) => ({ id: d.id, dados: d.data() }));
          cb(lista);
        },
        () => cb([]),
      );
    } else {
      if (!ouvintesLocais.has(caminho)) ouvintesLocais.set(caminho, new Set());
      const fn = (snap) => cb(snap.docs.map((d) => ({ id: d.id, dados: d.data() })));
      ouvintesLocais.get(caminho).add(fn);
      pararReal = () => ouvintesLocais.get(caminho)?.delete(fn);
      disparar(caminho); // entrega o estado atual imediatamente
    }
  })();
  return () => {
    cancelada = true;
    pararReal();
  };
}

/** Cria um documento com id novo. Retorna o id criado. */
export async function criar(caminho, dados) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    const ref = await db.collection(caminho).add(dados);
    return ref.id;
  }
  const mapa = lerColecaoLocal(caminho);
  const id = idLocal();
  mapa[id] = dados;
  escreverColecaoLocal(caminho, mapa);
  return id;
}

/** Substitui um documento inteiro (equivalente a `set`). */
export async function definir(caminho, id, dados) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    await db.collection(caminho).doc(id).set(dados);
    return;
  }
  const mapa = lerColecaoLocal(caminho);
  mapa[id] = dados;
  escreverColecaoLocal(caminho, mapa);
}

/** Mescla campos em um documento existente (equivalente a `update`). */
export async function atualizar(caminho, id, campos) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    await db.collection(caminho).doc(id).update(campos);
    return;
  }
  const mapa = lerColecaoLocal(caminho);
  mapa[id] = { ...(mapa[id] || {}), ...campos };
  escreverColecaoLocal(caminho, mapa);
}

/** Apaga um documento. */
export async function apagar(caminho, id) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    await db.collection(caminho).doc(id).delete();
    return;
  }
  const mapa = lerColecaoLocal(caminho);
  delete mapa[id];
  escreverColecaoLocal(caminho, mapa);
}

/** Lê um único documento por caminho completo (coleção/id). Usado por meta/schema. */
export async function lerDocumento(caminhoDocumento) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    const snap = await db.doc(caminhoDocumento).get();
    return snap.exists ? snap.data() : undefined;
  }
  const partes = caminhoDocumento.split("/");
  const id = partes.pop();
  const caminho = partes.join("/");
  const mapa = lerColecaoLocal(caminho);
  return mapa[id];
}

/** Escreve (set) um único documento por caminho completo. */
export async function definirDocumento(caminhoDocumento, dados) {
  await inicializar();
  if (modo === "db") {
    const db = await dbPromise;
    await db.doc(caminhoDocumento).set(dados);
    return;
  }
  const partes = caminhoDocumento.split("/");
  const id = partes.pop();
  const caminho = partes.join("/");
  const mapa = lerColecaoLocal(caminho);
  mapa[id] = dados;
  escreverColecaoLocal(caminho, mapa);
}
