gsap.registerPlugin(ScrollTrigger, SplitText, Observer, DrawSVGPlugin, ScrollToPlugin);

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});

lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

document.fonts.ready.then(() => {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const type = el.dataset.split || 'lines';

    SplitText.create(el, {
      type: type,
      linesClass: 'split_line',
      wordsClass: 'split_word',
      charsClass: 'split_char',
      autoSplit: true,
      onSplit(self) {
        const targets = type === 'chars' ? self.chars
          : type === 'words' ? self.words
          : self.lines;

        gsap.set(targets, { autoAlpha: 0, y: '0.6em' });

        return gsap.to(targets, {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.025,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%'
          }
        });
      }
    });
  });
});

function initAccordionCSS() {
  document.querySelectorAll('[data-accordion-css-init]').forEach((accordion) => {
    const closeSiblings = accordion.getAttribute('data-accordion-close-siblings') === 'true';

    accordion.querySelectorAll('[data-accordion-status="active"]').forEach((activeItem) => {
      const answer = activeItem.querySelector('.faq_answer');
      answer.style.height = answer.scrollHeight + 'px';
    });

    accordion.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-accordion-toggle]');
      if (!toggle) return;
      const singleAccordion = toggle.closest('[data-accordion-status]');
      if (!singleAccordion) return;

      const answer = singleAccordion.querySelector('.faq_answer');
      const isActive = singleAccordion.getAttribute('data-accordion-status') === 'active';

      singleAccordion.setAttribute('data-accordion-status', isActive ? 'not-active' : 'active');
      answer.style.height = isActive ? '0px' : answer.scrollHeight + 'px';

      if (closeSiblings && !isActive) {
        accordion.querySelectorAll('[data-accordion-status="active"]').forEach((sibling) => {
          if (sibling !== singleAccordion) {
            sibling.setAttribute('data-accordion-status', 'not-active');
            sibling.querySelector('.faq_answer').style.height = '0px';
          }
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAccordionCSS();
});

document.querySelectorAll('[data-nav-theme]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 80px',
    end: 'bottom 80px',
    onToggle: (self) => {
      if (self.isActive) {
        document.querySelector('[data-nav]').setAttribute('data-nav-theme', section.dataset.navTheme);
      }
    }
  });
});

function initHamburgerMenu() {
  const navbar = document.querySelector('.navbar');
  const navItems = navbar && navbar.querySelector('.nav_items');
  const hb = navbar && navbar.querySelector('.hb_wrapper');
  if (!navbar || !navItems || !hb) return;

  const items = navItems.querySelectorAll('.nav_item');
  const lines = hb.querySelectorAll('.hb_line');
  const mq = window.matchMedia('(max-width: 767px)');
  let isOpen = false;
  let tl = null;
  hb.setAttribute('role', 'button');
  hb.setAttribute('tabindex', '0');
  hb.setAttribute('aria-label', 'Menu openen');
  hb.setAttribute('aria-expanded', 'false');
  navbar.setAttribute('data-nav-status', 'closed');
  function lineOffset() {
    if (lines.length < 2) return 0;
    const a = lines[0].getBoundingClientRect();
    const b = lines[1].getBoundingClientRect();
    return ((b.top + b.height / 2) - (a.top + a.height / 2)) / 2;
  }

  function open() {
    if (isOpen || !mq.matches) return;
    isOpen = true;
    if (tl) tl.kill();
    const from = { width: navItems.offsetWidth, height: navItems.offsetHeight };
    const d = lineOffset();
    navbar.setAttribute('data-nav-status', 'open');
    hb.setAttribute('aria-expanded', 'true');
    hb.setAttribute('aria-label', 'Menu sluiten');
    const to = { width: navItems.offsetWidth, height: navItems.offsetHeight };

    tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(navItems, from, { ...to, duration: 0.45, ease: 'power3.inOut', clearProps: 'width,height' }, 0)
      .to(lines[0], { y: d, rotate: 45, duration: 0.35 }, 0)
      .to(lines[1], { y: -d, rotate: -45, duration: 0.35 }, 0)
      .fromTo(items, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05 }, 0.15);
  }

  function close(instant) {
    if (!isOpen) return;
    isOpen = false;
    if (tl) tl.kill();
    hb.setAttribute('aria-expanded', 'false');
    hb.setAttribute('aria-label', 'Menu openen');

    if (instant) {
      navbar.setAttribute('data-nav-status', 'closed');
      gsap.set([navItems, ...items, ...lines], { clearProps: 'all' });
      return;
    }

    const from = { width: navItems.offsetWidth, height: navItems.offsetHeight };
    tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } })
      .to(items, { autoAlpha: 0, y: -8, duration: 0.2, stagger: { each: 0.03, from: 'end' } }, 0)
      .to(lines, { y: 0, rotate: 0, duration: 0.35 }, 0)
      .add(() => {
        navbar.setAttribute('data-nav-status', 'closed');
        const to = { width: navItems.offsetWidth, height: navItems.offsetHeight };
        gsap.fromTo(navItems, from, {
          ...to, duration: 0.35, ease: 'power3.inOut',
          onComplete: () => gsap.set([navItems, ...items], { clearProps: 'all' })
        });
      }, 0.18);
  }

  function toggle() { isOpen ? close() : open(); }

  hb.addEventListener('click', toggle);
  hb.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
  items.forEach((item) => item.addEventListener('click', () => close()));
  document.addEventListener('click', (e) => { if (isOpen && !navItems.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) close(); });
  mq.addEventListener('change', () => { if (!mq.matches) close(true); });
}

function initNavLogoHide() {
  const logo = document.querySelector('.logo_wrapper');
  if (!logo) return;

  const hideTween = gsap.to(logo, {
    yPercent: -150,
    autoAlpha: 0,
    duration: 0.5,
    ease: 'power3.inOut',
    paused: true
  });

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      if (self.scroll() < 80) {
        hideTween.reverse();
        return;
      }

      if (self.direction === 1) {
        hideTween.play();
      } else {
        hideTween.reverse();
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavLogoHide();
});

document.querySelectorAll('.floating_img_wrapper').forEach((el, i) => {
  const distanceX = gsap.utils.random(6, 18);
  const distanceY = gsap.utils.random(10, 26);
  const rotation = gsap.utils.random(-2, 2);
  const duration = gsap.utils.random(5, 8);

  gsap.to(el, {
    x: `+=${distanceX}`,
    y: `-=${distanceY}`,
    rotation,
    duration,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    delay: i * 0.5
  });
});

function initDraggableMarquee() {
  const wrappers = document.querySelectorAll("[data-draggable-marquee-init]");

  const getNumberAttr = (el, name, fallback) => {
    const value = parseFloat(el.getAttribute(name));
    return Number.isFinite(value) ? value : fallback;
  };

  wrappers.forEach((wrapper) => {
    if (wrapper.getAttribute("data-draggable-marquee-init") === "initialized") return;

    const collection = wrapper.querySelector("[data-draggable-marquee-collection]");
    const list = wrapper.querySelector("[data-draggable-marquee-list]");
    if (!collection || !list) return;

    const duration = getNumberAttr(wrapper, "data-duration", 60);
    const multiplier = getNumberAttr(wrapper, "data-multiplier", 40);
    const sensitivity = getNumberAttr(wrapper, "data-sensitivity", 0.01);

    const wrapperWidth = wrapper.getBoundingClientRect().width;
    const listWidth = list.scrollWidth || list.getBoundingClientRect().width;
    if (!wrapperWidth || !listWidth) return;

    const minRequiredWidth = wrapperWidth + listWidth + 2;
    while (collection.scrollWidth < minRequiredWidth) {
      const listClone = list.cloneNode(true);
      listClone.setAttribute("data-draggable-marquee-clone", "");
      listClone.setAttribute("aria-hidden", "true");
      collection.appendChild(listClone);
    }

    const wrapX = gsap.utils.wrap(-listWidth, 0);

    gsap.set(collection, { x: 0 });

    const marqueeLoop = gsap.to(collection, {
      x: -listWidth,
      duration,
      ease: "none",
      repeat: -1,
      onReverseComplete: () => marqueeLoop.progress(1),
      modifiers: {
        x: (x) => wrapX(parseFloat(x)) + "px"
      },
    });

    const initialDirectionAttr = (wrapper.getAttribute("data-direction") || "left").toLowerCase();
    const baseDirection = initialDirectionAttr === "right" ? -1 : 1;

    const timeScale = { value: 1 };

    timeScale.value = baseDirection;
    wrapper.setAttribute("data-direction", baseDirection < 0 ? "right" : "left");

    if (baseDirection < 0) marqueeLoop.progress(1);

    function applyTimeScale() {
      marqueeLoop.timeScale(timeScale.value);
      wrapper.setAttribute("data-direction", timeScale.value < 0 ? "right" : "left");
    }

    applyTimeScale();

    const marqueeObserver = Observer.create({
      target: wrapper,
      type: "pointer,touch",
      preventDefault: true,
      debounce: false,
      onChangeX: (observerEvent) => {
        let velocityTimeScale = observerEvent.velocityX * -sensitivity;
        velocityTimeScale = gsap.utils.clamp(-multiplier, multiplier, velocityTimeScale);

        gsap.killTweensOf(timeScale);

        const restingDirection = velocityTimeScale < 0 ? -1 : 1;

        gsap.timeline({ onUpdate: applyTimeScale })
          .to(timeScale, { value: velocityTimeScale, duration: 0.1, overwrite: true })
          .to(timeScale, { value: restingDirection, duration: 1.0 });
      }
    });

    ScrollTrigger.create({
      trigger: wrapper,
      start: "top bottom",
      end: "bottom top",
      onEnter: () => { marqueeLoop.resume(); applyTimeScale(); marqueeObserver.enable(); },
      onEnterBack: () => { marqueeLoop.resume(); applyTimeScale(); marqueeObserver.enable(); },
      onLeave: () => { marqueeLoop.pause(); marqueeObserver.disable(); },
      onLeaveBack: () => { marqueeLoop.pause(); marqueeObserver.disable(); }
    });

    wrapper.setAttribute("data-draggable-marquee-init", "initialized");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initDraggableMarquee();
});

function initKeenSlider(sliderEl, options) {
  const wrapper = sliderEl.closest('[data-slider-wrapper]') || sliderEl.parentElement;

  const updateActive = (instance) => {
    const containerRect = sliderEl.getBoundingClientRect();
    const containerLeft = containerRect.left;

    let closestSlide = null;
    let closestDistance = Infinity;

    instance.slides.forEach((slide) => {
      const slideRect = slide.getBoundingClientRect();
      const distance = Math.abs(slideRect.left - containerLeft);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSlide = slide;
      }
    });

    instance.slides.forEach((slide) => {
      slide.classList.toggle('is_active', slide === closestSlide);
    });
  };

  const slider = new KeenSlider(sliderEl, {
    ...options,
    created: (s) => updateActive(s),
    slideChanged: (s) => updateActive(s),
    detailsChanged: (s) => updateActive(s)
  });

  const prevBtn = wrapper.querySelector('[data-slider-nav="prev"]');
  const nextBtn = wrapper.querySelector('[data-slider-nav="next"]');

  prevBtn?.addEventListener('click', () => slider.prev());
  nextBtn?.addEventListener('click', () => slider.next());
}

document.querySelectorAll('[data-team-slider]').forEach((sliderEl) => {
  initKeenSlider(sliderEl, {
    loop: true,
    centered: true,
    slides: { perView: 1.2, spacing: 8 },
    breakpoints: {
      '(min-width: 768px)': { slides: { perView: 1.6, spacing: 16 } },
      '(min-width: 1280px)': { slides: { perView: 2.6, spacing: 24 } }
    }
  });
});

document.querySelectorAll('[data-project-slider]').forEach((sliderEl) => {
  initKeenSlider(sliderEl, {
    loop: false,
    centered: true,
    slides: { perView: 1.5, spacing: 8 },
    breakpoints: {
      '(min-width: 768px)': { slides: { perView: 2.4, spacing: 16 } },
      '(min-width: 1280px)': { slides: { perView: 2.8, spacing: 24 } }
    }
  });
});

function initDynamicTextCursor() {
  const cursor = document.querySelector("[data-cursor]");
  const cursorTextTarget = document.querySelector("[data-cursor-text-target]");

  if (!cursor || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  let mouseX = 0;
  let mouseY = 0;
  let hasMouseMoved = false;

  const xTo = gsap.quickTo(cursor, "x", {duration: 0.4, ease: "power3.out"});
  const yTo = gsap.quickTo(cursor, "y", {duration: 0.4, ease: "power3.out"});

  function updateCursor() {
    const hoverItem = document.elementFromPoint(mouseX, mouseY)?.closest("[data-cursor-hover]");
    const rect = cursor.getBoundingClientRect();

    const isHovering = !!hoverItem;
    const isEdge = rect.right >= window.innerWidth;

    cursor.setAttribute("data-cursor", isHovering ? (isEdge ? "active-edge" : "active") : "");

    if (hoverItem && cursorTextTarget) {
      const text = hoverItem.getAttribute("data-cursor-text");
      if (text) cursorTextTarget.textContent = text;
    }
  }

  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    hasMouseMoved = true;

    xTo(mouseX);
    yTo(mouseY);

    requestAnimationFrame(updateCursor);
  });

  window.addEventListener("scroll", () => {
    if (!hasMouseMoved) return;
    requestAnimationFrame(updateCursor);
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initDynamicTextCursor();
});

function expandElement(el) {
  el.style.height = el.scrollHeight + 'px';

  const onTransitionEnd = (event) => {
    if (event.target !== el || event.propertyName !== 'height') return;
    el.style.height = 'auto';
    el.removeEventListener('transitionend', onTransitionEnd);
  };

  el.addEventListener('transitionend', onTransitionEnd);
}

function collapseElement(el) {
  el.style.height = el.scrollHeight + 'px';
  el.offsetHeight;

  requestAnimationFrame(() => {
    el.style.height = '0px';
  });
}

function initToolkitInfoBlocks() {
  document.querySelectorAll('[data-toolkit-status]').forEach((block) => {
    const textWrapper = block.querySelector('.info_block_text_wrapper');
    if (!textWrapper) return;

    if (block.getAttribute('data-toolkit-status') === 'active') {
      textWrapper.style.height = 'auto';
    }

    block.addEventListener('click', (event) => {
      if (event.target.closest('.secondary_button')) {
        event.stopPropagation();
        return;
      }

      const isActive = block.getAttribute('data-toolkit-status') === 'active';

      block.setAttribute('data-toolkit-status', isActive ? 'not-active' : 'active');

      if (isActive) {
        collapseElement(textWrapper);
      } else {
        expandElement(textWrapper);
      }
    });
  });
}

function initToolkitGroups() {
  document.querySelectorAll('[data-toolkit-group-status]').forEach((group) => {
    const toggle = group.querySelector('.toolkit_title_wrapper');
    const listWrapper = group.querySelector('.toolkit_list_wrapper');
    if (!toggle || !listWrapper) return;

    if (group.getAttribute('data-toolkit-group-status') === 'active') {
      listWrapper.style.height = 'auto';
    }

    toggle.addEventListener('click', () => {
      const isActive = group.getAttribute('data-toolkit-group-status') === 'active';

      group.setAttribute('data-toolkit-group-status', isActive ? 'not-active' : 'active');

      if (isActive) {
        collapseElement(listWrapper);
      } else {
        expandElement(listWrapper);
      }
    });
  });
}

function initCampagnesCircle() {
  const wrapper = document.querySelector('.campagnes_circle_wrapper');
  if (!wrapper) return;

  const icons = Array.from(wrapper.querySelectorAll('.cam_c_img_wrapper'));
  if (icons.length === 0) return;

  const ORBIT_DURATION = 180;

  gsap.to(wrapper, {
    rotation: 360,
    duration: ORBIT_DURATION,
    repeat: -1,
    ease: 'none'
  });

  icons.forEach((icon) => {
    gsap.to(icon, {
      rotation: -360,
      duration: ORBIT_DURATION,
      repeat: -1,
      ease: 'none'
    });
  });

  window.addEventListener('load', () => {
    const wrapperRect = wrapper.getBoundingClientRect();
    const centerX = wrapperRect.left + wrapperRect.width / 2;
    const centerY = wrapperRect.top + wrapperRect.height / 2;

    const startOffsets = icons.map((icon) => {
      const rect = icon.getBoundingClientRect();
      const iconCenterX = rect.left + rect.width / 2;
      const iconCenterY = rect.top + rect.height / 2;

      return {
        x: centerX - iconCenterX,
        y: centerY - iconCenterY
      };
    });

    icons.forEach((icon, i) => {
      gsap.set(icon, {
        x: startOffsets[i].x,
        y: startOffsets[i].y,
        scale: 0.3,
        opacity: 0
      });
    });

    ScrollTrigger.create({
      trigger: wrapper,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        gsap.to(icons, {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.12
        });
      }
    });

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const PARALLAX_STRENGTH = 0.04;

    const xTo = icons.map((icon) =>
      gsap.quickTo(icon, 'x', { duration: 0.6, ease: 'power3.out' })
    );
    const yTo = icons.map((icon) =>
      gsap.quickTo(icon, 'y', { duration: 0.6, ease: 'power3.out' })
    );

    window.addEventListener('mousemove', (event) => {
      const rect = wrapper.getBoundingClientRect();
      const mouseX = event.clientX - (rect.left + rect.width / 2);
      const mouseY = event.clientY - (rect.top + rect.height / 2);

      icons.forEach((icon, i) => {
        const strength = PARALLAX_STRENGTH * (0.6 + (i % 3) * 0.2);
        xTo[i](mouseX * strength);
        yTo[i](mouseY * strength);
      });
    });
  });
}

function initButtonCharacterStagger() {
  const offsetIncrement = 0.01;
  const buttons = document.querySelectorAll('[data-button-animate-chars]');

  buttons.forEach(button => {
    const text = button.textContent;
    button.innerHTML = '';

    [...text].forEach((char, index) => {
      const span = document.createElement('span');
      span.textContent = char;
      span.style.transitionDelay = `${index * offsetIncrement}s`;

      if (char === ' ') {
        span.style.whiteSpace = 'pre';
      }

      button.appendChild(span);
    });
  });
}

function initDynamicTextCursor() {
  const cursor = document.querySelector("[data-cursor]");
  const cursorTextTarget = document.querySelector("[data-cursor-text-target]");

  if (!cursor || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  let mouseX = 0;
  let mouseY = 0;
  let hasMouseMoved = false;

  const xTo = gsap.quickTo(cursor, "x", {duration: 0.4, ease: "power3.out"});
  const yTo = gsap.quickTo(cursor, "y", {duration: 0.4, ease: "power3.out"});

  function updateCursor() {
    const hoverItem = document.elementFromPoint(mouseX, mouseY)?.closest("[data-cursor-hover]");
    const rect = cursor.getBoundingClientRect();

    const isHovering = !!hoverItem;
    const isEdge = rect.right >= window.innerWidth;

    cursor.setAttribute("data-cursor", isHovering ? (isEdge ? "active-edge" : "active") : "");

    if (hoverItem && cursorTextTarget) {
      const text = hoverItem.getAttribute("data-cursor-text");
      if (text) cursorTextTarget.textContent = text;
    }
  }

  window.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    hasMouseMoved = true;

    xTo(mouseX);
    yTo(mouseY);

    requestAnimationFrame(updateCursor);
  });

  window.addEventListener("scroll", () => {
    if (!hasMouseMoved) return;
    requestAnimationFrame(updateCursor);
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  initDynamicTextCursor();
});

function initComponentFormSubmit() {
  document.querySelectorAll('[data-form-submit-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      const form = trigger.closest('form');
      if (!form) return;

      const nativeSubmit = form.querySelector('[data-form-submit-native]');
      if (!nativeSubmit) return;

      event.preventDefault();
      nativeSubmit.click();
    });
  });
}

function initContentRevealScroll() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = gsap.context(() => {

    document.querySelectorAll('[data-reveal-group]').forEach(groupEl => {

      const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 100) / 1000;
      const groupDistance = groupEl.getAttribute('data-distance') || '2em';
      const triggerStart = groupEl.getAttribute('data-start') || 'top 80%';

      const animDuration = 0.8;
      const animEase = "power4.inOut";

      if (prefersReduced) {
        gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
        return;
      }

      const directChildren = Array.from(groupEl.children).filter(el => el.nodeType === 1);
      if (!directChildren.length) {
        gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
        ScrollTrigger.create({
          trigger: groupEl,
          start: triggerStart,
          once: true,
          onEnter: () => gsap.to(groupEl, {
            y: 0,
            autoAlpha: 1,
            duration: animDuration,
            ease: animEase,
            onComplete: () => gsap.set(groupEl, { clearProps: 'all' })
          })
        });
        return;
      }

      const slots = [];
      directChildren.forEach(child => {
        const nestedGroup = child.matches('[data-reveal-group-nested]')
          ? child
          : child.querySelector(':scope [data-reveal-group-nested]');

        if (nestedGroup) {
          const includeParent =
            child.getAttribute('data-ignore') !== 'true' &&
            (
              child.getAttribute('data-ignore') === 'false' ||
              nestedGroup.getAttribute('data-ignore') === 'false'
            );

          const nestedChildren = Array.from(nestedGroup.children).filter(
            el => el.nodeType === 1 && el.getAttribute('data-ignore') !== 'true'
          );

          slots.push({
            type: 'nested',
            parentEl: child,
            nestedEl: nestedGroup,
            includeParent,
            nestedChildren
          });
        } else {
          if (child.getAttribute('data-ignore') === 'true') return;
          slots.push({ type: 'item', el: child });
        }
      });

      slots.forEach(slot => {
        if (slot.type === 'item') {

          const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
          const d = isNestedSelf ? groupDistance : (slot.el.getAttribute('data-distance') || groupDistance);
          gsap.set(slot.el, { y: d, autoAlpha: 0 });
        } else {

          if (slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });

          const nestedD = slot.nestedEl.getAttribute('data-distance') || groupDistance;
          slot.nestedChildren.forEach(target => gsap.set(target, { y: nestedD, autoAlpha: 0 }));
        }
      });

      slots.forEach(slot => {
        if (slot.type === 'nested' && slot.includeParent) {
          gsap.set(slot.parentEl, { y: groupDistance });
        }
      });

      ScrollTrigger.create({
        trigger: groupEl,
        start: triggerStart,
        once: true,
        onEnter: () => {
          const tl = gsap.timeline();

          slots.forEach((slot, slotIndex) => {
            const slotTime = slotIndex * groupStaggerSec;

            if (slot.type === 'item') {
              tl.to(slot.el, {
                y: 0,
                autoAlpha: 1,
                duration: animDuration,
                ease: animEase,
                onComplete: () => gsap.set(slot.el, { clearProps: 'all' })
              }, slotTime);
            } else {

              if (slot.includeParent) {
                tl.to(slot.parentEl, {
                  y: 0,
                  autoAlpha: 1,
                  duration: animDuration,
                  ease: animEase,
                  onComplete: () => gsap.set(slot.parentEl, { clearProps: 'all' })
                }, slotTime);
              }

              const nestedMs = parseFloat(slot.nestedEl.getAttribute('data-stagger'));
              const nestedStaggerSec = isNaN(nestedMs) ? groupStaggerSec : nestedMs / 1000;
              slot.nestedChildren.forEach((nestedChild, nestedIndex) => {
                tl.to(nestedChild, {
                  y: 0,
                  autoAlpha: 1,
                  duration: animDuration,
                  ease: animEase,
                  onComplete: () => gsap.set(nestedChild, { clearProps: 'all' })
                }, slotTime + nestedIndex * nestedStaggerSec);
              });
            }
          });
        }
      });
    });

  });

  return () => ctx.revert();
}

function initDrawPathOnScroll() {
  const wraps = document.querySelectorAll('[data-draw-scroll-wrap]');
  if (wraps.length === 0) return;

  wraps.forEach((wrap) => {
    const paths = Array.from(wrap.querySelectorAll('[data-draw-scroll-path]'));
    if (paths.length === 0) return;

    const lengths = paths.map((path) => path.getTotalLength());
    const totalLength = lengths.reduce((sum, len) => sum + len, 0);

    if (totalLength === 0) return;

    gsap.set(paths, { drawSVG: '0%' });
    gsap.set(wrap, { autoAlpha: 0 });

    const introPercent = 6;

    gsap.to(wrap, {
      autoAlpha: 1,
      duration: 1,
      delay: 0.2,
      ease: 'power1.out'
    });

    gsap.to(paths[0], {
      drawSVG: `0% ${introPercent}%`,
      duration: 0.5,
      delay: 0.15,
      ease: 'power2.out',
      onComplete: startScrub
    });

    function startScrub() {
      const startScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const maxScrollY = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        startScrollY + 200
      );

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrap,
          start: startScrollY,
          end: maxScrollY,
          scrub: 0.6
        }
      });

      paths.forEach((path, i) => {
        const fromValue = i === 0 ? `0% ${introPercent}%` : '0%';

        tl.fromTo(path, {
          drawSVG: fromValue
        }, {
          drawSVG: '100%',
          duration: lengths[i] / totalLength,
          ease: 'none'
        }, i === 0 ? 0 : '>');
      });
    }
  });
}

function initScrollProgressBar() {
  const progressBar = document.querySelector('.progress-bar');
  const progressBarWrap = document.querySelector('.progress-bar-wrap');

  if (!progressBar || !progressBarWrap) return;

  gsap.to(progressBar, {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
    },
  });

  progressBarWrap.addEventListener('click', (event) => {
    const clickX = event.clientX;
    const progress = clickX / progressBarWrap.offsetWidth;
    const scrollPosition = progress * (document.body.scrollHeight - window.innerHeight);

    gsap.to(window, {
      scrollTo: scrollPosition,
      duration: 0.725,
      ease: 'power3.out',
    });
  });
}

function initMapCardClose() {
  document.querySelectorAll('.close_icon_wrapper').forEach((closeIcon) => {
    closeIcon.addEventListener('click', () => {
      const popUp = closeIcon.closest('.map_card_pop_up');
      if (!popUp) return;

      popUp.setAttribute('data-map-card-status', 'closed');
    });
  });
}

function initNumberOdometer() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const initFlag = 'data-odometer-initialized'
  const activeTweens = new WeakMap()

  const defaults = {
    duration: 1,
    ease: 'power3.out',
    elementStagger: 0.1,
    digitStagger: 0.04,
    revealDuration: 0.5,
    revealEase: 'power2.out',
    triggerStart: 'top 80%',
    staggerOrder: 'left',
    digitCycles: 2
  }

  document.querySelectorAll('[data-odometer-group]').forEach(group => {
    if (group.hasAttribute(initFlag)) return
    group.setAttribute(initFlag, '')

    const elements = Array.from(group.querySelectorAll('[data-odometer-element]'))
    if (!elements.length || prefersReducedMotion) return

    const staggerOrder = group.getAttribute('data-odometer-stagger-order') || defaults.staggerOrder
    const triggerStart = group.getAttribute('data-odometer-trigger-start') || defaults.triggerStart
    const elementStagger = parseFloat(group.getAttribute('data-odometer-stagger')) || defaults.elementStagger

    const elementData = elements.map(el => {
      const originalText = el.textContent.trim()
      const hasExplicitStart = el.hasAttribute('data-odometer-start')
      const startValue = parseFloat(el.getAttribute('data-odometer-start')) || 0
      const duration = parseFloat(el.getAttribute('data-odometer-duration')) || defaults.duration
      const step = getLineHeightRatio(el)

      let segments = parseSegments(originalText)
      segments = mapStartDigits(segments, startValue)
      segments = markHiddenSegments(segments, startValue)

      const grow = shouldGrow(el, hasExplicitStart, startValue, segments)
      const { rollers, revealEls } = buildRollerDOM(el, segments, step, grow)

      const fontSize = parseFloat(getComputedStyle(el).fontSize)
      const revealData = revealEls.map(revealEl => {
        const widthEm = revealEl.offsetWidth / fontSize
        gsap.set(revealEl, { width: 0, overflow: 'hidden' })
        return { el: revealEl, widthEm }
      })

      return { el, rollers, duration, step, revealData, originalText }
    })

    const ordered = applyStaggerOrder(elementData, staggerOrder)

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: group,
        start: triggerStart,
        once: true
      },
      onComplete() {
        elementData.forEach(({ el, originalText, step }) => {
          cleanupElement(el, originalText)
        })
      }
    })

    ordered.forEach((data, orderIdx) => {
      const { rollers, duration, step, revealData } = data
      const offset = orderIdx * elementStagger

      revealData.forEach(({ el, widthEm }) => {
        tl.to(el, {
          width: widthEm + 'em',
          opacity: 1,
          duration: defaults.revealDuration,
          ease: defaults.revealEase
        }, offset)
      })

      rollers.forEach(({ roller, targetPos }, digitIdx) => {
        const reversedIdx = rollers.length - 1 - digitIdx
        tl.to(roller, {
          y: -targetPos * step + 'em',
          duration,
          ease: defaults.ease,
          force3D: true
        }, offset + reversedIdx * defaults.digitStagger)
      })
    })
  })

  return function updateOdometer(el, newText, options = {}) {
    const currentText = el.textContent.trim()
    if (currentText === newText) return

    const duration = options.duration || defaults.duration
    const ease = options.ease || defaults.ease
    const step = getLineHeightRatio(el)

    const existing = activeTweens.get(el)
    if (existing) {
      existing.kill()
      gsap.set(el, { clearProps: 'width,overflow' })
    }

    const fontSize = parseFloat(getComputedStyle(el).fontSize)
    const oldWidthEm = el.getBoundingClientRect().width / fontSize

    const startSegments = parseSegments(currentText)
    const startDigitsStr = startSegments
      .filter(s => s.type === 'digit')
      .map(s => s.char)
      .join('')
    const startValue = parseInt(startDigitsStr, 10) || 0

    let segments = parseSegments(newText)
    segments = mapStartDigits(segments, startValue)
    segments = markHiddenSegments(segments, startValue)
    const { rollers, revealEls } = buildRollerDOM(el, segments, step, true)

    const newWidthEm = el.getBoundingClientRect().width / fontSize
    const widthChanged = Math.abs(oldWidthEm - newWidthEm) > 0.01

    if (widthChanged) {
      gsap.set(el, { width: oldWidthEm + 'em', overflow: 'hidden' })
    }

    const tl = gsap.timeline({
      onComplete() {
        cleanupElement(el, newText)
        activeTweens.delete(el)
      }
    })
    activeTweens.set(el, tl)

    if (widthChanged) {
      tl.to(el, {
        width: newWidthEm + 'em',
        duration: defaults.revealDuration,
        ease: defaults.revealEase
      }, 0)
    }

    revealEls.forEach(revealEl => {
      if (revealEl.getAttribute('data-odometer-part') === 'static') {
        tl.to(revealEl, { opacity: 1, duration: 0.2 }, 0)
      }
    })

    rollers.forEach(({ roller, targetPos }, digitIdx) => {
      const reversedIdx = rollers.length - 1 - digitIdx
      tl.to(roller, {
        y: -targetPos * step + 'em',
        duration,
        ease,
        force3D: true
      }, reversedIdx * defaults.digitStagger)
    })
  }

  function getLineHeightRatio(el) {
    const cs = getComputedStyle(el)
    const lh = cs.lineHeight
    if (lh === 'normal') return 1.2
    return parseFloat(lh) / parseFloat(cs.fontSize)
  }

  function parseSegments(text) {
    return [...text].map(char => ({
      type: /\d/.test(char) ? 'digit' : 'static',
      char
    }))
  }

  function mapStartDigits(segments, startValue) {
    const digitSlots = segments.filter(s => s.type === 'digit')
    const padded = String(Math.floor(Math.abs(startValue)))
      .padStart(digitSlots.length, '0')
      .slice(-digitSlots.length)
    let di = 0
    return segments.map(s =>
      s.type === 'digit'
        ? { ...s, startDigit: parseInt(padded[di++], 10) }
        : s
    )
  }

  function markHiddenSegments(segments, startValue) {
    const totalDigits = segments.filter(s => s.type === 'digit').length
    const absStart = Math.floor(Math.abs(startValue))
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length
    const leadingZeros = Math.max(0, totalDigits - startDigitCount)
    if (leadingZeros === 0) return segments
    let digitsSeen = 0
    let firstDigitSeen = false
    let prevDigitHidden = false
    return segments.map(seg => {
      if (seg.type === 'digit') {
        firstDigitSeen = true
        const hidden = digitsSeen < leadingZeros
        prevDigitHidden = hidden
        digitsSeen++
        return { ...seg, hidden }
      }
      const hidden = firstDigitSeen && prevDigitHidden
      return { ...seg, hidden }
    })
  }

  function shouldGrow(el, hasExplicitStart, startValue, segments) {
    if (el.hasAttribute('data-odometer-grow')) {
      return el.getAttribute('data-odometer-grow') !== 'false'
    }
    if (!hasExplicitStart) return false
    const absStart = Math.floor(Math.abs(startValue))
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length
    const endDigitCount = segments.filter(s => s.type === 'digit').length
    return startDigitCount < endDigitCount
  }

  function buildRollerDOM(el, segments, step, grow) {
    el.innerHTML = ''
    el.style.height = ''
    const rollers = []
    const revealEls = []
    const totalCells = 10 * defaults.digitCycles
    const fontSize = parseFloat(getComputedStyle(el).fontSize)
    segments.forEach(seg => {
      if (seg.type === 'static') {
        const span = document.createElement('span')
        span.setAttribute('data-odometer-part', 'static')
        span.style.height = step + 'em'
        span.style.lineHeight = step
        span.textContent = seg.char
        el.appendChild(span)
        if (grow && seg.hidden) {
          gsap.set(span, { opacity: 0 })
          revealEls.push(span)
        }
        return
      }
      const mask = document.createElement('span')
      mask.setAttribute('data-odometer-part', 'mask')
      mask.style.height = step + 'em'
      mask.style.lineHeight = step
      mask.textContent = seg.char
      el.appendChild(mask)
      mask.style.width = (mask.getBoundingClientRect().width / fontSize) + 'em'
      mask.textContent = ''
      const roller = document.createElement('span')
      roller.setAttribute('data-odometer-part', 'roller')
      roller.style.lineHeight = step
      roller.style.textAlign = 'center'

      const digits = []
      for (let d = 0; d < totalCells; d++) {
        digits.push(d % 10)
      }
      roller.textContent = digits.join('\n')
      mask.appendChild(roller)
      el.appendChild(mask)
      const startDigit = seg.startDigit || 0
      const isReveal = grow && seg.hidden
      gsap.set(roller, { y: isReveal ? step + 'em' : -startDigit * step + 'em' })
      const endDigit = parseInt(seg.char, 10)
      const targetPos = endDigit > startDigit ? endDigit : 10 + endDigit
      rollers.push({ roller, targetPos })
      if (isReveal) revealEls.push(mask)
    })
    return { rollers, revealEls }
  }

  function cleanupElement(el, originalText) {
    el.style.overflow = ''
    el.style.height = ''

    const digits = [...originalText].filter(c => /\d/.test(c))
    let di = 0

    el.querySelectorAll('[data-odometer-part="mask"]').forEach(mask => {
      const roller = mask.querySelector('[data-odometer-part="roller"]')
      if (roller) roller.remove()
      mask.textContent = digits[di++] || ''
      mask.style.opacity = ''
      mask.style.overflow = ''
      mask.style.width = ''
    })

    el.querySelectorAll('[data-odometer-part="static"]').forEach(stat => {
      stat.style.opacity = ''
    })
  }

  function recalcOnResize() {
    document.querySelectorAll('[data-odometer-element]').forEach(el => {

      const running = activeTweens.get(el)
      if (running) {
        running.progress(1)
        activeTweens.delete(el)
      }

      const hasRollers = el.querySelector('[data-odometer-part="roller"]')

      if (hasRollers) {

        const step = getLineHeightRatio(el)
        el.querySelectorAll('[data-odometer-part="mask"]').forEach(mask => {
          mask.style.height = step + 'em'
          mask.style.lineHeight = step
        })
        el.querySelectorAll('[data-odometer-part="roller"]').forEach(roller => {
          roller.style.lineHeight = step
        })
        el.querySelectorAll('[data-odometer-part="static"]').forEach(stat => {
          stat.style.lineHeight = step
        })
      }

    })
    ScrollTrigger.refresh()
  }

  let resizeTimer
  let lastWidth = window.innerWidth
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) return
      lastWidth = window.innerWidth
      recalcOnResize()
    }, 250)
  })

  function applyStaggerOrder(items, order) {
    const arr = [...items]
    if (order === 'right') return arr.reverse()
    if (order === 'random') return shuffleArray(arr)
    return arr
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initToolkitInfoBlocks();
  initToolkitGroups();
  initCampagnesCircle();
  initComponentFormSubmit();
  initButtonCharacterStagger();
  initContentRevealScroll();
  initDrawPathOnScroll();
  initMapCardClose();
  initScrollProgressBar();
  initHamburgerMenu();
  document.fonts.ready.then(() => initNumberOdometer());
});
