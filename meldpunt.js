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
    data-meldpunt-title            (optioneel) kop die wisselt: melding/petitie
    data-meldpunt-field="adres"    het adresveld
    data-meldpunt-field="titel"    het titelveld (voor de "in behandeling"-pin)
    data-meldpunt-field="type"     verborgen veld  } in een Embed binnen het form,
    data-meldpunt-field="lat"      verborgen veld  } zie de bouwinstructie
    data-meldpunt-field="lng"      verborgen veld  }
    data-meldpunt="webflow-form"   (optioneel) verborgen native Webflow Form Block
                                   waar de inzending doorheen gaat - zie hieronder
*/
(function(){
  const LOG = '[divo-meldpunt]';

  // Dit script staat in het kaart-snippet (hoog op de pagina), terwijl het
  // formulier/de modal vaak láger op de pagina staat. Dus pas beginnen als
  // de hele pagina er is - anders bestaat de modal nog niet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(){
  const modal = document.querySelector('[data-meldpunt="modal"]');
  if (!modal) {
    console.warn(LOG, 'geen [data-meldpunt="modal"] gevonden op deze pagina - staat de meldpunt-embed erop?');
    return;
  }
  console.log(LOG, 'meldpunt.js klaar');
  // Zelfde reden als bij de kaart-overlay: los van eventuele stacking-
  // contexts (z-index/transform van secties) hangen, direct onder <body>.
  if (modal.parentNode !== document.body) document.body.appendChild(modal);

  // Native Webflow-form (.w-form) of de test-embed (data-meldpunt="done"/"fail").
  const form = modal.querySelector('form');
  const done = modal.querySelector('.w-form-done, [data-meldpunt="done"]');
  const fail = modal.querySelector('.w-form-fail, [data-meldpunt="fail"]');
  if (!form) { console.warn(LOG, 'geen <form> in de modal gevonden'); return; }

  const field = (name) => form.querySelector(`[data-meldpunt-field="${name}"]`);
  const adresInput = field('adres');
  const typeInput = field('type');
  const latInput = field('lat');
  const lngInput = field('lng');
  const typeButtons = modal.querySelectorAll('[data-meldpunt-type]');
  const titleEl = modal.querySelector('[data-meldpunt-title]'); // optioneel
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
    // Petitie = red-thema (styling via .is--petitie op de modal).
    modal.classList.toggle('is--petitie', isPetitie);
    if (titleEl) titleEl.textContent = isPetitie ? 'Start een petitie' : 'Doe een melding';
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

  // ---------- Versturen via een verborgen native Webflow-formulier ----------
  // Het zichtbare formulier is een embed (eigen opbouw/styling). Webflow
  // accepteert alleen inzendingen van formulieren die in de Designer zijn
  // gebouwd - dus staat er ergens op de pagina een klein, verborgen
  // Webflow-formulier (attribuut data-meldpunt="webflow-form") met velden
  // die dezelfde Name hebben. Bij versturen kopiëren we de waarden daarheen
  // en laten webflow.js dát formulier versturen. Resultaat (gelukt/mislukt)
  // spiegelen we terug naar het zichtbare formulier.
  //
  // Is het zichtbare formulier zelf al een native Webflow-form (.w-form),
  // dan doet dit blok niets. Staat er (nog) geen verborgen formulier, dan
  // testmodus: inzending alleen in de console.
  const isNativeForm = !!form.closest('.w-form');
  let sending = false;

  function showResult(ok){
    sending = false;
    form.classList.remove('is--sending');
    form.style.display = ok ? 'none' : '';
    if (done) done.style.display = ok ? 'block' : 'none';
    if (fail) fail.style.display = ok ? 'none' : 'block';
  }

  function findBridge(){
    const el = document.querySelector('[data-meldpunt="webflow-form"]');
    if (!el) return null;
    const bForm = el.matches('form') ? el : el.querySelector('form');
    const block = bForm && bForm.closest('.w-form');
    if (!bForm || !block) {
      console.warn(LOG, '[data-meldpunt="webflow-form"] gevonden, maar geen Webflow Form Block (.w-form > form) - check de opbouw');
      return null;
    }
    return { block, form: bForm, done: block.querySelector('.w-form-done'), fail: block.querySelector('.w-form-fail') };
  }

  // Webflow beveiligt formulieren met Cloudflare Turnstile. webflow.js start
  // die pas als het <form> in beeld komt (IntersectionObserver) en zet de
  // widget ín dat form. Een formulier met display:none krijgt dus nooit een
  // token. Daarom verhuist het verborgen formulier naar een plekje onderin
  // de modal (buiten ons eigen <form> - geneste forms kan niet): zodra de
  // modal opent komt het in beeld en haalt Turnstile een token op. De
  // velden van dat formulier blijven onzichtbaar (CSS: .divo-bridge-slot).
  function mountBridge(bridge){
    let slot = modal.querySelector('[data-meldpunt="webflow-slot"]');
    if (!slot) {
      slot = document.createElement('div');
      form.insertAdjacentElement('afterend', slot);
    }
    slot.classList.add('divo-bridge-slot');
    if (bridge.block.parentNode !== slot) slot.appendChild(bridge.block);
  }

  const turnstileActive = () => !!document.querySelector('[data-turnstile-sitekey]');
  let lastToken = null; // een Turnstile-token is maar één keer bruikbaar

  function currentToken(bridge){
    const jq = window.jQuery;
    const d = jq && jq.data ? jq.data(bridge.form, '.w-form') : null; // webflow.js bewaart het token hier
    return d ? d.turnstileToken : undefined;
  }

  // Wacht (max. 15s) tot webflow.js een vers Turnstile-token heeft.
  function waitForToken(bridge){
    return new Promise((resolve) => {
      if (!turnstileActive()) return resolve(true);
      const start = Date.now();
      (function poll(){
        const tok = currentToken(bridge);
        const ready = tok !== undefined
          ? (tok && tok !== lastToken)
          : !bridge.block.classList.contains('w-form-loading'); // terugval als jQuery-data niet leesbaar is
        if (ready) return resolve(true);
        if (Date.now() - start > 15000) return resolve(false);
        setTimeout(poll, 200);
      })();
    });
  }

  // Na elke poging een nieuw token laten aanmaken voor een volgende inzending.
  function renewToken(bridge){
    lastToken = currentToken(bridge) || lastToken;
    if (!window.turnstile || typeof window.turnstile.reset !== 'function') return;
    const widget = [...bridge.form.children].reverse().find(el => el.tagName === 'DIV' && !el.className);
    try { window.turnstile.reset(widget); } catch (e) { /* geen widget gevonden */ }
  }

  const initialBridge = findBridge();
  if (initialBridge && !isNativeForm) mountBridge(initialBridge);

  function sendViaBridge(bridge){
    // Verborgen formulier resetten (na een eerdere inzending verbergt
    // webflow.js het en toont de bedankt-melding).
    bridge.form.reset();
    bridge.form.style.display = '';
    if (bridge.done) bridge.done.style.display = 'none';
    if (bridge.fail) bridge.fail.style.display = 'none';

    const missing = [];
    new FormData(form).forEach((value, name) => {
      const target = bridge.form.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!target) { missing.push(name); return; }
      if (target.type === 'checkbox') target.checked = !!value;
      else target.value = value;
    });
    if (missing.length) console.warn(LOG, 'deze velden bestaan niet in het verborgen Webflow-formulier en worden dus niet opgeslagen:', missing.join(', '));

    // Afwachten wat webflow.js teruggeeft.
    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true; obs.disconnect(); clearTimeout(timer);
      renewToken(bridge);
      showResult(ok);
    };
    const visible = (el) => el && getComputedStyle(el).display !== 'none';
    const obs = new MutationObserver(() => {
      if (visible(bridge.done)) settle(true);
      else if (visible(bridge.fail)) settle(false);
    });
    [bridge.done, bridge.fail].filter(Boolean).forEach(el => obs.observe(el, { attributes: true, attributeFilter: ['style', 'class'] }));
    const timer = setTimeout(() => { console.warn(LOG, 'geen antwoord van Webflow binnen 20s'); settle(false); }, 20000);

    // requestSubmit() vuurt een echt submit-event af -> webflow.js pakt het op.
    if (typeof bridge.form.requestSubmit === 'function') bridge.form.requestSubmit();
    else bridge.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  if (!isNativeForm) {
    form.addEventListener('submit', async (e) => {
      if (e.target !== form) return; // (voor de zekerheid: alleen ons eigen formulier)
      e.preventDefault();
      if (sending) return;
      // (Verplichte velden zijn op dit punt al door de browser gecontroleerd.)
      const bridge = findBridge();
      if (fail) fail.style.display = 'none';
      if (bridge) {
        sending = true;
        form.classList.add('is--sending');
        if (!isNativeForm) mountBridge(bridge);
        const ok = await waitForToken(bridge);
        if (!ok) {
          console.warn(LOG, 'geen Turnstile-token van Webflow ontvangen (spambeveiliging) - niet verstuurd');
          showResult(false);
          return;
        }
        sendViaBridge(bridge);
      } else {
        const data = {};
        new FormData(form).forEach((v, k) => { data[k] = v; });
        console.log(LOG, 'TESTMODUS - geen verborgen Webflow-formulier gevonden, niet verstuurd:', data);
        showResult(true);
      }
    });
  }

  // ---------- Geslaagde inzending detecteren ----------
  // webflow.js geeft geen event; we kijken wanneer .w-form-done zichtbaar wordt.
  if (done) {
    new MutationObserver(() => {
      if (submitted || getComputedStyle(done).display === 'none') return;
      submitted = true;
      // De velden zijn nu nog gevuld (Webflow verbergt het formulier alleen) -
      // de kaart gebruikt dit om meteen een "in behandeling"-pin te tonen.
      const titelInput = field('titel') || form.querySelector('[name="Titel"]');
      document.dispatchEvent(new CustomEvent('ditisvanons:meldingverstuurd', {
        detail: {
          lat: pinLocatie && pinLocatie.lat,
          lng: pinLocatie && pinLocatie.lng,
          type: typeInput ? typeInput.value : 'Melding',
          titel: titelInput ? titelInput.value : '',
          adres: adresInput ? adresInput.value : ''
        }
      }));
      setLocatie(null);
    }).observe(done, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  setType('melding');
  }
})();
