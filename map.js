(function(){
  // Onvoorwaardelijke eerste regel - als dit NIET verschijnt in de console
  // op de live pagina, dan draait dit script daar simpelweg niet (dan ligt
  // het niet aan MapLibre, elementen of wat dan ook hierna).
  console.log('[divo-map] map.js gestart');
  window.__divoMapScriptRan = true;

  const NL_BOUNDS = [3.37087, 50.753883, 7.211666, 53.511383];
  const NL_MAXBOUNDS = [2.87087, 50.253883, 7.711666, 54.011383];
  const DEFAULT_ZOOM_PADDING = 20;

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

  const LOG_PREFIX = '[divo-map]';
  const staticBtn = document.getElementById('divo-map-static');
  const overlay = document.getElementById('divo-map-overlay');

  if (!staticBtn) { console.error(LOG_PREFIX, 'kon #divo-map-static niet vinden'); return; }
  if (!overlay) { console.error(LOG_PREFIX, 'kon #divo-map-overlay niet vinden'); return; }

  // Belangrijk: dit script kan door Webflow's Embed-mechanisme uitgevoerd
  // worden VOORDAT het los geladen <script src=".../maplibre-gl.js">
  // klaar is (dynamisch ingevoegde <script>-tags met een src laden
  // standaard async, ook al staan ze in de HTML-brontekst in volgorde) -
  // dus niet zomaar aannemen dat `maplibregl` al bestaat, maar er expliciet
  // op wachten (met een tijdslimiet, zodat het nooit stil blijft hangen
  // zonder enige melding).
  function whenMapLibreReady(callback){
    if (typeof maplibregl !== 'undefined') { callback(); return; }
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (typeof maplibregl !== 'undefined') {
        clearInterval(iv);
        callback();
      } else if (tries > 100) { // ~10s
        clearInterval(iv);
        console.error(LOG_PREFIX, 'maplibre-gl is niet geladen (na 10s) - controleer of https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js laadt (netwerktabblad/adblocker).');
      }
    }, 100);
  }

  let map = null;
  let isOpen = false;
  let activePopup = null;

  // Lenis draait los van deze kaart-code en is meestal een lokale variabele
  // in jullie eigen initialisatiescript, niet automatisch bereikbaar van
  // buitenaf. We proberen 'm zelf te vinden zodat dit ook werkt zonder dat
  // jullie iets hoeven te wijzigen:
  // 1. window.lenis of window.__lenis, als die al bestaan.
  // 2. anders zoeken we naar een object ergens op window dat een instance
  //    is van de globale Lenis-klasse (die het CDN-scripttag altijd zet).
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

  function stopPageScroll(){
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    overlay.setAttribute('data-lenis-prevent', '');
    if (!window.lenis) {
      const found = findLenisInstance();
      if (found) window.lenis = found;
    }
    if (window.lenis) window.lenis.stop();
  }

  function resumePageScroll(){
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    overlay.removeAttribute('data-lenis-prevent');
    if (window.lenis) window.lenis.start();
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

  function addMarkers(){
    meldingen.forEach(m => {
      const el = document.createElement('div');
      el.className = 'divo-pin' + (m.type === 'petitie' ? ' divo-petitie' : '');
      el.innerHTML = `<i class="ti ${m.icon}" aria-hidden="true"></i>`;
      // Geen stopPropagation hier: MapLibre opent de pop-up juist via de
      // klik die doorbubbelt naar de kaart. onMapClick negeert klikken op
      // pins zelf al, dus er wordt dan geen nieuwe pin geplaatst.

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
        .on('open', () => { activePopup = popup; hidePinCard(); })
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
  }

  // ---------- Zelf een pin plaatsen ----------
  // Klik/tik op een lege plek op de kaart -> er verschijnt een (versleepbare)
  // pin met een klein kaartje: het adres + de knop "Doe hier een melding".
  // Zo kan de bezoeker eerst checken of de plek klopt (en de pin verslepen)
  // voordat het formulier over de kaart heen schuift. Het formulier zelf
  // staat in de losse meldpunt-embed; die communiceert met deze kaart via
  // CustomEvents op document:
  //   ditisvanons:openmeldpunt    -> formulier openen (detail: adres/lat/lng)
  //   ditisvanons:meldpuntlocatie -> adres is (opnieuw) opgehaald
  //   ditisvanons:meldingverstuurd <- formulier is verstuurd (pin opruimen)
  let newPin = null;
  let newPinData = null;      // { lat, lng, adres, loading }
  let geocodeSeq = 0;         // negeert trage antwoorden van een eerdere pin-positie
  let lastPinDragAt = 0;
  let pinCard = null;         // maplibregl.Popup met het kaartje bij de pin
  let pinCardAdres = null;    // tekst-element in dat kaartje

  function coordsText(lat, lng){
    return lat.toFixed(5) + ', ' + lng.toFixed(5);
  }

  // Adres opzoeken bij een coördinaat. Beide diensten zijn gratis en hebben
  // geen API-key nodig:
  // 1. PDOK Locatieserver (Kadaster/overheid) - de beste NL-adressen.
  // 2. Nominatim (OpenStreetMap) - voor plekken zonder adres in de buurt
  //    (weiland, park, water) of net over de grens.
  // Lukt geen van beide, dan vallen we terug op de coördinaten.
  async function reverseGeocode(lat, lng){
    try {
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${lat}&lon=${lng}&rows=1`);
      if (res.ok) {
        const json = await res.json();
        const doc = json && json.response && json.response.docs && json.response.docs[0];
        // Alleen gebruiken als het adres ook echt dichtbij is (in meters),
        // anders krijg je midden in een weiland een huisnummer 800m verderop.
        if (doc && doc.weergavenaam && (doc.afstand == null || doc.afstand < 150)) {
          return doc.weergavenaam;
        }
      }
    } catch (e) { console.warn(LOG_PREFIX, 'PDOK-adres ophalen mislukt:', e); }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=nl`);
      if (res.ok) {
        const json = await res.json();
        const a = (json && json.address) || {};
        const straat = [a.road || a.pedestrian || a.footway || a.cycleway || a.path, a.house_number].filter(Boolean).join(' ');
        const plaats = a.city || a.town || a.village || a.hamlet || a.municipality;
        const tekst = [straat, plaats].filter(Boolean).join(', ');
        if (tekst) return tekst;
      }
    } catch (e) { console.warn(LOG_PREFIX, 'Nominatim-adres ophalen mislukt:', e); }

    return null;
  }

  function openMeldpuntForPin(){
    if (!newPinData) return;
    hidePinCard(); // pin blijft staan; klik erop om het kaartje terug te halen
    document.dispatchEvent(new CustomEvent('ditisvanons:openmeldpunt', { detail: Object.assign({}, newPinData) }));
  }

  // Het kaartje wordt één keer opgebouwd en daarna alleen bijgewerkt, zodat
  // de knoppen hun click-handlers houden. Hergebruikt dezelfde klassen als de
  // pop-ups van bestaande meldingen (.map_card_pop_up e.d.).
  function buildPinCard(){
    const card = document.createElement('div');
    card.className = 'map_card_pop_up divo-pin-card';
    card.setAttribute('data-map-card-status', 'open');
    card.innerHTML = `
      <div class="close_icon_wrapper" role="button" aria-label="Annuleren"><i class="ti ti-x" aria-hidden="true"></i></div>
      <span class="divo-mc-pill divo-mc-pill-new">Nieuwe melding</span>
      <p class="divo-mc-title divo-pin-card-adres"></p>
      <p class="divo-mc-place"><i class="ti ti-hand-move" aria-hidden="true"></i>Sleep de pin om hem te verplaatsen</p>
      <button type="button" class="divo-mc-cta divo-pin-card-cta">Doe hier een melding ›</button>`;
    pinCardAdres = card.querySelector('.divo-pin-card-adres');
    card.querySelector('.divo-pin-card-cta').addEventListener('click', (e) => {
      e.stopPropagation();
      openMeldpuntForPin();
    });
    card.querySelector('.close_icon_wrapper').addEventListener('click', (e) => {
      e.stopPropagation();
      removePin(); // kruisje = plaatsen annuleren
    });
    pinCard = new maplibregl.Popup({ offset: 22, closeButton: false, closeOnClick: false, maxWidth: '260px' })
      .setDOMContent(card);
  }

  function renderPinCard(){
    if (!pinCard || !newPinData) return;
    pinCardAdres.textContent = newPinData.loading ? 'Adres ophalen…' : newPinData.adres;
  }

  function showPinCard(){
    if (!newPin || !newPinData) return;
    closeActivePopup(); // niet twee kaartjes tegelijk
    if (!pinCard) buildPinCard();
    renderPinCard();
    pinCard.setLngLat(newPin.getLngLat());
    if (!pinCard.isOpen()) pinCard.addTo(map);
  }

  function hidePinCard(){
    if (pinCard && pinCard.isOpen()) pinCard.remove();
  }

  function updatePinLocation(lngLat){
    const seq = ++geocodeSeq;
    const lat = +lngLat.lat.toFixed(6);
    const lng = +lngLat.lng.toFixed(6);
    newPinData = { lat, lng, adres: null, loading: true };
    showPinCard();

    reverseGeocode(lat, lng).then((adres) => {
      if (seq !== geocodeSeq) return; // pin is inmiddels verplaatst of weg
      newPinData = { lat, lng, adres: adres || coordsText(lat, lng), loading: false };
      renderPinCard();
      document.dispatchEvent(new CustomEvent('ditisvanons:meldpuntlocatie', { detail: Object.assign({}, newPinData) }));
    });
  }

  function placePin(lngLat){
    closeActivePopup();
    if (!newPin) {
      const el = document.createElement('div');
      el.className = 'divo-pin divo-pin-new';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Jouw melding - klik voor het adres, sleep om te verplaatsen');
      el.innerHTML = '<i class="ti ti-plus" aria-hidden="true"></i>';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (Date.now() - lastPinDragAt < 300) return; // klik na slepen negeren
        if (pinCard && pinCard.isOpen()) hidePinCard(); else showPinCard();
      });
      newPin = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(lngLat)
        .addTo(map);
      newPin.on('dragstart', hidePinCard);
      newPin.on('dragend', () => {
        lastPinDragAt = Date.now();
        updatePinLocation(newPin.getLngLat());
      });
    } else {
      newPin.setLngLat(lngLat);
    }
    updatePinLocation(lngLat);
  }

  function removePin(){
    hidePinCard();
    if (newPin) newPin.remove();
    newPin = null;
    newPinData = null;
    geocodeSeq++;
  }

  function onMapClick(e){
    // Alleen klikken op de kaart zelf - niet op bestaande pins of pop-ups.
    if (e.originalEvent && e.originalEvent.target !== map.getCanvas()) return;
    // Staat er een pop-up open? Dan sluit deze klik alleen die pop-up (dat
    // doet MapLibre zelf, direct na deze handler) en plaatsen we nog geen pin.
    if (activePopup) return;
    placePin(e.lngLat);
  }

  document.addEventListener('ditisvanons:meldingverstuurd', removePin);

  function createMap(){
    try {
      map = new maplibregl.Map({
        container: 'divo-map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        bounds: NL_BOUNDS,
        fitBoundsOptions: { padding: DEFAULT_ZOOM_PADDING },
        maxBounds: NL_MAXBOUNDS,
        minZoom: 5.4,
        maxZoom: 16,
        attributionControl: { compact: true }
      });
      map.on('load', addMarkers);
      map.on('click', onMapClick);
      map.on('error', (e) => console.error(LOG_PREFIX, 'MapLibre-fout:', e && e.error));
    } catch (err) {
      console.error(LOG_PREFIX, 'kon de kaart niet initialiseren:', err);
    }
  }

  function openMapOverlay(){
    isOpen = true;
    overlay.classList.remove('is-hidden');
    stopPageScroll();

    whenMapLibreReady(() => {
      // De kaart pas écht aanmaken bij de eerste keer openen (niet al bij
      // het laden van de pagina) - dat voorkomt dat we tegels laden die
      // niemand ziet, en dat de kaart moet initialiseren in een element
      // dat nog (tijdelijk) geen zichtbare afmeting heeft.
      if (!map) {
        requestAnimationFrame(createMap);
        return;
      }
      requestAnimationFrame(() => {
        map.resize();
        map.fitBounds(NL_BOUNDS, { padding: DEFAULT_ZOOM_PADDING, duration: 0 });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
    });
  }

  function closeMapOverlay(){
    isOpen = false;
    removePin();
    overlay.classList.add('is-hidden');
    resumePageScroll();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  console.log('[divo-map] klik-handler gekoppeld aan', staticBtn);
  staticBtn.addEventListener('click', () => {
    console.log('[divo-map] klik ontvangen, isOpen was', isOpen);
    if (!isOpen) openMapOverlay();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMapOverlay();
  });
  document.addEventListener('keydown', (e) => {
    // Staat het meldpunt-formulier open, dan sluit Escape alleen dát formulier
    // (dat regelt de meldpunt-embed zelf) en blijft de kaart open.
    const meldpuntOpen = document.querySelector('.divo-meldpunt-overlay.divo-mp-open');
    if (e.key === 'Escape' && isOpen && !meldpuntOpen) closeMapOverlay();
  });
})();
