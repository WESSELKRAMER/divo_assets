/*
  Meldpunt - stuurt een NATIVE Webflow-formulier aan (gebouwd in de
  Designer), zodat inzendingen gewoon in Webflow > Forms binnenkomen.

  Dit script regelt alleen het gedrag eromheen:
  - openen/sluiten van de modal (+ pagina-scroll op slot, ook met Lenis);
  - adres + coördinaten invullen als het formulier vanaf een pin op de
    kaart wordt geopend (event 'ditisvanons:openmeldpunt' uit map.js);
  - Melding/Petitie-schakelaar (vult een verborgen veld, toont het
    petitielink-veld en maakt dat verplicht);
  - na een geslaagde inzending de kaart laten weten dat de pin weg mag, en
    bij opnieuw openen het formulier weer leeg klaarzetten.

  Verwachte attributen in Webflow (Element settings > Custom attributes):
    data-meldpunt="modal"          de modal-wrapper (position fixed, z-index 10000)
    data-meldpunt="close"          sluitknop(pen) - mag vaker voorkomen
    data-meldpunt="open"           knoppen elders op de site die het formulier openen
    data-meldpunt-type="melding"   schakelaar-knop
    data-meldpunt-type="petitie"   schakelaar-knop
    data-meldpunt-petitie          wrapper van het petitielink-veld (alleen bij petitie)
    data-meldpunt-field="adres"    het adresveld
    data-meldpunt-field="type"     verborgen veld  } in een Embed binnen het form,
    data-meldpunt-field="lat"      verborgen veld  } zie de bouwinstructie
    data-meldpunt-field="lng"      verborgen veld  }
*/
(function(){
  const LOG = '[divo-meldpunt]';
  const modal = document.querySelector('[data-meldpunt="modal"]');
  if (!modal) { console.warn(LOG, 'geen [data-meldpunt="modal"] gevonden op deze pagina'); return; }

  const formBlock = modal.querySelector('.w-form');
  const form = modal.querySelector('form');
  const done = formBlock && formBlock.querySelector('.w-form-done');
  const fail = formBlock && formBlock.querySelector('.w-form-fail');
  if (!form) { console.warn(LOG, 'geen <form> in de modal gevonden'); return; }

  const field = (name) => form.querySelector(`[data-meldpunt-field="${name}"]`);
  const adresInput = field('adres');
  const typeInput = field('type');
  const latInput = field('lat');
  const lngInput = field('lng');
  const typeButtons = modal.querySelectorAll('[data-meldpunt-type]');
  const petitieWrap = modal.querySelector('[data-meldpunt-petitie]');
  const petitieInputs = petitieWrap ? petitieWrap.querySelectorAll('input, textarea') : [];
  const adresPlaceholder = adresInput ? adresInput.getAttribute('placeholder') || '' : '';

  let pinLocatie = null;   // { lat, lng } of null als er geen pin is
  let autoAdres = '';      // wat wij automatisch invulden (zelf aangepast = niet overschrijven)
  let submitted = false;

  // ---------- Scroll-lock (samen met de kaart-overlay) ----------
  function getLenis(){
    try {
      // site.bundle.js: `const lenis = new Lenis()` - globale naam, niet op window
      // eslint-disable-next-line no-undef
      if (typeof lenis !== 'undefined' && lenis && typeof lenis.stop === 'function') return lenis;
    } catch (e) {}
    return window.lenis || null;
  }
  function isMapOverlayOpen(){
    const m = document.getElementById('divo-map-overlay');
    return !!(m && !m.classList.contains('is-hidden'));
  }

  // ---------- Formulier-velden ----------
  function setAdres(adres, loading, force){
    if (!adresInput) return;
    const handmatig = adresInput.value !== '' && adresInput.value !== autoAdres;
    if (handmatig && !force) return;
    adresInput.value = adres || '';
    autoAdres = adresInput.value;
    adresInput.setAttribute('placeholder', loading ? 'Adres ophalen…' : adresPlaceholder);
  }
  function setLocatie(loc){
    pinLocatie = loc;
    if (latInput) latInput.value = loc ? loc.lat : '';
    if (lngInput) lngInput.value = loc ? loc.lng : '';
  }
  function setType(type){
    const isPetitie = type === 'petitie';
    if (typeInput) typeInput.value = isPetitie ? 'Petitie' : 'Melding';
    typeButtons.forEach(b => b.classList.toggle('is--active', b.getAttribute('data-meldpunt-type') === type));
    if (petitieWrap) petitieWrap.style.display = isPetitie ? '' : 'none';
    // Petitielink alleen verplicht (en alleen meegestuurd) bij een petitie.
    petitieInputs.forEach(i => {
      i.required = isPetitie;
      if (!isPetitie) i.value = '';
    });
  }
  typeButtons.forEach(b => b.addEventListener('click', (e) => {
    e.preventDefault();
    setType(b.getAttribute('data-meldpunt-type'));
  }));

  // Na een inzending verbergt Webflow het formulier en toont .w-form-done.
  // Bij opnieuw openen zetten we alles weer terug.
  function resetAfterSubmit(){
    form.reset();
    form.style.display = '';
    if (done) done.style.display = 'none';
    if (fail) fail.style.display = 'none';
    autoAdres = '';
    submitted = false;
    setType('melding');
  }

  // ---------- Open / dicht ----------
  function open(e){
    if (submitted) resetAfterSubmit();
    const d = (e && e.detail) || {};
    if (d.lat != null && d.lng != null) {
      const nieuwePlek = !pinLocatie || pinLocatie.lat !== d.lat || pinLocatie.lng !== d.lng;
      setLocatie({ lat: d.lat, lng: d.lng });
      setAdres(d.adres, !!d.loading, nieuwePlek);
    } else {
      setLocatie(null);
      setAdres('', false, false);
    }
    if (!typeInput || !typeInput.value) setType('melding');

    modal.style.display = 'flex';
    modal.classList.add('is-open');
    modal.setAttribute('data-lenis-prevent', '');
    document.body.style.overflow = 'hidden';
    const l = getLenis(); if (l) l.stop();
  }

  function close(){
    modal.classList.remove('is-open');
    modal.style.display = 'none';
    // Geopend vanuit de kaart: pagina blijft op slot tot de kaart dicht gaat.
    if (isMapOverlayOpen()) return;
    document.body.style.overflow = '';
    const l = getLenis(); if (l) l.start();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  document.addEventListener('ditisvanons:openmeldpunt', open);
  document.addEventListener('ditisvanons:meldpuntlocatie', (e) => {
    const d = e.detail || {};
    setLocatie({ lat: d.lat, lng: d.lng });
    setAdres(d.adres, false, false);
  });

  document.querySelectorAll('[data-meldpunt="open"]').forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  }));
  modal.querySelectorAll('[data-meldpunt="close"]').forEach(btn => btn.addEventListener('click', (e) => {
    e.preventDefault();
    close();
  }));
  // Klik op de donkere achtergrond (de modal zelf, niet het paneel) sluit.
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !modal.classList.contains('is-open')) return;
    close();
    e.stopImmediatePropagation(); // niet ook meteen de kaart-overlay sluiten
  });

  // ---------- Geslaagde inzending detecteren ----------
  // webflow.js geeft geen event; we kijken wanneer .w-form-done zichtbaar wordt.
  if (done) {
    new MutationObserver(() => {
      if (submitted || getComputedStyle(done).display === 'none') return;
      submitted = true;
      document.dispatchEvent(new CustomEvent('ditisvanons:meldingverstuurd', {
        detail: { lat: pinLocatie && pinLocatie.lat, lng: pinLocatie && pinLocatie.lng }
      }));
      setLocatie(null);
    }).observe(done, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  setType('melding');
})();
