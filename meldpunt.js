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
    const petitieWraps = modal.querySelectorAll('[data-meldpunt-petitie]');
    const petitieInputs = () => modal.querySelectorAll('[data-meldpunt-petitie] input, [data-meldpunt-petitie] textarea, [data-meldpunt-petitie] select');
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
    let adresGetypt = false;
    if (adresInput) {
      adresInput.addEventListener('keydown', () => {
        adresGetypt = true;
      });
      adresInput.addEventListener('paste', () => {
        adresGetypt = true;
      });
    }
    function isAutofilled(el) {
      try {
        if (el.matches(':autofill')) return true;
      } catch (e) {}
      try {
        if (el.matches(':-webkit-autofill')) return true;
      } catch (e) {}
      return false;
    }
    function herstelPinAdres() {
      if (!adresInput || !pinLocatie || !autoAdres) return;
      if (adresInput.value !== autoAdres && (!adresGetypt || isAutofilled(adresInput))) {
        console.log(LOG, 'adres door autofill overschreven, pin-adres teruggezet');
        adresInput.value = autoAdres;
      }
    }
    function setAdres(adres, loading, force) {
      if (!adresInput) return;
      if (force) adresGetypt = false;
      const handmatig = adresGetypt && adresInput.value !== '' && adresInput.value !== autoAdres;
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
    function setText(el, text) {
      if (text == null) return;
      if (el.matches('input, textarea')) {
        el.placeholder = text;
        return;
      }
      if (el.textContent === text) return;
      if (!el.hasAttribute('data-button-animate-chars')) {
        el.textContent = text;
        return;
      }
      el.innerHTML = '';
      [ ...text ].forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent = char;
        span.style.transitionDelay = i * .01 + 's';
        if (char === ' ') span.style.whiteSpace = 'pre';
        el.appendChild(span);
      });
    }
    const tsBox = modal.querySelector('[data-meldpunt="turnstile"]');
    let tsWidget = null;
    let tsToken = null;
    function whenTurnstile(cb) {
      if (window.turnstile && typeof window.turnstile.render === 'function') return cb();
      if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
        const sc = document.createElement('script');
        sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        sc.async = true;
        sc.defer = true;
        document.head.appendChild(sc);
      }
      let tries = 0;
      const iv = setInterval(() => {
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          clearInterval(iv);
          cb();
        } else if (++tries > 100) {
          clearInterval(iv);
          console.warn(LOG, 'Turnstile niet geladen');
        }
      }, 100);
    }
    function ensureTurnstile() {
      if (!tsBox || tsWidget !== null) return;
      const sitekey = tsBox.getAttribute('data-sitekey');
      if (!sitekey) {
        console.warn(LOG, '[data-meldpunt="turnstile"] heeft geen data-sitekey');
        return;
      }
      tsWidget = false;
      whenTurnstile(() => {
        tsWidget = window.turnstile.render(tsBox, {
          sitekey: sitekey,
          appearance: 'interaction-only',
          language: 'nl',
          callback: t => {
            tsToken = t;
          },
          'expired-callback': () => {
            tsToken = null;
          },
          'error-callback': () => {
            tsToken = null;
          }
        });
      });
    }
    function waitForPetitieToken() {
      return new Promise(resolve => {
        ensureTurnstile();
        const start = Date.now();
        (function poll() {
          if (tsToken) return resolve(tsToken);
          if (Date.now() - start > 15e3) return resolve(null);
          setTimeout(poll, 200);
        })();
      });
    }
    function resetPetitieToken() {
      tsToken = null;
      if (window.turnstile && tsWidget) {
        try {
          window.turnstile.reset(tsWidget);
        } catch (e) {}
      }
    }
    const scroller = modal.querySelector('[data-meldpunt="scroll"]');
    const scrollBlock = scroller ? scroller.parentElement : null;
    const scrollThumb = scrollBlock ? scrollBlock.querySelector('.meldpunt_scrollthumb') : null;
    const scrollHint = modal.querySelector('[data-meldpunt="scrollhint"]');
    let scrollRaf = 0;
    function updateScroll() {
      scrollRaf = 0;
      if (!scroller || !scrollBlock) return;
      const sh = scroller.scrollHeight, ch = scroller.clientHeight, st = scroller.scrollTop;
      const scrollable = sh > ch + 2;
      scrollBlock.classList.toggle('is--scrollable', scrollable);
      scrollBlock.classList.toggle('is--more', scrollable && st + ch < sh - 12);
      if (scrollable && scrollThumb) {
        const track = scrollThumb.parentElement.clientHeight;
        const th = Math.max(28, track * ch / sh);
        const top = (track - th) * (st / (sh - ch));
        scrollThumb.style.height = th + 'px';
        scrollThumb.style.transform = 'translateY(' + top + 'px)';
      }
    }
    function queueScrollUpdate() {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(updateScroll);
    }
    if (scroller) {
      scroller.addEventListener('scroll', queueScrollUpdate, {
        passive: true
      });
      window.addEventListener('resize', queueScrollUpdate);
      form.addEventListener('input', queueScrollUpdate);
      if (window.ResizeObserver) new ResizeObserver(queueScrollUpdate).observe(scroller.firstElementChild || scroller);
    }
    if (scrollHint && scroller) scrollHint.addEventListener('click', () => {
      scroller.scrollBy({
        top: Math.round(scroller.clientHeight * .7),
        behavior: 'smooth'
      });
    });
    function setType(type) {
      const isPetitie = type === 'petitie';
      if (typeInput) typeInput.value = isPetitie ? 'Petitie' : 'Melding';
      typeButtons.forEach(b => b.classList.toggle('is--active', b.getAttribute('data-meldpunt-type') === type));
      modal.classList.toggle('is--petitie', isPetitie);
      if (titleEl && !titleEl.hasAttribute('data-meldpunt-text-melding')) titleEl.textContent = isPetitie ? 'Start een petitie' : 'Doe een melding';
      modal.querySelectorAll('[data-meldpunt-text-melding][data-meldpunt-text-petitie]').forEach(el => {
        setText(el, el.getAttribute(isPetitie ? 'data-meldpunt-text-petitie' : 'data-meldpunt-text-melding'));
      });
      modal.querySelectorAll('[data-meldpunt-maxlength-petitie]').forEach(el => {
        const v = el.getAttribute(isPetitie ? 'data-meldpunt-maxlength-petitie' : 'data-meldpunt-maxlength-melding');
        if (v) el.setAttribute('maxlength', v); else el.removeAttribute('maxlength');
      });
      petitieWraps.forEach(w => {
        w.style.display = isPetitie ? '' : 'none';
      });
      petitieInputs().forEach(i => {
        if (i.name && i.name.indexOf('cf-turnstile') === 0) return;
        i.required = isPetitie && i.hasAttribute('data-meldpunt-required');
        i.disabled = !isPetitie;
      });
      modal.querySelectorAll('[data-meldpunt-melding]').forEach(w => {
        w.style.display = isPetitie ? 'none' : '';
        w.querySelectorAll('input, textarea, select').forEach(i => {
          i.disabled = isPetitie;
        });
      });
      if (isPetitie) ensureTurnstile();
      if (scroller) queueScrollUpdate();
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
      if (scroller) {
        scroller.scrollTop = 0;
        queueScrollUpdate();
      }
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
    const buttonsWrap = form.querySelector('.buttons_wrapper');
    if (fail && buttonsWrap && !form.contains(fail) && !fail.closest('.w-form')) buttonsWrap.before(fail);
    const failText = fail ? fail.querySelector('div') || fail : null;
    const failDefault = failText ? failText.textContent : '';
    function showResult(ok, message) {
      sending = false;
      form.classList.remove('is--sending');
      form.style.display = ok ? 'none' : '';
      if (failText) failText.textContent = message || failDefault;
      if (done) done.style.display = ok ? 'block' : 'none';
      if (fail) fail.style.display = ok ? 'none' : 'block';
      if (scroller) {
        if (ok) scroller.scrollTop = 0;
        queueScrollUpdate();
      }
      if (!ok && fail) requestAnimationFrame(() => {
        if (scroller) {
          const top = fail.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
          scroller.scrollTo({
            top: Math.max(0, top - scroller.clientHeight / 3),
            behavior: 'smooth'
          });
        } else if (fail.scrollIntoView) fail.scrollIntoView({
          block: 'center',
          behavior: 'smooth'
        });
      });
    }
    const petitieEndpoint = form.getAttribute('data-meldpunt-petitie-endpoint');
    const val = name => {
      const el = form.querySelector(`[name="${name}"]`);
      return el && !el.disabled ? String(el.value || '').trim() : '';
    };
    async function sendPetitie() {
      sending = true;
      form.classList.add('is--sending');
      const token = await waitForPetitieToken();
      if (!token) {
        showResult(false, 'De spamcheck lukte niet. Probeer het nog eens.');
        resetPetitieToken();
        return;
      }
      const payload = {
        titel: val('Titel'),
        wat: val('Wat'),
        waarom: val('Beschrijving'),
        aanWie: val('AanWie'),
        email: val('E-mailadres'),
        voornaam: val('Voornaam'),
        achternaam: val('Achternaam'),
        adres: val('Adres'),
        lat: latInput ? latInput.value : '',
        lng: lngInput ? lngInput.value : '',
        website: val('website'),
        turnstileToken: token
      };
      let res = null, data = {};
      try {
        res = await fetch(petitieEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        data = await res.json().catch(() => ({}));
      } catch (e) {
        console.warn(LOG, 'petitie-API onbereikbaar:', e);
      }
      resetPetitieToken();
      if (res && res.ok && data.ok) {
        console.log(LOG, 'petitie aangemaakt:', data.slug || '(honeypot)');
        showResult(true);
        return;
      }
      console.warn(LOG, 'petitie niet aangemaakt:', res && res.status, data);
      const msg = data.error === 'velden' ? 'Vul alle verplichte velden in en probeer het opnieuw.' : data.error === 'turnstile' ? 'De spamcheck lukte niet. Probeer het nog eens.' : res && res.status === 429 ? 'Het is even druk. Probeer het over een minuut nog eens.' : '';
      showResult(false, msg);
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
        if (name.indexOf('cf-turnstile') === 0) return;
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
        if (fail) fail.style.display = 'none';
        herstelPinAdres();
        if (typeInput && typeInput.value === 'Petitie' && petitieEndpoint) {
          sendPetitie();
          return;
        }
        const bridge = findBridge();
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
