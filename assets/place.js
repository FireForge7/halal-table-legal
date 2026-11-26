(function () {
  'use strict';
  var root = document.getElementById('place');
  if (!root) return;
  var LIVE = window.HALAL_TABLE_LIVE || null;
  var LABELS = {"certified":{"en":"Certified halal","ar":"حلال معتمد","icon":"shield","blurb":"This place is on its certifier’s own published list.","svg":"<svg class=\"icon\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z\"/><path d=\"M9 12l2 2 4-4\"/></svg>"},"community_confirmed":{"en":"Community confirmed","ar":"مؤكد من المجتمع","icon":"people","blurb":"More members have confirmed it than disputed it, each saying how they know.","svg":"<svg class=\"icon\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3.5 19c.6-3 2.8-5 5.5-5s4.9 2 5.5 5\"/><circle cx=\"17\" cy=\"9\" r=\"2.4\"/><path d=\"M15.5 14.2c2.3.3 4 2.1 4.5 4.8\"/></svg>"},"unverified":{"en":"Not yet verified","ar":"غير مؤكد","icon":"question","blurb":"Listed as halal, but nobody has confirmed it yet. When in doubt, ask the business.","svg":"<svg class=\"icon\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6\"/><path d=\"M12 17.2h.01\"/></svg>"},"disputed":{"en":"Disputed","ar":"محل خلاف","icon":"alert","blurb":"Members disagree about whether it is halal. Read what each side says in the app and decide for yourself.","svg":"<svg class=\"icon\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7.5v5.5\"/><path d=\"M12 16.4h.01\"/></svg>"}};
  var CATEGORIES = {"restaurant":"Restaurant","cafe":"Café","bakery":"Bakery","food_truck":"Food truck","butcher":"Halal butcher","grocery":"Grocery","caterer":"Caterer","other":"Other"};
  var RIBBON = "<svg class=\"icon\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><circle cx=\"12\" cy=\"9\" r=\"5.5\"/><path d=\"M8.6 13.4L7 21l5-2.6 5 2.6-1.6-7.6\"/></svg>";
  var STALE_MS = 3 * 24 * 60 * 60 * 1000;
  var PLACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var CERT_HOSTS = /^https:\/\/(www\.hfsaa\.org|hmsusa\.org)\//;
  var APP_STORE = "https://apps.apple.com/us/app/halal-table-find-halal-food/id6809083897";
  function f(name) { return root.querySelector('[data-f="' + name + '"]'); }
  function show(el, on) { if (el) el.hidden = !on; }
  function text(name, value) { var el = f(name); if (el) el.textContent = value; return el; }
  function day(ms) { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

  // The label, or nothing. Certified only with its certifier's name.
  function renderLabel(row, note) {
    var slot = f('label');
    var meta = row && LABELS[row.halal_status];
    var certifier = row && typeof row.certification_body === 'string' ? row.certification_body.trim() : '';
    if (!meta || (row.halal_status === 'certified' && !certifier)) return noLabel();
    slot.textContent = '';
    var pill = document.createElement('span');
    pill.className = 'pill ' + (row.halal_status === 'community_confirmed' ? 'confirmed' : row.halal_status);
    pill.innerHTML = meta.svg; // a fixed icon from this script, never data
    pill.appendChild(document.createTextNode(meta.en));
    var sep = document.createElement('span'); sep.className = 'sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = '|';
    var ar = document.createElement('span'); ar.className = 'ar'; ar.lang = 'ar'; ar.textContent = meta.ar;
    pill.appendChild(sep); pill.appendChild(ar);
    slot.appendChild(pill);
    if (row.halal_status === 'certified') {
      var line = document.createElement('p'); line.className = 'place-certifier';
      line.innerHTML = RIBBON;
      line.appendChild(document.createTextNode('Certifier: ' + certifier + '. '));
      var url = typeof row.certificate_url === 'string' ? row.certificate_url.trim() : '';
      if (CERT_HOSTS.test(url)) {
        var a = document.createElement('a'); a.href = url; a.rel = 'noopener'; a.textContent = 'See this place on the certifier’s list';
        line.appendChild(a);
      }
      slot.appendChild(line);
    }
    var blurb = document.createElement('p'); blurb.className = 'place-blurb'; blurb.textContent = meta.blurb;
    slot.appendChild(blurb);
    text('label-note', note);
  }
  function noLabel() {
    f('label').textContent = '';
    text('label-note', 'Open Halal Table for today’s halal label and how it was checked.');
  }
  function gone() {
    f('label').textContent = '';
    show(f('label-box'), false);
    show(f('gone'), true);
    show(f('actions'), false);
  }

  function read(id, columns) {
    if (!LIVE || !window.fetch) return Promise.reject(new Error('no live read'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    var q = LIVE.url + '/rest/v1/places?select=' + columns + '&id=eq.' + encodeURIComponent(id);
    return fetch(q, { headers: { apikey: LIVE.key, Authorization: 'Bearer ' + LIVE.key, Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { clearTimeout(timer); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (rows) { return Array.isArray(rows) && rows.length ? rows[0] : null; });
  }

  // Fills the 404 shell for a place built after the last run.
  function fill(row) {
    var name = (row.name || '').trim();
    text('name', name);
    var kind = CATEGORIES[row.category] || CATEGORIES.other;
    var first = row.cuisines && row.cuisines[0] ? String(row.cuisines[0]) : '';
    if (first) kind += ' · ' + first.split('_').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
    text('kind', kind);
    var cityRegion = [row.city, row.region].filter(function (s) { return s && String(s).trim(); }).join(', ');
    var tail = [cityRegion, row.postal_code].filter(function (s) { return s && String(s).trim(); }).join(' ');
    var address = [row.address_line1, tail].filter(function (s) { return s && String(s).trim(); }).join(', ');
    show(text('address', address), !!address);
    var at = Number(row.latitude) + ',' + Number(row.longitude);
    f('apple-maps').href = 'https://maps.apple.com/?daddr=' + at + '&q=' + encodeURIComponent(name || address || 'Halal place');
    f('google-maps').href = 'https://www.google.com/maps/dir/?api=1&destination=' + at;
    var phone = String(row.phone || '').trim(), digits = phone.replace(/[^0-9]/g, '');
    if (digits.length >= 10 && digits.length <= 15) { f('call').href = 'tel:' + (phone.charAt(0) === '+' ? '+' : '') + digits; show(f('call-item'), true); }
    var site = String(row.website || '').trim();
    if (/^https?:\/\//i.test(site) && !/\s/.test(site)) {
      try { var host = new URL(site).hostname.replace(/^www\./, ''); if (host) { f('site').href = site; text('site-label', host); show(f('site-item'), true); } } catch (e) {}
    }
    show(f('actions'), true);
    document.title = (name || 'A halal place') + ' — Halal Table';
  }

  var liveNote = 'Current label, read from Halal Table just now.';
  if (root.dataset.mode === 'built') {
    var built = Date.parse(root.dataset.built || '');
    if (isFinite(built) && Date.now() - built <= STALE_MS) {
      renderLabel({ halal_status: root.dataset.status, certification_body: root.dataset.certifier, certificate_url: root.dataset.certUrl },
        'Label as of ' + day(built) + '. The app always has today’s.');
    }
    read(root.dataset.id, "id,halal_status,certification_body,certificate_url").then(function (row) {
      if (row) renderLabel(row, liveNote); else gone();
    }, function () {
      // Keep a fresh built-in label; a stale one was never shown.
    });
    return;
  }

  // 404.html: is this a place address?
  var m = /^\/place\/([0-9a-fA-F-]{36})\/?$/.exec(location.pathname);
  var id = m ? m[1].toLowerCase() : '';
  if (!PLACE_ID.test(id)) { document.title = 'Page not found — Halal Table'; return; }
  var missing = document.getElementById('not-found');
  if (missing) missing.hidden = true;
  root.hidden = false;
  read(id, "id,name,category,cuisines,address_line1,city,region,postal_code,latitude,longitude,phone,website,halal_status,certification_body,certificate_url,updated_at").then(function (row) {
    if (!row) { text('name', 'Place not found'); gone(); return; }
    fill(row);
    renderLabel(row, liveNote);
  }, function () {
    text('name', 'This place could not be loaded');
    text('label-note', 'Open it in Halal Table, or try again in a minute.');
    var store = document.createElement('a'); store.href = APP_STORE; store.textContent = ' Get Halal Table';
    f('label-note').appendChild(store);
  });
})();
