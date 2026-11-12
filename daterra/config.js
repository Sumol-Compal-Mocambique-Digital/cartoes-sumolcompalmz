/* Compal Da Terra — landing do QR do pack.
   Tudo o que muda ao longo da campanha está aqui. Não é preciso mexer no resto. */
window.DT_CONFIG = {
  // Registo anónimo das visitas (Supabase da Matilde)
  api: "https://ljdoexluezwhtejbsyoa.supabase.co/functions/v1/qr-track",

  // Redes sociais da Compal Moçambique (confirmar os links)
  social: {
    instagram: "https://www.instagram.com/compalmocambique/",
    tiktok: "https://www.tiktok.com/@compalmocambique",
    facebook: "https://www.facebook.com/CompalMocambique"
  },

  // Fases: a página escolhe a fase pela data (hora de Maputo).
  // «next» é a data da próxima novidade (contagem decrescente e lembrete).
  phases: [
    {
      id: "teaser",
      from: "2026-11-01T00:00:00+02:00",
      video: "assets/video/daterra-carta.mp4",
      poster: "assets/img/poster.webp",
      next: "2026-11-19T00:00:00+02:00"
    }
    // A 19/11, acrescentar a fase do TVC, por exemplo:
    // { id: "lancamento", from: "2026-11-19T00:00:00+02:00",
    //   video: "assets/video/daterra-tvc.mp4", poster: "assets/img/poster-tvc.webp",
    //   next: null }
  ],

  // Lembrete no calendário (hora de Maputo)
  reminder: {
    title: "Compal Da Terra: a capulana tem uma novidade",
    details: "Volta a ler o QR Code do teu Compal Da Terra. Há muito mais para descobrir.",
    hour: "09:00",
    // ficheiro de calendário para o iPhone (refazer se a data mudar)
    ics: "assets/lembrete.ics"
  }
};
