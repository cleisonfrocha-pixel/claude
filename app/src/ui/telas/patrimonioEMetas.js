// Patrimônio & Metas: uma tela só. O que você tem e o que você quer
// conseguir têm de ser lidos juntos (uma meta sem patrimônio ao lado é um
// palpite). Cada parte continua sendo a tela original, montada numa
// metade da página.

import telaPatrimonio from "./patrimonio.js";
import telaObjetivos from "./objetivos.js";

export default {
  montar(alvo) {
    alvo.innerHTML = `<div id="pm-patrimonio"></div><div id="pm-metas" style="margin-top:28px;"></div>`;
    telaPatrimonio.montar(alvo.querySelector("#pm-patrimonio"));
    telaObjetivos.montar(alvo.querySelector("#pm-metas"));
  },
  desmontar() {
    telaPatrimonio.desmontar();
    telaObjetivos.desmontar();
  },
};
