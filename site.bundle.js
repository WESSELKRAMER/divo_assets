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
      // Config from attributes or defaults (group-level)
      const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 100) / 1000; // ms → sec
      const groupDistance = groupEl.getAttribute('data-distance') || '2em';
      const triggerStart = groupEl.getAttribute('data-start') || 'top 80%';

      const animDuration = 0.8;
      const animEase = "power4.inOut";

      // Reduced motion: show immediately
      if (prefersReduced) {
        gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
        return;
      }

      // If no direct children, animate the group element itself
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

      // Build animation slots: item or nested (deep layers allowed)
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

      // Initial hidden state
      slots.forEach(slot => {
        if (slot.type === 'item') {
          // If the element itself is a nested group, force group distance (prevents it from using its own data-distance)
          const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
          const d = isNestedSelf ? groupDistance : (slot.el.getAttribute('data-distance') || groupDistance);
          gsap.set(slot.el, { y: d, autoAlpha: 0 });
        } else {
          // Parent follows the group's distance when included, regardless of nested's data-distance
          if (slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
          // Children use nested group's own distance (fallback to group distance)
          const nestedD = slot.nestedEl.getAttribute('data-distance') || groupDistance;
          slot.nestedChildren.forEach(target => gsap.set(target, { y: nestedD, autoAlpha: 0 }));
        }
      });

      // Extra safety: if a nested parent is included, re-assert its distance to the group's value
      slots.forEach(slot => {
        if (slot.type === 'nested' && slot.includeParent) {
          gsap.set(slot.parentEl, { y: groupDistance });
        }
      });

      // Reveal sequence
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
              // Optionally include the parent at the same slot time (parent uses group distance)
              if (slot.includeParent) {
                tl.to(slot.parentEl, {
                  y: 0,
                  autoAlpha: 1,
                  duration: animDuration,
                  ease: animEase,
                  onComplete: () => gsap.set(slot.parentEl, { clearProps: 'all' })
                }, slotTime);
              }
              // Nested children use nested stagger (ms → sec); fallback to group stagger
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

    gsap.set(paths, { drawSVG: '0%' });
    gsap.set(wrap, { autoAlpha: 0 });

    const lengths = paths.map((path) => path.getTotalLength());
    const totalLength = lengths.reduce((sum, len) => sum + len, 0);

    // Small entrance draw on load, independent of scroll, so the page
    // never shows a static half-drawn blob before the user scrolls.
    // The wrap fades in alongside it so the thick round-capped stroke
    // materializes softly instead of popping in as a solid dot.
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

    // Only create the scroll-linked timeline once the entrance is done.
    // Its "start" is pinned to whatever the actual scroll position is at
    // that exact moment (not literally the top of the page) — so its
    // first render always lines up with where the entrance left off,
    // no matter how much the page scrolled during the entrance itself.
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

  // Animate the progress bar as you scroll
  gsap.to(progressBar, {
    scaleX: 1,
    ease: 'none', // no ease, we control smoothness with the 'scrub' property
    scrollTrigger: {
      trigger: document.body, // Track the entire page
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5, // control the amount of time it takes for the bar to catch up with scroll position
    },
  });

  // Click listener to scroll to a specific position
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
});
