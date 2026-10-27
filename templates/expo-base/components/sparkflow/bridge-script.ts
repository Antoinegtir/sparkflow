// Plain JS injected into the page by app/+html.tsx. It only runs when the app is embedded in the
// Sparkflow IDE (an iframe) and never touches React, so a broken screen cannot break it.
export const BRIDGE_SCRIPT = `(function () {
  if (window.parent === window) return;
  var SRC = "sparkflow-app";
  var send = function (m) { m.source = SRC; try { window.parent.postMessage(m, "*"); } catch (e) {} };
  var here = function () { return location.pathname + location.search; };

  // Color scheme: ?sf-scheme= or the session value, then live messages.
  var setScheme = function (s) {
    var root = document.documentElement;
    if (root.dataset.sfAppScheme === "1") return;
    if (s === "light" || s === "dark") root.setAttribute("data-sf-scheme", s);
    else root.removeAttribute("data-sf-scheme");
  };
  try {
    var q = new URLSearchParams(location.search).get("sf-scheme");
    if (q) sessionStorage.setItem("sparkflow-scheme", q);
    setScheme(q || sessionStorage.getItem("sparkflow-scheme"));
  } catch (e) {}

  // The app's real background, so the IDE can colour its fake status bar and home indicator to match.
  var lastSurface = "";
  var surface = function () {
    var c = getComputedStyle(document.body).backgroundColor;
    if (!c || c === "rgba(0, 0, 0, 0)") c = getComputedStyle(document.documentElement).backgroundColor;
    if (c && c !== lastSurface) { lastSurface = c; send({ type: "surface", color: c }); }
  };
  setInterval(surface, 500);

  // Route tracking.
  var last = here();
  var check = function () { var p = here(); if (p !== last) { last = p; send({ type: "route", path: p }); hide(); } };
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    history[k] = function () { var r = orig.apply(this, arguments); setTimeout(check, 0); return r; };
  });
  window.addEventListener("popstate", check);
  setInterval(check, 300);

  // Ready once React has mounted on #root (or after 10 s).
  var readySent = false;
  var ready = function () { readySent = true; send({ type: "ready", path: here() }); };
  var mounted = function () {
    var r = document.getElementById("root");
    return !!r && Object.keys(r).some(function (k) { return k.indexOf("__reactContainer") === 0; });
  };
  var waitReady = function () {
    var t0 = Date.now();
    (function poll() { if (mounted() || Date.now() - t0 > 10000) ready(); else setTimeout(poll, 100); })();
  };
  if (document.readyState === "complete") waitReady(); else window.addEventListener("load", waitReady);

  // Inspect overlay.
  var box = document.createElement("div");
  var tag = document.createElement("div");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #0a84ff;border-radius:6px;background:rgba(10,132,255,.06);display:none;transition:all .06s";
  tag.style.cssText = "position:absolute;left:-2px;font:600 11px/1.6 -apple-system,sans-serif;color:#fff;background:#0a84ff;padding:0 6px;border-radius:4px;white-space:nowrap";
  box.appendChild(tag);
  var cursor = document.createElement("style");
  cursor.textContent = "*{cursor:crosshair!important}";
  var inspecting = false, current = null;
  var attach = function () { if (!box.parentNode) document.documentElement.appendChild(box); };
  var hide = function () { box.style.display = "none"; current = null; };
  var show = function (el) {
    if (!el) return hide();
    attach();
    current = el;
    var r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left - 2 + "px"; box.style.top = r.top - 2 + "px";
    box.style.width = r.width + 4 + "px"; box.style.height = r.height + 4 + "px";
    tag.textContent = nameOf(el);
    if (r.top < 24) { tag.style.top = "auto"; tag.style.bottom = "-20px"; } else { tag.style.top = "-20px"; tag.style.bottom = "auto"; }
  };
  // What the pointer designates: the closest element with a testID, else a native control (tab, button,
  // link, anything with an accessibility label), else the text under the pointer.
  var CONTROL = '[role=button],[role=tab],[role=link],[role=switch],[role=checkbox],[role=img],a,button,input,[aria-label]';
  var target = function (e) {
    var t = e.target;
    if (!t || !t.closest) return null;
    var withId = t.closest("[data-testid]");
    var control = t.closest(CONTROL);
    // A control nested inside a testID block (a tab inside the tab bar) is the more precise target.
    if (control && (!withId || withId.contains(control))) return control;
    if (withId) return withId;
    return (t.innerText || "").trim() ? t : null;
  };
  // First non-empty line of an element's text (tab labels start with the icon's empty lines).
  var firstLine = function (t) { return String(t || "").replace(/[\\uE000-\\uF8FF]/g, "").split("\\n").map(function (l) { return l.trim(); }).filter(Boolean)[0] || ""; };
  var nameOf = function (el) {
    var id = el.getAttribute("data-testid");
    if (id) return id;
    var label = el.getAttribute("aria-label") || (firstLine(el.innerText) || firstLine(el.textContent)).slice(0, 40);
    var role = el.getAttribute("role") || el.tagName.toLowerCase();
    return label ? role + ' "' + label + '"' : role;
  };
  var swallow = function (e) { if (!inspecting) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
  ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart", "touchend", "dblclick", "contextmenu"].forEach(function (t) {
    window.addEventListener(t, swallow, true);
  });
  window.addEventListener("mousemove", function (e) { if (inspecting) show(target(e)); }, true);
  document.addEventListener("mouseleave", function () { if (inspecting) hide(); });
  window.addEventListener("click", function (e) {
    if (!inspecting) return;
    swallow(e);
    var el = target(e);
    if (!el) return;
    var r = el.getBoundingClientRect();
    var id = el.getAttribute("data-testid");
    var label = el.getAttribute("aria-label") || "";
    var text = (firstLine(el.innerText) || firstLine(el.textContent)).slice(0, 120);
    send({ type: "select", testId: id || nameOf(el), text: text,
      rect: { x: r.left, y: r.top, width: r.width, height: r.height }, path: here(),
      // Elements without a testID are found again by their accessibility label or their text.
      anchors: id ? undefined : { ids: [], texts: text ? [text] : [], labels: label ? [label] : [], climb: false, control: el.matches(CONTROL) } });
  }, true);
  // Element lookup: by testID, or for elements without one, the smallest block holding all their anchors
  // (testIDs and texts inside). A single anchor climbs to the first ancestor with its own background.
  var byId = function (id) { return document.querySelectorAll('[data-testid="' + String(id).replace(/"/g, "") + '"]'); };
  var byText = function (t) {
    var want = String(t).trim().toLowerCase();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n.textContent || "").trim().toLowerCase() === want && n.parentElement) return n.parentElement;
    }
    return null;
  };
  var hasSurface = function (el) {
    var s = getComputedStyle(el);
    var bg = s.backgroundColor;
    return (bg && bg !== "transparent" && !/rgba\\([^)]*,\\s*0\\)$/.test(bg)) || parseFloat(s.borderTopWidth) > 0 || s.boxShadow !== "none";
  };
  var lca = function (els) {
    var path = [];
    for (var a = els[0]; a; a = a.parentElement) path.push(a);
    var common = path.find(function (p) { return els.every(function (e) { return p.contains(e); }); });
    return common || null;
  };
  var resolve = function (item) {
    if (item.testId) {
      var found = byId(item.testId);
      if (found.length || !item.anchors) return Array.prototype.slice.call(found);
    }
    var a = item.anchors;
    if (!a) return [];
    var hits = [];
    (a.ids || []).forEach(function (id) { var e = byId(id)[0]; if (e) hits.push(e); });
    (a.labels || []).forEach(function (l) { var e = document.querySelector('[aria-label="' + String(l).replace(/"/g, "") + '"]'); if (e) hits.push(e); });
    if (!(a.labels || []).length || !hits.length) (a.texts || []).forEach(function (t) { var e = byText(t); if (e) hits.push(e); });
    if (!hits.length) return [];
    var el = lca(hits);
    // A native control (a tab, a button) is outlined whole, not just its label.
    if (el && a.control && el.closest) el = el.closest(CONTROL) || el;
    if (el && hits.length === 1 && a.climb) {
      for (var i = 0, p = el.parentElement; i < 5 && p && p !== document.body; i++, p = p.parentElement) {
        if (hasSurface(p)) { el = p; break; }
      }
    }
    return el ? [el] : [];
  };

  // Selected elements: persistent blue outlines with their number, until the IDE clears them.
  var selected = [];
  var selLayer = document.createElement("div");
  selLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646";
  var drawSelection = function () {
    if (!selLayer.parentNode) document.documentElement.appendChild(selLayer);
    selLayer.innerHTML = "";
    selected.forEach(function (item, i) {
      resolve(item).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var b = document.createElement("div");
        b.style.cssText = "position:fixed;border:2px solid #0a84ff;border-radius:6px;background:rgba(10,132,255,.08);left:" + (r.left - 2) + "px;top:" + (r.top - 2) + "px;width:" + (r.width + 4) + "px;height:" + (r.height + 4) + "px";
        var n = document.createElement("div");
        n.textContent = String(i + 1);
        n.style.cssText = "position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:9px;background:#0a84ff;color:#fff;font:700 10px/18px -apple-system,sans-serif;text-align:center";
        b.appendChild(n);
        selLayer.appendChild(b);
      });
    });
  };
  setInterval(function () { if (selected.length) drawSelection(); }, 500);
  var reposition = function () { if (current) show(current); if (selected.length) drawSelection(); };
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);

  window.addEventListener("message", function (e) {
    var m = e.data;
    if (!m || typeof m !== "object") return;
    if (m.type === "inspect") {
      inspecting = !!m.enabled;
      if (inspecting) document.head.appendChild(cursor); else { cursor.remove(); hide(); }
    } else if (m.type === "navigate") {
      try { history.pushState(null, "", m.path); dispatchEvent(new PopStateEvent("popstate")); } catch (err) { location.assign(m.path); }
    } else if (m.type === "color-scheme") {
      try { sessionStorage.setItem("sparkflow-scheme", m.scheme); } catch (err) {}
      setScheme(m.scheme);
    } else if (m.type === "highlight") {
      if (!m.testId && !m.anchors) { if (!inspecting) hide(); return; }
      var target = resolve({ testId: m.testId, anchors: m.anchors })[0];
      if (!target) return hide();
      show(target);
      if (!target.getAttribute("data-testid")) tag.textContent = (m.anchors && m.anchors.texts && m.anchors.texts[0]) || "element";
    } else if (m.type === "selection") {
      selected = Array.isArray(m.items) ? m.items : Array.isArray(m.testIds) ? m.testIds.map(function (id) { return { testId: id }; }) : [];
      drawSelection();
    } else if (m.type === "ping") {
      if (readySent) ready();
    }
  });
})();`;
