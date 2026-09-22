gsap.registerPlugin(ScrollTrigger, SplitText, Observer);

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

document.addEventListener('DOMContentLoaded', () => {
  initToolkitInfoBlocks();
  initToolkitGroups();
  initCampagnesCircle();
  initComponentFormSubmit();
});
