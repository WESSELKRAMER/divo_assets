(function() {
  console.log('[divo-map] map.js gestart');
  window.__divoMapScriptRan = true;
  const NL_BOUNDS = [ 3.37087, 50.753883, 7.211666, 53.511383 ];
  const NL_MAXBOUNDS = [ 2.87087, 50.253883, 7.711666, 54.011383 ];
  const DEFAULT_ZOOM_PADDING = 20;
  const meldingen = [ {
    type: 'melding',
    categorie: 'welzijn',
    lng: 6.5931,
    lat: 53.2237,
    titel: 'Buurthuis Oosterpark dreigt te sluiten',
    plaats: 'Groningen',
    tekst: 'Het buurthuis waar wekelijks honderden mensen samenkomen, krijgt vanaf volgend jaar geen gemeentelijke subsidie meer.',
    cta: null
  }, {
    type: 'melding',
    categorie: 'basisdiensten',
    lng: 7.045,
    lat: 53.253,
    titel: 'Laatste bushokje uit het dorp verdwenen',
    plaats: 'Nieuwolda',
    tekst: 'Vervoerder heeft de halte opgeheven wegens te weinig reizigers. Ouderen en scholieren moeten nu vijf kilometer verder.',
    cta: null
  }, {
    type: 'petitie',
    categorie: 'cultuur',
    lng: 6.412,
    lat: 52.649,
    titel: 'Red de openbare bibliotheek van Zuidwolde',
    plaats: 'Zuidwolde',
    tekst: 'De enige gratis ontmoetingsplek in het dorp moet haar deuren sluiten door bezuinigingen.',
    cta: {
      label: 'Teken de petitie',
      href: '#'
    }
  }, {
    type: 'petitie',
    categorie: 'basisdiensten',
    lng: 6.564,
    lat: 53.238,
    titel: 'Behoud de huisartsenpost in Beijum',
    plaats: 'Groningen (Beijum)',
    tekst: 'De post dreigt te fuseren met een post aan de andere kant van de stad. Langere reistijd voor avond- en weekendzorg.',
    cta: {
      label: 'Teken de petitie',
      href: '#'
    }
  } ];
  const LOG_PREFIX = '[divo-map]';
  const SCRIPT_BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/?#]*([?#].*)?$/, '');
  const staticBtn = document.getElementById('divo-map-static');
  const overlay = document.getElementById('divo-map-overlay');
  if (!staticBtn) {
    console.error(LOG_PREFIX, 'kon #divo-map-static niet vinden');
    return;
  }
  if (!overlay) {
    console.error(LOG_PREFIX, 'kon #divo-map-overlay niet vinden');
    return;
  }
  if (overlay.parentNode !== document.body) document.body.appendChild(overlay);
  function whenMapLibreReady(callback) {
    if (typeof maplibregl !== 'undefined') {
      callback();
      return;
    }
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (typeof maplibregl !== 'undefined') {
        clearInterval(iv);
        callback();
      } else if (tries > 100) {
        clearInterval(iv);
        console.error(LOG_PREFIX, 'maplibre-gl is niet geladen (na 10s) - controleer of https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js laadt (netwerktabblad/adblocker).');
      }
    }, 100);
  }
  let map = null;
  let isOpen = false;
  let activePopup = null;
  function findLenisInstance() {
    try {
      if (typeof lenis !== 'undefined' && lenis && typeof lenis.stop === 'function') return lenis;
    } catch (e) {}
    if (window.lenis && typeof window.lenis.stop === 'function') return window.lenis;
    if (window.__lenis && typeof window.__lenis.stop === 'function') return window.__lenis;
    return null;
  }
  function stopPageScroll() {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    overlay.setAttribute('data-lenis-prevent', '');
    const l = findLenisInstance();
    if (l) l.stop();
  }
  function resumePageScroll() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    overlay.removeAttribute('data-lenis-prevent');
    const l = findLenisInstance();
    if (l) l.start();
  }
  function closeActivePopup() {
    if (!activePopup) return;
    const el = activePopup.getElement();
    const card = el && el.querySelector('.map_card_pop_up');
    const popupRef = activePopup;
    activePopup = null;
    if (card) {
      card.setAttribute('data-map-card-status', 'closed');
      setTimeout(() => popupRef.remove(), 420);
    } else {
      popupRef.remove();
    }
  }
  const PLUS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 26 26" fill="none" class="plus_icon" aria-hidden="true"><path d="M24.2811 11.2912L14.8003 11.2715L14.7806 1.7877C14.8003 1.29675 14.6235 0.962971 14.3096 0.648909C13.8973 0.236547 13.4065 0.0599388 12.9943 0.00106957C12.5035 -0.0186461 12.0913 0.236824 11.7773 0.550886C11.4436 0.884664 11.2668 1.21844 11.3651 1.78797L11.1885 11.2718L1.70777 11.2915C0.569351 11.2915 0 11.861 0 12.9998C0 14.1386 0.569351 14.7081 1.70777 14.7081H11.2082V24.2116C11.1885 24.7026 11.4436 25.1149 11.7579 25.429C12.0916 25.7628 12.5038 26.018 12.9946 25.9985C13.4854 26.0182 13.819 25.8414 14.2313 25.429C14.5452 25.1149 14.8006 24.7026 14.8006 24.1919L14.7221 14.8061L24.2814 14.865C25.4395 14.8847 26.0086 14.3152 25.9892 13.1567C26.0874 11.9196 25.5181 11.3503 24.2814 11.2912H24.2811Z" fill="currentColor"></path></svg>';
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }
  function cardHtml({variant: variant, label: label, title: title, place: place, body: body, cta: cta}) {
    return `\n      <div class="map_card_pop_up divo-card is--${variant}" data-map-card-status="open">\n        <div class="map_card_top">\n          <div class="map_card_category is--${variant}"><div class="map_card_cat_text">${esc(label)}</div></div>\n          <div class="close_icon_wrapper" role="button" tabindex="0" aria-label="Sluiten">${PLUS_ICON}</div>\n        </div>\n        <div class="map_card_title_text">${title}</div>\n        ${place ? `<div class="body_small divo-card-place">${esc(place)}</div>` : ''}\n        ${body ? `<div class="body_small divo-card-body">${esc(body)}</div>` : ''}\n        ${cta || ''}\n      </div>`;
  }
  const DEFAULT_CATEGORIES = [ {
    slug: 'toegankelijkheid',
    label: 'Toegankelijkheid',
    ti: 'ti-wheelchair'
  }, {
    slug: 'veiligheid',
    label: 'Veiligheid',
    ti: 'ti-shield'
  }, {
    slug: 'cultuur',
    label: 'Cultuur',
    ti: 'ti-masks-theater'
  }, {
    slug: 'educatie',
    label: 'Educatie',
    ti: 'ti-school',
    file: 'onderwijs'
  }, {
    slug: 'welzijn',
    label: 'Welzijn',
    ti: 'ti-heart-handshake'
  }, {
    slug: 'natuur',
    label: 'Natuur',
    ti: 'ti-trees'
  }, {
    slug: 'basisdiensten',
    label: 'Basisdiensten',
    ti: 'ti-building-community'
  }, {
    slug: 'overige',
    label: 'Overige',
    ti: 'ti-dots'
  } ];
  function readCategories() {
    const el = document.getElementById('divo-map-categories');
    if (el) {
      try {
        const list = JSON.parse(el.textContent);
        if (Array.isArray(list) && list.length) {
          const defaults = Object.fromEntries(DEFAULT_CATEGORIES.map(c => [ c.slug, c ]));
          return list.filter(c => c && c.slug && c.label).map(c => {
            const slug = String(c.slug).toLowerCase().trim();
            const d = defaults[slug] || {};
            return Object.assign({
              ti: d.ti,
              file: d.file
            }, c, {
              slug: slug
            });
          });
        }
      } catch (e) {
        console.warn(LOG_PREFIX, 'divo-map-categories bevat geen geldige JSON:', e);
      }
    }
    return DEFAULT_CATEGORIES;
  }
  const CATEGORIES = readCategories();
  const CATEGORY_BY_SLUG = Object.fromEntries(CATEGORIES.map(c => [ c.slug, c ]));
  const FALLBACK_CATEGORY = CATEGORY_BY_SLUG.overige ? 'overige' : CATEGORIES[CATEGORIES.length - 1].slug;
  function categoryOf(slug) {
    const key = String(slug || '').toLowerCase().trim();
    return CATEGORY_BY_SLUG[key] || CATEGORY_BY_SLUG[FALLBACK_CATEGORY];
  }
  function categoryIconHtml(cat, cls) {
    const tiHtml = `<i class="ti ${esc(cat.ti || 'ti-map-pin')} ${cls}" aria-hidden="true"></i>`;
    const src = cat.icon || (SCRIPT_BASE ? SCRIPT_BASE + 'icons/' + encodeURIComponent(cat.file || cat.slug) + '.png' : '');
    if (!src) return tiHtml;
    return `<img src="${esc(src)}" alt="" class="${cls} is--img" loading="lazy" data-divo-fallback="${esc(cat.ti || 'ti-map-pin')}">`;
  }
  document.addEventListener('error', e => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-divo-fallback')) return;
    const i = document.createElement('i');
    i.className = 'ti ' + img.getAttribute('data-divo-fallback') + ' ' + img.className.replace('is--img', '').trim();
    i.setAttribute('aria-hidden', 'true');
    const pin = img.closest('.divo-pin');
    if (pin) pin.classList.remove('has--img');
    img.replaceWith(i);
  }, true);
  const markerRegistry = [];
  const filters = {
    melding: true,
    petitie: true
  };
  const categoryFilter = new Set(CATEGORIES.map(c => c.slug));
  function registerMarker(marker, popup, type, category, pending) {
    const entry = {
      marker: marker,
      popup: popup,
      type: type,
      category: category,
      pending: !!pending
    };
    markerRegistry.push(entry);
    applyFilterTo(entry);
    updateCategoryCounts();
  }
  function applyFilterTo(entry) {
    const visible = filters[entry.type] !== false && (entry.pending || categoryFilter.has(entry.category));
    entry.marker.getElement().style.display = visible ? '' : 'none';
    if (!visible && entry.popup && entry.popup.isOpen()) entry.popup.remove();
  }
  function applyFilters() {
    markerRegistry.forEach(applyFilterTo);
    updateCategoryCounts();
  }
  function updateCategoryCounts() {
    document.querySelectorAll('.divo-cat-count[data-cat]').forEach(el => {
      const slug = el.getAttribute('data-cat');
      el.textContent = markerRegistry.filter(e => !e.pending && e.category === slug && filters[e.type] !== false).length;
    });
  }
  function makePopup(html) {
    const popup = new maplibregl.Popup({
      offset: 22,
      closeButton: false,
      maxWidth: 'none'
    }).setHTML(html);
    popup.on('open', () => {
      activePopup = popup;
      hidePinCard();
      const closeIcon = popup.getElement().querySelector('.close_icon_wrapper');
      if (closeIcon) closeIcon.addEventListener('click', e => {
        e.stopPropagation();
        closeActivePopup();
      });
    });
    popup.on('close', () => {
      if (activePopup === popup) activePopup = null;
    });
    return popup;
  }
  function addMarkers() {
    meldingen.forEach(m => {
      const type = m.type === 'petitie' ? 'petitie' : 'melding';
      const cat = categoryOf(m.categorie);
      const el = document.createElement('div');
      el.className = 'divo-pin is--' + type + (cat.icon || SCRIPT_BASE ? ' has--img' : '');
      el.setAttribute('aria-label', (type === 'petitie' ? 'Petitie' : 'Melding') + ' · ' + cat.label);
      el.innerHTML = categoryIconHtml(cat, 'divo-pin-icon');
      const cta = m.cta ? `<a data-underline-link="alt" class="secondary_button is-small" href="${esc(m.cta.href)}" target="_blank" rel="noopener">${esc(m.cta.label)}</a>` : '';
      const popup = makePopup(cardHtml({
        variant: type,
        label: (type === 'petitie' ? 'Petitie' : 'Melding') + ' · ' + cat.label,
        title: esc(m.titel),
        place: m.plaats,
        body: m.tekst,
        cta: cta
      }));
      const marker = new maplibregl.Marker({
        element: el
      }).setLngLat([ m.lng, m.lat ]).setPopup(popup).addTo(map);
      registerMarker(marker, popup, type, cat.slug, false);
    });
    loadPendingPins();
  }
  const PENDING_KEY = 'divo-meldingen-in-behandeling';
  const PENDING_MAX_AGE = 60 * 24 * 60 * 60 * 1e3;
  function readPending() {
    try {
      const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      return Array.isArray(list) ? list.filter(p => p && Date.now() - p.ts < PENDING_MAX_AGE) : [];
    } catch (e) {
      return [];
    }
  }
  function savePending(list) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    } catch (e) {}
  }
  function addPendingPin(p) {
    const type = p.type === 'petitie' ? 'petitie' : 'melding';
    const el = document.createElement('div');
    el.className = 'divo-pin is--pending is--' + type;
    el.setAttribute('aria-label', 'Jouw ' + type + ' - in behandeling');
    el.innerHTML = '<i class="ti ti-clock" aria-hidden="true"></i>';
    const popup = makePopup(cardHtml({
      variant: type,
      label: 'In behandeling',
      title: esc(p.titel || (type === 'petitie' ? 'Jouw petitie' : 'Jouw melding')),
      place: p.adres,
      body: 'Alleen jij ziet deze pin. Na goedkeuring staat hij voor iedereen op de kaart.'
    }));
    const marker = new maplibregl.Marker({
      element: el
    }).setLngLat([ p.lng, p.lat ]).setPopup(popup).addTo(map);
    registerMarker(marker, popup, type, null, true);
  }
  function loadPendingPins() {
    const list = readPending();
    savePending(list);
    list.forEach(addPendingPin);
  }
  function onMeldingVerstuurd(e) {
    removePin();
    const d = e && e.detail || {};
    if (d.lat == null || d.lng == null || d.lat === '' || !map) return;
    const p = {
      lat: +d.lat,
      lng: +d.lng,
      type: String(d.type || '').toLowerCase() === 'petitie' ? 'petitie' : 'melding',
      titel: d.titel || '',
      adres: d.adres || '',
      ts: Date.now()
    };
    savePending(readPending().concat(p));
    addPendingPin(p);
  }
  let newPin = null;
  let newPinData = null;
  let geocodeSeq = 0;
  let lastPinDragAt = 0;
  let pinCard = null;
  let pinCardAdres = null;
  function coordsText(lat, lng) {
    return lat.toFixed(5) + ', ' + lng.toFixed(5);
  }
  async function reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${lat}&lon=${lng}&rows=1`);
      if (res.ok) {
        const json = await res.json();
        const doc = json && json.response && json.response.docs && json.response.docs[0];
        if (doc && doc.weergavenaam && (doc.afstand == null || doc.afstand < 150)) {
          return doc.weergavenaam;
        }
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'PDOK-adres ophalen mislukt:', e);
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=nl`);
      if (res.ok) {
        const json = await res.json();
        const a = json && json.address || {};
        const straat = [ a.road || a.pedestrian || a.footway || a.cycleway || a.path, a.house_number ].filter(Boolean).join(' ');
        const plaats = a.city || a.town || a.village || a.hamlet || a.municipality;
        const tekst = [ straat, plaats ].filter(Boolean).join(', ');
        if (tekst) return tekst;
      }
    } catch (e) {
      console.warn(LOG_PREFIX, 'Nominatim-adres ophalen mislukt:', e);
    }
    return null;
  }
  function openMeldpuntForPin() {
    if (!newPinData) return;
    hidePinCard();
    document.dispatchEvent(new CustomEvent('ditisvanons:openmeldpunt', {
      detail: Object.assign({}, newPinData)
    }));
  }
  function buildPinCard() {
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
    card.querySelector('.divo-pin-card-cta').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openMeldpuntForPin();
    });
    card.querySelector('.close_icon_wrapper').addEventListener('click', e => {
      e.stopPropagation();
      removePin();
    });
    pinCard = new maplibregl.Popup({
      offset: 22,
      closeButton: false,
      closeOnClick: false,
      maxWidth: 'none'
    }).setDOMContent(card);
  }
  function renderPinCard() {
    if (!pinCard || !newPinData) return;
    pinCardAdres.textContent = newPinData.loading ? 'Adres ophalen…' : newPinData.adres;
  }
  function showPinCard() {
    if (!newPin || !newPinData) return;
    closeActivePopup();
    if (!pinCard) buildPinCard();
    renderPinCard();
    pinCard.setLngLat(newPin.getLngLat());
    if (!pinCard.isOpen()) pinCard.addTo(map);
  }
  function hidePinCard() {
    if (pinCard && pinCard.isOpen()) pinCard.remove();
  }
  function updatePinLocation(lngLat, knownAdres) {
    const seq = ++geocodeSeq;
    const lat = +lngLat.lat.toFixed(6);
    const lng = +lngLat.lng.toFixed(6);
    if (knownAdres) {
      newPinData = {
        lat: lat,
        lng: lng,
        adres: knownAdres,
        loading: false
      };
      showPinCard();
      document.dispatchEvent(new CustomEvent('ditisvanons:meldpuntlocatie', {
        detail: Object.assign({}, newPinData)
      }));
      return;
    }
    newPinData = {
      lat: lat,
      lng: lng,
      adres: null,
      loading: true
    };
    showPinCard();
    reverseGeocode(lat, lng).then(adres => {
      if (seq !== geocodeSeq) return;
      newPinData = {
        lat: lat,
        lng: lng,
        adres: adres || coordsText(lat, lng),
        loading: false
      };
      renderPinCard();
      document.dispatchEvent(new CustomEvent('ditisvanons:meldpuntlocatie', {
        detail: Object.assign({}, newPinData)
      }));
    });
  }
  function placePin(lngLat, knownAdres) {
    closeActivePopup();
    hideHint();
    if (!newPin) {
      const el = document.createElement('div');
      el.className = 'divo-pin divo-pin-new';
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Jouw melding - klik voor het adres, sleep om te verplaatsen');
      el.innerHTML = '<i class="ti ti-plus" aria-hidden="true"></i>';
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (Date.now() - lastPinDragAt < 300) return;
        if (pinCard && pinCard.isOpen()) hidePinCard(); else showPinCard();
      });
      newPin = new maplibregl.Marker({
        element: el,
        draggable: true
      }).setLngLat(lngLat).addTo(map);
      newPin.on('dragstart', hidePinCard);
      newPin.on('dragend', () => {
        lastPinDragAt = Date.now();
        updatePinLocation(newPin.getLngLat());
      });
    } else {
      newPin.setLngLat(lngLat);
    }
    updatePinLocation(lngLat, knownAdres);
  }
  function removePin() {
    hidePinCard();
    if (newPin) newPin.remove();
    newPin = null;
    newPinData = null;
    geocodeSeq++;
  }
  function onMapClick(e) {
    if (e.originalEvent && e.originalEvent.target !== map.getCanvas()) return;
    if (activePopup) return;
    placePin(e.lngLat);
  }
  document.addEventListener('ditisvanons:meldingverstuurd', onMeldingVerstuurd);
  const PDOK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1';
  const ZOOM_PER_TYPE = {
    adres: 16,
    postcode: 15,
    weg: 15,
    woonplaats: 12,
    gemeente: 11
  };
  const TYPE_LABEL = {
    adres: 'Adres',
    postcode: 'Postcode',
    weg: 'Straat',
    woonplaats: 'Plaats',
    gemeente: 'Gemeente'
  };
  let hintEl = null;
  function hideHint() {
    if (hintEl) hintEl.classList.add('is--hidden');
  }
  function buildMapUi() {
    const inner = overlay.querySelector('.divo-map-overlay-inner') || overlay;
    const chrome = document.createElement('div');
    chrome.className = 'divo-map-chrome';
    const container = document.createElement('div');
    container.className = 'container divo-map-chrome-inner';
    chrome.appendChild(container);
    inner.appendChild(chrome);
    const ui = document.createElement('div');
    ui.className = 'divo-map-ui';
    ui.innerHTML = `\n      <div class="divo-map-search" role="search">\n        <input type="search" class="text_field divo-search-input" placeholder="Zoek een adres of plaats"\n               aria-label="Zoek een adres of plaats" autocomplete="off" spellcheck="false"\n               role="combobox" aria-expanded="false" aria-controls="divo-search-results">\n        <ul class="divo-search-results" id="divo-search-results" role="listbox" hidden></ul>\n      </div>\n      <div class="divo-map-filters" role="group" aria-label="Toon op de kaart">\n        <label class="divo-filter is--melding"><input type="checkbox" data-filter="melding" checked><span class="divo-filter-box" aria-hidden="true"></span><span>Meldingen</span></label>\n        <label class="divo-filter is--petitie"><input type="checkbox" data-filter="petitie" checked><span class="divo-filter-box" aria-hidden="true"></span><span>Petities</span></label>\n      </div>\n      <div class="divo-map-hint" role="note">\n        <i class="ti ti-info-circle divo-map-hint-icon" aria-hidden="true"></i>\n        <p class="divo-map-hint-text"></p>\n        <button type="button" class="divo-map-hint-close" aria-label="Uitleg sluiten">${PLUS_ICON}</button>\n      </div>`;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'divo-map-close';
    closeBtn.setAttribute('aria-label', 'Kaart sluiten');
    closeBtn.innerHTML = PLUS_ICON;
    closeBtn.addEventListener('click', closeMapOverlay);
    container.appendChild(ui);
    container.appendChild(closeBtn);
    container.appendChild(buildCategoryFilter());
    const embedEl = document.querySelector('.divo-map-embed');
    hintEl = ui.querySelector('.divo-map-hint');
    ui.querySelector('.divo-map-hint-text').textContent = embedEl && embedEl.getAttribute('data-map-hint') || 'Zoek op adres of klik op de kaart om op die locatie een melding te maken of een petitie te starten.';
    ui.querySelector('.divo-map-hint-close').addEventListener('click', hideHint);
    ui.querySelectorAll('[data-filter]').forEach(cb => cb.addEventListener('change', () => {
      filters[cb.getAttribute('data-filter')] = cb.checked;
      applyFilters();
    }));
    initSearch(ui.querySelector('.divo-search-input'), ui.querySelector('.divo-search-results'));
  }
  function buildCategoryFilter() {
    const mqSmall = window.matchMedia('(max-width: 991px)');
    const wrap = document.createElement('div');
    wrap.className = 'divo-cat-filter';
    wrap.innerHTML = `\n      <button type="button" class="divo-cat-toggle" aria-expanded="false" aria-controls="divo-cat-list">\n        <span class="divo-cat-toggle-label">Onderwerpen</span>\n        <span class="divo-cat-dot" aria-hidden="true"></span>\n        <span class="divo-cat-pm" aria-hidden="true"></span>\n      </button>\n      <div class="divo-cat-panel" id="divo-cat-list">\n        <ul class="divo-cat-list" role="group" aria-label="Filter op onderwerp">\n          ${CATEGORIES.map(c => `\n            <li><label class="divo-cat-item">\n              <input type="checkbox" data-cat-filter="${esc(c.slug)}" checked>\n              <span class="divo-cat-icon">${categoryIconHtml(c, 'divo-cat-icon-el')}</span>\n              <span class="divo-cat-label">${esc(c.label)}</span>\n              <span class="divo-cat-count" data-cat="${esc(c.slug)}">0</span>\n            </label></li>`).join('')}\n        </ul>\n        <button type="button" class="divo-cat-all" hidden>Alles tonen</button>\n      </div>`;
    const toggle = wrap.querySelector('.divo-cat-toggle');
    const allBtn = wrap.querySelector('.divo-cat-all');
    const boxes = [ ...wrap.querySelectorAll('[data-cat-filter]') ];
    function setOpen(open) {
      wrap.classList.toggle('is--open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    setOpen(!mqSmall.matches);
    mqSmall.addEventListener('change', () => setOpen(!mqSmall.matches));
    toggle.addEventListener('click', () => setOpen(!wrap.classList.contains('is--open')));
    function sync() {
      const on = boxes.filter(b => b.checked).length;
      allBtn.hidden = on === boxes.length;
      toggle.setAttribute('aria-label', 'Onderwerpen' + (on === boxes.length ? '' : ' (' + on + ' van ' + boxes.length + ' aan)'));
      wrap.classList.toggle('is--filtered', on !== boxes.length);
    }
    boxes.forEach(b => b.addEventListener('change', () => {
      const slug = b.getAttribute('data-cat-filter');
      if (b.checked) categoryFilter.add(slug); else categoryFilter.delete(slug);
      sync();
      applyFilters();
    }));
    allBtn.addEventListener('click', () => {
      boxes.forEach(b => {
        b.checked = true;
        categoryFilter.add(b.getAttribute('data-cat-filter'));
      });
      sync();
      applyFilters();
    });
    sync();
    return wrap;
  }
  function initSearch(input, list) {
    let results = [];
    let highlighted = -1;
    let seq = 0;
    let timer = null;
    function closeList() {
      list.hidden = true;
      list.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      results = [];
      highlighted = -1;
    }
    function render() {
      list.innerHTML = results.length ? results.map((r, i) => `\n            <li role="option" id="divo-search-opt-${i}" class="divo-search-result${i === highlighted ? ' is--active' : ''}" data-i="${i}" aria-selected="${i === highlighted}">\n              <span class="divo-search-name">${esc(r.weergavenaam)}</span>\n              <span class="divo-search-type">${esc(TYPE_LABEL[r.type] || r.type)}</span>\n            </li>`).join('') : '<li class="divo-search-empty">Niets gevonden</li>';
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (highlighted >= 0) input.setAttribute('aria-activedescendant', 'divo-search-opt-' + highlighted); else input.removeAttribute('aria-activedescendant');
    }
    async function suggest(q) {
      const mySeq = ++seq;
      try {
        const fq = encodeURIComponent('type:(gemeente OR woonplaats OR weg OR postcode OR adres)');
        const res = await fetch(`${PDOK}/suggest?q=${encodeURIComponent(q)}&rows=6&fq=${fq}`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (mySeq !== seq) return;
        results = json.response && json.response.docs || [];
        highlighted = -1;
        render();
      } catch (e) {
        if (mySeq === seq) closeList();
        console.warn(LOG_PREFIX, 'zoeken mislukt:', e);
      }
    }
    async function choose(r) {
      if (!r) return;
      hideHint();
      input.value = r.weergavenaam;
      closeList();
      input.blur();
      try {
        const res = await fetch(`${PDOK}/lookup?id=${encodeURIComponent(r.id)}&fl=id,type,weergavenaam,centroide_ll`);
        const json = await res.json();
        const doc = json.response && json.response.docs && json.response.docs[0];
        const m = doc && /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(doc.centroide_ll || '');
        if (!m || !map) return;
        const lngLat = {
          lng: +m[1],
          lat: +m[2]
        };
        map.flyTo({
          center: [ lngLat.lng, lngLat.lat ],
          zoom: ZOOM_PER_TYPE[doc.type] || 13,
          duration: 1200
        });
        if (doc.type === 'adres') map.once('moveend', () => placePin(lngLat, doc.weergavenaam));
      } catch (e) {
        console.warn(LOG_PREFIX, 'locatie ophalen mislukt:', e);
      }
    }
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) {
        seq++;
        closeList();
        return;
      }
      timer = setTimeout(() => suggest(q), 200);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && results.length) {
        e.preventDefault();
        highlighted = (highlighted + 1) % results.length;
        render();
      } else if (e.key === 'ArrowUp' && results.length) {
        e.preventDefault();
        highlighted = (highlighted - 1 + results.length) % results.length;
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        choose(results[highlighted >= 0 ? highlighted : 0]);
      } else if (e.key === 'Escape') {
        if (!list.hidden || input.value) {
          e.preventDefault();
          e.stopPropagation();
          if (list.hidden) input.value = '';
          closeList();
        }
      }
    });
    list.addEventListener('mousedown', e => {
      const li = e.target.closest('[data-i]');
      if (!li) return;
      e.preventDefault();
      choose(results[+li.getAttribute('data-i')]);
    });
    input.addEventListener('blur', () => setTimeout(closeList, 150));
  }
  buildMapUi();
  function createMap() {
    try {
      map = new maplibregl.Map({
        container: 'divo-map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        bounds: NL_BOUNDS,
        fitBoundsOptions: {
          padding: DEFAULT_ZOOM_PADDING
        },
        maxBounds: NL_MAXBOUNDS,
        minZoom: 5.4,
        maxZoom: 16,
        attributionControl: {
          compact: true
        }
      });
      map.on('load', addMarkers);
      map.on('click', onMapClick);
      map.on('error', e => console.error(LOG_PREFIX, 'MapLibre-fout:', e && e.error));
    } catch (err) {
      console.error(LOG_PREFIX, 'kon de kaart niet initialiseren:', err);
    }
  }
  function openMapOverlay() {
    isOpen = true;
    overlay.classList.remove('is-hidden');
    document.body.classList.add('divo-map-is-open');
    stopPageScroll();
    whenMapLibreReady(() => {
      if (!map) {
        requestAnimationFrame(createMap);
        return;
      }
      requestAnimationFrame(() => {
        map.resize();
        map.fitBounds(NL_BOUNDS, {
          padding: DEFAULT_ZOOM_PADDING,
          duration: 0
        });
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
    });
  }
  function closeMapOverlay() {
    isOpen = false;
    removePin();
    closeActivePopup();
    overlay.classList.add('is-hidden');
    document.body.classList.remove('divo-map-is-open');
    resumePageScroll();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  console.log('[divo-map] klik-handler gekoppeld aan', staticBtn);
  staticBtn.addEventListener('click', () => {
    console.log('[divo-map] klik ontvangen, isOpen was', isOpen);
    if (!isOpen) openMapOverlay();
  });
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-map="open"]');
    if (!trigger) return;
    e.preventDefault();
    if (!isOpen) openMapOverlay();
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeMapOverlay();
  });
  document.addEventListener('keydown', e => {
    const meldpuntOpen = document.querySelector('[data-meldpunt="modal"].is-open, .divo-meldpunt-overlay.divo-mp-open');
    if (e.key === 'Escape' && isOpen && !meldpuntOpen) closeMapOverlay();
  });
})();
