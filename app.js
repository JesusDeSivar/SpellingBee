/* The Pronouncer's Desk — spelling bee trainer for the 150-word study list */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var RANKS = [
    [0, "Classroom"], [250, "School Bee"], [750, "District Bee"], [1750, "Regional Bee"],
    [3500, "State Bee"], [6000, "National Bee"], [10000, "Champion"]
  ];
  var BADGES = [
    { id: "first",   ic: "🎤", t: "First Word",        d: "Spell your first word correctly." },
    { id: "s5",      ic: "🔥", t: "Hot Mic",           d: "Five correct in a row." },
    { id: "s10",     ic: "👏", t: "Standing Ovation",  d: "Ten correct in a row." },
    { id: "clean20", ic: "🎯", t: "No Assistance",     d: "20 words spelled with no hints." },
    { id: "poly",    ic: "🌍", t: "Polyglot",          d: "Spell a word from all nine origin languages." },
    { id: "greek",   ic: "🏛", t: "Hellenist",         d: "Spell every Greek-origin word correctly." },
    { id: "sesqui",  ic: "📏", t: "A Foot and a Half", d: "Spell sesquipedalian correctly." },
    { id: "flaw",    ic: "🛡", t: "Flawless",          d: "Finish a championship with all three lives." },
    { id: "c100",    ic: "💯", t: "Century",           d: "Master 100 words." },
    { id: "all",     ic: "🏆", t: "National Champion", d: "Master all 150 words." }
  ];
  var BASE = { Basic: 10, Intermediate: 20, Advanced: 35 };
  var LVLCLASS = { Basic: "b", Intermediate: "i", Advanced: "a" };

  /* ---------------- state ---------------- */
  var KEY = "pronouncersdesk.v1";
  var S = { xp: 0, best: 0, clean: 0, p: {}, badges: [] };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var l = JSON.parse(raw);
      S.xp = l.xp || 0; S.best = l.best || 0; S.clean = l.clean || 0;
      S.p = l.p || {}; S.badges = l.badges || [];
    }
  } catch (e) { /* private mode, blocked storage — run in memory */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* non-fatal */ }
  }
  function prog(w) {
    if (!S.p[w]) S.p[w] = { r: 0, x: 0, c: 0, box: 1, star: 0 };
    return S.p[w];
  }
  function state(w) {
    var p = S.p[w];
    if (!p || (!p.r && !p.x)) return "";
    if (p.c >= 3) return "mastered";
    if (p.c >= 1) return "solid";
    return "learning";
  }
  var masteredCount = function () {
    return WORDS.filter(function (w) { return state(w.w) === "mastered"; }).length;
  };

  var streak = 0;

  /* ---------------- tiny helpers ---------------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function mask(text, word) {
    var re = new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w*", "gi");
    return String(text).replace(re, "———");
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  var toastT;
  function toast(msg) {
    var el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove("show"); }, 2600);
  }

  /* ---------------- speech ---------------- */
  var SPEAK = typeof window.speechSynthesis !== "undefined" &&
              typeof window.SpeechSynthesisUtterance !== "undefined";
  var voice = null;
  function pickVoice() {
    if (!SPEAK) return;
    var v = [];
    try { v = window.speechSynthesis.getVoices() || []; } catch (e) { return; }
    var us = v.filter(function (x) { return /^en[-_]US/i.test(x.lang); });
    voice = us.filter(function (x) { return /natural|google|aria|jenny|samantha|zira/i.test(x.name); })[0] ||
            us[0] ||
            v.filter(function (x) { return /^en/i.test(x.lang); })[0] || null;
  }
  if (SPEAK) {
    pickVoice();
    try { window.speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* ignore */ }
  }
  function utter(text, rate) {
    var u = new SpeechSynthesisUtterance(text);
    u.rate = rate; u.lang = "en-US"; u.pitch = 1;
    if (voice) u.voice = voice;
    return u;
  }
  function say(text, rate) {
    if (!SPEAK) return;
    try {
      var ss = window.speechSynthesis;
      // iOS drops an utterance queued immediately after a no-op cancel()
      if (ss.speaking || ss.pending) ss.cancel();
      ss.speak(utter(text, rate || 0.9));
    } catch (e) { /* ignore */ }
  }
  function spellAloud(w) {
    if (!SPEAK) return;
    try {
      window.speechSynthesis.cancel();
      w.split("").forEach(function (ch) {
        window.speechSynthesis.speak(utter(ch.toUpperCase(), 0.7));
      });
      window.speechSynthesis.speak(utter(w, 0.85));
    } catch (e) { /* ignore */ }
  }

  /* ---------------- listening ----------------
     Speech recognition hears letter NAMES ("see", "double you"), not letters, so
     every transcript goes through a decoder before it becomes a spelling. */
  var RecCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var CAN_HEAR = !!RecCtor;
  var rec = null;

  var LETTER_WORDS = {
    a: "a", ay: "a", aye: "a", eh: "a", ah: "a",
    b: "b", be: "b", bee: "b", bea: "b", bi: "b",
    c: "c", see: "c", sea: "c", cee: "c", si: "c", ci: "c",
    d: "d", dee: "d", de: "d", di: "d",
    e: "e", ee: "e", eee: "e",
    f: "f", ef: "f", eff: "f",
    g: "g", gee: "g", ge: "g", jee: "g",
    h: "h", aitch: "h", haitch: "h", ache: "h", aich: "h",
    i: "i", eye: "i", ai: "i",
    j: "j", jay: "j", jai: "j", je: "j",
    k: "k", kay: "k", cay: "k", ka: "k",
    l: "l", el: "l", ell: "l", elle: "l",
    m: "m", em: "m", emm: "m",
    n: "n", en: "n", enn: "n",
    o: "o", oh: "o", owe: "o", ou: "o",
    p: "p", pee: "p", pea: "p", pe: "p",
    q: "q", cue: "q", queue: "q", kew: "q", qu: "q",
    r: "r", are: "r", ar: "r", arr: "r",
    s: "s", es: "s", ess: "s", esse: "s",
    t: "t", tee: "t", tea: "t", te: "t", ti: "t",
    u: "u", you: "u", yu: "u", ewe: "u", oo: "u",
    v: "v", vee: "v", ve: "v", vi: "v",
    w: "w", dub: "w", dubya: "w", "double-u": "w",
    x: "x", ex: "x", eks: "x", ecks: "x",
    y: "y", why: "y", wye: "y", wy: "y",
    z: "z", zee: "z", zed: "z", zi: "z", zeta: "z"
  };

  function decodeSpelling(text, target) {
    var s = String(text).toLowerCase()
      .replace(/[.,!?;:"'’“”]/g, " ")
      .replace(/\bdouble\s*-?\s*(u|you|yoo|yu)\b/g, " w ")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ").trim();
    if (!s) return "";
    var toks = s.split(" "), i;
    // said the whole word rather than spelling it — that is an answer too
    if (target) {
      for (i = 0; i < toks.length; i++) {
        if (toks[i] === target.toLowerCase()) return target.toLowerCase();
      }
    }
    var out = "";
    for (i = 0; i < toks.length; i++) {
      if (LETTER_WORDS[toks[i]]) out += LETTER_WORDS[toks[i]];
      else if (/^[a-z]+$/.test(toks[i])) out += toks[i];  // recognizer merged a run
    }
    return out;
  }

  function lev(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }
  function soundsLike(said, target) {
    var t = target.toLowerCase();
    var s = String(said).toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
    if (!s) return false;
    var slack = Math.max(1, Math.floor(t.length / 5));
    var toks = s.split(" ");
    for (var i = 0; i < toks.length; i++) {
      if (toks[i] === t || lev(toks[i], t) <= slack) return true;
    }
    return lev(s.replace(/ /g, ""), t) <= slack;
  }

  function stopListening() {
    if (!rec) return;
    try { rec.onend = null; rec.stop(); } catch (e) { /* ignore */ }
    rec = null;
  }

  var ERRS = {
    "not-allowed": "Microphone blocked. Allow mic access for this page in your browser, then try again.",
    "service-not-allowed": "Your browser would not start the speech service. Typing still works.",
    "audio-capture": "No microphone found. Check that one is connected.",
    "no-speech": "I did not hear anything — try again, a little closer to the mic.",
    "network": "The speech service could not be reached. Check your connection.",
    "aborted": ""
  };

  function listen(opts) {
    if (!CAN_HEAR) { opts.onError("unsupported"); return; }
    stopListening();
    if (SPEAK) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    var r;
    try { r = new RecCtor(); } catch (e) { opts.onError("unsupported"); return; }
    rec = r;
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    var finalText = "";
    r.onresult = function (e) {
      var interim = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += " " + e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (opts.onHear) opts.onHear((finalText + " " + interim).trim(), false);
    };
    r.onerror = function (e) { opts.onError(e.error || "error"); };
    r.onend = function () { rec = null; if (opts.onDone) opts.onDone(finalText.trim()); };
    try { r.start(); } catch (e) { opts.onError("start"); }
  }

  /* ---------------- mascots: Bea la abeja & Capi el carpincho ----------------
     Drawn from primitives (ellipses, rects, short arcs) so they stay crisp at any
     size and take every colour from the theme tokens. */
  var uid = 0;

  function beeInner(mood) {
    var clip = "beeclip" + (++uid), eyes, mouth;
    if (mood === "happy") {
      eyes = '<path d="M43.4 26.6q2.6-3.2 5.2 0M51.4 26.6q2.6-3.2 5.2 0" stroke="var(--bee-eye)" ' +
             'stroke-width="1.8" fill="none" stroke-linecap="round"/>';
      mouth = '<path d="M45.6 31.4q4.2 4 8.4 0" stroke="var(--bee-eye)" stroke-width="1.7" ' +
              'fill="none" stroke-linecap="round"/>';
    } else if (mood === "oops") {
      eyes = '<circle cx="46" cy="26" r="2.7" fill="var(--bee-eye)"/>' +
             '<circle cx="54" cy="26" r="2.7" fill="var(--bee-eye)"/>' +
             '<circle cx="46" cy="26.8" r="1.3" fill="var(--bee-ink)"/>' +
             '<circle cx="54" cy="26.8" r="1.3" fill="var(--bee-ink)"/>';
      mouth = '<ellipse cx="50" cy="32.2" rx="2.2" ry="2.6" fill="var(--bee-eye)"/>';
    } else {
      eyes = '<circle cx="46" cy="25.8" r="2.7" fill="var(--bee-eye)"/>' +
             '<circle cx="54" cy="25.8" r="2.7" fill="var(--bee-eye)"/>' +
             '<circle cx="46.7" cy="26.4" r="1.35" fill="var(--bee-ink)"/>' +
             '<circle cx="54.7" cy="26.4" r="1.35" fill="var(--bee-ink)"/>';
      mouth = '<path d="M46.6 31.6q3.4 2.8 6.8 0" stroke="var(--bee-eye)" stroke-width="1.6" ' +
              'fill="none" stroke-linecap="round"/>';
    }
    return '<g class="wings">' +
        '<ellipse cx="28" cy="16" rx="12.5" ry="6.6" transform="rotate(-26 28 16)" ' +
          'fill="var(--wing)" opacity=".75"/>' +
        '<ellipse cx="21" cy="19.5" rx="9.5" ry="5.2" transform="rotate(-54 21 19.5)" ' +
          'fill="var(--wing)" opacity=".55"/></g>' +
      '<path d="M9.5 34.5 2.5 32.5 9.5 30.5Z" fill="var(--bee-ink)"/>' +
      '<ellipse cx="28" cy="33" rx="19" ry="12.6" fill="var(--bee-gold)"/>' +
      '<clipPath id="' + clip + '"><ellipse cx="28" cy="33" rx="19" ry="12.6"/></clipPath>' +
      '<g clip-path="url(#' + clip + ')" fill="var(--bee-ink)">' +
        '<rect x="14" y="18" width="5" height="30" rx="2.4" transform="rotate(9 16.5 33)"/>' +
        '<rect x="24" y="18" width="5.4" height="30" rx="2.6" transform="rotate(9 26.7 33)"/>' +
        '<rect x="34" y="18" width="5" height="30" rx="2.4" transform="rotate(9 36.5 33)"/></g>' +
      '<path d="M47 17.5q-1.5-7 3.5-9.6M54 18q2.5-6.6 8-6.8" stroke="var(--bee-ink)" ' +
        'stroke-width="1.9" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50.8" cy="7.4" r="2.2" fill="var(--bee-gold)"/>' +
      '<circle cx="62.4" cy="11.2" r="2.2" fill="var(--bee-gold)"/>' +
      '<circle cx="50" cy="27" r="10.5" fill="var(--bee-ink)" stroke="var(--bee-gold)" ' +
        'stroke-width="1.1" stroke-opacity=".45"/>' +
      eyes + mouth;
  }

  /* Capybara, not teddy bear: a blunt brick of a head, tiny ears set at the far
     corners, eyes high on the skull, and a big squared-off nose pad. */
  function capyInner(mood) {
    var eyes;
    if (mood === "zen") {                       // unbothered: shades for a hot streak
      eyes = '<rect x="10.5" y="10.4" width="43" height="6.2" rx="3" fill="var(--capy-dd)"/>' +
             '<path d="M11.5 12.2h41" stroke="var(--capy-l)" stroke-width="1" opacity=".3"/>';
    } else if (mood === "sleepy") {
      eyes = '<path d="M12.5 13.5h7M44.5 13.5h7" stroke="var(--capy-dd)" stroke-width="2.2" ' +
             'stroke-linecap="round"/>';
    } else if (mood === "proud") {
      eyes = '<path d="M12.5 15.1q3.5-4 7 0M44.5 15.1q3.5-4 7 0" stroke="var(--capy-dd)" ' +
             'stroke-width="2.1" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<ellipse cx="16" cy="13.5" rx="2.4" ry="2.5" fill="var(--capy-dd)"/>' +
             '<ellipse cx="48" cy="13.5" rx="2.4" ry="2.5" fill="var(--capy-dd)"/>';
    }
    // barrel body, not a ball — a capybara is a rodent built like a footstool
    return '<rect x="7" y="37" width="50" height="24" rx="11" fill="var(--capy)"/>' +
      '<rect x="15" y="51" width="10" height="9" rx="4.5" fill="var(--capy-d)"/>' +
      '<rect x="39" y="51" width="10" height="9" rx="4.5" fill="var(--capy-d)"/>' +
      // tiny ears riding the top edge: eyes, ears and nostrils all sit along the top
      // of the skull, so a swimming capybara keeps the lot above the waterline
      '<ellipse cx="10" cy="8.5" rx="3.2" ry="2.8" fill="var(--capy-d)"/>' +
      '<ellipse cx="54" cy="8.5" rx="3.2" ry="2.8" fill="var(--capy-d)"/>' +
      '<ellipse cx="10" cy="8.8" rx="1.5" ry="1.3" fill="var(--capy-dd)" opacity=".45"/>' +
      '<ellipse cx="54" cy="8.8" rx="1.5" ry="1.3" fill="var(--capy-dd)" opacity=".45"/>' +
      '<rect x="7" y="8" width="50" height="24" rx="5.5" fill="var(--capy)"/>' +
      '<rect x="14" y="19" width="36" height="18" rx="6.5" fill="var(--capy-l)"/>' +
      '<rect x="23.5" y="21.5" width="17" height="8" rx="3.5" fill="var(--capy-dd)"/>' +
      '<ellipse cx="27.5" cy="25.5" rx="1.3" ry="1" fill="var(--capy-l)" opacity=".5"/>' +
      '<ellipse cx="36.5" cy="25.5" rx="1.3" ry="1" fill="var(--capy-l)" opacity=".5"/>' +
      '<path d="M32 30.5v3M26 35q6 3 12 0" stroke="var(--capy-dd)" stroke-width="1.5" ' +
        'fill="none" stroke-linecap="round"/>' + eyes;
  }

  function beeSVG(mood, cls) {
    return '<svg class="mascot ' + (cls || "") + '" viewBox="0 0 68 50" role="img" ' +
      'aria-label="Bea the bee, the pronouncer">' + beeInner(mood) + "</svg>";
  }
  function capySVG(mood, cls) {
    return '<svg class="mascot ' + (cls || "") + '" viewBox="3 3 58 62" role="img" ' +
      'aria-label="Capi the capybara, your study buddy">' + capyInner(mood) + "</svg>";
  }
  /* Capi sitting, Bea perched just above his head — the pair that runs the bee. */
  function duoSVG(beeMood, capyMood) {
    return '<svg class="mascot" viewBox="-2 -4 68 84" role="img" ' +
      'aria-label="Bea the bee hovering just above Capi the capybara">' +
      '<g transform="translate(0,16)">' + capyInner(capyMood) + "</g>" +
      '<g transform="translate(23,-5) scale(.52)">' + beeInner(beeMood) + "</g></svg>";
  }
  function buzz(el) {
    var s = el && el.querySelector(".mascot");
    if (!s) return;
    s.classList.remove("buzz");
    void s.offsetWidth;               // restart the animation
    s.classList.add("buzz");
  }

  var CAPI_LINES = [
    "Tranquilo. One card at a time.",
    "Capybaras never rush. <em>Ni nosotros.</em>",
    "You know more than you think. <em>Sabes más de lo que crees.</em>",
    "A long word is just small pieces. Ses-qui-ped-al-ian.",
    "Missing one is how you learn it. <em>Otra vez.</em>",
    "Breathe. The word is not going anywhere.",
    "Say it, spell it, define it, use it.",
    "Even <em>onomatopoeia</em> is only four sounds."
  ];

  /* ---------------- scoreboard ---------------- */
  function rankOf(xp) {
    var i = 0;
    for (var k = 0; k < RANKS.length; k++) if (xp >= RANKS[k][0]) i = k;
    return i;
  }
  function paintBoard() {
    var ri = rankOf(S.xp);
    var floor = RANKS[ri][0];
    var ceil = ri + 1 < RANKS.length ? RANKS[ri + 1][0] : null;
    $("#s-rank").textContent = RANKS[ri][1];
    $("#s-xp").style.width = (ceil === null ? 100 : Math.min(100, ((S.xp - floor) / (ceil - floor)) * 100)) + "%";
    $("#s-streak").textContent = streak;
    $("#s-mast").textContent = masteredCount();
  }

  function award(id) {
    if (S.badges.indexOf(id) > -1) return;
    S.badges.push(id); save();
    var b = BADGES.filter(function (x) { return x.id === id; })[0];
    if (b) toast(b.ic + "  Honor unlocked — " + b.t);
    paintBadges();
  }
  function checkBadges() {
    if (S.clean >= 20) award("clean20");
    var seen = {}, allGreek = true, done = 0;
    WORDS.forEach(function (w) {
      var p = S.p[w.w];
      if (p && p.r > 0) { seen[w.org] = 1; }
      if (w.org === "Greek" && !(p && p.r > 0)) allGreek = false;
      if (state(w.w) === "mastered") done++;
    });
    if (Object.keys(seen).length >= 9) award("poly");
    if (allGreek) award("greek");
    if (done >= 100) award("c100");
    if (done >= 150) award("all");
  }

  /* ---------------- dashboard ---------------- */
  function beeSay(mood, line) {
    var av = $("#bee-av");
    if (!av) return;
    av.innerHTML = beeSVG(mood);
    $("#bee-says").innerHTML = line;
    buzz(av);
  }

  function paintDash() {
    var n = masteredCount();
    // Capi loosens up as you master more of the list
    var capyMood = n >= 100 ? "zen" : n >= 25 ? "proud" : "calm";
    $("#hero-duo").innerHTML = duoSVG(n ? "happy" : "calm", capyMood) +
      "<figcaption><b>Bea &amp; Capi</b><span>la abeja y el carpincho</span></figcaption>";
    var C = 2 * Math.PI * 41;
    $("#ring-p").setAttribute("stroke-dashoffset", String(C - (n / 150) * C));
    $("#ring-n").textContent = n;

    var started = WORDS.filter(function (w) { return state(w.w); }).length;
    var weak = WORDS.filter(function (w) { return S.p[w.w] && S.p[w.w].x > 0 && state(w.w) !== "mastered"; }).length;
    if (!started) {
      $("#dash-line1").textContent = "Nothing mastered yet.";
      $("#dash-line2").textContent = "A word counts as mastered after three clean spellings.";
    } else {
      $("#dash-line1").textContent = n + " mastered · " + (started - n) + " in progress";
      $("#dash-line2").textContent = weak
        ? weak + " word" + (weak === 1 ? "" : "s") + " you have missed at least once. Best streak: " + S.best + "."
        : "No outstanding misses. Best streak: " + S.best + ".";
    }
    $("#go-weak").disabled = !weak;

    var L = ["Basic", "Intermediate", "Advanced"];
    var sub = {
      Basic: "Everyday patterns",
      Intermediate: "Silent letters and doubles",
      Advanced: "Greek, Latin and showmanship"
    };
    $("#levels").innerHTML = L.map(function (lv, i) {
      var set = WORDS.filter(function (w) { return w.lvl === lv; });
      var m = set.filter(function (w) { return state(w.w) === "mastered"; }).length;
      return '<button class="lvl" data-lvl="' + lv + '">' +
        '<span class="lvl-n">' + (i + 1) + '</span>' +
        '<span><span class="lvl-t">' + lv + '</span>' +
        '<span class="lvl-s"> · ' + set.length + ' words</span>' +
        '<span class="lvl-meter"><i style="width:' + ((m / set.length) * 100) + '%"></i></span></span>' +
        '<span class="lvl-c">' + m + "/" + set.length + "</span></button>";
    }).join("");
    $$(".lvl").forEach(function (b) {
      b.addEventListener("click", function () { startRound("practice", b.dataset.lvl); });
    });

    var ri = rankOf(S.xp);
    $("#ladder").innerHTML = RANKS.map(function (r, i) {
      var cls = i < ri ? "done" : i === ri ? "now" : "";
      return '<div class="rung ' + cls + '"><i></i>' + r[1] +
        "<u>" + (i === ri ? S.xp + " xp" : r[0] + " xp") + "</u></div>";
    }).join("");

    paintBadges();
  }
  function paintBadges() {
    $("#badges").innerHTML = BADGES.map(function (b) {
      var got = S.badges.indexOf(b.id) > -1;
      return '<div class="badge' + (got ? " got" : "") + '" title="' + esc(b.t + " — " + b.d) + '">' + b.ic + "</div>";
    }).join("");
  }

  /* ---------------- the round ---------------- */
  var R = null;

  function pickQueue(mode, lvl) {
    var pool = WORDS.slice();
    if (lvl) pool = pool.filter(function (w) { return w.lvl === lvl; });
    if (mode === "weak") {
      pool = pool.filter(function (w) { return S.p[w.w] && S.p[w.w].x > 0 && state(w.w) !== "mastered"; });
      return shuffle(pool).slice(0, 12);
    }
    if (mode === "champ") {
      var by = function (l) { return shuffle(WORDS.filter(function (w) { return w.lvl === l; })); };
      return by("Basic").slice(0, 4).concat(by("Intermediate").slice(0, 4), by("Advanced").slice(0, 4));
    }
    var fresh = shuffle(pool.filter(function (w) { return state(w.w) !== "mastered"; }));
    var rest = shuffle(pool.filter(function (w) { return state(w.w) === "mastered"; }));
    return fresh.concat(rest).slice(0, 10);
  }

  function startRound(mode, lvl) {
    var q = pickQueue(mode, lvl);
    if (!q.length) { toast("No words left in that set — try another."); return; }
    R = { q: q, i: 0, mode: mode, lives: 3, hints: {}, answered: false, pts: 0, right: 0 };
    $("#bee-idle").hidden = true;
    $("#bee-live").hidden = false;
    $("#speech-warn").innerHTML = SPEAK ? "" :
      '<div class="nospeech"><b>This browser will not speak.</b> The word is shown instead of ' +
      "pronounced, so you can still study — but try Chrome, Edge or Safari for the real bee.</div>";
    showWord();
  }

  function cur() { return R.q[R.i]; }

  function showWord() {
    var w = cur();
    R.answered = false; R.hints = {};
    $("#r-num").textContent = String(w.n).padStart(3, "0");
    var chip = $("#r-lvl"); chip.textContent = w.lvl; chip.className = "chip " + LVLCLASS[w.lvl];
    $("#r-mode").textContent =
      (R.mode === "champ" ? "Championship" : R.mode === "weak" ? "Drilling misses" : "Practice") +
      " · word " + (R.i + 1) + " of " + R.q.length;
    $("#r-hearts").innerHTML = R.mode === "champ"
      ? [0, 1, 2].map(function (i) { return '<u class="' + (i < R.lives ? "on" : "") + '">♥</u>'; }).join("")
      : "";

    // the word is heard, not seen
    var hide = $("#r-word");
    if (SPEAK) { hide.className = "mic hidden-word"; hide.textContent = w.w.replace(/./g, "• ").trim(); }
    else { hide.className = "mic"; hide.textContent = w.w; }
    $("#r-ipa").textContent = SPEAK ? " " : w.ipa;
    $("#r-rows").innerHTML = "";
    $("#r-result").innerHTML = "";
    micStop();
    setHeard(CAN_HEAR ? "" : "");
    $$(".ask").forEach(function (b) { b.classList.remove("used"); });
    var inp = $("#r-input");
    inp.value = ""; inp.disabled = false; $("#r-submit").disabled = false;
    inp.focus();
    beeSay("calm", streak >= 5
      ? "<b>" + streak + " in a row.</b> Keep your nerve — here is the next one."
      : "Here is your word. Ask me for anything you need.");
    say(w.w, 0.85);
  }

  function addRow(key, val, cls) {
    var d = document.createElement("div");
    d.className = "ic-row " + (cls || "");
    d.innerHTML = '<span class="k">' + esc(key) + '</span><span class="v">' + val + "</span>";
    $("#r-rows").appendChild(d);
  }

  function doAsk(kind) {
    if (!R) return;
    var w = cur();
    var btn = $$('.ask').filter(function (b) { return b.dataset.ask === kind; })[0];
    if (kind === "again") { say(w.w, 0.85); return; }
    if (kind === "slow") { say(w.w, 0.45); return; }
    if (btn) btn.classList.add("used");
    if (R.hints[kind]) { // already shown: just repeat the audio
      if (kind === "def") say(w.def, 0.92);
      if (kind === "sent") say(w.ex, 0.92);
      if (kind === "org") say("From the " + w.org, 0.92);
      return;
    }
    R.hints[kind] = 1;
    if (kind === "def") { addRow("Definition", esc(mask(w.def, w.w))); say(w.def, 0.92); }
    if (kind === "sent") { addRow("In a sentence", "<em>" + esc(mask(w.ex, w.w)) + "</em>"); say(w.ex, 0.92); }
    if (kind === "org") { addRow("Origin", esc(w.org)); say("From the " + w.org, 0.92); }
  }

  function lcsMark(guess, ans) {
    var a = guess.toLowerCase(), b = ans.toLowerCase();
    var m = a.length, n = b.length, i, j;
    var dp = [];
    for (i = 0; i <= m; i++) dp.push(new Uint16Array(n + 1));
    for (i = m - 1; i >= 0; i--)
      for (j = n - 1; j >= 0; j--)
        dp[i][j] = a.charAt(i) === b.charAt(j) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    i = 0; j = 0;
    var out = "";
    while (j < n) {
      if (i < m && a.charAt(i) === b.charAt(j)) { out += esc(ans.charAt(j)); i++; j++; }
      else if (i < m && dp[i + 1][j] >= dp[i][j + 1]) { i++; }
      else { out += "<s>" + esc(ans.charAt(j)) + "</s>"; j++; }
    }
    return out;
  }

  function teachHTML(w) {
    var h = '<div class="teach">';
    h += "<div><span class='tag'>Etymology</span>" + esc(w.ety) + "</div>";
    h += "<div><span class='tag'>Trivia</span>" + esc(w.triv) + "</div>";
    h += "<div><span class='tag'>The trap</span><b>" + esc(w.trap) + "</b></div>";
    if (w.esn) h += "<div class='esn'><span class='tag'>Para ti</span>" + esc(w.esn) + "</div>";
    return h + "</div>";
  }

  function submit() {
    if (!R || R.answered) return;
    var w = cur(), guess = $("#r-input").value.trim();
    if (!guess) return;
    R.answered = true;
    $("#r-input").disabled = true; $("#r-submit").disabled = true;

    var ok = guess.toLowerCase() === w.w.toLowerCase();
    var clean = ok && !R.hints.def && !R.hints.sent && !R.hints.org;
    var p = prog(w.w);
    var pts = 0;

    $("#r-word").className = "mic"; $("#r-word").textContent = w.w;
    $("#r-ipa").textContent = w.ipa;
    addRow("Español", esc(w.es), "es");

    if (ok) {
      streak++; p.r++; if (clean) { p.c++; S.clean++; }
      p.box = Math.min(5, p.box + 1);
      if (streak > S.best) S.best = streak;
      var mult = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
      pts = BASE[w.lvl] * mult + (clean ? Math.round(BASE[w.lvl] * mult * 0.5) : 0);
      S.xp += pts; R.pts += pts; R.right++;
      award("first");
      if (streak >= 5) award("s5");
      if (streak >= 10) award("s10");
      if (w.w === "sesquipedalian") award("sesqui");
      beeSay("happy", clean
        ? "<b>Perfect.</b> No help needed at all."
        : streak >= 5 ? "<b>That is " + streak + " in a row.</b> Capi is impressed."
        : "<b>Correct.</b> Nicely done.");
      $("#r-result").innerHTML =
        '<div class="verdict good"><div class="v-head">Correct' +
        (clean ? " — clean solve" : "") +
        '<span class="v-pts">+' + pts + " xp" + (mult > 1 ? " · ×" + mult + " streak" : "") + "</span></div>" +
        teachHTML(w) + "</div>";
    } else {
      streak = 0; p.x++; p.box = 1;
      if (R.mode === "champ") R.lives--;
      beeSay("oops", "<b>Not this time.</b> Look at the letters you missed, then read the trap.");
      $("#r-result").innerHTML =
        '<div class="verdict bad"><div class="v-head">Not quite' +
        '<span class="v-pts">streak reset</span></div>' +
        '<div class="spellout">' + lcsMark(guess, w.w) + "</div>" +
        '<div class="yours">You wrote <code>' + esc(guess) + "</code>" +
        (guess.length !== w.w.length ? " · " + guess.length + " letters, not " + w.w.length : "") +
        "</div>" + teachHTML(w) + "</div>";
      $("#r-hearts").innerHTML = R.mode === "champ"
        ? [0, 1, 2].map(function (i) { return '<u class="' + (i < R.lives ? "on" : "") + '">♥</u>'; }).join("")
        : "";
    }

    save(); paintBoard(); checkBadges();

    var bar = document.createElement("div");
    bar.className = "audiorow";
    bar.innerHTML =
      '<button class="btn sm" data-a="hear">🔊 Hear it</button>' +
      '<button class="btn sm" data-a="spell">🔤 Spell it aloud</button>' +
      '<button class="btn sm" data-a="sent">💬 Sentence</button>' +
      '<button class="btn primary sm" data-a="next" style="margin-left:auto">' +
      (R.i + 1 >= R.q.length || (R.mode === "champ" && R.lives <= 0) ? "See results" : "Next word →") +
      "</button>";
    $("#r-result").appendChild(bar);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.a === "hear") say(w.w, 0.85);
      if (b.dataset.a === "spell") spellAloud(w.w);
      if (b.dataset.a === "sent") say(w.ex, 0.92);
      if (b.dataset.a === "next") advance();
    });
    $$('[data-a="next"]')[0].focus();
  }

  function advance() {
    if (R.mode === "champ" && R.lives <= 0) return finish("eliminated");
    R.i++;
    if (R.i >= R.q.length) return finish("complete");
    showWord();
  }

  function finish(how) {
    if (R.mode === "champ" && how === "complete" && R.lives === 3) award("flaw");
    var msg = how === "eliminated"
      ? "Eliminated — the bell rings."
      : "Round complete.";
    var ratio = R.right / R.q.length;
    var duoMood = how === "eliminated" ? ["oops", "calm"]
      : ratio === 1 ? ["happy", "zen"] : ratio >= 0.6 ? ["happy", "proud"] : ["calm", "calm"];
    $("#r-result").innerHTML =
      '<div class="verdict ' + (how === "eliminated" ? "bad" : "good") + '">' +
      '<div class="v-head">' + msg + '<span class="v-pts">+' + R.pts + " xp</span></div>" +
      '<div class="teach"><div><b>' + R.right + " of " + R.q.length + " correct.</b> " +
      (how === "eliminated"
        ? "In a real bee that is the end of your run. Here you simply start again."
        : "Every word you missed is waiting in <b>Drill my misses</b>.") +
      "</div></div>" +
      '<figure class="duo mini">' + duoSVG(duoMood[0], duoMood[1]) +
      "<figcaption><span>" +
      (how === "eliminated" ? "Capi is unbothered. Go again."
        : ratio === 1 ? "Capi did not doubt you for a second."
        : "Bea will read them out again whenever you like.") +
      "</span></figcaption></figure></div>";
    var b = document.createElement("div");
    b.className = "audiorow";
    b.innerHTML = '<button class="btn primary sm" id="again-btn">Back to the desk</button>';
    $("#r-result").appendChild(b);
    $("#again-btn").addEventListener("click", quit);
    $("#r-word").className = "mic"; $("#r-word").textContent = how === "eliminated" ? "Eliminated" : "Round over";
    $("#r-ipa").textContent = " "; $("#r-rows").innerHTML = "";
    $("#r-input").disabled = true; $("#r-submit").disabled = true;
    save(); paintBoard();
  }

  function quit() {
    if (SPEAK) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    micStop();
    R = null;
    $("#bee-live").hidden = true;
    $("#bee-idle").hidden = false;
    paintDash(); paintBoard(); paintLedger();
  }

  /* ---------------- study ledger ---------------- */
  var filter = "all", query = "", openWord = null;

  function cardHTML(w) {
    var rows = [
      ["Español", esc(w.es), "es"],
      ["Definition", esc(w.def), ""],
      ["In a sentence", "<em>" + esc(w.ex) + "</em>", ""],
      ["Origin", esc(w.org), ""],
      ["Etymology", esc(w.ety), ""],
      ["Trivia", esc(w.triv), ""],
      ["The trap", "<b>" + esc(w.trap) + "</b>", ""]
    ];
    if (w.esn) rows.push(["Para ti", esc(w.esn), ""]);
    return '<div class="indexcard">' +
      '<div class="ic-top"><span class="ic-label">Word ' + String(w.n).padStart(3, "0") +
      " · " + esc(w.lvl) + '</span></div>' +
      '<div class="mic">' + esc(w.w) + "</div>" +
      '<div class="ipa">' + esc(w.ipa) + "</div>" +
      '<div class="ic-rows">' + rows.map(function (r) {
        return '<div class="ic-row ' + r[2] + '"><span class="k">' + r[0] +
          '</span><span class="v">' + r[1] + "</span></div>";
      }).join("") + "</div></div>" +
      '<div class="audiorow">' +
      '<button class="btn sm" data-s="hear">🔊 Hear it</button>' +
      '<button class="btn sm" data-s="slow">🐢 Slowly</button>' +
      '<button class="btn sm" data-s="spell">🔤 Spell it aloud</button>' +
      '<button class="btn sm" data-s="sent">💬 Sentence</button>' +
      (CAN_HEAR ? '<button class="btn sm micbtn" data-s="mine" id="say-btn">🎙 Your turn</button>' : "") +
      '</div><p class="heard" id="study-heard"></p>';
  }

  function visible() {
    var q = query.toLowerCase();
    return WORDS.filter(function (w) {
      if (filter === "star" && !(S.p[w.w] && S.p[w.w].star)) return false;
      if (filter === "weak" && !(S.p[w.w] && S.p[w.w].x > 0)) return false;
      if (filter !== "all" && filter !== "star" && filter !== "weak" && w.lvl !== filter) return false;
      if (!q) return true;
      return (w.w + " " + w.es + " " + w.def + " " + w.org).toLowerCase().indexOf(q) > -1;
    });
  }

  function paintLedger() {
    stopListening(); sayBusy = false;
    var list = visible();
    $("#q-count").textContent = list.length + " of 150";
    $("#ledger").innerHTML = list.map(function (w) {
      var st = state(w.w);
      var starred = S.p[w.w] && S.p[w.w].star;
      return '<button class="row" data-w="' + esc(w.w) + '">' +
        '<span class="row-n">' + String(w.n).padStart(3, "0") + "</span>" +
        '<span><span class="row-w">' + esc(w.w) + "</span> " +
        '<span class="row-es">' + esc(w.es) + "</span></span>" +
        '<span class="row-r"><span class="chip ' + LVLCLASS[w.lvl] + '">' + w.lvl.slice(0, 3) + "</span>" +
        '<span class="dot ' + st + '" title="' + (st || "not started") + '"></span>' +
        '<span class="star' + (starred ? " on" : "") + '" data-star="' + esc(w.w) + '" role="img" ' +
        'aria-label="star">★</span></span></button>' +
        (openWord === w.w ? '<div class="detail">' + cardHTML(w) + "</div>" : "");
    }).join("") || '<div style="padding:26px;text-align:center;color:var(--muted)">No words match.</div>';
  }

  /* --- pronunciation practice: say the word, see whether it came through --- */
  var sayBusy = false;
  function sayItCheck(w, btn) {
    var out = $("#study-heard");
    if (sayBusy) { stopListening(); sayBusy = false; btn.classList.remove("listening"); return; }
    sayBusy = true;
    btn.classList.add("listening");
    btn.textContent = "● Listening…";
    if (out) { out.className = "heard"; out.innerHTML = "Say <b>" + esc(w.w) + "</b> out loud."; }
    var done = function () {
      sayBusy = false; btn.classList.remove("listening"); btn.textContent = "🎙 Your turn";
    };
    listen({
      onHear: function (t) {
        if (out) out.innerHTML = "Hearing <span class='raw'>“" + esc(t) + "”</span>…";
      },
      onDone: function (t) {
        done();
        if (!out) return;
        if (!t) { out.className = "heard err";
          out.innerHTML = "Nothing came through — check that this page may use your microphone.";
          return; }
        if (soundsLike(t, w.w)) {
          out.className = "heard ok";
          out.innerHTML = "Clear as a bell — that came through as <b>" + esc(w.w) + "</b>.";
        } else {
          out.className = "heard err";
          out.innerHTML = "It came through as <span class='raw'>“" + esc(t) + "”</span>. " +
            "Listen once more, then try the stressed syllable again: " + esc(w.ipa);
        }
      },
      onError: function (err) {
        done();
        if (!out) return;
        out.className = "heard err";
        out.innerHTML = err === "unsupported"
          ? "This browser cannot listen. Chrome, Edge or Safari can."
          : (ERRS[err] !== undefined ? ERRS[err] : "Listening failed (" + err + ").");
      }
    });
  }

  $("#ledger").addEventListener("click", function (e) {
    var st = e.target.closest("[data-star]");
    if (st) {
      e.stopPropagation();
      var p = prog(st.dataset.star); p.star = p.star ? 0 : 1; save(); paintLedger();
      return;
    }
    var snd = e.target.closest("[data-s]");
    if (snd) {
      var w0 = WORDS.filter(function (x) { return x.w === openWord; })[0];
      if (!w0) return;
      if (snd.dataset.s === "hear") say(w0.w, 0.85);
      if (snd.dataset.s === "slow") say(w0.w, 0.45);
      if (snd.dataset.s === "spell") spellAloud(w0.w);
      if (snd.dataset.s === "sent") say(w0.ex, 0.92);
      if (snd.dataset.s === "mine") sayItCheck(w0, snd);
      return;
    }
    var row = e.target.closest("[data-w]");
    if (row) { openWord = openWord === row.dataset.w ? null : row.dataset.w; paintLedger(); }
  });
  $("#q").addEventListener("input", function (e) { query = e.target.value; paintLedger(); });
  $$('.filters [data-f]').forEach(function (b) {
    b.addEventListener("click", function () {
      filter = b.dataset.f;
      $$('.filters [data-f]').forEach(function (x) {
        x.setAttribute("aria-pressed", String(x === b));
      });
      paintLedger();
    });
  });

  /* ---------------- flashcards ---------------- */
  var dir = "en-es", fcWord = null, fcFlipped = false, capiFor = null;

  function fcPick() {
    var pool = WORDS.filter(function (w) { return (S.p[w.w] ? S.p[w.w].box : 1) < 5; });
    if (!pool.length) pool = WORDS.slice();
    var weights = pool.map(function (w) { return 6 - (S.p[w.w] ? S.p[w.w].box : 1); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  function paintCard() {
    if (!fcWord) fcWord = fcPick();
    var w = fcWord, f = $("#fc-face");
    if (!fcFlipped) {
      var front = dir === "es-en" ? esc(w.es) : dir === "def-en" ? esc(w.def) : esc(w.w);
      f.innerHTML = '<span class="fc-hint">' +
        (dir === "es-en" ? "Español" : dir === "def-en" ? "Definition" : "English") + "</span>" +
        '<span class="big">' + front + "</span>" +
        (dir === "en-es" ? '<span class="ipa">' + esc(w.ipa) + "</span>" : "") +
        '<span class="fc-hint">Click to flip</span>';
    } else {
      var back = dir === "en-es"
        ? '<span class="big">' + esc(w.es) + "</span><span class='sub'>" + esc(w.def) + "</span>"
        : '<span class="big">' + esc(w.w) + '</span><span class="ipa">' + esc(w.ipa) +
          "</span><span class='sub'>" + esc(w.trap) + "</span>";
      f.innerHTML = '<span class="fc-hint">Box ' + (S.p[w.w] ? S.p[w.w].box : 1) + "</span>" + back;
    }
    $("#fc-ctl").innerHTML = fcFlipped
      ? '<button class="btn" data-g="0">Again · back to box 1</button>' +
        '<button class="btn primary" data-g="1">I knew it →</button>' +
        '<button class="btn ghost" data-g="s">🔊</button>'
      : '<button class="btn ghost" data-g="s">🔊 Hear it</button>' +
        '<button class="btn" data-g="f">Flip</button>';
    var retired = WORDS.filter(function (x) { return S.p[x.w] && S.p[x.w].box >= 5; }).length;
    $("#capy-av").innerHTML = capySVG(retired >= 50 ? "zen" : "calm");
    if (capiFor !== w.w) {            // a new line per card, not per flip
      capiFor = w.w;
      $("#capy-says").innerHTML = CAPI_LINES[Math.floor(Math.random() * CAPI_LINES.length)];
    }

    var counts = [0, 0, 0, 0, 0];
    WORDS.forEach(function (x) { counts[(S.p[x.w] ? S.p[x.w].box : 1) - 1]++; });
    var at = (S.p[w.w] ? S.p[w.w].box : 1) - 1;
    $("#fc-boxes").innerHTML = counts.map(function (c, i) {
      return '<div class="box' + (i === at ? " at" : "") + '"><b>' + c + "</b>Box " + (i + 1) + "</div>";
    }).join("");
  }

  $("#fc-face").addEventListener("click", function () { fcFlipped = !fcFlipped; paintCard(); });
  $("#fc-ctl").addEventListener("click", function (e) {
    var b = e.target.closest("[data-g]"); if (!b) return;
    var g = b.dataset.g;
    if (g === "s") { say(fcWord.w, 0.85); return; }
    if (g === "f") { fcFlipped = true; paintCard(); return; }
    var p = prog(fcWord.w);
    p.box = g === "1" ? Math.min(5, p.box + 1) : 1;
    save();
    fcWord = fcPick(); fcFlipped = false; paintCard();
  });
  $$('.filters [data-dir]').forEach(function (b) {
    b.addEventListener("click", function () {
      dir = b.dataset.dir;
      $$('.filters [data-dir]').forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      fcFlipped = false; paintCard();
    });
  });

  /* ---------------- origins quiz ---------------- */
  var ORIGINS = WORDS.reduce(function (a, w) { if (a.indexOf(w.org) < 0) a.push(w.org); return a; }, []).sort();
  var oWord = null;

  function paintOrigin() {
    oWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    $("#o-word").textContent = oWord.w;
    $("#o-ipa").textContent = oWord.ipa;
    $("#o-after").innerHTML = "";
    var wrong = shuffle(ORIGINS.filter(function (o) { return o !== oWord.org; })).slice(0, 3);
    var opts = shuffle(wrong.concat([oWord.org]));
    $("#o-opts").innerHTML = opts.map(function (o) {
      return '<button class="opt" data-o="' + esc(o) + '">' + esc(o) + "</button>";
    }).join("");
    var counts = {};
    WORDS.forEach(function (w) { counts[w.org] = (counts[w.org] || 0) + 1; });
    $("#o-map").innerHTML = ORIGINS.map(function (o) {
      return '<span class="maptag">' + esc(o) + " <b>" + counts[o] + "</b></span>";
    }).join("");
  }

  $("#o-opts").addEventListener("click", function (e) {
    var b = e.target.closest("[data-o]"); if (!b || b.disabled) return;
    var ok = b.dataset.o === oWord.org;
    $$("#o-opts .opt").forEach(function (x) {
      x.disabled = true;
      if (x.dataset.o === oWord.org) x.classList.add("right");
      else if (x === b) x.classList.add("wrong");
    });
    if (ok) { S.xp += 8; save(); paintBoard(); }
    $("#o-after").innerHTML =
      '<div class="verdict ' + (ok ? "good" : "bad") + '" style="text-align:left">' +
      '<div class="v-head">' + (ok ? "Yes — " : "No — ") + esc(oWord.org) +
      '<span class="v-pts">' + (ok ? "+8 xp" : "") + "</span></div>" +
      '<div class="teach"><div><span class="tag">Etymology</span>' + esc(oWord.ety) + "</div>" +
      '<div><span class="tag">Trivia</span>' + esc(oWord.triv) + "</div></div></div>" +
      '<button class="btn primary" id="o-next" style="margin-top:14px">Next word →</button>';
    $("#o-next").addEventListener("click", paintOrigin);
    $("#o-next").focus();
  });

  /* ---------------- anki ---------------- */
  function ankiText() {
    var clean = function (s) { return String(s).replace(/[\t\r\n]+/g, " ").trim(); };
    var lines = WORDS.map(function (w) {
      var notes = "<b>" + clean(w.trap) + "</b><br><br>" +
        clean(w.ety) + "<br><br><i>" + clean(w.triv) + "</i>" +
        (w.esn ? "<br><br>" + clean(w.esn) : "");
      var tags = w.lvl.toLowerCase() + " " + w.org.toLowerCase().replace(/\s+/g, "-") + " spelling-bee";
      return [clean(w.w), clean(w.ipa), clean(w.es), clean(w.def),
              clean(w.ex).replace(new RegExp("\\b" + w.w + "\\b", "i"), "<b>" + w.w + "</b>"),
              notes, tags].join("\t");
    });
    return "#separator:tab\n#html:true\n#tags column:7\n" + lines.join("\n");
  }
  $("#anki-copy").addEventListener("click", function () {
    var t = $("#anki-out");
    t.select(); t.setSelectionRange(0, t.value.length);
    var done = false;
    try { done = document.execCommand("copy"); } catch (e) { done = false; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t.value).then(function () {
        toast("All 150 notes copied. Paste into a .txt file and import.");
      }, function () {
        toast(done ? "All 150 notes copied." : "Press Ctrl+C to copy the selected text.");
      });
    } else {
      toast(done ? "All 150 notes copied." : "Press Ctrl+C to copy the selected text.");
    }
  });
  $("#anki-select").addEventListener("click", function () {
    var t = $("#anki-out"); t.focus(); t.select(); t.setSelectionRange(0, t.value.length);
    toast("Selected — now press Ctrl+C (or ⌘C).");
  });

  /* ---------------- chrome ---------------- */
  $$(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      $$(".tab").forEach(function (x) { x.setAttribute("aria-selected", String(x === t)); });
      $$(".view").forEach(function (v) { v.hidden = v.id !== "view-" + t.dataset.view; });
      if (t.dataset.view === "cards") paintCard();
      if (t.dataset.view === "origin" && !oWord) paintOrigin();
      if (SPEAK) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
      micStop(); stopListening(); sayBusy = false;
    });
  });

  $$(".ask").forEach(function (b) {
    b.addEventListener("click", function () { doAsk(b.dataset.ask); });
  });
  /* --- spell aloud: fills the box, never auto-submits, so you can fix a mishear --- */
  var micBtn = $("#r-mic"), heardEl = $("#r-heard"), listening = false;
  if (CAN_HEAR) micBtn.hidden = false;

  function setHeard(msg, cls) {
    heardEl.className = "heard" + (cls ? " " + cls : "");
    heardEl.innerHTML = msg;
  }
  function endMic() {
    listening = false;
    micBtn.classList.remove("listening");
    micBtn.textContent = "🎙 Spell aloud";
  }
  function micStop() { stopListening(); endMic(); }

  micBtn.addEventListener("click", function () {
    if (listening) { micStop(); return; }
    if (!R || R.answered) return;
    var target = cur().w;
    listening = true;
    micBtn.classList.add("listening");
    micBtn.textContent = "● Listening — tap to stop";
    setHeard("Say the letters: <span class='raw'>“ess — ee — pea — ay — ar — ay — tee — ee”</span>");
    listen({
      onHear: function (text) {
        var guess = decodeSpelling(text, target);
        $("#r-input").value = guess;
        setHeard("Heard <span class='raw'>“" + esc(text) + "”</span> → <b>" +
          esc(guess.toUpperCase()) + "</b>");
      },
      onDone: function (text) {
        endMic();
        if (!text) { setHeard("Nothing came through. Try again, or check that this page is "
          + "allowed to use your microphone — typing always works.", "err"); return; }
        var guess = decodeSpelling(text, target);
        $("#r-input").value = guess;
        $("#r-input").focus();
        setHeard("Heard <span class='raw'>“" + esc(text) + "”</span> → <b>" +
          esc(guess.toUpperCase()) + "</b> · check it, then press Enter");
      },
      onError: function (err) {
        endMic();
        var m = err === "unsupported"
          ? "This browser cannot listen. Chrome, Edge or Safari can."
          : (ERRS[err] !== undefined ? ERRS[err] : "Listening failed (" + err + ").");
        if (m) setHeard(m, "err");
      }
    });
  });

  $("#r-submit").addEventListener("click", function () { micStop(); submit(); });
  $("#r-input").addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
  $("#r-quit").addEventListener("click", quit);
  $("#go-practice").addEventListener("click", function () { startRound("practice", null); });
  $("#go-champ").addEventListener("click", function () { startRound("champ", null); });
  $("#go-weak").addEventListener("click", function () { startRound("weak", null); });

  document.addEventListener("keydown", function (e) {
    if (!R || R.answered || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "r" || e.key === "R") doAsk("again");
  });

  var themeBtn = $("#themebtn");
  try {
    var saved = localStorage.getItem("pd.theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  } catch (e) { /* ignore */ }
  themeBtn.addEventListener("click", function () {
    var now = document.documentElement.getAttribute("data-theme");
    var isDark = now ? now === "dark"
      : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("pd.theme", next); } catch (e2) { /* ignore */ }
  });

  /* ---------------- boot ---------------- */
  $("#anki-out").value = ankiText();
  paintBoard(); paintDash(); paintLedger(); paintCard();
})();
