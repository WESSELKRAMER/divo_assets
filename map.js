(function(){
  // Alle zware data (grenzen-geojson, SVG-masker) staat als los bestand
  // naast dit script op GitHub/jsdelivr, in plaats van hier inline
  // ingebakken - dat hield het vorige Webflow Embed-blok boven het
  // karakterlimiet. We bepalen de map waar map.js zelf vandaan komt en
  // halen de rest daar automatisch bij op, dus dit werkt vanuit elke
  // repo/tag zonder dat er iets hardcoded hoeft te worden. LET OP: dit
  // moet helemaal bovenaan, vóór enige await/.then - document.currentScript
  // is daarna niet meer beschikbaar.
  const ASSET_BASE = document.currentScript.src.replace(/[^/]+$/, '');

  const NL_BOUNDS = [3.37087, 50.753883, 7.211666, 53.511383];
  const NL_MAXBOUNDS = [2.87087, 50.253883, 7.711666, 54.011383];

  const meldingen = [
    {
      type: 'melding', icon: 'ti-home', lng: 6.5931, lat: 53.2237,
      titel: 'Buurthuis Oosterpark dreigt te sluiten', plaats: 'Groningen',
      tekst: 'Het buurthuis waar wekelijks honderden mensen samenkomen, krijgt vanaf volgend jaar geen gemeentelijke subsidie meer.',
      cta: null
    },
    {
      type: 'melding', icon: 'ti-bus', lng: 7.045, lat: 53.253,
      titel: 'Laatste bushokje uit het dorp verdwenen', plaats: 'Nieuwolda',
      tekst: 'Vervoerder heeft de halte opgeheven wegens te weinig reizigers. Ouderen en scholieren moeten nu vijf kilometer verder.',
      cta: null
    },
    {
      type: 'petitie', icon: 'ti-book', lng: 6.412, lat: 52.649,
      titel: 'Red de openbare bibliotheek van Zuidwolde', plaats: 'Zuidwolde',
      tekst: 'De enige gratis ontmoetingsplek in het dorp moet haar deuren sluiten door bezuinigingen.',
      cta: {label:'Teken de petitie', href:'#'}
    },
    {
      type: 'petitie', icon: 'ti-first-aid-kit', lng: 6.564, lat: 53.238,
      titel: 'Behoud de huisartsenpost in Beijum', plaats: 'Groningen (Beijum)',
      tekst: 'De post dreigt te fuseren met een post aan de andere kant van de stad. Langere reistijd voor avond- en weekendzorg.',
      cta: {label:'Teken de petitie', href:'#'}
    }
  ];

  const stage = document.getElementById('divo-map-stage');
  const closeBtn = document.getElementById('divo-map-close');

  const map = new maplibregl.Map({
    container: 'divo-map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    bounds: NL_BOUNDS,
    fitBoundsOptions: { padding: 20 },
    maxBounds: NL_MAXBOUNDS,
    minZoom: 5.4,
    maxZoom: 16,
    attributionControl: { compact: true },
    scrollZoom: false,
    dragPan: false,
    dragRotate: false,
    doubleClickZoom: false,
    touchZoomRotate: false,
    keyboard: false
  });

  // Het SVG-masker (exacte silhouet van jullie eigen illustratie) als los
  // bestand ophalen en via een Blob-URL aan de --divo-nl-mask CSS-variabele
  // hangen (zie map.css) - zo hoeft er nergens een grote base64-string in
  // dit bestand te staan.
  fetch(ASSET_BASE + 'nl-mask.svg')
    .then(r => r.text())
    .then(svgText => {
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(blob);
      document.querySelector('.divo-map-embed').style.setProperty('--divo-nl-mask', `url("${blobUrl}")`);
    })
    .catch(err => console.warn('Kon NL-maskervorm niet laden:', err));

  let isFullscreen = false;
  let activePopup = null;

  // Lenis draait los van deze kaart-code en is meestal een lokale variabele
  // in jullie eigen initialisatiescript, niet automatisch bereikbaar van
  // buitenaf. We proberen 'm zelf te vinden zodat dit ook werkt zonder dat
  // jullie iets hoeven te wijzigen:
  // 1. window.lenis of window.__lenis, als die al bestaan.
  // 2. anders zoeken we naar een object ergens op window dat een instance
  //    is van de globale Lenis-klasse (die het CDN-scripttag altijd zet).
  // Zodra we 'm gevonden hebben, onthouden we 'm op window.lenis, zodat we
  // niet iedere keer opnieuw hoeven te zoeken.
  function findLenisInstance(){
    if (window.lenis && typeof window.lenis.stop === 'function') return window.lenis;
    if (window.__lenis && typeof window.__lenis.stop === 'function') return window.__lenis;
    if (window.Lenis) {
      for (const key in window) {
        try {
          const val = window[key];
          if (val instanceof window.Lenis) return val;
        } catch (e) { /* sommige window-properties mogen niet gelezen worden - negeren */ }
      }
    }
    return null;
  }

  function setFullscreen(on){
    isFullscreen = on;
    stage.classList.toggle('divo-map-fs', on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
    document.body.style.overflow = on ? 'hidden' : '';

    // Belangrijkste fix: Lenis's eigen wheel/touch-listener zit standaard op
    // window en negeert daarbij volledig of iets "erboven" ligt qua z-index -
    // dus zelfs met de kaart fixed en fullscreen bleef de pagina eronder
    // gewoon meescrollen. Lenis kent hier zelf een ingebouwde uitzondering
    // voor: een element met [data-lenis-prevent] (of een voorouder daarvan)
    // wordt door Lenis genegeerd. Dat werkt hoe dan ook, ook als we geen
    // toegang hebben tot de Lenis-instance zelf.
    stage.toggleAttribute('data-lenis-prevent', on);

    // Als extra vangnet: ook echt lenis.stop()/start() aanroepen als we de
    // instance te pakken kunnen krijgen (zie findLenisInstance hierboven).
    if (!window.lenis) {
      const found = findLenisInstance();
      if (found) window.lenis = found;
    }
    if (window.lenis) { on ? window.lenis.stop() : window.lenis.start(); }

    // In de rustige stand is het canvas leeg/transparant (alleen onze NL-
    // vorm); in volledig scherm tonen we de echte OpenFreeMap-basiskaart.
    setBaseLayersVisible(on);

    if (on) {
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      map.touchZoomRotate.enable();
      map.touchZoomRotate.disableRotation();
      map.keyboard.enable();
    } else {
      map.scrollZoom.disable();
      map.dragPan.disable();
      map.doubleClickZoom.disable();
      map.touchZoomRotate.disable();
      map.keyboard.disable();
    }

    requestAnimationFrame(() => {
      map.resize();
      map.fitBounds(NL_BOUNDS, { padding: 20, duration: 0 });
      // de stage wisselt van relative naar fixed en terug, wat de hoogte
      // van de pagina er even anders uit kan laten zien voor GSAP
      // ScrollTrigger - na afloop laten we 'm zijn triggerposities
      // herberekenen zodat andere scroll-animaties op de pagina niet
      // uit de pas gaan lopen.
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  map.getContainer().addEventListener('click', (e) => {
    // Klik op de zoomknoppen mag niet ook meteen volledig scherm openen.
    if (e.target.closest('.maplibregl-ctrl')) return;
    if (!isFullscreen) setFullscreen(true);
  });
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setFullscreen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFullscreen) setFullscreen(false);
  });

  // Dispatcht een event waar andere Webflow-interacties/scripts op kunnen
  // luisteren, bv.:
  // document.addEventListener('ditisvanons:openmeldpunt', function(){ ... })
  const addBtn = document.querySelector('.divo-map-embed .divo-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function(e){
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('ditisvanons:openmeldpunt'));
    });
  }

  function closeActivePopup(){
    if (!activePopup) return;
    const el = activePopup.getElement();
    const card = el && el.querySelector('.map_card_pop_up');
    const popupRef = activePopup;
    activePopup = null;
    if (card) {
      card.setAttribute('data-map-card-status', 'closed');
      setTimeout(() => popupRef.remove(), 420); // laat de fade-transitie (0.4s) eerst afspelen
    } else {
      popupRef.remove();
    }
  }

  // Alle laag-ID's van de OpenFreeMap 'liberty'-basisstijl zelf (land,
  // water, wegen, labels, ...). In de rustige (inline) stand verbergen we
  // die allemaal, zodat alleen onze eigen NL-vorm overblijft en de rest
  // van het canvas ECHT transparant is - geen kleur die nog moet matchen
  // met de pagina-achtergrond. In volledig scherm zetten we ze weer aan
  // zodat je de echte kaart (straten, plaatsnamen) ziet.
  let baseLayerIds = [];

  function setBaseLayersVisible(visible){
    baseLayerIds.forEach(id => {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }

  map.on('load', () => {
    baseLayerIds = map.getStyle().layers.map(l => l.id);
    setBaseLayersVisible(false);

    // MapLibre paint-properties snappen geen CSS var() - we lezen de
    // opgeloste waarde van onze CSS-variabelen (die zelf weer naar de
    // echte Webflow-tokens verwijzen) uit de DOM en geven die als platte
    // kleurwaarde door.
    function getComputedColor(varName, fallback){
      const v = getComputedStyle(document.querySelector('.divo-map-embed')).getPropertyValue(varName).trim();
      return v || fallback;
    }

    fetch(ASSET_BASE + 'nl-boundary.geojson')
      .then(r => r.json())
      .then(nlBoundary => {
        map.addSource('divo-nl-boundary', { type: 'geojson', data: nlBoundary });

        map.addLayer({
          id: 'divo-nl-fill',
          type: 'fill',
          source: 'divo-nl-boundary',
          paint: {
            'fill-color': getComputedColor('--divo-blue', '#0038E5'),
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 10, 0]
          }
        });

        map.addLayer({
          id: 'divo-nl-outline',
          type: 'line',
          source: 'divo-nl-boundary',
          paint: {
            'line-color': getComputedColor('--divo-blue-light', '#83C9FC'),
            'line-width': 2,
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 11, 0.45]
          }
        });
      })
      .catch(err => console.warn('Kon NL-grensdata niet laden:', err));

    meldingen.forEach(m => {
      const el = document.createElement('div');
      el.className = 'divo-pin' + (m.type === 'petitie' ? ' divo-petitie' : '');
      el.innerHTML = `<i class="ti ${m.icon}" aria-hidden="true"></i>`;
      el.addEventListener('click', (e) => e.stopPropagation());

      const ctaHtml = m.cta
        ? `<a class="divo-mc-cta ${m.type === 'petitie' ? 'divo-petitie' : ''}" href="${m.cta.href}" target="_blank" rel="noopener">${m.cta.label} ↗</a>`
        : `<a class="divo-mc-cta" href="#">Bekijk melding ›</a>`;

      const popupHtml = `
        <div class="map_card_pop_up" data-map-card-status="open">
          <div class="close_icon_wrapper" role="button" aria-label="Sluiten"><i class="ti ti-x" aria-hidden="true"></i></div>
          <span class="divo-mc-pill ${m.type === 'petitie' ? 'divo-petitie' : ''}">${m.type === 'petitie' ? 'Petitie' : 'Melding'}</span>
          <p class="divo-mc-title">${m.titel}</p>
          <p class="divo-mc-place"><i class="ti ti-map-pin" aria-hidden="true"></i>${m.plaats}</p>
          <p class="divo-mc-body">${m.tekst}</p>
          ${ctaHtml}
        </div>`;

      const popup = new maplibregl.Popup({ offset: 22, closeButton: false, maxWidth: '260px' })
        .setHTML(popupHtml)
        .on('open', () => { activePopup = popup; })
        .on('close', () => { if (activePopup === popup) activePopup = null; });

      new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(popup)
        .addTo(map);

      popup.on('open', () => {
        const closeIcon = popup.getElement().querySelector('.close_icon_wrapper');
        if (closeIcon) {
          closeIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            closeActivePopup();
          });
        }
      });
    });
  });
})();
