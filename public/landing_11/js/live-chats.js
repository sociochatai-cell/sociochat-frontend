(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const updates = [
    { selector: ".wa-bubble--1", texts: ["New lead alert! 🔔", "Lead from Facebook Ads", "Form submitted ✓"], meta: "Just now" },
    { selector: ".wa-bubble--2", texts: ["Broadcast sent to 2,450", "Campaign is live 🚀", "2,441 delivered"], meta: "✓✓ Delivered" },
    { selector: ".wa-bubble--4", texts: ["98% open rate 📈", "3× more replies", "Live analytics"], meta: "Live" },
  ];

  updates.forEach((item, i) => {
    const bubble = document.querySelector(item.selector);
    const card = bubble?.querySelector(".wa-bubble__card");
    if (!card) return;

    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % item.texts.length;
      card.innerHTML =
        item.texts[idx] +
        `<span class="wa-bubble__meta">${item.meta}</span>`;
    }, 3200 + i * 500);
  });
})();
