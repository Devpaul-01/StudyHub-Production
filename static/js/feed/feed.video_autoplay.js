/**
 * feed_video_autoplay.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Plays post videos when they are both:
 *   1. Inside the viewport  (outer IntersectionObserver on the carousel wrapper)
 *   2. The currently-visible slide  (inner IntersectionObserver on each slide,
 *      rooted to the scroll container so it ignores off-screen siblings)
 *
 * Usage
 * ─────
 * import { initVideoAutoplay, notifySlideChange } from './feed_video_autoplay.js';
 *
 * // Call once after the feed has rendered:
 * initVideoAutoplay();
 *
 * // Call from your existing carousel scroll handler whenever the active slide
 * // changes, passing the carousel wrapper element and the new 0-based index:
 * notifySlideChange(carouselEl, newIndex);
 *
 * The module re-observes dynamically injected carousels automatically via a
 * MutationObserver on document.body, so it works with infinite scroll / lazy
 * loaded posts out of the box.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── State ───────────────────────────────────────────────────────────────────

/** Carousels whose wrapper is currently intersecting the viewport. */
const inViewCarousels = new Set();

/**
 * Per-carousel Set of slide indices that are currently visible inside the
 * scroll container.  Key → carousel element,  Value → Set<number>
 */
const visibleSlides = new WeakMap();

/** The single outer observer (viewport). */
let outerObserver = null;

/** One inner observer per carousel (root = its scroll container). */
const innerObservers = new WeakMap();

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the <video> element inside a given .post-resource slide, or null.
 */
function getVideo(slideEl) {
  return slideEl.querySelector('video') ?? null;
}

/**
 * Safely plays a video.  Swallows the AbortError that fires when .play() is
 * interrupted by an almost-immediate .pause() (common during fast scrolling).
 */
function safePlay(video) {
  if (!video || !video.paused) return;
  video.play().catch((err) => {
    if (err.name !== 'AbortError') console.warn('[VideoAutoplay] play() error:', err);
  });
}

/** Pauses a video and resets to the beginning so next entry starts clean. */
function safePause(video) {
  if (!video || video.paused) return;
  video.pause();
}

/**
 * Decides whether the video in a specific slide should be playing right now.
 * Plays if: carousel is in viewport AND that slide's index is visible in the
 * scroll container AND the slide actually contains a video.
 */
function evaluateSlide(carouselEl, slideEl, index) {
  const video = getVideo(slideEl);
  if (!video) return;

  const carouselInView = inViewCarousels.has(carouselEl);
  const slideVisible   = visibleSlides.get(carouselEl)?.has(index) ?? false;

  if (carouselInView && slideVisible) {
    safePlay(video);
  } else {
    safePause(video);
  }
}

/** Runs evaluateSlide for every slide in a carousel. */
function evaluateCarousel(carouselEl) {
  const scrollEl = carouselEl.querySelector('.resources-scroll-container');
  if (!scrollEl) return;

  scrollEl.querySelectorAll('.post-resource').forEach((slideEl, index) => {
    evaluateSlide(carouselEl, slideEl, index);
  });
}

/** Pauses all videos inside a carousel immediately. */
function pauseAllInCarousel(carouselEl) {
  carouselEl.querySelectorAll('video').forEach(safePause);
}

// ─── Outer observer (viewport visibility of the whole carousel) ───────────────

function createOuterObserver() {
  return new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const carouselEl = entry.target;

        if (entry.isIntersecting) {
          inViewCarousels.add(carouselEl);
          evaluateCarousel(carouselEl);
        } else {
          inViewCarousels.delete(carouselEl);
          pauseAllInCarousel(carouselEl);
        }
      });
    },
    {
      // Fire when at least 50% of the carousel is visible.
      // Lower this (e.g. 0.25) for tall viewports / short posts.
      threshold: 0.5,
    }
  );
}

// ─── Inner observer (which slide is visible inside the scroll container) ──────

/**
 * Creates one IntersectionObserver rooted to the scroll container.
 * It only sees slides that are snapped into the visible area of that container,
 * so it's completely immune to other carousels on screen.
 */
function createInnerObserver(carouselEl, scrollEl) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const slideEl = entry.target;
        // Find the index of this slide inside its scroll container
        const index = Array.from(scrollEl.querySelectorAll('.post-resource'))
                           .indexOf(slideEl);
        if (index === -1) return;

        const visible = visibleSlides.get(carouselEl) ?? new Set();

        if (entry.isIntersecting) {
          visible.add(index);
        } else {
          visible.delete(index);
        }

        visibleSlides.set(carouselEl, visible);
        evaluateSlide(carouselEl, slideEl, index);
      });
    },
    {
      root: scrollEl,
      // A slide counts as "visible" when 60% of it is within the scroll
      // container's viewport.  This prevents the adjacent (partially visible)
      // slide from triggering playback.
      threshold: 0.6,
    }
  );

  return observer;
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * Registers a single .post-resources-carousel element with both observers.
 * Safe to call multiple times on the same element (idempotent).
 */
function registerCarousel(carouselEl) {
  // Already registered?
  if (innerObservers.has(carouselEl)) return;

  const scrollEl = carouselEl.querySelector('.resources-scroll-container');
  if (!scrollEl) return;

  // Only bother if this carousel has at least one video slide
  const hasVideo = !!carouselEl.querySelector('[data-type="video"]');
  if (!hasVideo) return;

  // Outer: is the carousel in the viewport?
  outerObserver.observe(carouselEl);

  // Inner: which slide inside this carousel is visible?
  const innerObs = createInnerObserver(carouselEl, scrollEl);
  scrollEl.querySelectorAll('.post-resource').forEach((slide) => {
    innerObs.observe(slide);
  });

  innerObservers.set(carouselEl, innerObs);
  visibleSlides.set(carouselEl, new Set());
}

function unregisterCarousel(carouselEl) {
  outerObserver?.unobserve(carouselEl);
  innerObservers.get(carouselEl)?.disconnect();
  innerObservers.delete(carouselEl);
  visibleSlides.delete(carouselEl);
  inViewCarousels.delete(carouselEl);
}

// ─── MutationObserver (handles infinite scroll / dynamic posts) ───────────────

function watchForNewCarousels() {
  const mutObs = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        // The node itself might be a carousel
        if (node.classList.contains('post-resources-carousel')) {
          registerCarousel(node);
        }

        // Or it might be a post card that contains one or more carousels
        node.querySelectorAll('.post-resources-carousel').forEach(registerCarousel);
      });

      // Clean up removed carousels to avoid memory leaks
      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        if (node.classList.contains('post-resources-carousel')) {
          unregisterCarousel(node);
        }
        node.querySelectorAll('.post-resources-carousel').forEach(unregisterCarousel);
      });
    });
  });

  mutObs.observe(document.body, { childList: true, subtree: true });
  return mutObs;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * initVideoAutoplay()
 *
 * Call once, after the initial feed render.
 * Sets up all observers and begins watching for new posts.
 */
export function initVideoAutoplay() {
  if (outerObserver) return; // already initialised

  outerObserver = createOuterObserver();

  // Register all carousels already in the DOM
  document.querySelectorAll('.post-resources-carousel').forEach(registerCarousel);

  // Watch for future carousels (infinite scroll, etc.)
  watchForNewCarousels();
}

/**
 * notifySlideChange(carouselEl, newIndex)
 *
 * Call this from your existing carousel scroll/button handler whenever the
 * active slide changes.  This is the bridge between your navigation logic and
 * the autoplay system — without it, the inner IntersectionObserver alone would
 * handle it, but calling this explicitly makes the response instant (no
 * threshold delay).
 *
 * @param {Element} carouselEl  - The .post-resources-carousel wrapper element
 * @param {number}  newIndex    - The 0-based index of the slide now in view
 */
export function notifySlideChange(carouselEl, newIndex) {
  if (!carouselEl) return;

  const scrollEl = carouselEl.querySelector('.resources-scroll-container');
  if (!scrollEl) return;

  const slides = scrollEl.querySelectorAll('.post-resource');

  // Pause every video in this carousel first
  slides.forEach((slide) => safePause(slide.querySelector('video')));

  // Update visible slides state to reflect only the new index
  visibleSlides.set(carouselEl, new Set([newIndex]));

  // Evaluate only the newly active slide
  const activeSlide = slides[newIndex];
  if (activeSlide) evaluateSlide(carouselEl, activeSlide, newIndex);
}
