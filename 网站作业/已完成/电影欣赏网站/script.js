document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav");
  const browseStateKey = "yingying-browse-state-v1";
  const currentPath = window.location.pathname;

  const readBrowseState = () => {
    try {
      const raw = window.sessionStorage.getItem(browseStateKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  };

  const writeBrowseState = (state) => {
    try {
      window.sessionStorage.setItem(browseStateKey, JSON.stringify(state));
    } catch (error) {
      // Private browsing modes may disable sessionStorage; navigation still works.
    }
  };

  const clearBrowseState = () => {
    try {
      window.sessionStorage.removeItem(browseStateKey);
    } catch (error) {
      // Ignore storage errors and keep the page usable.
    }
  };

  if (menu && nav) {
    menu.addEventListener("click", () => {
      const open = body.classList.toggle("nav-open");
      menu.setAttribute("aria-expanded", String(open));
      menu.textContent = open ? "关闭" : "菜单";
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      body.classList.remove("nav-open");
      menu.setAttribute("aria-expanded", "false");
      menu.textContent = "菜单";
    }));
  }

  const storedBrowseState = readBrowseState();
  let restorePending = false;
  document.querySelectorAll(".search-box").forEach((box) => {
    const input = box.querySelector("input");
    const clear = box.querySelector(".search-clear");
    const cards = [...document.querySelectorAll(".film-card")];
    const empty = box.parentElement.querySelector(".search-empty") || document.querySelector(".search-empty");
    if (!input || !cards.length) return;
    const filter = () => {
      const query = input.value.trim().toLowerCase();
      let count = 0;
      cards.forEach((card) => {
        const haystack = (card.dataset.search || card.dataset.title || "").toLowerCase();
        const visible = !query || haystack.includes(query);
        card.classList.toggle("is-hidden", !visible);
        if (visible) count += 1;
      });
      if (clear) clear.hidden = !query;
      if (empty) empty.hidden = count !== 0;
    };
    if (body.classList.contains("page-category") && storedBrowseState?.pagePath === currentPath) {
      input.value = storedBrowseState.query || "";
      filter();
      restorePending = true;
    }
    input.addEventListener("input", filter);
    clear?.addEventListener("click", () => { input.value = ""; input.focus(); filter(); });
  });

  // Record the list position before opening a film. The category page can then
  // restore the same scroll position and search phrase when its return link is used.
  if (body.classList.contains("page-category")) {
    document.querySelectorAll(".film-card[href]").forEach((card) => card.addEventListener("click", () => {
      const input = document.querySelector(".search-box input");
      writeBrowseState({
        pagePath: currentPath,
        scrollY: Math.max(0, Math.round(window.scrollY)),
        query: input?.value || ""
      });
    }));
  }

  if (restorePending && Number.isFinite(storedBrowseState?.scrollY)) {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: storedBrowseState.scrollY, behavior: "auto" });
        clearBrowseState();
      });
    });
  }

  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("p");
  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.classList.remove("lightbox-open");
  };
  document.querySelectorAll("[data-lightbox]").forEach((button) => button.addEventListener("click", () => {
    if (!lightbox || !lightboxImage) return;
    lightboxImage.src = button.dataset.lightbox;
    lightboxImage.alt = button.dataset.caption || "海报预览";
    if (lightboxCaption) lightboxCaption.textContent = button.dataset.caption || "";
    lightbox.hidden = false;
    document.body.classList.add("lightbox-open");
    lightbox.querySelector("[data-lightbox-close]")?.focus();
  }));
  lightbox?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
});
