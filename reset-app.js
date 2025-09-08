// Reset Application Data - Run this in browser console
// This will completely reset authentication and local data

console.log('🔄 Starting app reset...');

// Clear all localStorage
localStorage.clear();

// Clear all sessionStorage
sessionStorage.clear();

// Clear any service worker caches (if exists)
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      caches.delete(name);
    });
  });
}

// Force reload the page
setTimeout(() => {
  window.location.href = '/login';
}, 1000);

console.log('✅ App data cleared. Redirecting to login page...');
