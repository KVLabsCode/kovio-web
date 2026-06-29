// Robot-/screen-facing player for an OEM "custom campaign".
//
// Point a robot screen at /display/<code>. This self-contained HTML page loops
// the campaign's playlist full-screen (object-fit: cover, no bars): images
// advance after their duration (or the display default), videos play to their
// natural end, then it wraps around.
//
// It refreshes the playlist IN PLACE every ~20s (fetching the same-origin
// /display/<code>/data endpoint) instead of reloading the page — so the screen
// never drops out of fullscreen and the wake-lock holds. A paused/unknown
// campaign just shows black and resumes on its own when it goes active again.
// No QR, no budget — advertiser content only.

import { fetchPlaylist } from '@/lib/display';

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  const { items, default_image_seconds } = await fetchPlaylist(code);

  // Inline the initial playlist safely (guard against </script> breakouts).
  const playlistJson = JSON.stringify(items).replace(/</g, '\\u003c');
  const dataUrl = `/display/${encodeURIComponent(code)}/data`;
  const manifestUrl = `/display/${encodeURIComponent(code)}/manifest`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="${manifestUrl}">
<title>Kovio display</title>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  .stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
  .art{width:100%;height:100%;object-fit:cover;background:#000}
</style></head>
<body><div class="stage" id="stage"></div>
<script>
(function(){
  var PLAYLIST = ${playlistJson};
  var DEFAULT_SECS = ${default_image_seconds};
  var DATA_URL = ${JSON.stringify(dataUrl)};
  var sig = JSON.stringify(PLAYLIST);
  var stage = document.getElementById('stage');
  var idx = 0, timer = null;

  function clearTimer(){ if(timer){ clearTimeout(timer); timer = null; } }
  function next(){ if(PLAYLIST.length){ idx = (idx + 1) % PLAYLIST.length; show(); } }
  function show(){
    clearTimer();
    if(!PLAYLIST.length){ stage.innerHTML = ''; return; }
    var item = PLAYLIST[idx % PLAYLIST.length];
    stage.innerHTML = '';
    if(item.media_type === 'video'){
      var v = document.createElement('video');
      v.src = item.media_url; v.className = 'art';
      v.autoplay = true; v.muted = true; v.defaultMuted = true; v.playsInline = true;
      v.setAttribute('muted',''); v.setAttribute('playsinline','');
      if(PLAYLIST.length === 1){ v.loop = true; }
      v.onended = function(){ if(PLAYLIST.length > 1) next(); };
      v.onerror = function(){ if(PLAYLIST.length > 1) next(); };
      stage.appendChild(v);
      var pr = v.play(); if(pr && pr.catch){ pr.catch(function(){}); }
    } else {
      var img = document.createElement('img');
      img.src = item.media_url; img.className = 'art'; img.alt = '';
      img.onerror = function(){ if(PLAYLIST.length > 1) next(); };
      stage.appendChild(img);
      if(PLAYLIST.length > 1){
        var secs = item.duration_seconds || DEFAULT_SECS;
        timer = setTimeout(next, secs * 1000);
      }
    }
  }
  show();

  // Keep the screen awake — a kiosk display must never sleep. Re-acquire when
  // the tab becomes visible again (the lock is dropped on hide).
  function keepAwake(){
    try {
      if ('wakeLock' in navigator) { navigator.wakeLock.request('screen').catch(function(){}); }
    } catch (e) {}
  }
  keepAwake();
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') keepAwake();
  });

  // First tap takes the page fullscreen — hides browser chrome even in a plain
  // browser tab (kiosk apps / installed PWA are already chromeless).
  function goFullscreen(){
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) { try { req.call(el); } catch (e) {} }
  }
  document.addEventListener('click', goFullscreen, { once: true });
  document.addEventListener('touchend', goFullscreen, { once: true });

  // Pick up playlist edits / pause / resume IN PLACE — no page reload, so the
  // screen stays fullscreen and the wake-lock holds. Only restart playback when
  // the playlist actually changed (otherwise leave the current item playing).
  function refresh(){
    fetch(DATA_URL, { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if(!d){ return; }
        if(typeof d.default_image_seconds === 'number'){ DEFAULT_SECS = d.default_image_seconds; }
        var items = (d.ok && Array.isArray(d.items)) ? d.items : [];
        var ns = JSON.stringify(items);
        if(ns !== sig){ sig = ns; PLAYLIST = items; idx = 0; show(); }
      })
      .catch(function(){});
  }
  setInterval(refresh, 20000);
})();
</script>
</body></html>`;

  return new Response(html, { status: 200, headers: HTML_HEADERS });
}
