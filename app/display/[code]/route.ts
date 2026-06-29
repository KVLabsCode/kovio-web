// Robot-/screen-facing player for an OEM "custom display".
//
// Point a robot screen at /display/<code>. This self-contained HTML page fetches
// the display's playlist from the cloud public endpoint and loops it full-screen:
// images advance after their duration (falling back to the display default),
// videos play to their natural end, then it wraps around. A single item just
// holds (images) or loops (video). Paused/unknown displays render an idle black
// screen. It soft-reloads each minute so edits/pauses propagate without touching
// the robot. No QR, no budget — this is the advertiser-content-only surface.

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' };

const API_BASE = (process.env.NEXT_PUBLIC_KOVIO_API_URL ?? '').replace(/\/$/, '');

interface PlaylistItem {
  media_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number | null;
}

function idleDoc(status: number): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}</style></head><body></body></html>`;
  return new Response(html, { status, headers: HTML_HEADERS });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await ctx.params;
  if (!API_BASE) return idleDoc(500);

  let items: PlaylistItem[] = [];
  let defaultSecs = 8;
  try {
    const res = await fetch(`${API_BASE}/display/v1/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return idleDoc(res.status === 404 ? 404 : 502);
    const data = await res.json();
    items = Array.isArray(data?.items) ? data.items : [];
    if (typeof data?.default_image_seconds === 'number') defaultSecs = data.default_image_seconds;
  } catch {
    return idleDoc(502);
  }

  // Inline the playlist safely (guard against </script> breakouts in URLs).
  const playlistJson = JSON.stringify(items).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="/display/${encodeURIComponent(code)}/manifest">
<title>Kovio display</title>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden}
  .stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
  .art{width:100%;height:100%;object-fit:contain;background:#000}
</style></head>
<body><div class="stage" id="stage"></div>
<script>
(function(){
  var PLAYLIST = ${playlistJson};
  var DEFAULT_SECS = ${defaultSecs};
  var stage = document.getElementById('stage');
  var idx = 0, timer = null;
  function clearTimer(){ if(timer){ clearTimeout(timer); timer = null; } }
  function next(){ if(PLAYLIST.length){ idx = (idx + 1) % PLAYLIST.length; show(); } }
  function show(){
    clearTimer();
    if(!PLAYLIST.length) return;
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
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(function(){});
      }
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

  // Pick up playlist edits / pause without re-touching the robot. (An installed
  // PWA / kiosk browser stays fullscreen across this reload; a plain tab won't.)
  setTimeout(function(){ location.reload(); }, 60000);
})();
</script>
</body></html>`;

  return new Response(html, { status: 200, headers: HTML_HEADERS });
}
