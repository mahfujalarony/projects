const getRectCenter = (rect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

export const animateAddToCart = ({ sourceEl, imageUrl }) => {
  if (!sourceEl || typeof document === "undefined") return;
  const target = document.querySelector("[data-cart-target]");
  if (!target) return;

  const srcRect = sourceEl.getBoundingClientRect();
  const tgtRect = target.getBoundingClientRect();
  if (!srcRect.width || !srcRect.height) return;

  const srcCenter = getRectCenter(srcRect);
  const tgtCenter = getRectCenter(tgtRect);

  const flyer = document.createElement("img");
  flyer.src = imageUrl || "";
  flyer.alt = "";
  flyer.setAttribute("aria-hidden", "true");

  const size = Math.max(22, Math.min(48, srcRect.width, srcRect.height));
  flyer.style.position = "fixed";
  flyer.style.left = `${srcCenter.x - size / 2}px`;
  flyer.style.top = `${srcCenter.y - size / 2}px`;
  flyer.style.width = `${size}px`;
  flyer.style.height = `${size}px`;
  flyer.style.borderRadius = "999px";
  flyer.style.objectFit = "cover";
  flyer.style.boxShadow = "0 6px 18px rgba(0,0,0,0.25)";
  flyer.style.zIndex = "9999";
  flyer.style.pointerEvents = "none";
  flyer.style.transition = "transform 650ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 650ms";
  flyer.style.transform = "translate3d(0,0,0) scale(1)";
  flyer.style.opacity = "1";

  document.body.appendChild(flyer);

  const dx = tgtCenter.x - srcCenter.x;
  const dy = tgtCenter.y - srcCenter.y;

  requestAnimationFrame(() => {
    flyer.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.3)`;
    flyer.style.opacity = "0.2";
  });

  const cleanup = () => {
    if (flyer && flyer.parentNode) flyer.parentNode.removeChild(flyer);
  };

  flyer.addEventListener("transitionend", cleanup, { once: true });
  setTimeout(cleanup, 800);
};

export const bumpCartBadge = () => {
  const badge = document.querySelector("[data-cart-badge]");
  if (!badge) return;
  badge.classList.remove("cart-bump");
  // force reflow to restart animation
  void badge.offsetWidth;
  badge.classList.add("cart-bump");
};
