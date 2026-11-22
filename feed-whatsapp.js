// Feed de publicações enviadas pelo WhatsApp (projeto Supabase "METAS") e
// visualizador de imagens (clique para ampliar, clique de novo para dar zoom).
// Usa nomes locais e um cliente próprio, para não conflitar com o scriptinicial.js,
// que já usa SUPABASE_URL, SUPABASE_KEY e supabaseClient para login e cadastro.
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Visualizador de imagens
  // Vale para as fotos dentro de <figure> na área <main>: as do feed e as fixas da página.
  // ---------------------------------------------------------------
  var SELETOR_IMAGEM = "main figure img";
  var lb = null;
  var lbArea = null;
  var lbImg = null;
  var lbLegenda = null;
  var lbFechar = null;
  var ultimoFoco = null;

  function tornarAmpliavel(img) {
    img.setAttribute("data-zoom", "");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", "Ampliar: " + (img.alt || "imagem"));
  }

  function criarVisualizador() {
    lb = document.createElement("div");
    lb.className = "lb";
    lb.hidden = true;
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Imagem ampliada");

    lbFechar = document.createElement("button");
    lbFechar.type = "button";
    lbFechar.className = "lb-fechar";
    lbFechar.setAttribute("aria-label", "Fechar");
    lbFechar.textContent = "×";

    lbArea = document.createElement("div");
    lbArea.className = "lb-area";

    lbImg = document.createElement("img");
    lbImg.className = "lb-img";
    lbImg.alt = "";
    lbArea.appendChild(lbImg);

    lbLegenda = document.createElement("div");
    lbLegenda.className = "lb-legenda";

    lb.appendChild(lbFechar);
    lb.appendChild(lbArea);
    lb.appendChild(lbLegenda);
    document.body.appendChild(lb);

    lbFechar.addEventListener("click", fecharVisualizador);

    // Clicar no fundo escuro fecha
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target === lbArea) fecharVisualizador();
    });

    // Clicar na imagem alterna entre ajustada à tela e tamanho real (zoom)
    lbImg.addEventListener("click", function () {
      lb.classList.toggle("zoom");
      lbArea.scrollLeft = (lbArea.scrollWidth - lbArea.clientWidth) / 2;
      lbArea.scrollTop = (lbArea.scrollHeight - lbArea.clientHeight) / 2;
    });
  }

  function abrirVisualizador(img) {
    if (!lb) criarVisualizador();
    ultimoFoco = img;

    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || "";

    var figura = img.closest("figure");
    var legenda = figura ? figura.querySelector("figcaption") : null;
    lbLegenda.textContent = legenda ? legenda.textContent : "";

    lb.classList.remove("zoom");
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lbFechar.focus();
  }

  function fecharVisualizador() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    lb.classList.remove("zoom");
    lbImg.removeAttribute("src");
    document.body.style.overflow = "";
    if (ultimoFoco && document.contains(ultimoFoco)) ultimoFoco.focus();
  }

  document.addEventListener("click", function (e) {
    var img = e.target.closest ? e.target.closest(SELETOR_IMAGEM) : null;
    if (img) abrirVisualizador(img);
  });

  document.addEventListener("keydown", function (e) {
    if (lb && !lb.hidden) {
      if (e.key === "Escape") {
        fecharVisualizador();
      } else if (e.key === "Tab") {
        // Mantém o foco dentro do visualizador enquanto ele está aberto
        e.preventDefault();
        lbFechar.focus();
      }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(SELETOR_IMAGEM)) {
      e.preventDefault();
      abrirVisualizador(e.target);
    }
  });

  document.querySelectorAll(SELETOR_IMAGEM).forEach(tornarAmpliavel);

  // ---------------------------------------------------------------
  // Feed do WhatsApp
  // ---------------------------------------------------------------
  var FEED_URL = "https://fzpfebjklshecoeevtra.supabase.co";
  var FEED_KEY = "sb_publishable_ORHDh82qeSZSt3HG8AUxeQ_D7YD89yV"; // chave pública: só leitura

  var container = document.getElementById("feed-whatsapp");
  if (!container || !window.supabase) return;

  // Quantidade de posts: data-limite no HTML (ex.: 3 na prévia da página inicial); padrão 20
  var LIMITE = parseInt(container.getAttribute("data-limite"), 10) || 20;

  var feedClient = window.supabase.createClient(FEED_URL, FEED_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  function mostrarStatus(texto) {
    container.replaceChildren();
    var p = document.createElement("p");
    p.className = "feed-status";
    p.textContent = texto;
    container.appendChild(p);
  }

  function formatarData(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function criarCartao(post) {
    var card = document.createElement("article");
    card.className = "cursos-gr";

    var figura = document.createElement("figure");

    if (post.imagem_url && /^https:\/\//.test(post.imagem_url)) {
      var img = document.createElement("img");
      img.src = post.imagem_url;
      img.alt = post.texto ? post.texto.slice(0, 120) : "Foto publicada pelo Conselho";
      img.loading = "lazy";
      tornarAmpliavel(img);
      figura.appendChild(img);
    }

    if (post.texto) {
      var legenda = document.createElement("figcaption");
      legenda.textContent = post.texto;
      figura.appendChild(legenda);
    }

    card.appendChild(figura);

    var quando = formatarData(post.criado_em);
    if (quando) {
      var data = document.createElement("time");
      data.className = "feed-data";
      data.dateTime = post.criado_em;
      data.textContent = quando;
      card.appendChild(data);
    }

    return card;
  }

  async function carregar() {
    var resposta = await feedClient
      .from("posts")
      .select("id, texto, imagem_url, criado_em")
      .order("criado_em", { ascending: false })
      .limit(LIMITE);

    if (resposta.error) {
      console.error("Erro ao carregar o feed:", resposta.error);
      mostrarStatus("Não foi possível carregar as atualizações agora.");
      return;
    }

    var posts = resposta.data || [];
    if (!posts.length) {
      mostrarStatus("Ainda não há publicações.");
      return;
    }

    container.replaceChildren();
    posts.forEach(function (post) {
      container.appendChild(criarCartao(post));
    });
  }

  // Agrupa vários eventos seguidos (ex.: várias fotos enviadas juntas) em uma só consulta
  var espera = null;
  function agendar() {
    clearTimeout(espera);
    espera = setTimeout(carregar, 400);
  }

  carregar();

  try {
    feedClient
      .channel("feed-whatsapp-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, agendar)
      .subscribe();
  } catch (e) {
    console.error("Atualização em tempo real indisponível:", e);
  }
})();