(function () {
  "use strict";
  var C = window.DT_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var agora = function () { return new Date(); };

  /* ---------- armazenamento local (pode falhar em modo privado) ---------- */
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  var visitante = ler("dt_vid") || uid();
  gravar("dt_vid", visitante);
  var visitas = (parseInt(ler("dt_visitas") || "0", 10) || 0) + 1;
  gravar("dt_visitas", String(visitas));
  var sessao = uid();
  var params = new URLSearchParams(location.search);
  var origem = (params.get("src") || params.get("utm_source") || "direto").slice(0, 40);

  /* ---------- fase atual ---------- */
  var fases = (C.phases || []).slice().sort(function (a, b) { return new Date(a.from) - new Date(b.from); });
  var fase = fases[0] || {};
  fases.forEach(function (f) { if (new Date(f.from) <= agora()) fase = f; });

  /* ---------- registo anónimo ---------- */
  var fila = [];
  var temporizador = null;
  function evento(nome, valor) {
    fila.push({ e: nome, x: valor == null ? null : String(valor).slice(0, 60), t: Date.now() });
    if (!temporizador) temporizador = setTimeout(enviar, 1500);
  }
  function corpo(evts) {
    return JSON.stringify({
      v: visitante, s: sessao, n: visitas, ph: fase.id || "", src: origem,
      w: screen.width, h: screen.height, lang: (navigator.language || "").slice(0, 12),
      ref: (document.referrer || "").slice(0, 120), ev: evts
    });
  }
  function enviar(usarBeacon) {
    clearTimeout(temporizador); temporizador = null;
    if (!fila.length || !C.api) return;
    var evts = fila.splice(0, fila.length);
    var dados = corpo(evts);
    try {
      if (usarBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(C.api, new Blob([dados], { type: "text/plain" }));
      } else {
        fetch(C.api, { method: "POST", body: dados, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(function () {});
      }
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") enviar(true); });
  window.addEventListener("pagehide", function () { enviar(true); });

  // primeiro registo: a visita. A resposta traz o mapa coletivo e a contagem.
  var estatisticas = null;
  function registarVisita() {
    if (!C.api) return;
    var dados = corpo([{ e: "scan", x: visitas > 1 ? "regresso" : "nova", t: Date.now() }]);
    fetch(C.api, { method: "POST", body: dados, headers: { "Content-Type": "text/plain" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { estatisticas = j; aplicarEstatisticas(); } })
      .catch(function () {});
  }
  registarVisita();

  /* ---------- capa ---------- */
  var regresso = visitas > 1;
  var h1 = $("capaTitulo");
  var titulo = regresso ? "Voltaste. A capulana ainda guarda mais." : h1.getAttribute("data-texto");
  titulo.split(" ").forEach(function (p, i) {
    var s = document.createElement("span");
    s.className = "l"; s.textContent = p;
    s.style.animationDelay = (0.25 + i * 0.12) + "s";
    h1.appendChild(s); h1.appendChild(document.createTextNode(" "));
  });
  if (regresso) { var sub = $("capaSub"); sub.textContent = "Há sempre mais do que se vê."; sub.hidden = false; }

  var video = $("video");
  video.src = fase.video || "assets/video/daterra-carta.mp4";
  if (fase.poster) video.poster = fase.poster;

  var aberto = false;
  $("btnVer").addEventListener("click", function () {
    if (aberto) return; aberto = true;
    if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) {} }
    var capa = $("capa");
    capa.classList.add("abrir");
    document.body.classList.remove("fechado");
    $("conteudo").removeAttribute("aria-hidden");
    video.muted = false;
    var p = video.play();
    if (p && p.catch) p.catch(function () { video.muted = true; video.play().catch(function () {}); atualizarSom(); });
    evento("abrir");
    setTimeout(function () { capa.classList.add("aberta"); capa.setAttribute("aria-hidden", "true"); }, 1300);
  });

  /* ---------- vídeo ---------- */
  var wrap = $("videoWrap");
  var marcos = { 25: false, 50: false, 75: false };
  var iniciou = false;
  video.addEventListener("play", function () {
    wrap.classList.remove("pausa");
    if (!iniciou) { iniciou = true; evento("video_inicio"); }
  });
  video.addEventListener("pause", function () { wrap.classList.add("pausa"); });
  video.addEventListener("timeupdate", function () {
    if (!video.duration) return;
    var pct = (video.currentTime / video.duration) * 100;
    $("barra").style.width = pct + "%";
    [25, 50, 75].forEach(function (m) { if (!marcos[m] && pct >= m) { marcos[m] = true; evento("video_" + m); } });
  });
  video.addEventListener("ended", function () {
    evento("video_fim");
    wrap.classList.add("pausa");
    setTimeout(function () { $("carta").scrollIntoView({ behavior: "smooth", block: "start" }); }, 400);
  });
  video.addEventListener("click", function () { if (video.paused) video.play(); else video.pause(); });
  $("btnTocar").addEventListener("click", function () { video.play(); });

  function atualizarSom() {
    var b = $("btnSom");
    b.setAttribute("aria-pressed", String(!video.muted));
    b.querySelector("span").textContent = video.muted ? "Ligar o som" : "Som ligado";
  }
  $("btnSom").addEventListener("click", function () { video.muted = !video.muted; atualizarSom(); });
  video.addEventListener("volumechange", atualizarSom);
  atualizarSom();

  $("btnEcra").addEventListener("click", function () {
    evento("ecra_inteiro");
    var el = video;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(function () {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function () {});
      }).catch(function () {});
    } else if (el.webkitEnterFullscreen) { el.webkitEnterFullscreen(); }
    if (video.paused) video.play();
  });

  /* ---------- revelar ao rolar ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("ver");
      if (en.target.id === "carta") revelarCarta();
      if (en.target.dataset.ev) evento(en.target.dataset.ev);
      io.unobserve(en.target);
    });
  }, { threshold: 0.25 }) : null;
  function observar(el, ev) { if (ev) el.dataset.ev = ev; if (io) io.observe(el); else el.classList.add("ver"); }
  function revelarCarta() {
    var linhas = document.querySelectorAll(".carta .linha");
    linhas.forEach(function (l, i) { l.style.transitionDelay = (i * 0.18) + "s"; });
  }
  observar($("carta"), "carta_vista");
  ["secMandalas", "secContagem", "secMapa", "secRedes"].forEach(function (id) { observar($(id), "vista_" + id.slice(3).toLowerCase()); });

  /* ---------- mandalas ---------- */
  var frutas = [
    { id: "melancia", nome: "Melancia", cor: "#e8505b",
      icone: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 18a19 19 0 0 0 38 0z" fill="#2f8f3a"/><path d="M8 18a16 16 0 0 0 32 0z" fill="#e8505b"/><g fill="#1f2a1b"><ellipse cx="17" cy="24" rx="1.3" ry="2"/><ellipse cx="24" cy="28" rx="1.3" ry="2"/><ellipse cx="31" cy="24" rx="1.3" ry="2"/></g></svg>',
      texto: "A melancia é africana de raiz: as suas antepassadas selvagens crescem neste continente há milhares de anos." },
    { id: "tomate", nome: "Tomate", cor: "#e30613",
      icone: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="28" r="15" fill="#e30613"/><path d="M24 13l3 5 5-2-3 5 5 2-6 1-4 4-4-4-6-1 5-2-3-5 5 2z" fill="#2f8f3a"/></svg>',
      texto: "Muita gente chama-lhe legume, mas o tomate é um fruto: nasce da flor e guarda as sementes lá dentro." },
    { id: "tamarindo", nome: "Tamarindo", cor: "#8a5a2b",
      icone: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 30c4-8 10-6 14-10s10-8 16-6 7 6 4 9-9 2-13 6-9 9-15 8-8-4-6-7z" fill="#a2713d"/><path d="M10 31c4-3 8-4 12-8M24 21c3-3 7-5 11-5" stroke="#6b4421" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
      texto: "O tamarindeiro pode viver mais de cem anos. Há árvores que já deram sombra a várias gerações." }
  ];
  var descobertas = {};
  try { descobertas = JSON.parse(ler("dt_frutas") || "{}") || {}; } catch (e) { descobertas = {}; }
  var mand = $("mandalas");
  frutas.forEach(function (f) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "mandala"; b.style.setProperty("--cor", f.cor);
    b.setAttribute("aria-label", "Mandala: descobrir a fruta");
    b.innerHTML = '<span class="face frente"><span class="olho"><svg viewBox="0 0 24 24" fill="none" stroke="#3b070d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></span></span><span class="face verso">' + f.icone + "<b>" + f.nome + "</b></span>";
    b.addEventListener("click", function () { virar(f, b, true); });
    mand.appendChild(b);
    if (descobertas[f.id]) virar(f, b, false);
  });
  function virar(f, b, gesto) {
    var nova = !b.classList.contains("virada");
    b.classList.add("virada");
    b.setAttribute("aria-label", f.nome);
    if (gesto) {
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
      $("curiosidade").innerHTML = "<b>" + f.nome + "</b>" + f.texto;
      if (nova) evento("fruta", f.id);
    }
    descobertas[f.id] = 1; gravar("dt_frutas", JSON.stringify(descobertas));
    var n = Object.keys(descobertas).length;
    var bolas = $("contador").children;
    for (var i = 0; i < bolas.length; i++) bolas[i].classList.toggle("on", i < n);
    if (n === 3 && gesto && nova) {
      setTimeout(function () {
        $("curiosidade").innerHTML = "<b>Encontraste as três.</b>Melancia, tomate e tamarindo. Juntas, já estão nas tuas mãos.";
      }, 2600);
      evento("frutas_todas");
    }
  }

  /* ---------- contagem decrescente ---------- */
  var proxima = fase.next ? new Date(fase.next) : null;
  function contar() {
    var sec = $("secContagem");
    if (!proxima || proxima <= agora()) {
      $("contaNum").textContent = "";
      $("contaTxt").textContent = "A próxima novidade já chegou. Volta a ler o QR Code e descobre.";
      $("acoesLembrete").querySelector("#btnLembrete").hidden = true;
      $("btnOutroCal").hidden = true;
      return;
    }
    var ms = proxima - agora();
    var dias = Math.ceil(ms / 86400000);
    if (ms < 86400000) {
      var horas = Math.max(1, Math.ceil(ms / 3600000));
      $("contaNum").innerHTML = horas + "<small>h</small>";
      $("contaTxt").textContent = horas === 1 ? "falta uma hora para a próxima novidade" : "faltam " + horas + " horas para a próxima novidade";
    } else {
      $("contaNum").textContent = dias;
      $("contaTxt").textContent = dias === 1 ? "dia para a próxima novidade" : "dias para a próxima novidade";
      document.querySelector("#secContagem .olhinho").textContent = dias === 1 ? "Falta" : "Faltam";
    }
    sec.dataset.ok = "1";
  }
  contar(); setInterval(contar, 60000);

  /* ---------- lembrete ---------- */
  var ua = navigator.userAgent || "";
  var ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var urlBase = location.origin + location.pathname;
  var R = C.reminder || {};
  function dataLembrete() {
    var d = proxima ? new Date(proxima) : agora();
    var hm = (R.hour || "09:00").split(":");
    // hora de Maputo (UTC+2) convertida para UTC
    var y = d.getUTCFullYear(), m = d.getUTCMonth(), dd = d.getUTCDate();
    if (proxima) { var loc = new Date(proxima.getTime() + 2 * 3600000); y = loc.getUTCFullYear(); m = loc.getUTCMonth(); dd = loc.getUTCDate(); }
    var ini = new Date(Date.UTC(y, m, dd, parseInt(hm[0], 10) - 2, parseInt(hm[1], 10)));
    return { ini: ini, fim: new Date(ini.getTime() + 15 * 60000) };
  }
  function fmt(d) { return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function linkGoogle() {
    var t = dataLembrete();
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(R.title || "Compal Da Terra") +
      "&dates=" + fmt(t.ini) + "/" + fmt(t.fim) +
      "&details=" + encodeURIComponent((R.details || "") + "\n" + urlBase + "?src=lembrete") +
      "&ctz=Africa/Maputo";
  }
  function ficheiroIcs() {
    var t = dataLembrete();
    var linhas = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Compal Da Terra//QR//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + visitante + "-dt@compal",
      "DTSTAMP:" + fmt(agora()),
      "DTSTART:" + fmt(t.ini), "DTEND:" + fmt(t.fim),
      "SUMMARY:" + (R.title || "Compal Da Terra").replace(/,/g, "\\,"),
      "DESCRIPTION:" + ((R.details || "") + "\\n" + urlBase + "?src=lembrete").replace(/,/g, "\\,"),
      "URL:" + urlBase + "?src=lembrete",
      "BEGIN:VALARM", "TRIGGER:-PT0M", "ACTION:DISPLAY", "DESCRIPTION:" + (R.title || "Compal Da Terra").replace(/,/g, "\\,"), "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ];
    return new Blob([linhas.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  }
  function abrirIcs() {
    // iPhone: um ficheiro .ics real abre logo «Adicionar ao calendário»
    if (R.ics) { location.href = R.ics; return; }
    var url = URL.createObjectURL(ficheiroIcs());
    var a = document.createElement("a");
    a.href = url; a.download = "compal-da-terra-novidade.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function lembreteFeito(tipo) {
    evento("lembrete", tipo);
    gravar("dt_lembrete", tipo);
    $("lembreteOk").classList.add("ver");
  }
  $("btnLembreteTxt").textContent = ios ? "Lembra-me no calendário" : "Lembra-me no Google Calendar";
  $("btnOutroCal").textContent = ios ? "Prefiro o Google Calendar" : "Usar outro calendário (.ics)";
  $("btnLembrete").addEventListener("click", function () {
    if (ios) { lembreteFeito("ics"); enviar(true); abrirIcs(); }
    else { lembreteFeito("google"); enviar(true); window.open(linkGoogle(), "_blank", "noopener"); }
  });
  $("btnOutroCal").addEventListener("click", function () {
    if (ios) { lembreteFeito("google"); enviar(true); window.open(linkGoogle(), "_blank", "noopener"); }
    else { lembreteFeito("ics"); enviar(true); abrirIcs(); }
  });
  if (ler("dt_lembrete")) $("lembreteOk").classList.add("ver");

  var textoZap = "A capulana guarda mais do que se vê. Descobre o novo Compal Da Terra: " + urlBase + "?src=whatsapp";
  $("btnZap").href = "https://wa.me/?text=" + encodeURIComponent(textoZap);
  $("btnZap").addEventListener("click", function () { evento("partilha", "whatsapp"); });

  /* ---------- redes ---------- */
  document.querySelectorAll(".rede").forEach(function (a) {
    var r = a.getAttribute("data-rede");
    a.href = (C.social || {})[r] || "#";
    a.addEventListener("click", function () { evento("rede", r); enviar(true); });
  });

  /* ---------- mapa ---------- */
  var provincias = [];
  var minha = ler("dt_prov");
  fetch("assets/mz-provincias.json").then(function (r) { return r.json(); }).then(function (m) {
    provincias = m.provinces;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "-6 -6 " + (m.w + 12) + " " + (m.h + 12));
    svg.setAttribute("role", "img");
    // ordem do norte para o sul na lista
    var ordem = ["P", "A", "N", "Q", "T", "S", "B", "I", "G", "L", "MPM"];
    m.provinces.forEach(function (p) {
      var path = document.createElementNS(ns, "path");
      path.setAttribute("d", p.d); path.setAttribute("data-id", p.id);
      var t = document.createElementNS(ns, "title"); t.textContent = p.name; path.appendChild(t);
      path.addEventListener("click", function () { escolher(p.id, true); });
      svg.appendChild(path);
    });
    $("mapa").appendChild(svg);
    var lista = $("provincias");
    ordem.forEach(function (id) {
      var p = m.provinces.filter(function (x) { return x.id === id; })[0];
      if (!p) return;
      var b = document.createElement("button");
      b.type = "button"; b.textContent = p.name; b.dataset.id = p.id; b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { escolher(p.id, true); });
      lista.appendChild(b);
    });
    if (minha) escolher(minha, false);
    aplicarEstatisticas();
  }).catch(function () { $("secMapa").hidden = true; });

  function nomeProv(id) { var p = provincias.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ""; }
  function escolher(id, gesto) {
    var mudou = minha !== id;
    minha = id; gravar("dt_prov", id);
    document.querySelectorAll("#mapa path").forEach(function (p) { p.classList.toggle("minha", p.dataset.id === id); });
    document.querySelectorAll("#provincias button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.id === id)); });
    if (gesto && mudou) {
      evento("provincia", id); enviar();
      if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
      if (estatisticas && estatisticas.provinces) estatisticas.provinces[id] = (estatisticas.provinces[id] || 0) + 1;
    }
    aplicarEstatisticas();
  }

  function aplicarEstatisticas() {
    var pv = (estatisticas && estatisticas.provinces) || {};
    if (minha && !pv[minha]) pv[minha] = 1;
    var acesas = 0;
    document.querySelectorAll("#mapa path").forEach(function (p) {
      var on = !!pv[p.dataset.id]; if (on) acesas++;
      p.classList.toggle("acesa", on);
    });
    var msg = $("mapaMsg");
    if (minha) {
      msg.innerHTML = "<b>" + nomeProv(minha) + "</b> acesa. A capulana já chegou a <b>" + Math.max(acesas, 1) + " de 11</b> províncias.";
    } else if (acesas > 0) {
      msg.innerHTML = "Já se acenderam <b>" + acesas + " de 11</b> províncias. Falta a tua?";
    } else {
      msg.textContent = "";
    }
    var pr = $("primeiros");
    if (estatisticas && estatisticas.bucket) {
      pr.textContent = "Estás entre as primeiras " + estatisticas.bucket.toLocaleString("pt-PT") + " pessoas a ver o que a capulana guarda.";
      pr.hidden = false;
    }
  }
})();
