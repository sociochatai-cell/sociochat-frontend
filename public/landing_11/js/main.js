(function () {
  const menuToggle = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector(".mobile-nav");
  const header = document.querySelector(".header");
  const faqItems = document.querySelectorAll(".faq-item");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Logo → main site home (works inside React iframe) */
  document.querySelectorAll('a.logo[href="/"]').forEach((logo) => {
    logo.addEventListener("click", (e) => {
      e.preventDefault();
      const top = window.top || window;
      top.location.href = "/";
    });
  });

  /* Mobile menu */
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* Sticky header shadow */
  if (header) {
    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* FAQ accordion */
  faqItems.forEach((item) => {
    const btn = item.querySelector(".faq-question");
    btn?.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      faqItems.forEach((i) => i.classList.remove("open"));
      if (!isOpen) item.classList.add("open");
    });
  });

  /* Marquee duplicate */
  document.querySelectorAll(".logo-track, .benefits-track").forEach((track) => {
    [...track.children].forEach((child) => {
      track.appendChild(child.cloneNode(true));
    });
  });

  /* —— Smooth scroll (custom ease for anchor links) —— */
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function smoothScrollTo(targetY, duration = 900) {
    if (prefersReducedMotion) {
      window.scrollTo(0, targetY);
      return;
    }

    const startY = window.scrollY;
    const diff = targetY - startY;
    if (Math.abs(diff) < 2) return;

    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      window.scrollTo(0, startY + diff * easeOutCubic(progress));
      if (progress < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"), 10) || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 16;
      smoothScrollTo(top);
    });
  });

  /* —— Scroll reveal —— */
  const observed = new WeakSet();

  function observeReveal(el, observer) {
    if (!el || observed.has(el)) return;
    observed.add(el);
    observer.observe(el);
  }

  function initScrollReveal() {
    const revealTargets = document.querySelectorAll(
      ".reveal, .section-header, .trusted, .trigger-stats-bar, .benefits-bar, .get-started, .footer-top"
    );

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealTargets.forEach((el) => el.classList.add("is-visible"));
      document.querySelectorAll(".reveal-stagger, .features-grid-7").forEach((el) => {
        el.classList.add("is-visible");
      });
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -5% 0px", threshold: 0.08 }
    );

    /* Hero — show immediately on load */
    document.querySelectorAll(".hero .reveal").forEach((el) => {
      el.classList.add("is-visible");
      observed.add(el);
    });

    /* Feature sections — slide in from alternating sides */
    document.querySelectorAll(".feature-split").forEach((split) => {
      const reverse = split.classList.contains("reverse");
      const text = split.querySelector(".feature-text");
      const visual = split.querySelector(".feature-visual");

      if (text) {
        text.classList.add("reveal", reverse ? "reveal-right" : "reveal-left");
        observeReveal(text, revealObserver);
      }
      if (visual) {
        visual.classList.add("reveal", reverse ? "reveal-left" : "reveal-right", "reveal-delay-2");
        observeReveal(visual, revealObserver);
      }
    });

    /* Staggered grids & lists */
    document.querySelectorAll(
      ".stats-grid, .testimonials-grid, .faq-list, .trigger-types"
    ).forEach((container) => {
      container.classList.add("reveal-stagger");
      [...container.children].forEach((child, index) => {
        child.classList.add("reveal-child");
        child.style.setProperty("--stagger-i", index);
      });
      observeReveal(container, revealObserver);
    });

    /* 7-feature grid */
    const featuresGrid = document.querySelector(".features-grid-7");
    if (featuresGrid) observeReveal(featuresGrid, revealObserver);

    /* General reveal elements */
    revealTargets.forEach((el) => {
      if (!el.classList.contains("reveal")) el.classList.add("reveal");
      observeReveal(el, revealObserver);
    });

    /* Get started block — stagger checklist items */
    const getStarted = document.querySelector(".get-started");
    if (getStarted) {
      getStarted.classList.add("reveal", "reveal-left");
      observeReveal(getStarted, revealObserver);
    }
  }

  initScrollReveal();
})();
