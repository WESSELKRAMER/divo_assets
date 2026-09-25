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

  // Lenis: jullie site.bundle.js maakt 'm aan als `const lenis = new Lenis()`
  // op het hoogste niveau van een gewoon script. Zo'n const staat NIET op
  // window, maar is wel als globale naam `lenis` bereikbaar - daar kijken we
  // dus eerst. Daarna window.lenis / window.__lenis als terugval.
  function findLenisInstance(){
    try {
      // eslint-disable-next-line no-undef
      if (typeof lenis !== 'undefined' && lenis && typeof lenis.stop === 'function') return lenis;
    } catch (e) { /* niet gedefinieerd */ }
    if (window.lenis && typeof window.lenis.stop === 'function') return window.lenis;
    if (window.__lenis && typeof window.__lenis.stop === 'function') return window.__lenis;
    return null;
  }

  function stopPageScroll(){
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    overlay.setAttribute('data-lenis-prevent', '');
    const l = findLenisInstance();
    if (l) l.stop();
  }

  function resumePageScroll(){
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    overlay.removeAttribute('data-lenis-prevent');
    const l = findLenisInstance();
    if (l) l.start();
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

  // ---------- Kaartjes (pop-ups) ----------
  // Zelfde markup als het kaartje op de hero-illustratie in Webflow
  // (.map_card_pop_up > .map_card_top > .map_card_category + .close_icon_wrapper,
  // .map_card_title_text, a.secondary_button.is-small), zodat de styling uit
  // de Designer meekomt. map.css zet alleen de positionering recht (in
  // Webflow staat dit kaartje absoluut op de illustratie).
  const PLUS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 26 26" fill="none" class="plus_icon" aria-hidden="true"><path d="M24.2811 11.2912L14.8003 11.2715L14.7806 1.7877C14.8003 1.29675 14.6235 0.962971 14.3096 0.648909C13.8973 0.236547 13.4065 0.0599388 12.9943 0.00106957C12.5035 -0.0186461 12.0913 0.236824 11.7773 0.550886C11.4436 0.884664 11.2668 1.21844 11.3651 1.78797L11.1885 11.2718L1.70777 11.2915C0.569351 11.2915 0 11.861 0 12.9998C0 14.1386 0.569351 14.7081 1.70777 14.7081H11.2082V24.2116C11.1885 24.7026 11.4436 25.1149 11.7579 25.429C12.0916 25.7628 12.5038 26.018 12.9946 25.9985C13.4854 26.0182 13.819 25.8414 14.2313 25.429C14.5452 25.1149 14.8006 24.7026 14.8006 24.1919L14.7221 14.8061L24.2814 14.865C25.4395 14.8847 26.0086 14.3152 25.9892 13.1567C26.0874 11.9196 25.5181 11.3503 24.2814 11.2912H24.2811Z" fill="currentColor"></path></svg>';

  // Tekst uit meldingen komt straks van bezoekers (Supabase/Webflow) - altijd
  // escapen voordat het als HTML in een kaartje gaat.
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // variant: 'melding' | 'petitie' | 'nieuw'
  function cardHtml({ variant, label, title, place, body, cta }){
    return `
      <div class="map_card_pop_up divo-card" data-map-card-status="open">
        <div class="map_card_top">
          <div class="map_card_category is--${variant}"><div class="map_card_cat_text">${esc(label)}</div></div>
          <div class="close_icon_wrapper" role="button" tabindex="0" aria-label="Sluiten">${PLUS_ICON}</div>
        </div>
        <div class="map_card_title_text">${title}</div>
        ${place ? `<div class="body_small divo-card-place">${esc(place)}</div>` : ''}
        ${body ? `<div class="body_small divo-card-body">${esc(body)}</div>` : ''}
        ${cta || ''}
      </div>`;
  }

  function addMarkers(){
    meldingen.forEach(m => {
      const el = document.createElement('div');
      el.className = 'divo-pin' + (m.type === 'petitie' ? ' divo-petitie' : '');
      el.innerHTML = `<i class="ti ${m.icon}" aria-hidden="true"></i>`;
      // Geen stopPropagation hier: MapLibre opent de pop-up juist via de
      // klik die doorbubbelt naar de kaart. onMapClick negeert klikken op
      // pins zelf al, dus er wordt dan geen nieuwe pin geplaatst.

      const cta = m.cta
        ? `<a data-underline-link="alt" class="secondary_button is-small" href="${esc(m.cta.href)}" target="_blank" rel="noopener">${esc(m.cta.label)}</a>`
        : '';

      const popupHtml = cardHtml({
        variant: m.type === 'petitie' ? 'petitie' : 'melding',
        label: m.type === 'petitie' ? 'Petitie' : 'Melding',
        title: esc(m.titel),
        place: m.plaats,
        body: m.tekst,
        cta
      });

      const popup = new maplibregl.Popup({ offset: 22, closeButton: false, maxWidth: 'none' })
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
    const wrap = document.createElement('div');
    wrap.innerHTML = cardHtml({
      variant: 'nieuw',
      label: 'Nieuwe melding',
      title: '<span class="divo-pin-card-adres"></span>',
      body: 'Klopt de plek niet? Sleep de pin.',
      cta: '<a href="#" data-underline-link="alt" class="secondary_button is-small divo-pin-card-cta">Doe hier een melding</a>'
    }).trim();
    const card = wrap.firstChild;
    card.classList.add('divo-pin-card');
    pinCardAdres = card.querySelector('.divo-pin-card-adres');
    card.querySelector('.divo-pin-card-cta').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMeldpuntForPin();
    });
    card.querySelector('.close_icon_wrapper').addEventListener('click', (e) => {
      e.stopPropagation();
      removePin(); // kruisje = plaatsen annuleren
    });
    pinCard = new maplibregl.Popup({ offset: 22, closeButton: false, closeOnClick: false, maxWidth: 'none' })
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
    const meldpuntOpen = document.querySelector('[data-meldpunt="modal"].is-open, .divo-meldpunt-overlay.divo-mp-open');
    if (e.key === 'Escape' && isOpen && !meldpuntOpen) closeMapOverlay();
  });
})();
