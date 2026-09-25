(function() {
  const LOG = '[divo-meldpunt]';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  function init() {
    const modal = document.querySelector('[data-meldpunt="modal"]');
    if (!modal) {
      console.warn(LOG, 'geen [data-meldpunt="modal"] gevonden op deze pagina - staat de meldpunt-embed erop?');
      return;
    }
    console.log(LOG, 'meldpunt.js klaar');
    if (modal.parentNode !== document.body) document.body.appendChild(modal);
    const form = modal.querySelector('form');
    const done = modal.querySelector('.w-form-done, [data-meldpunt="done"]');
    const fail = modal.querySelector('.w-form-fail, [data-meldpunt="fail"]');
    if (!form) {
      console.warn(LOG, 'geen <form> in de modal gevonden');
      return;
    }
    const field = name => form.querySelector(`[data-meldpunt-field="${name}"]`);
    const adresInput = field('adres');
    const typeInput = field('type');
    const latInput = field('lat');
    const lngInput = field('lng');
    const typeButtons = modal.querySelectorAll('[data-meldpunt-type]');
    const titleEl = modal.querySelector('[data-meldpunt-title]');
    const petitieWrap = modal.querySelector('[data-meldpunt-petitie]');
    const petitieInputs = petitieWrap ? petitieWrap.querySelectorAll('input, textarea') : [];
    const adresPlaceholder = adresInput ? adresInput.getAttribute('placeholder') || '' : '';
    let pinLocatie = null;
    let autoAdres = '';
    let submitted = false;
    function getLenis() {
      try {
        if (typeof lenis !== 'undefined' && lenis && typeof lenis.stop === 'function') return lenis;
      } catch (e) {}
      return window.lenis || null;
    }
    function isMapOverlayOpen() {
      const m = document.getElementById('divo-map-overlay');
      return !!(m && !m.classList.contains('is-hidden'));
    }
    function setAdres(adres, loading, force) {
      if (!adresInput) return;
      const handmatig = adresInput.value !== '' && adresInput.value !== autoAdres;
      if (handmatig && !force) return;
      adresInput.value = adres || '';
      autoAdres = adresInput.value;
      adresInput.setAttribute('placeholder', loading ? 'Adres ophalen…' : adresPlaceholder);
    }
    function setLocatie(loc) {
      pinLocatie = loc;
      if (latInput) latInput.value = loc ? loc.lat : '';
      if (lngInput) lngInput.value = loc ? loc.lng : '';
    }
    function setType(type) {
      const isPetitie = type === 'petitie';
      if (typeInput) typeInput.value = isPetitie ? 'Petitie' : 'Melding';
      typeButtons.forEach(b => b.classList.toggle('is--active', b.getAttribute('data-meldpunt-type') === type));
      modal.classList.toggle('is--petitie', isPetitie);
      if (titleEl) titleEl.textContent = isPetitie ? 'Start een petitie' : 'Doe een melding';
      if (petitieWrap) petitieWrap.style.display = isPetitie ? '' : 'none';
      petitieInputs.forEach(i => {
        i.required = isPetitie;
        if (!isPetitie) i.value = '';
      });
    }
    typeButtons.forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      setType(b.getAttribute('data-meldpunt-type'));
    }));
    function resetAfterSubmit() {
      form.reset();
      form.style.display = '';
      if (done) done.style.display = 'none';
      if (fail) fail.style.display = 'none';
      autoAdres = '';
      submitted = false;
      setType('melding');
    }
    function open(e) {
      if (submitted) resetAfterSubmit();
      const d = e && e.detail || {};
      if (d.lat != null && d.lng != null) {
        const nieuwePlek = !pinLocatie || pinLocatie.lat !== d.lat || pinLocatie.lng !== d.lng;
        setLocatie({
          lat: d.lat,
          lng: d.lng
        });
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
      const l = getLenis();
      if (l) l.stop();
    }
    function close() {
      modal.classList.remove('is-open');
      modal.style.display = 'none';
      if (isMapOverlayOpen()) return;
      document.body.style.overflow = '';
      const l = getLenis();
      if (l) l.start();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }
    document.addEventListener('ditisvanons:openmeldpunt', open);
    document.addEventListener('ditisvanons:meldpuntlocatie', e => {
      const d = e.detail || {};
      setLocatie({
        lat: d.lat,
        lng: d.lng
      });
      setAdres(d.adres, false, false);
    });
    document.querySelectorAll('[data-meldpunt="open"]').forEach(btn => btn.addEventListener('click', e => {
      e.preventDefault();
      open();
    }));
    modal.querySelectorAll('[data-meldpunt="close"]').forEach(btn => btn.addEventListener('click', e => {
      e.preventDefault();
      close();
    }));
    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !modal.classList.contains('is-open')) return;
      close();
      e.stopImmediatePropagation();
    });
    const isNativeForm = !!form.closest('.w-form');
    let sending = false;
    function showResult(ok) {
      sending = false;
      form.classList.remove('is--sending');
      form.style.display = ok ? 'none' : '';
      if (done) done.style.display = ok ? 'block' : 'none';
      if (fail) fail.style.display = ok ? 'none' : 'block';
    }
    function findBridge() {
      const el = document.querySelector('[data-meldpunt="webflow-form"]');
      if (!el) return null;
      const bForm = el.matches('form') ? el : el.querySelector('form');
      const block = bForm && bForm.closest('.w-form');
      if (!bForm || !block) {
        console.warn(LOG, '[data-meldpunt="webflow-form"] gevonden, maar geen Webflow Form Block (.w-form > form) - check de opbouw');
        return null;
      }
      return {
        block: block,
        form: bForm,
        done: block.querySelector('.w-form-done'),
        fail: block.querySelector('.w-form-fail')
      };
    }
    function mountBridge(bridge) {
      let slot = modal.querySelector('[data-meldpunt="webflow-slot"]');
      if (!slot) {
        slot = document.createElement('div');
        form.insertAdjacentElement('afterend', slot);
      }
      slot.classList.add('divo-bridge-slot');
      if (bridge.block.parentNode !== slot) slot.appendChild(bridge.block);
    }
    const turnstileActive = () => !!document.querySelector('[data-turnstile-sitekey]');
    let lastToken = null;
    function currentToken(bridge) {
      const jq = window.jQuery;
      const d = jq && jq.data ? jq.data(bridge.form, '.w-form') : null;
      return d ? d.turnstileToken : undefined;
    }
    function waitForToken(bridge) {
      return new Promise(resolve => {
        if (!turnstileActive()) return resolve(true);
        const start = Date.now();
        (function poll() {
          const tok = currentToken(bridge);
          const ready = tok !== undefined ? tok && tok !== lastToken : !bridge.block.classList.contains('w-form-loading');
          if (ready) return resolve(true);
          if (Date.now() - start > 15e3) return resolve(false);
          setTimeout(poll, 200);
        })();
      });
    }
    function renewToken(bridge) {
      lastToken = currentToken(bridge) || lastToken;
      if (!window.turnstile || typeof window.turnstile.reset !== 'function') return;
      const widget = [ ...bridge.form.children ].reverse().find(el => el.tagName === 'DIV' && !el.className);
      try {
        window.turnstile.reset(widget);
      } catch (e) {}
    }
    const initialBridge = findBridge();
    if (initialBridge && !isNativeForm) mountBridge(initialBridge);
    function sendViaBridge(bridge) {
      bridge.form.reset();
      bridge.form.style.display = '';
      if (bridge.done) bridge.done.style.display = 'none';
      if (bridge.fail) bridge.fail.style.display = 'none';
      const missing = [];
      new FormData(form).forEach((value, name) => {
        const target = bridge.form.querySelector(`[name="${CSS.escape(name)}"]`);
        if (!target) {
          missing.push(name);
          return;
        }
        if (target.type === 'checkbox') target.checked = !!value; else target.value = value;
      });
      if (missing.length) console.warn(LOG, 'deze velden bestaan niet in het verborgen Webflow-formulier en worden dus niet opgeslagen:', missing.join(', '));
      let settled = false;
      const settle = ok => {
        if (settled) return;
        settled = true;
        obs.disconnect();
        clearTimeout(timer);
        renewToken(bridge);
        showResult(ok);
      };
      const visible = el => el && getComputedStyle(el).display !== 'none';
      const obs = new MutationObserver(() => {
        if (visible(bridge.done)) settle(true); else if (visible(bridge.fail)) settle(false);
      });
      [ bridge.done, bridge.fail ].filter(Boolean).forEach(el => obs.observe(el, {
        attributes: true,
        attributeFilter: [ 'style', 'class' ]
      }));
      const timer = setTimeout(() => {
        console.warn(LOG, 'geen antwoord van Webflow binnen 20s');
        settle(false);
      }, 2e4);
      if (typeof bridge.form.requestSubmit === 'function') bridge.form.requestSubmit(); else bridge.form.dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true
      }));
    }
    if (!isNativeForm) {
      form.addEventListener('submit', async e => {
        if (e.target !== form) return;
        e.preventDefault();
        if (sending) return;
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
          new FormData(form).forEach((v, k) => {
            data[k] = v;
          });
          console.log(LOG, 'TESTMODUS - geen verborgen Webflow-formulier gevonden, niet verstuurd:', data);
          showResult(true);
        }
      });
    }
    if (done) {
      new MutationObserver(() => {
        if (submitted || getComputedStyle(done).display === 'none') return;
        submitted = true;
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
      }).observe(done, {
        attributes: true,
        attributeFilter: [ 'style', 'class' ]
      });
    }
    setType('melding');
  }
})();
