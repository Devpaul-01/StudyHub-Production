
import { LearnoraHandlers } from './learnora.delegation.js';
import { initLearnora } from './learnora.events.js';

let isInitialized = false;

async function bootstrapLearnora() {
  if (isInitialized) return;
  isInitialized = true;
  
  console.log('✅ Learnora: initializing…');
  try {
    await initLearnora();
    console.log('✅ Learnora: initialized successfully');
  } catch (err) {
    console.error('❌ Learnora init failed:', err);
  }
}

// Initialize when DOM is ready (no active class check needed)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLearnora);
} else {
  bootstrapLearnora();
}

// Handle click delegation
document.body.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  
  const action = target.dataset.action;
  const handler = LearnoraHandlers[action];
  
  if (handler) {
    event.stopPropagation();
    try {
      handler(target, event);
    } catch (error) {
      console.error(`Error in handler for ${action}:`, error);
    }
  }
});

// Handle change delegation (needed for <select> elements like mode selector)
document.body.addEventListener('change', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const handler = LearnoraHandlers[action];

  if (handler) {
    try {
      handler(target, event);
    } catch (error) {
      console.error(`Error in change handler for ${action}:`, error);
    }
  }
});
