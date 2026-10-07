(function() {
  console.log('[divo-map] map.js gestart');
  window.__divoMapScriptRan = true;
  const NL_BOUNDS = [ 3.37087, 50.753883, 7.211666, 53.511383 ];
  const NL_MAXBOUNDS = [ -1.5, 49.3, 12.1, 55 ];
  const DEFAULT_ZOOM_PADDING = 20;
  const meldingen = [ {
    type: 'melding',
    categorie: 'buurthuis',
    lng: 6.5931,
    lat: 53.2237,
    titel: 'Buurthuis Oosterpark dreigt te sluiten',
    plaats: 'Groningen',
    tekst: 'Het buurthuis waar wekelijks honderden mensen samenkomen, krijgt vanaf volgend jaar geen gemeentelijke subsidie meer.',
    cta: null
  }, {
    type: 'melding',
    categorie: 'mobiliteit',
    lng: 7.045,
    lat: 53.253,
    titel: 'Laatste bushokje uit het dorp verdwenen',
    plaats: 'Nieuwolda',
    tekst: 'Vervoerder heeft de halte opgeheven wegens te weinig reizigers. Ouderen en scholieren moeten nu vijf kilometer verder.',
    cta: null
  }, {
    type: 'petitie',
    categorie: 'bibliotheek',
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
    categorie: 'ziekenhuis',
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
    slug: 'mobiliteit',
    label: 'Mobiliteit / vervoer',
    file: 'ov'
  }, {
    slug: 'sport-en-spel',
    label: 'Sport & spel',
    file: 'sport_en_spel'
  }, {
    slug: 'verbinding',
    label: 'Verbinding'
  }, {
    slug: 'buurthuis',
    label: 'Buurthuis'
  }, {
    slug: 'bibliotheek',
    label: 'Bibliotheek'
  }, {
    slug: 'school',
    label: 'School',
    file: 'educatie'
  }, {
    slug: 'toilet',
    label: 'Toilet'
  }, {
    slug: 'woning',
    label: 'Woning'
  }, {
    slug: 'ziekenhuis',
    label: 'Ziekenhuis'
  }, {
    slug: 'verlichting',
    label: 'Verlichting',
    file: 'veiligheid'
  }, {
    slug: 'afval',
    label: 'Afval'
  }, {
    slug: 'bestuur',
    label: 'Bestuur'
  }, {
    slug: 'overige',
    label: 'Overige'
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
            const merged = Object.assign({
              file: d.file
            }, c, {
              slug: slug
            });
            if (!merged.file) merged.file = d.file;
            return merged;
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
    return CATEGORY_BY_SLUG[key] || CATEGORIES.find(c => String(c.label).toLowerCase().trim() === key) || CATEGORY_BY_SLUG[FALLBACK_CATEGORY];
  }
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICON_RED = /#dc542c\b/gi;
  const FALLBACK_SYMBOL = '<path fill="currentColor" d="M400 60c-150 0-260 112-260 255 0 190 260 425 260 425s260-235 260-425C660 172 550 60 400 60z"/><circle fill="#F3E8D0" cx="400" cy="310" r="105"/>';
  const iconState = {};
  let iconSprite = null;
  function iconKey(cat) {
    return 'divo-icon-' + String(cat.icon ? cat.slug : cat.file || cat.slug).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  }
  function iconUrl(cat) {
    if (cat.icon) return cat.icon;
    return SCRIPT_BASE ? SCRIPT_BASE + 'icons/' + encodeURIComponent(cat.file || cat.slug) + '.svg' : '';
  }
  function addSymbol(key, viewBox, inner) {
    if (!iconSprite) {
      iconSprite = document.createElementNS(SVG_NS, 'svg');
      iconSprite.setAttribute('aria-hidden', 'true');
      iconSprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.appendChild(iconSprite);
    }
    const sym = document.createElementNS(SVG_NS, 'symbol');
    sym.id = key;
    sym.setAttribute('viewBox', viewBox);
    sym.innerHTML = inner;
    iconSprite.appendChild(sym);
    document.querySelectorAll('use[href="#' + key + '"]').forEach(u => u.setAttribute('href', '#' + key));
  }
  function loadIcon(cat) {
    const key = iconKey(cat);
    if (iconState[key]) return;
    iconState[key] = 'loading';
    const url = iconUrl(cat);
    const fallback = () => {
      iconState[key] = 'fallback';
      addSymbol(key, '0 0 800 800', FALLBACK_SYMBOL);
    };
    if (!url) return fallback();
    fetch(url).then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status))).then(text => {
      const doc = (new DOMParser).parseFromString(text, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('geen SVG');
      svg.querySelectorAll('script, foreignObject').forEach(n => n.remove());
      const vb = svg.getAttribute('viewBox') || '0 0 ' + (parseFloat(svg.getAttribute('width')) || 800) + ' ' + (parseFloat(svg.getAttribute('height')) || 800);
      iconState[key] = 'ok';
      addSymbol(key, vb, svg.innerHTML.replace(ICON_RED, 'currentColor'));
    }).catch(e => {
      console.warn(LOG_PREFIX, 'illustratie niet geladen (' + url + '), terugval gebruikt:', e.message);
      fallback();
    });
  }
  function categoryIconHtml(cat, cls) {
    loadIcon(cat);
    const key = iconKey(cat);
    return `<svg class="${cls} is--svg" aria-hidden="true" focusable="false"><use href="#${key}" width="100%" height="100%"></use></svg>`;
  }
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
      offset: 32,
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
  function num(v) {
    const n = parseFloat(String(v == null ? '' : v).replace(',', '.').trim());
    return isFinite(n) ? n : null;
  }
  function attr(el, name) {
    const v = el.getAttribute(name);
    return v == null ? '' : v.trim();
  }
  function readCmsItems() {
    const items = Array.from(document.querySelectorAll('[data-map-item]'));
    const hasList = items.length > 0 || !!document.querySelector('[data-map-list]');
    if (!hasList) return null;
    const out = [];
    items.forEach(el => {
      const lat = num(attr(el, 'data-lat'));
      const lng = num(attr(el, 'data-lng'));
      const titel = attr(el, 'data-titel');
      if (lat == null || lng == null || !titel) {
        console.warn(LOG_PREFIX, 'CMS-item overgeslagen (lat, lng of titel ontbreekt):', el);
        return;
      }
      const type = attr(el, 'data-type').toLowerCase() === 'petitie' ? 'petitie' : 'melding';
      const bodyEl = el.querySelector('[data-map-body]');
      const tekst = bodyEl ? bodyEl.textContent.trim() : attr(el, 'data-tekst');
      const href = attr(el, 'data-link');
      const label = attr(el, 'data-link-label') || (type === 'petitie' ? 'Teken de petitie' : 'Lees meer');
      out.push({
        type: type,
        lat: lat,
        lng: lng,
        titel: titel,
        tekst: tekst,
        categorie: attr(el, 'data-categorie'),
        plaats: attr(el, 'data-plaats'),
        cta: href && href !== '#' ? {
          label: label,
          href: href
        } : null
      });
    });
    return out;
  }
  function addMarkers() {
    const cms = readCmsItems();
    const items = cms || meldingen;
    if (cms) console.log(LOG_PREFIX, cms.length + ' item(s) uit het CMS geladen');
    items.forEach(addItemMarker);
    loadPendingPins(items);
    loadPetities();
  }
  function loadPetities() {
    const embedEl = document.querySelector('.divo-map-embed');
    const url = embedEl && embedEl.getAttribute('data-petities-url');
    if (!url) return;
    fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    }).then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))).then(data => {
      const list = data && data.petities || [];
      const items = list.map(p => ({
        type: 'petitie',
        categorie: p.onderwerp,
        lat: +p.lat,
        lng: +p.lng,
        titel: p.titel,
        plaats: p.plaats,
        tekst: p.tekst,
        cta: p.url ? {
          label: 'Teken de petitie',
          href: p.url
        } : null
      })).filter(m => isFinite(m.lat) && isFinite(m.lng) && m.titel);
      items.forEach(addItemMarker);
      removeApprovedPending(items);
      console.log(LOG_PREFIX, items.length + ' petitie(s) uit ControlShift geladen');
    }).catch(e => console.warn(LOG_PREFIX, 'petities ophalen mislukt:', e));
  }
  function addItemMarker(m) {
    const type = m.type === 'petitie' ? 'petitie' : 'melding';
    const cat = categoryOf(m.categorie);
    const el = document.createElement('div');
    el.className = 'divo-pin has--icon is--' + type;
    el.setAttribute('aria-label', (type === 'petitie' ? 'Petitie' : 'Melding') + ' · ' + cat.label);
    el.innerHTML = categoryIconHtml(cat, 'divo-pin-icon');
    const cta = m.cta ? `<a data-underline-link="alt" class="secondary_button is-small" href="${esc(m.cta.href)}" target="_blank" rel="noopener">${esc(m.cta.label)}</a>` : '';
    const petitieTip = type === 'melding' ? '<div class="body_small divo-card-petitie">Meer doen voor deze voorziening? <a href="#" data-divo-start-petitie>Start een petitie</a>.</div>' : '';
    const popup = makePopup(cardHtml({
      variant: type,
      label: (type === 'petitie' ? 'Petitie' : 'Melding') + ' · ' + cat.label,
      title: esc(m.titel),
      place: m.plaats,
      body: m.tekst,
      cta: (cta || '') + petitieTip
    }));
    if (petitieTip) popup.on('open', () => {
      const link = popup.getElement().querySelector('[data-divo-start-petitie]');
      if (link) link.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeActivePopup();
        startPetitieAt(m.lat, m.lng);
      });
    });
    const marker = new maplibregl.Marker({
      element: el
    }).setLngLat([ m.lng, m.lat ]).setPopup(popup).addTo(map);
    registerMarker(marker, popup, type, cat.slug, false);
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
  function distM(a, b) {
    const dLat = (a.lat - b.lat) * 111320;
    const dLng = (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }
  const APPROVED_MATCH_M = 75;
  function loadPendingPins(approved) {
    const list = readPending().filter(p => !(approved || []).some(a => a.type === (p.type === 'petitie' ? 'petitie' : 'melding') && distM(a, p) < APPROVED_MATCH_M));
    savePending(list);
    list.forEach(addPendingPin);
  }
  function removeApprovedPending(approved) {
    const match = p => approved.some(a => a.type === p.type && distM(a, p) < APPROVED_MATCH_M);
    savePending(readPending().filter(p => !match({
      type: p.type === 'petitie' ? 'petitie' : 'melding',
      lat: p.lat,
      lng: p.lng
    })));
    for (let i = markerRegistry.length - 1; i >= 0; i--) {
      const e = markerRegistry[i];
      if (!e.pending) continue;
      const ll = e.marker.getLngLat();
      if (match({
        type: e.type,
        lat: ll.lat,
        lng: ll.lng
      })) {
        if (e.popup && e.popup.isOpen()) e.popup.remove();
        e.marker.remove();
        markerRegistry.splice(i, 1);
      }
    }
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
  function startPetitieAt(lat, lng) {
    document.dispatchEvent(new CustomEvent('ditisvanons:openmeldpunt', {
      detail: {
        lat: lat,
        lng: lng,
        adres: null,
        loading: true,
        type: 'petitie'
      }
    }));
    reverseGeocode(lat, lng).then(adres => {
      document.dispatchEvent(new CustomEvent('ditisvanons:meldpuntlocatie', {
        detail: {
          lat: lat,
          lng: lng,
          adres: adres || coordsText(lat, lng)
        }
      }));
    });
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
      body: 'Klopt de plek niet? Sleep de pin of zoek het adres op in de zoekbalk.',
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
      offset: 32,
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
  let hintEls = [];
  let hintToggle = null;
  const INFO_ICON = '<svg viewBox="0 0 24 24" width="100%" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="7.4" r="1.4" fill="currentColor"/></svg>';
  function syncHintToggle() {
    if (!hintToggle) return;
    const open = hintEls.some(el => !el.classList.contains('is--hidden'));
    hintToggle.setAttribute('aria-expanded', String(open));
    hintToggle.setAttribute('aria-label', open ? 'Uitleg verbergen' : 'Uitleg tonen');
    hintToggle.classList.toggle('is--open', open);
  }
  function hideHint() {
    hintEls.forEach(el => el.classList.add('is--hidden'));
    syncHintToggle();
  }
  function showHint() {
    hintEls.forEach(el => el.classList.remove('is--hidden'));
    syncHintToggle();
  }
  function hintHtml(extraClass) {
    return `\n      <div class="divo-map-hint${extraClass ? ' ' + extraClass : ''}" role="note">\n        <p class="divo-map-hint-text"></p>\n        <button type="button" class="divo-map-hint-close" aria-label="Uitleg sluiten">${PLUS_ICON}</button>\n      </div>`;
  }
  function addHintLink(el, url) {
    if (!url) return;
    const a = document.createElement('a');
    a.className = 'divo-map-hint-link';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Meer uitleg (opent in nieuw tabblad)');
    a.innerHTML = INFO_ICON;
    el.querySelector('.divo-map-hint-text').after(a);
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
    ui.innerHTML = `\n      <div class="divo-map-search" role="search">\n        <input type="search" class="text_field divo-search-input" placeholder="Zoek een adres of plaats"\n               aria-label="Zoek een adres of plaats" autocomplete="off" spellcheck="false"\n               role="combobox" aria-expanded="false" aria-controls="divo-search-results">\n        <ul class="divo-search-results" id="divo-search-results" role="listbox" hidden></ul>\n      </div>\n      <div class="divo-map-filters" role="group" aria-label="Toon op de kaart">\n        <label class="divo-filter is--melding"><input type="checkbox" data-filter="melding" checked><span class="divo-filter-box" aria-hidden="true"></span><span>Meldingen</span></label>\n        <label class="divo-filter is--petitie"><input type="checkbox" data-filter="petitie" checked><span class="divo-filter-box" aria-hidden="true"></span><span>Petities</span></label>\n        <button type="button" class="divo-map-hint-toggle is--open" aria-expanded="true" aria-label="Uitleg verbergen" title="Uitleg">${INFO_ICON}</button>\n      </div>\n      ${hintHtml('')}`;
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
    const firstHint = ui.querySelector('.divo-map-hint');
    firstHint.querySelector('.divo-map-hint-text').textContent = embedEl && embedEl.getAttribute('data-map-hint') || 'Zoek op adres of klik op de kaart om op die locatie een melding te maken of een petitie te starten.';
    addHintLink(firstHint, embedEl && embedEl.getAttribute('data-map-hint-link'));
    hintEls = [ firstHint ];
    const hint2 = embedEl && embedEl.getAttribute('data-map-hint-2');
    if (hint2) {
      firstHint.insertAdjacentHTML('afterend', hintHtml('is--alt'));
      const second = firstHint.nextElementSibling;
      second.querySelector('.divo-map-hint-text').textContent = hint2;
      addHintLink(second, embedEl.getAttribute('data-map-hint-2-link'));
      hintEls.push(second);
    }
    hintEls.forEach(el => el.querySelector('.divo-map-hint-close').addEventListener('click', () => {
      el.classList.add('is--hidden');
      syncHintToggle();
    }));
    hintToggle = ui.querySelector('.divo-map-hint-toggle');
    hintToggle.addEventListener('click', () => {
      if (hintToggle.getAttribute('aria-expanded') === 'true') hideHint(); else showHint();
    });
    syncHintToggle();
    ui.querySelectorAll('[data-filter]').forEach(cb => cb.addEventListener('change', () => {
      filters[cb.getAttribute('data-filter')] = cb.checked;
      applyFilters();
    }));
    initSearch(ui.querySelector('.divo-search-input'), ui.querySelector('.divo-search-results'));
  }
  function buildCategoryFilter() {
    const wrap = document.createElement('div');
    wrap.className = 'divo-cat-filter';
    wrap.innerHTML = `\n      <button type="button" class="divo-cat-toggle" aria-expanded="false" aria-controls="divo-cat-list">\n        <span class="divo-cat-toggle-label">Thema's</span>\n        <span class="divo-cat-dot" aria-hidden="true"></span>\n        <span class="divo-cat-pm" aria-hidden="true"></span>\n      </button>\n      <div class="divo-cat-panel" id="divo-cat-list">\n        <ul class="divo-cat-list" role="group" aria-label="Filter op thema">\n          ${CATEGORIES.map(c => `\n            <li><label class="divo-cat-item">\n              <input type="checkbox" data-cat-filter="${esc(c.slug)}" checked>\n              <span class="divo-cat-icon">${categoryIconHtml(c, 'divo-cat-icon-el')}</span>\n              <span class="divo-cat-label">${esc(c.label)}</span>\n              <span class="divo-cat-count" data-cat="${esc(c.slug)}">0</span>\n            </label></li>`).join('')}\n        </ul>\n        <button type="button" class="divo-cat-all" hidden>Alles tonen</button>\n      </div>`;
    const toggle = wrap.querySelector('.divo-cat-toggle');
    const allBtn = wrap.querySelector('.divo-cat-all');
    const boxes = [ ...wrap.querySelectorAll('[data-cat-filter]') ];
    function setOpen(open) {
      wrap.classList.toggle('is--open', open);
      toggle.setAttribute('aria-expanded', String(open));
    }
    setOpen(false);
    toggle.addEventListener('click', () => setOpen(!wrap.classList.contains('is--open')));
    function sync() {
      const on = boxes.filter(b => b.checked).length;
      allBtn.hidden = on === boxes.length;
      toggle.setAttribute('aria-label', "Thema's" + (on === boxes.length ? '' : ' (' + on + ' van ' + boxes.length + ' aan)'));
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
