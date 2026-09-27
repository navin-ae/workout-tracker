/* =========================================================================
   Strongr — Track. Progress. Repeat.
   Designed by Navin.
   Vanilla JS, no dependencies, LocalStorage only.

   Data model note: a workout entry holds an ARRAY OF SETS, because nobody
   lifts the same load three times in a row. 55x12, 60x10, 60x8 is one
   exercise, three different sets. Warm-up sets are flagged and excluded
   from volume, records and progression.

   Module map
     1  Configuration      splits, exercise library, cardio
     2  Utilities          dom, dates, numbers, icons
     3  Store              load / migrate / save
     4  Derivations        history, records, e1RM, streaks, insights
     5  Sheets             number pad, exercise picker, exercise menu
     6  Rest timer
     7  Screens
     8  Router & events
     9  Sample data
   ========================================================================= */

(function () {
  'use strict';

  /* =======================================================================
     1. Configuration
     ======================================================================= */

  var SPLITS = [
    { id: 'back',     name: 'Back + Biceps',   hue: 'blue' },
    { id: 'chest',    name: 'Chest + Triceps', hue: 'red' },
    { id: 'shoulder', name: 'Shoulder + Abs',  hue: 'yellow' },
    { id: 'legs',     name: 'Leg Day',         hue: 'green' }
  ];
  var SPLIT_BY_ID = {};
  SPLITS.forEach(function (s) { SPLIT_BY_ID[s.id] = s; });

  var DEFAULT_PLAN = {
    back: ['Lat Pulldown', 'Seated Cable Row', 'Incline Dumbbell Curl',
      'Cable Curl', 'Preacher Curl'],
    chest: ['Flat Dumbbell Press', 'Incline Dumbbell Press', 'Pec Deck',
      'Triceps Rope Pushdown', 'Overhead Dumbbell Extension',
      'Reverse Pushdown', 'Dips'],
    shoulder: ['Dumbbell Shoulder Press', 'Lateral Raise', 'Reverse Pec Deck',
      'Face Pull', 'Captain Chair Leg Raise', 'Machine Crunch', 'Plank'],
    legs: ['Squat', 'Leg Press', 'Leg Extension', 'Leg Curl',
      'Romanian Deadlift', 'Walking Lunges', 'Standing Calf Raise']
  };

  /* type:  weight     — loaded, the weight field is the load
            bodyweight — the weight field is ADDED load, often 0
            time       — the reps field is seconds, no load
     rest:  seconds. Compounds need longer; isolation doesn't.            */
  var DEFAULT_LIBRARY = {
    'Lat Pulldown':                { type: 'weight',     rest: 90,  group: 'Back' },
    'Seated Cable Row':            { type: 'weight',     rest: 90,  group: 'Back' },
    'Barbell Row':                 { type: 'weight',     rest: 120, group: 'Back' },
    'Chin Up':                     { type: 'bodyweight', rest: 120, group: 'Back' },
    'Straight Arm Pulldown':       { type: 'weight',     rest: 60,  group: 'Back' },
    'Incline Dumbbell Curl':       { type: 'weight',     rest: 60,  group: 'Biceps' },
    'Cable Curl':                  { type: 'weight',     rest: 60,  group: 'Biceps' },
    'Preacher Curl':               { type: 'weight',     rest: 60,  group: 'Biceps' },
    'Hammer Curl':                 { type: 'weight',     rest: 60,  group: 'Biceps' },

    'Flat Dumbbell Press':         { type: 'weight',     rest: 120, group: 'Chest' },
    'Incline Dumbbell Press':      { type: 'weight',     rest: 120, group: 'Chest' },
    'Barbell Bench Press':         { type: 'weight',     rest: 150, group: 'Chest' },
    'Incline Barbell Press':       { type: 'weight',     rest: 150, group: 'Chest' },
    'Pec Deck':                    { type: 'weight',     rest: 75,  group: 'Chest' },
    'Cable Crossover':             { type: 'weight',     rest: 60,  group: 'Chest' },
    'Triceps Rope Pushdown':       { type: 'weight',     rest: 60,  group: 'Triceps' },
    'Overhead Dumbbell Extension': { type: 'weight',     rest: 60,  group: 'Triceps' },
    'Reverse Pushdown':            { type: 'weight',     rest: 60,  group: 'Triceps' },
    'Close Grip Bench Press':      { type: 'weight',     rest: 120, group: 'Triceps' },
    'Skull Crusher':               { type: 'weight',     rest: 75,  group: 'Triceps' },
    'Dips':                        { type: 'bodyweight', rest: 90,  group: 'Triceps' },

    'Dumbbell Shoulder Press':     { type: 'weight',     rest: 120, group: 'Shoulders' },
    'Arnold Press':                { type: 'weight',     rest: 120, group: 'Shoulders' },
    'Lateral Raise':               { type: 'weight',     rest: 60,  group: 'Shoulders' },
    'Cable Lateral Raise':         { type: 'weight',     rest: 60,  group: 'Shoulders' },
    'Reverse Pec Deck':            { type: 'weight',     rest: 60,  group: 'Shoulders' },
    'Face Pull':                   { type: 'weight',     rest: 60,  group: 'Shoulders' },
    'Shrug':                       { type: 'weight',     rest: 75,  group: 'Shoulders' },
    'Captain Chair Leg Raise':     { type: 'bodyweight', rest: 60,  group: 'Abs' },
    'Hanging Leg Raise':           { type: 'bodyweight', rest: 60,  group: 'Abs' },
    'Machine Crunch':              { type: 'weight',     rest: 60,  group: 'Abs' },
    'Cable Crunch':                { type: 'weight',     rest: 60,  group: 'Abs' },
    'Plank':                       { type: 'time',       rest: 60,  group: 'Abs' },

    'Squat':                       { type: 'weight',     rest: 180, group: 'Legs' },
    'Hack Squat':                  { type: 'weight',     rest: 150, group: 'Legs' },
    'Leg Press':                   { type: 'weight',     rest: 150, group: 'Legs' },
    'Leg Extension':               { type: 'weight',     rest: 75,  group: 'Legs' },
    'Leg Curl':                    { type: 'weight',     rest: 75,  group: 'Legs' },
    'Romanian Deadlift':           { type: 'weight',     rest: 150, group: 'Legs' },
    'Deadlift':                    { type: 'weight',     rest: 180, group: 'Legs' },
    'Hip Thrust':                  { type: 'weight',     rest: 120, group: 'Legs' },
    'Bulgarian Split Squat':       { type: 'weight',     rest: 120, group: 'Legs' },
    'Walking Lunges':              { type: 'weight',     rest: 120, group: 'Legs' },
    'Standing Calf Raise':         { type: 'weight',     rest: 60,  group: 'Calves' },
    'Seated Calf Raise':           { type: 'weight',     rest: 60,  group: 'Calves' }
  };

  /* Big lifts move in 5 kg jumps; dumbbells and cables in 2.5 */
  var BIG_STEP = ['Squat', 'Deadlift', 'Leg Press', 'Romanian Deadlift', 'Hack Squat',
    'Leg Extension', 'Leg Curl', 'Hip Thrust', 'Standing Calf Raise', 'Seated Calf Raise'];

  var CARDIO = { name: 'Incline Treadmill Walk', defaultMinutes: 15 };
  var UNIT = 'kg';
  var SESSIONS_PER_WEEK = 4;

  function meta(name) {
    return (Store.data && Store.data.library[name]) || DEFAULT_LIBRARY[name] ||
      { type: 'weight', rest: 90, group: 'Other' };
  }
  function typeOf(name) { return meta(name).type; }
  function restOf(name) { return meta(name).rest; }
  function stepOf(name) {
    if (typeOf(name) === 'time') return 15;
    return BIG_STEP.indexOf(name) >= 0 ? 5 : 2.5;
  }
  function splitOfExercise(name) {
    var plan = Store.data ? Store.data.plan : DEFAULT_PLAN;
    for (var i = 0; i < SPLITS.length; i++) {
      if ((plan[SPLITS[i].id] || []).indexOf(name) >= 0) return SPLITS[i];
    }
    return null;
  }

  /* =======================================================================
     2. Utilities
     ======================================================================= */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function pad2(x) { return x < 10 ? '0' + x : '' + x; }

  function n(v) {
    var r = Math.round(v * 100) / 100;
    if (Math.abs(r % 1) < 0.005) return r.toFixed(0);
    return (Math.abs((r * 10) % 1) < 0.05) ? r.toFixed(1) : r.toFixed(2);
  }
  function signed(v) { return (v > 0 ? '+' : '') + n(v); }
  /* Typographic minus for buttons; the hyphen reads as a dash at key sizes. */
  function signedKey(v) { return signed(v).replace('-', '−'); }
  function group(v) { return Math.round(v).toLocaleString('en-US'); }
  function plural(c, w) { return c + ' ' + w + (Math.abs(c) === 1 ? '' : 's'); }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function startOfDay(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function fmtDate(ts) {
    var d = new Date(ts);
    return pad2(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtShort(ts) { var d = new Date(ts); return pad2(d.getDate()) + ' ' + MONTHS[d.getMonth()]; }
  function fmtDay(ts) { return DAYNAMES[new Date(ts).getDay()] + ' ' + fmtShort(ts); }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }

  function relDay(ts) {
    var d = daysBetween(ts, Date.now());
    if (d <= 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return d + ' days ago';
    if (d < 14) return 'Last week';
    if (d < 60) return Math.floor(d / 7) + ' weeks ago';
    return Math.floor(d / 30) + ' months ago';
  }
  function weekStart(ts) {
    var d = new Date(startOfDay(ts));
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function monthKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1); }

  function fmtDuration(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
  function fmtClock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + pad2(s % 60);
  }

  /* One set, written the way you'd say it out loud. */
  function fmtSetValue(name, s) {
    if (!s || s.w === null || s.r === null) return '—';
    var t = typeOf(name);
    if (t === 'time') return s.r + 's';
    if (t === 'bodyweight' && !s.w) return 'BW × ' + s.r;
    return n(s.w) + ' × ' + s.r;
  }
  function fmtSetFull(name, s) {
    if (!s) return '—';
    var t = typeOf(name);
    if (t === 'time') return s.r + 's';
    if (t === 'bodyweight' && !s.w) return 'Bodyweight × ' + s.r;
    return n(s.w) + ' ' + UNIT + ' × ' + s.r;
  }

  function icon(name) {
    var p = {
      check: 'M9.6 16.4 5.2 12l-1.4 1.4 5.8 5.8L20.2 8.6 18.8 7.2z',
      chev: 'M9 5.5 15.5 12 9 18.5 7.6 17.1 12.7 12 7.6 6.9z',
      back: 'M15 5.5 8.5 12 15 18.5l1.4-1.4L11.3 12l5.1-5.1z',
      more: 'M6 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4m6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4m6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
      plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
      close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z',
      minus: 'M4 11h16v2H4z',
      up: 'M12 4.5 20 14h-5v5.5H9V14H4z',
      down: 'M12 19.5 4 10h5V4.5h6V10h5z',
      flame: 'M13 2c.6 3.2-1.4 4.6-2.8 6.2C8.6 10 7 11.7 7 14.4A5.2 5.2 0 0 0 12.2 20 5.4 5.4 0 0 0 18 14.6c0-3.6-2.4-5.2-3.4-8.2-.4 1.2-1.3 1.8-2.3 2.3.7-2.4.9-4.8.7-6.7',
      bolt: 'M13.5 2 5 13.5h5L9.5 22 18 10.5h-5z',
      clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 5v5.3l4 2.4-.9 1.5-5.1-3V7z',
      alert: 'M12 2 1.5 20.5h21zm-1 6h2v6h-2zm0 8h2v2h-2z',
      note: 'M4 4h16v2H4zm0 5h16v2H4zm0 5h11v2H4z',
      swap: 'M7 4v3h10.6l-2.8 2.8 1.4 1.4L21.6 6 16.2.6 14.8 2 17.6 4.8V5H7zm10 16v-3H6.4l2.8-2.8-1.4-1.4L2.4 18l5.4 5.4 1.4-1.4-2.8-2.8V19h10.6z',
      trash: 'M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 13H7z',
      pencil: 'M3 17.2V21h3.8L18 9.8 14.2 6zM20.7 7.1a1 1 0 0 0 0-1.4L18.3 3.3a1 1 0 0 0-1.4 0L15 5.2 18.8 9z',
      run: 'M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5 5 0 0 1-4.2-2.4l-1-1.6a2 2 0 0 0-2.4-.8L6 8.3V13h2V9.6z'
    }[name];
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + p + '"/></svg>';
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* =======================================================================
     3. Store
     ======================================================================= */

  var KEY = 'strongr:v2';
  /* Read in order, newest shape first. Anything found under an old key is
     rewritten under the current one, so a rename never orphans your logs. */
  var LEGACY_KEYS = ['ironlog:v2', 'ironlog:v1'];

  var Store = {
    data: null,

    blank: function () {
      var plan = {};
      Object.keys(DEFAULT_PLAN).forEach(function (k) { plan[k] = DEFAULT_PLAN[k].slice(); });
      var lib = {};
      Object.keys(DEFAULT_LIBRARY).forEach(function (k) {
        lib[k] = { type: DEFAULT_LIBRARY[k].type, rest: DEFAULT_LIBRARY[k].rest, group: DEFAULT_LIBRARY[k].group };
      });
      return {
        version: 2, plan: plan, library: lib,
        workouts: [], bodyweight: [], active: null, goal: 'lose',
        theme: 'light',
        /* 'after' — filling the sheet from memory later, so no session clock
           and no rest timer, but you can set the date it happened.
           'live'  — logging set by set in the gym.                        */
        logMode: 'after',
        /* Your usual sets for an exercise: [{w, r, warm}, ...]. Used to
           prefill the sheet before you have any history to go on. */
        targets: {},
        /* One-time coaching notes, dismissed for good once understood. */
        learned: {}
      };
    },

    load: function () {
      var raw = null, fromLegacy = false;
      try {
        raw = localStorage.getItem(KEY);
        for (var i = 0; !raw && i < LEGACY_KEYS.length; i++) {
          raw = localStorage.getItem(LEGACY_KEYS[i]);
          if (raw) fromLegacy = true;
        }
      } catch (e) { /* private mode: run in memory */ }
      if (!raw) { Store.data = Store.blank(); return; }

      var parsed;
      try { parsed = JSON.parse(raw); } catch (e) { Store.data = Store.blank(); return; }

      Store.data = Store.merge(parsed);
      if (fromLegacy || parsed.version !== 2) Store.save();
    },

    /* Fills in anything a older or partial file is missing, and lifts v1's
       weight x reps x sets shorthand into real per-set rows. */
    merge: function (input) {
      var base = Store.blank();
      var d = input || {};

      base.goal = d.goal === 'gain' ? 'gain' : 'lose';
      if (['light', 'dark', 'auto'].indexOf(d.theme) >= 0) base.theme = d.theme;
      if (['after', 'live'].indexOf(d.logMode) >= 0) base.logMode = d.logMode;
      if (d.learned && typeof d.learned === 'object') base.learned = d.learned;
      if (d.targets && typeof d.targets === 'object') {
        Object.keys(d.targets).forEach(function (k) {
          if (Array.isArray(d.targets[k]) && d.targets[k].length) base.targets[k] = d.targets[k];
        });
      }
      if (d.library) {
        Object.keys(d.library).forEach(function (k) { base.library[k] = d.library[k]; });
      }
      if (d.plan) {
        Object.keys(base.plan).forEach(function (k) {
          if (Array.isArray(d.plan[k]) && d.plan[k].length) base.plan[k] = d.plan[k].slice();
        });
      }
      base.bodyweight = Array.isArray(d.bodyweight) ? d.bodyweight.slice() : [];
      base.bodyweight.sort(function (a, b) { return a.ts - b.ts; });

      base.workouts = (Array.isArray(d.workouts) ? d.workouts : []).map(function (w) {
        var entries = (w.entries || []).map(function (e) {
          if (Array.isArray(e.sets)) {
            return { exercise: e.exercise, note: e.note || '', sets: e.sets };
          }
          /* v1 row: one weight repeated N times */
          var count = Math.max(1, e.sets || 1), sets = [];
          for (var i = 0; i < count; i++) {
            sets.push({ w: e.weight || 0, r: e.reps || 0, warm: false });
          }
          return { exercise: e.exercise, note: '', sets: sets };
        });
        var cardio = w.cardio;
        if (typeof cardio === 'boolean') cardio = { done: cardio, minutes: CARDIO.defaultMinutes };
        return {
          id: w.id, ts: w.ts, split: w.split, durationMs: w.durationMs || 0,
          cardio: cardio || { done: false, minutes: CARDIO.defaultMinutes },
          entries: entries, prs: w.prs || []
        };
      });
      base.workouts.sort(function (a, b) { return a.ts - b.ts; });

      /* An in-progress v1 workout can't be lifted safely; drop it. */
      base.active = (d.active && Array.isArray(d.active.entries)) ? d.active : null;
      return base;
    },

    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(Store.data)); return true; }
      catch (e) { toast('Storage is full — export your data'); return false; }
    },

    reset: function () { Store.data = Store.blank(); Store.save(); }
  };

  /* --- Appearance ------------------------------------------------------- */

  function applyTheme() {
    var pick = (Store.data && Store.data.theme) || 'light';
    if (pick === 'auto') {
      pick = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', pick);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', pick === 'dark' ? '#0D131F' : '#F4F6FA');
  }

  /* --- Plain-language glossary -------------------------------------------
     Every term the app can't avoid gets a one-tap explanation, so nothing
     on screen is a word you have to already know. */

  var GLOSSARY = {
    e1rm: {
      title: 'Estimated 1-rep max',
      body: 'The heaviest single rep you could probably manage, worked out from a set ' +
        'you already did. It lets you compare sets that used different weights and reps.',
      eg: '60 kg × 10 reps  →  about 80 kg for one rep'
    },
    warmup: {
      title: 'Warm-up set',
      body: 'A lighter set you do to get ready, not to push yourself. Strongr keeps ' +
        'warm-ups out of your records and out of your totals, so they never flatter ' +
        'your numbers. Tap a set number to mark it as a warm-up.',
      eg: 'Warm-up 20 kg × 10,  then 40 kg × 8 for real'
    },
    volume: {
      title: 'Total weight lifted',
      body: 'Every working set added up: the weight times the reps. It is a rough ' +
        'measure of how much work a session took. Warm-ups are not counted.',
      eg: '40 kg × 10  +  40 kg × 8  =  720 kg'
    },
    bestset: {
      title: 'Best set',
      body: 'Your strongest single set on an exercise so far. When two sets used ' +
        'different weights, Strongr compares them by estimated 1-rep max, so more ' +
        'reps at a lighter weight can still win.',
      eg: '60 kg × 10 beats 65 kg × 5'
    },
    streak: {
      title: 'Streak',
      body: 'How many weeks in a row you have trained at least once. A quiet week ' +
        'resets it. This week is not counted against you until it ends.',
      eg: ''
    }
  };

  function openGlossary(key) {
    var g = GLOSSARY[key];
    if (!g) return;
    openSheet('<h3>' + esc(g.title) + '</h3>' +
      '<p class="sh-body" style="margin-top:8px">' + esc(g.body) + '</p>' +
      (g.eg ? '<div class="sh-eg num">' + esc(g.eg) + '</div>' : '') +
      '<button class="btn btn-primary" data-act="close-sheet">Got it</button>');
  }

  /* Renders the little "?" beside a term. */
  function what(key) {
    return '<button class="what" data-act="explain" data-term="' + key +
      '" aria-label="What does this mean?">?</button>';
  }

  var saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { Store.save(); }, 220);
  }
  var DB = function () { return Store.data; };

  /* =======================================================================
     4. Derivations
     ======================================================================= */

  /* Epley. At one rep it is just the load. */
  function e1rm(w, r) {
    if (!w || !r) return 0;
    return r === 1 ? w : w * (1 + r / 30);
  }
  /* An estimate to two decimals reads like false precision. */
  function e1rmText(w, r) { return n(Math.round(e1rm(w, r) * 10) / 10); }

  /* One comparable number per set, so "best set" is never ambiguous. */
  function setRank(name, s) {
    if (!s || s.w === null || s.r === null) return -1;
    var t = typeOf(name);
    if (t === 'time') return s.r;
    if (t === 'bodyweight') return s.w * 100 + s.r;
    return e1rm(s.w, s.r);
  }
  function working(sets) { return (sets || []).filter(function (s) { return !s.warm; }); }
  function filled(sets) {
    return (sets || []).filter(function (s) { return s.w !== null && s.r !== null; });
  }
  function bestSetIn(name, sets) {
    var best = null;
    filled(working(sets)).forEach(function (s) {
      if (setRank(name, s) > setRank(name, best)) best = s;
    });
    return best;
  }
  function volumeOfSets(name, sets) {
    if (typeOf(name) === 'time') return 0;
    return filled(working(sets)).reduce(function (sum, s) { return sum + s.w * s.r; }, 0);
  }

  /* Every logged session of one exercise, oldest first. */
  function historyOf(name, beforeTs) {
    var out = [];
    DB().workouts.forEach(function (w) {
      if (beforeTs !== undefined && w.ts >= beforeTs) return;
      w.entries.forEach(function (e) {
        if (e.exercise === name) {
          out.push({ ts: w.ts, split: w.split, exercise: name, note: e.note, sets: e.sets });
        }
      });
    });
    return out;
  }
  function lastSessionOf(name, beforeTs) {
    var h = historyOf(name, beforeTs);
    return h.length ? h[h.length - 1] : null;
  }
  function bestEverOf(name, beforeTs) {
    var best = null, bestTs = null;
    historyOf(name, beforeTs).forEach(function (sess) {
      var b = bestSetIn(name, sess.sets);
      if (b && setRank(name, b) > setRank(name, best)) { best = b; bestTs = sess.ts; }
    });
    return best ? { set: best, ts: bestTs } : null;
  }

  function allExercisesLogged() {
    var seen = {};
    DB().workouts.forEach(function (w) {
      w.entries.forEach(function (e) { seen[e.exercise] = true; });
    });
    return Object.keys(seen);
  }

  function lastWorkout() { var w = DB().workouts; return w.length ? w[w.length - 1] : null; }
  function lastWorkoutOfSplit(id) {
    var w = DB().workouts;
    for (var i = w.length - 1; i >= 0; i--) if (w[i].split === id) return w[i];
    return null;
  }
  function volumeOfWorkout(w) {
    return w.entries.reduce(function (sum, e) { return sum + volumeOfSets(e.exercise, e.sets); }, 0);
  }
  function setsOfWorkout(w) {
    return w.entries.reduce(function (sum, e) { return sum + working(e.sets).length; }, 0);
  }

  function weekStreak() {
    var weeks = {};
    DB().workouts.forEach(function (w) { weeks[weekStart(w.ts)] = true; });
    var cursor = weekStart(Date.now());
    if (!weeks[cursor]) cursor -= 7 * 86400000;
    var count = 0;
    while (weeks[cursor]) { count++; cursor -= 7 * 86400000; }
    return count;
  }
  function workoutsThisWeek() {
    var from = weekStart(Date.now());
    return DB().workouts.filter(function (w) { return w.ts >= from; }).length;
  }
  function workoutsThisMonth() {
    var mk = monthKey(Date.now());
    return DB().workouts.filter(function (w) { return monthKey(w.ts) === mk; }).length;
  }
  function cardioThisMonth() {
    var mk = monthKey(Date.now());
    return DB().workouts.filter(function (w) { return monthKey(w.ts) === mk && w.cardio.done; }).length;
  }

  /* --- Bodyweight -------------------------------------------------------- */

  function bwCurrent() { var b = DB().bodyweight; return b.length ? b[b.length - 1] : null; }
  function bwAt(ts) {
    var b = DB().bodyweight, found = null;
    for (var i = 0; i < b.length; i++) { if (b[i].ts <= ts) found = b[i]; else break; }
    return found;
  }
  function bwChange(days) {
    var cur = bwCurrent();
    if (!cur) return null;
    var then = bwAt(cur.ts - days * 86400000);
    if (!then || then.ts === cur.ts) return null;
    return { delta: cur.kg - then.kg, from: then, days: daysBetween(then.ts, cur.ts) };
  }
  function bwTrend() {
    var b = DB().bodyweight;
    if (b.length < 3) return null;
    var r = b.slice(-5), first = r[0], last = r[r.length - 1];
    var span = Math.max(1, daysBetween(first.ts, last.ts));
    return (last.kg - first.kg) / span * 7;
  }
  function bwBest() {
    var b = DB().bodyweight;
    if (!b.length) return null;
    var pick = b[0];
    b.forEach(function (x) { if (DB().goal === 'gain' ? x.kg > pick.kg : x.kg < pick.kg) pick = x; });
    return pick;
  }

  /* --- Progressive overload verdict --------------------------------------- */

  function verdictFor(name, todaySets, prevSets, prevBestEver) {
    var today = bestSetIn(name, todaySets);
    if (!today) return null;

    if (prevBestEver && setRank(name, today) > setRank(name, prevBestEver.set)) {
      return { trend: 'pr', text: 'Personal record — best set yet' };
    }
    var prev = bestSetIn(name, prevSets);
    if (!prev) return { trend: 'flat', text: 'First time logged' };

    var timed = typeOf(name) === 'time';
    if (timed) {
      var ds = today.r - prev.r;
      if (ds > 0) return { trend: 'up', text: '+' + ds + 's on your best hold' };
      if (ds < 0) return { trend: 'down', text: ds + 's against last session' };
      return { trend: 'flat', text: 'Same hold as last session' };
    }

    var dw = today.w - prev.w, dr = today.r - prev.r;
    if (dw > 0) return { trend: 'up', text: signed(dw) + ' ' + UNIT + ' on your top set' };
    if (dw < 0) return { trend: 'down', text: signed(dw) + ' ' + UNIT + ' against last session' };
    if (dr > 0) return { trend: 'up', text: '+' + plural(dr, 'rep') + ' at ' + n(today.w) + ' ' + UNIT };
    if (dr < 0) return { trend: 'down', text: plural(dr, 'rep') + ' at ' + n(today.w) + ' ' + UNIT };

    /* Totals only mean something once you've done as many sets as last time.
       Before that, say how many are left rather than inventing a shortfall. */
    var setsT = filled(working(todaySets)).length;
    var setsP = filled(working(prevSets)).length;
    if (setsT < setsP) {
      return { trend: 'flat', text: 'Matching so far · ' + (setsP - setsT) + ' to go' };
    }
    var vT = volumeOfSets(name, todaySets), vP = volumeOfSets(name, prevSets);
    if (vT > vP) return { trend: 'up', text: '+' + group(vT - vP) + ' ' + UNIT + ' more than last time' };
    if (vT < vP) return { trend: 'down', text: group(vP - vT) + ' ' + UNIT + ' down on last time' };
    return { trend: 'flat', text: 'Matched last session' };
  }

  /* --- Insights ------------------------------------------------------------ */

  function mostImproved(days) {
    var since = Date.now() - days * 86400000, best = null;
    allExercisesLogged().forEach(function (name) {
      if (typeOf(name) === 'time') return;
      var h = historyOf(name).filter(function (s) { return s.ts >= since; });
      if (h.length < 2) return;
      var startSet = bestSetIn(name, h[0].sets);
      if (!startSet || !startSet.w) return;
      var peak = startSet.w;
      h.forEach(function (s) {
        var b = bestSetIn(name, s.sets);
        if (b && b.w > peak) peak = b.w;
      });
      var gain = peak - startSet.w;
      if (gain <= 0) return;
      var weeks = Math.max(1, Math.round(daysBetween(h[0].ts, h[h.length - 1].ts) / 7));
      if (!best || gain > best.gain) best = { name: name, gain: gain, weeks: weeks, from: startSet.w, to: peak };
    });
    return best;
  }

  function neglectedSplit() {
    var worst = null;
    SPLITS.forEach(function (s) {
      var last = lastWorkoutOfSplit(s.id);
      if (!last) return;
      var days = daysBetween(last.ts, Date.now());
      if (days >= 12 && (!worst || days > worst.days)) worst = { split: s, days: days };
    });
    return worst;
  }

  function strongestSplit(days) {
    var since = Date.now() - days * 86400000, best = null;
    SPLITS.forEach(function (s) {
      var gains = [];
      (DB().plan[s.id] || []).forEach(function (name) {
        if (typeOf(name) === 'time') return;
        var h = historyOf(name).filter(function (x) { return x.ts >= since; });
        if (h.length < 2) return;
        var a = bestSetIn(name, h[0].sets), b = bestSetIn(name, h[h.length - 1].sets);
        if (!a || !b || !a.w) return;
        gains.push((b.w - a.w) / a.w * 100);
      });
      if (gains.length < 2) return;
      var avg = gains.reduce(function (x, y) { return x + y; }, 0) / gains.length;
      if (avg > 0 && (!best || avg > best.pct)) best = { split: s, pct: avg };
    });
    return best;
  }

  function consistencyThisMonth() {
    var elapsed = new Date().getDate();
    var expected = Math.max(1, Math.round(elapsed / 7 * SESSIONS_PER_WEEK));
    var done = workoutsThisMonth();
    return { pct: Math.min(100, Math.round(done / expected * 100)), done: done, expected: expected };
  }

  /* Rebuild every workout's records by walking history in date order.
     Used after a back-dated session lands in the middle. */
  function recomputeAllPRs() {
    DB().workouts.forEach(function (w) { w.prs = []; });
    DB().workouts.forEach(function (w) {
      w.entries.forEach(function (e) {
        var best = bestSetIn(e.exercise, e.sets);
        if (!best) return;
        var prev = bestEverOf(e.exercise, w.ts);
        if (!prev || setRank(e.exercise, best) > setRank(e.exercise, prev.set)) {
          w.prs.push({
            exercise: e.exercise, w: best.w, r: best.r,
            prevW: prev ? prev.set.w : null,
            prevR: prev ? prev.set.r : null
          });
        }
      });
    });
  }

  function latestPR() {
    var found = null;
    DB().workouts.forEach(function (w) {
      (w.prs || []).forEach(function (p) { found = { ts: w.ts, split: w.split, pr: p }; });
    });
    return found;
  }

  function buildInsights() {
    var out = [];

    var imp = mostImproved(70);
    if (imp) {
      var sp = splitOfExercise(imp.name);
      out.push({
        hue: sp ? sp.hue : 'blue', icon: 'up',
        html: 'You added <b>' + n(imp.gain) + ' ' + UNIT + '</b> to ' + esc(imp.name) +
          ' over ' + plural(imp.weeks, 'week') + '.',
        sub: n(imp.from) + ' ' + UNIT + ' to ' + n(imp.to) + ' ' + UNIT + ' on your top set'
      });
    }

    var strong = strongestSplit(70);
    if (strong) {
      out.push({
        hue: strong.split.hue, icon: 'bolt',
        html: '<b>' + esc(strong.split.name) + '</b> is moving fastest, up ' + n(strong.pct) + '% on average.',
        sub: 'Across the last ten weeks'
      });
    }

    var neg = neglectedSplit();
    if (neg) {
      out.push({
        hue: neg.split.hue, icon: 'alert',
        html: '<b>' + esc(neg.split.name) + '</b> hasn\'t been logged in ' + plural(neg.days, 'day') + '.',
        sub: 'Start it from the home screen'
      });
    }

    var c = consistencyThisMonth();
    if (c.done > 0) {
      out.push({
        hue: 'green', icon: 'flame',
        html: 'Consistency is <b>' + c.pct + '%</b> this month — ' + plural(c.done, 'workout') +
          ' against a target of ' + c.expected + '.',
        sub: 'Target assumes ' + SESSIONS_PER_WEEK + ' sessions a week'
      });
    }

    var month = workoutsThisMonth();
    if (month > 0) {
      out.push({
        hue: 'yellow', icon: 'run',
        html: 'You finished with cardio <b>' + cardioThisMonth() + ' of ' + month + '</b> times this month.',
        sub: CARDIO.name
      });
    }

    var streak = weekStreak();
    if (streak >= 2) {
      out.push({
        hue: 'red', icon: 'flame',
        html: 'You\'ve trained every week for <b>' + plural(streak, 'week') + '</b> running.',
        sub: 'Unbroken run ending this week'
      });
    }

    var bw = bwChange(30);
    if (bw && Math.abs(bw.delta) >= 0.3) {
      out.push({
        hue: 'blue', icon: bw.delta > 0 ? 'up' : 'down',
        html: 'Bodyweight is <b>' + signed(bw.delta) + ' ' + UNIT + '</b> across ' + plural(bw.days, 'day') + '.',
        sub: 'Now ' + n(bwCurrent().kg) + ' ' + UNIT
      });
    }

    return out;
  }

  /* =======================================================================
     5. Sheets — number pad, exercise picker, exercise menu
     ======================================================================= */

  var sheetEl = $('#sheet'), scrimEl = $('#scrim');
  var pad = null;          /* { exIdx, setIdx, field, buffer } */

  function openSheet(html, hue) {
    sheetEl.innerHTML = '<div class="grip"></div>' + html;
    sheetEl.setAttribute('data-hue', hue || currentHue());
    sheetEl.hidden = false;
    scrimEl.hidden = false;
  }
  function closeSheet() {
    sheetEl.hidden = true;
    scrimEl.hidden = true;
    sheetEl.innerHTML = '';
    pad = null;
    $$('.cell.is-active').forEach(function (c) { c.classList.remove('is-active'); });
  }
  function sheetOpen() { return !sheetEl.hidden; }

  function currentHue() {
    var a = DB().active;
    return a ? SPLIT_BY_ID[a.split].hue : 'blue';
  }

  /* --- Number pad ---------------------------------------------------------- */

  /* The pad edits any {w, r} set — a set in the live sheet, or a set in the
     defaults you're configuring. It knows nothing about either screen; the
     caller supplies the array, the ghost lookup and what "done" means. */

  function padSet() { return pad.sets[pad.idx]; }
  function padGhost() { return pad.ghost ? pad.ghost(pad.idx) : null; }

  function padValue() {
    var s = padSet();
    if (pad.buffer !== '') return parseFloat(pad.buffer) || 0;
    if (s[pad.field] !== null && s[pad.field] !== undefined) return s[pad.field];
    var g = padGhost();
    return g && g[pad.field] !== null && g[pad.field] !== undefined ? g[pad.field] : 0;
  }
  function padDisplay() {
    if (pad.buffer !== '') return pad.buffer;
    return n(padValue());
  }

  function openPad(opts) {
    pad = {
      sets: opts.sets, idx: opts.idx, field: opts.field, name: opts.name,
      ghost: opts.ghost || null,
      onChange: opts.onChange || function () {},
      onDone: opts.onDone || function () { closeSheet(); },
      returnTo: opts.returnTo || null,
      exIdx: opts.exIdx === undefined ? null : opts.exIdx,
      buffer: ''
    };
    renderPad();
    markActiveCell();
  }

  /* Opening the pad from a cell in the live sheet. */
  function openCellPad(exIdx, setIdx, field) {
    var e = DB().active.entries[exIdx];
    openPad({
      sets: e.sets, idx: setIdx, field: field, name: e.exercise, exIdx: exIdx,
      ghost: function (i) { return ghostSetFor(e.exercise, i); },
      onChange: function () { paintSet(exIdx, setIdx); saveSoon(); },
      onDone: function () {
        closeSheet();
        if (!e.sets[setIdx].done) toggleSet(exIdx, setIdx);
      }
    });
  }

  function markActiveCell() {
    $$('.cell.is-active').forEach(function (c) { c.classList.remove('is-active'); });
    if (!pad || pad.exIdx === null) return;
    var cell = $('.cell[data-ex="' + pad.exIdx + '"][data-set="' + pad.idx + '"][data-field="' + pad.field + '"]');
    if (cell) {
      cell.classList.add('is-active');
      cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function renderPad() {
    var name = pad.name, t = typeOf(name);
    var isWeight = pad.field === 'w';
    var unit = isWeight ? UNIT : (t === 'time' ? 's' : 'reps');
    var label = isWeight
      ? (t === 'bodyweight' ? 'Added weight' : 'Weight')
      : (t === 'time' ? 'Seconds' : 'Reps');
    var set = padSet();
    var setLabel = set.warm ? 'Warm-up set' : 'Set ' + (workingIndex(pad.sets, pad.idx) + 1);

    var step = isWeight ? stepOf(name) : (t === 'time' ? 15 : 1);
    var chips = isWeight
      ? [-step, -step / 2, step / 2, step]
      : (t === 'time' ? [-15, -5, 5, 15] : [-2, -1, 1, 2]);

    var goLabel = isWeight
      ? 'Next: ' + (t === 'time' ? 'seconds' : 'reps')
      : (pad.returnTo ? 'Save' : 'Save set');

    var html =
      '<h3>' + esc(name) + '</h3>' +
      '<p class="sh-sub">' + setLabel + '</p>' +
      '<div class="pad-read"><span class="pr-k">' + label + '</span>' +
      '<span class="pr-v num" id="padOut">' + padDisplay() +
      '<small>' + unit + '</small></span></div>' +
      '<div class="pad-quick">' +
      chips.map(function (c) {
        return '<button data-act="pad-step" data-by="' + c + '">' + signedKey(c) + '</button>';
      }).join('') +
      '</div><div class="pad-keys">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (k) {
        return '<button data-act="pad-key" data-k="' + k + '">' + k + '</button>';
      }).join('') +
      (isWeight && t !== 'time'
        ? '<button data-act="pad-key" data-k=".">.</button>'
        : '<button data-act="pad-clear" class="k-fn">Clear</button>') +
      '<button data-act="pad-key" data-k="0">0</button>' +
      '<button data-act="pad-back" class="k-fn">Delete</button>' +
      '<button data-act="pad-go" class="k-wide k-go">' + goLabel + '</button>' +
      '<button data-act="pad-close" class="k-fn">Close</button>' +
      '</div>';

    openSheet(html);
  }

  function padSetValue(v) {
    var s = padSet();
    s[pad.field] = Math.max(0, Math.round(v * 100) / 100);
    pad.buffer = '';
    var out = $('#padOut');
    if (out) out.firstChild.nodeValue = n(s[pad.field]);
    pad.onChange();
  }

  function padCommit() {
    var s = padSet();
    if (pad.buffer !== '') {
      s[pad.field] = Math.max(0, parseFloat(pad.buffer) || 0);
    } else if (s[pad.field] === null || s[pad.field] === undefined) {
      var g = padGhost();
      s[pad.field] = g && g[pad.field] !== null && g[pad.field] !== undefined ? g[pad.field] : 0;
    }
    pad.buffer = '';
    pad.onChange();
  }

  /* --- Default sets editor ---------------------------------------------------
     Your usual sets for one exercise, so a fresh sheet arrives filled in
     instead of thirty empty boxes. */

  var defaults = null;   /* { name, sets, back } */

  function openDefaults(name, back) {
    var seed = targetSetsFor(name) || prevSetsFor(name) ||
      [{ w: null, r: null, warm: false }, { w: null, r: null, warm: false },
       { w: null, r: null, warm: false }];
    defaults = {
      name: name,
      back: back || null,
      sets: seed.map(function (s) { return { w: s.w, r: s.r, warm: !!s.warm }; })
    };
    renderDefaults();
  }

  function renderDefaults() {
    var name = defaults.name, t = typeOf(name), timed = t === 'time';
    var unitLabel = t === 'bodyweight' ? '+kg' : UNIT;

    var rows = defaults.sets.map(function (s, j) {
      var cell = function (f) {
        return '<button class="cell' + (s[f] === null ? ' is-ghost' : '') +
          '" data-act="def-cell" data-set="' + j + '" data-field="' + f + '">' +
          (s[f] === null ? '—' : n(s[f])) + '</button>';
      };
      return '<div class="set" data-set="' + j + '">' +
        '<button class="set-n" data-act="def-warm" data-set="' + j +
        '" aria-label="Mark as warm-up">' + (s.warm ? 'W' : workingIndex(defaults.sets, j) + 1) +
        '</button>' +
        (timed ? '' : cell('w')) + cell('r') +
        '<button class="set-del" data-act="def-del" data-set="' + j +
        '" aria-label="Remove this set">' + icon('close') + '</button>' +
        '</div>';
    }).join('');

    openSheet(
      '<h3>Usual sets</h3>' +
      '<p class="sh-sub">' + esc(name) + ' — used to fill the sheet until you ' +
      'have a session to copy from.</p>' +
      '<div class="def-rows" data-type="' + t + '">' +
      '<div class="sets-head"><span>Set</span>' +
      (timed ? '' : '<span>' + unitLabel + '</span>') +
      '<span>' + (timed ? 'Seconds' : 'Reps') + '</span><span></span></div>' +
      rows + '</div>' +
      '<button class="add-set" data-act="def-add" style="width:100%;margin-top:10px;height:44px">' +
      'Add another set</button>' +
      '<p class="hint" style="margin:12px 2px 0">Tap a set number to make it a warm-up. ' +
      'Warm-ups stay out of your records and totals.</p>' +
      '<button class="btn btn-primary" data-act="def-save">Save defaults</button>' +
      (targetSetsFor(name)
        ? '<button class="btn btn-ghost btn-danger" data-act="def-clear" ' +
          'style="width:100%">Remove defaults</button>'
        : '<button class="btn btn-ghost" data-act="def-cancel" style="width:100%">Cancel</button>')
    );
  }

  function openDefaultsPad(j, field) {
    openPad({
      sets: defaults.sets, idx: j, field: field, name: defaults.name,
      onChange: function () {},
      onDone: function () { renderDefaults(); },
      returnTo: function () { renderDefaults(); }
    });
  }

  function saveDefaults() {
    var kept = defaults.sets.filter(function (s) {
      return s.r !== null && s.r > 0;
    }).map(function (s) {
      return { w: s.w === null ? 0 : s.w, r: s.r, warm: !!s.warm };
    });
    if (!kept.length) { toast('Give at least one set some reps'); return; }
    DB().targets[defaults.name] = kept;
    Store.save();
    finishDefaults(plural(kept.length, 'set') + ' saved for ' + defaults.name);
  }

  function finishDefaults(msg) {
    var back = defaults.back;
    defaults = null;
    closeSheet();
    render();
    if (msg) toast(msg);
    if (back) back();
  }

  /* Capture what is already on the sheet as the new defaults. */
  function captureDefaults(exIdx) {
    var e = DB().active.entries[exIdx];
    var kept = [];
    e.sets.forEach(function (s, j) {
      var g = ghostSetFor(e.exercise, j);
      var w = s.w !== null ? s.w : (g ? g.w : null);
      var r = s.r !== null ? s.r : (g ? g.r : null);
      if (r === null || r <= 0) return;
      kept.push({ w: w === null ? 0 : w, r: r, warm: !!s.warm });
    });
    if (!kept.length) { toast('Fill in some numbers first'); return; }
    DB().targets[e.exercise] = kept;
    Store.save();
    closeSheet();
    render();
    /* Say the count — empty rows are skipped, and silently saving one set
       when three are on screen would be a surprise. */
    toast(plural(kept.length, 'set') + ' saved as your usual ' + e.exercise);
  }

  /* --- Exercise picker ------------------------------------------------------ */

  var pickerMode = null;   /* {kind:'add'|'replace'|'plan', exIdx, splitId} */

  function openPicker(mode) {
    pickerMode = mode;
    renderPicker('');
    setTimeout(function () { var s = $('#pickSearch'); if (s) s.focus(); }, 60);
  }

  function renderPicker(query) {
    var q = (query || '').toLowerCase().trim();
    var lib = DB().library;
    var inPlan = {};
    Object.keys(DB().plan).forEach(function (k) {
      DB().plan[k].forEach(function (nm) { inPlan[nm] = SPLIT_BY_ID[k]; });
    });

    /* "chin" should surface Chin Up before Machine Crunch, so a name that
       starts with the query beats a word that does, which beats a match
       buried mid-word. */
    var rankOf = function (nm) {
      var low = nm.toLowerCase();
      if (low.indexOf(q) === 0) return 0;
      if (low.split(' ').some(function (word) { return word.indexOf(q) === 0; })) return 1;
      return 2;
    };
    var names = Object.keys(lib).filter(function (nm) {
      return !q || nm.toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      if (!q) return a < b ? -1 : 1;
      return (rankOf(a) - rankOf(b)) || (a < b ? -1 : 1);
    });

    var mine = names.filter(function (nm) { return inPlan[nm]; });
    var rest = names.filter(function (nm) { return !inPlan[nm]; });

    var title = pickerMode.kind === 'replace' ? 'Swap exercise'
      : pickerMode.kind === 'plan' ? 'Add to this workout' : 'Add an exercise';

    var itemHtml = function (nm) {
      var sp = inPlan[nm];
      var best = bestEverOf(nm);
      return '<button class="sh-item" data-act="pick" data-name="' + esc(nm) + '"' +
        (sp ? ' data-hue="' + sp.hue + '"' : '') + '>' +
        (sp ? '<span class="si-bar"></span>' : '<span class="si-ic">' + icon('plus') + '</span>') +
        '<span class="si-main"><span class="si-k">' + esc(nm) + '</span>' +
        '<span class="si-sub">' + esc(meta(nm).group) +
        (best ? ' · best ' + fmtSetFull(nm, best.set) : '') + '</span></span></button>';
    };

    var html = '<h3>' + title + '</h3><p class="sh-sub">Search, or create your own.</p>' +
      '<input class="sh-search" id="pickSearch" type="search" placeholder="Search exercises" ' +
      'autocomplete="off" autocorrect="off" spellcheck="false" value="' + esc(query || '') + '">' +
      '<button class="sh-item" data-act="new-exercise"><span class="si-ic">' + icon('plus') + '</span>' +
      '<span class="si-main"><span class="si-k">Create a new exercise</span>' +
      '<span class="si-sub">Name it, pick how it\'s measured</span></span></button>';

    if (q) {
      /* While searching, relevance wins over grouping — otherwise a split
         member buried mid-word outranks the exact match. */
      html += names.length
        ? names.map(itemHtml).join('')
        : '<div class="empty"><p>No exercise matches “' + esc(query) +
          '”. Create it instead.</p></div>';
    } else {
      if (mine.length) {
        html += '<div class="sh-group">Already in your workouts</div>' + mine.map(itemHtml).join('');
      }
      if (rest.length) {
        html += '<div class="sh-group">' + (mine.length ? 'Everything else' : 'Exercises') + '</div>' +
          rest.map(itemHtml).join('');
      }
    }
    openSheet(html);
  }

  function renderNewExercise(prefill) {
    openSheet(
      '<h3>Create an exercise</h3><p class="sh-sub">It joins your library for good.</p>' +
      '<input class="sh-search" id="newName" type="text" placeholder="Exercise name" ' +
      'autocomplete="off" value="' + esc(prefill || '') + '">' +
      '<div class="sec-head" style="margin-top:4px"><h2>How is it measured?</h2></div>' +
      '<div class="seg" id="newType" style="display:flex">' +
      '<button data-act="new-type" data-type="weight" aria-pressed="true">Weight</button>' +
      '<button data-act="new-type" data-type="bodyweight" aria-pressed="false">Bodyweight</button>' +
      '<button data-act="new-type" data-type="time" aria-pressed="false">Timed</button>' +
      '</div>' +
      '<div class="sec-head"><h2>Rest between sets</h2></div>' +
      '<div class="seg" id="newRest" style="display:flex">' +
      [60, 90, 120, 150].map(function (r) {
        return '<button data-act="new-rest" data-rest="' + r + '" aria-pressed="' +
          (r === 90) + '">' + fmtClock(r * 1000) + '</button>';
      }).join('') +
      '</div>' +
      '<button class="btn btn-primary" data-act="save-exercise">Create exercise</button>' +
      '<button class="btn btn-ghost" data-act="close-sheet">Cancel</button>'
    );
    setTimeout(function () { var i = $('#newName'); if (i) i.focus(); }, 60);
  }

  /* --- Exercise menu --------------------------------------------------------- */

  function openExerciseMenu(exIdx) {
    var e = DB().active.entries[exIdx];
    var item = function (act, ic, k, sub, danger) {
      return '<button class="sh-item' + (danger ? ' is-danger' : '') + '" data-act="' + act +
        '" data-ex="' + exIdx + '"><span class="si-ic">' + icon(ic) + '</span>' +
        '<span class="si-main"><span class="si-k">' + k + '</span>' +
        (sub ? '<span class="si-sub">' + esc(sub) + '</span>' : '') + '</span></button>';
    };
    openSheet(
      '<h3>' + esc(e.exercise) + '</h3>' +
      '<p class="sh-sub">' + plural(e.sets.length, 'set') + ' · rest ' +
      fmtClock(e.restSec * 1000) + '</p>' +
      item('menu-addset', 'plus', 'Add a set', '') +
      (e.sets.length > 1 ? item('menu-delset', 'minus', 'Remove the last set', '') : '') +
      item('menu-capture', 'check', 'Save these as my usual sets',
        'Reuse them whenever there is no history') +
      item('menu-defaults', 'pencil', 'Edit my usual sets',
        targetSetsFor(e.exercise) ? summariseTarget(e.exercise) : 'Not set yet') +
      item('menu-note', 'note', e.note ? 'Edit note' : 'Add a note', e.note || 'Seat height, grip, cues') +
      item('menu-rest', 'clock', 'Rest timer', 'Currently ' + fmtClock(e.restSec * 1000)) +
      item('menu-swap', 'swap', 'Swap for another exercise', 'Machine taken? Pick something else') +
      item('menu-remove', 'trash', 'Remove from this workout', '', true)
    );
  }

  function openRestPicker(exIdx) {
    var e = DB().active.entries[exIdx];
    openSheet('<h3>Rest after each set</h3><p class="sh-sub">' + esc(e.exercise) + '</p>' +
      [45, 60, 75, 90, 120, 150, 180, 240].map(function (r) {
        return '<button class="sh-item" data-act="set-rest" data-ex="' + exIdx + '" data-rest="' + r + '">' +
          '<span class="si-ic">' + icon(r === e.restSec ? 'check' : 'clock') + '</span>' +
          '<span class="si-main"><span class="si-k">' + fmtClock(r * 1000) + '</span></span></button>';
      }).join(''));
  }

  function openNoteSheet(exIdx) {
    var e = DB().active.entries[exIdx];
    openSheet('<h3>Note</h3><p class="sh-sub">' + esc(e.exercise) + '</p>' +
      '<input class="sh-search" id="noteInput" type="text" placeholder="Seat pin 4, neutral grip…" ' +
      'value="' + esc(e.note || '') + '">' +
      '<button class="btn btn-primary" data-act="save-note" data-ex="' + exIdx + '">Save note</button>' +
      '<button class="btn btn-ghost" data-act="close-sheet">Cancel</button>');
    setTimeout(function () { var i = $('#noteInput'); if (i) i.focus(); }, 60);
  }

  function openCardioSheet() {
    var a = DB().active;
    openSheet('<h3>' + esc(CARDIO.name) + '</h3><p class="sh-sub">How long did you walk?</p>' +
      [10, 12, 15, 20, 25, 30].map(function (m) {
        return '<button class="sh-item" data-act="set-cardio" data-mins="' + m + '">' +
          '<span class="si-ic">' + icon(m === a.cardio.minutes ? 'check' : 'run') + '</span>' +
          '<span class="si-main"><span class="si-k">' + m + ' minutes</span></span></button>';
      }).join(''));
  }

  /* =======================================================================
     6. Rest timer
     ======================================================================= */

  var restEl = $('#rest');

  function startRest(seconds, label) {
    DB().active.rest = { endsAt: Date.now() + seconds * 1000, total: seconds, label: label || 'Rest' };
    saveSoon();
    paintRest();
  }
  function stopRest() {
    if (DB().active) DB().active.rest = null;
    saveSoon();
    paintRest();
  }
  function nudgeRest(sec) {
    var r = DB().active && DB().active.rest;
    if (!r) return;
    r.endsAt = Math.max(Date.now() + 1000, r.endsAt + sec * 1000);
    r.total = Math.max(r.total + sec, 15);
    saveSoon();
    paintRest();
  }

  function paintRest() {
    var a = DB().active;
    var r = a && a.rest;
    if (!r || !isLive() || state.screen !== 'workout') { restEl.hidden = true; return; }

    var left = Math.ceil((r.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      a.rest = null;
      restEl.hidden = true;
      saveSoon();
      buzz([90, 60, 90]);
      toast('Rest over — next set');
      return;
    }
    var pct = Math.max(0, Math.min(100, left / r.total * 100));
    restEl.hidden = false;
    restEl.setAttribute('data-hue', currentHue());
    restEl.innerHTML =
      '<div class="rest-inner">' +
      '<div class="rest-fill" style="width:' + pct + '%"></div>' +
      '<span class="rest-label">' + esc(r.label) + '</span>' +
      '<span class="rest-time num">' + fmtClock(left * 1000) + '</span>' +
      '<button class="rest-btn" data-act="rest-nudge" data-by="-15">−15s</button>' +
      '<button class="rest-btn" data-act="rest-nudge" data-by="15">+15s</button>' +
      '<button class="rest-btn" data-act="rest-skip">Skip</button>' +
      '</div>';
  }

  /* One interval drives both the session clock and the rest timer. */
  var ticker = null;
  function startTicker() {
    stopTicker();
    ticker = setInterval(function () {
      var a = DB().active;
      if (!a) { stopTicker(); return; }
      var c = $('#clock');
      if (c) c.textContent = fmtClock(Date.now() - a.startedAt);
      if (a.rest) paintRest();
    }, 1000);
  }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null; } }

  /* =======================================================================
     7. Screens
     ======================================================================= */

  var state = { screen: 'home', params: {}, prev: null };
  var view = $('#view');

  /* `cls` colours the VALUE — it marks whether the number itself is progress
     or a step back. The note underneath stays neutral. */
  function statTile(value, unit, key, note, cls) {
    return '<div class="stat"><div class="stat-v ' + (cls || '') + '">' + value +
      (unit ? '<small>' + unit + '</small>' : '') + '</div>' +
      '<div class="stat-k">' + key + '</div>' +
      (note ? '<div class="stat-note">' + note + '</div>' : '') + '</div>';
  }

  /* --- 7.1 Home -------------------------------------------------------------- */

  function screenHome() {
    var d = DB(), last = lastWorkout();
    var html = '<div class="masthead-stack">' +
      '<header class="masthead"><h1>Strongr</h1>' +
      '<span class="tagline">Track. Progress. Repeat.</span></header>' +
      '<span class="credit">Designed by Navin</span></div>';

    if (d.active) {
      var aS = SPLIT_BY_ID[d.active.split];
      var doneSets = d.active.entries.reduce(function (s, e) {
        return s + e.sets.filter(function (x) { return x.done && !x.warm; }).length;
      }, 0);
      html += '<div class="recap" data-hue="' + aS.hue + '" style="margin-bottom:12px">' +
        '<div class="recap-top"><div><div class="recap-split">' + esc(aS.name) + '</div>' +
        '<div class="recap-when">' +
        (isLive() ? fmtClock(Date.now() - d.active.startedAt) + ' in · ' : fmtDay(logDateOf(d.active)) + ' · ') +
        plural(doneSets, 'set') + ' done</div></div>' +
        '<span class="recap-ago">Unfinished</span></div>' +
        '<button class="btn btn-primary" data-act="resume">Carry on filling it in</button></div>';
    }

    html += '<div class="sec-head"><h2>Last session</h2>' +
      (last ? '<span class="meta">' + fmtDate(last.ts) + '</span>' : '') + '</div>';

    if (last) {
      var sp = SPLIT_BY_ID[last.split];
      var shown = last.entries.slice(0, 4);
      html += '<div class="recap" data-hue="' + sp.hue + '">' +
        '<div class="recap-top"><div><div class="recap-split">' + esc(sp.name) + '</div>' +
        '<div class="recap-when">' + fmtDay(last.ts) +
        (last.durationMs ? ' · ' + fmtDuration(last.durationMs) : '') +
        ' · ' + group(volumeOfWorkout(last)) + ' ' + UNIT + '</div></div>' +
        '<span class="recap-ago">' + relDay(last.ts) + '</span></div>' +
        '<ul class="recap-lines">' +
        shown.map(function (e) {
          var b = bestSetIn(e.exercise, e.sets);
          return '<li><span class="rl-name">' + esc(e.exercise) + '</span>' +
            '<span class="rl-val num">' + plural(working(e.sets).length, 'set') + ' · top ' +
            fmtSetValue(e.exercise, b) + '</span></li>';
        }).join('') + '</ul>' +
        (last.entries.length > shown.length
          ? '<div class="recap-more">and ' + (last.entries.length - shown.length) +
            ' more, every set loaded in</div>' : '') +
        '<button class="btn btn-primary" data-act="repeat">Repeat this workout</button></div>';
    } else {
      html += '<div class="card empty"><h3>No workouts yet</h3>' +
        '<p>Pick one of the four workouts below to get started. Once you finish it, ' +
        'Strongr remembers every set so you can repeat it in one tap.</p>' +
        '<button class="btn btn-ghost btn-sm" data-act="seed" style="margin:14px auto 0">' +
        'Show me with sample data</button></div>';
    }

    var cur = bwCurrent(), streak = weekStreak();
    html += '<div class="stats stats-3" style="margin-top:12px">' +
      statTile(cur ? n(cur.kg) : '—', cur ? UNIT : '', 'Bodyweight',
        cur ? relDay(cur.ts) : 'Not logged', '') +
      statTile(streak || '0', streak === 1 ? 'wk' : 'wks', 'Streak' + what('streak'),
        streak ? 'Weeks in a row' : 'Start this week', '') +
      statTile(workoutsThisMonth(), '', 'This month',
        plural(workoutsThisWeek(), 'session') + ' this week', '') +
      '</div>';

    /* "Split" is gym jargon. A beginner starts a workout. */
    html += '<div class="sec-head"><h2>Start a workout</h2>' +
      '<button class="link" data-act="edit-plans">Edit</button></div><div class="splits">';
    SPLITS.forEach(function (s) {
      var lw = lastWorkoutOfSplit(s.id);
      html += '<button class="split-btn" data-hue="' + s.hue + '" data-act="start" data-split="' + s.id + '">' +
        '<div class="sb-name">' + esc(s.name) + '</div>' +
        '<div class="sb-meta">' + (lw ? relDay(lw.ts) : 'Not done yet') + ' · ' +
        (d.plan[s.id] || []).length + ' exercises</div></button>';
    });
    html += '</div>';

    if (!d.learned.basics) {
      html += '<div class="coach" data-hue="blue" style="margin-top:16px">' +
        '<span class="ic">' + icon('bolt') + '</span>' +
        '<div class="co-main"><h3>New here? It works like this</h3>' +
        '<ol><li><b>1</b><span>Pick a workout. Every exercise is already listed — ' +
        'add or remove any you like.</span></li>' +
        '<li><b>2</b><span>Do a set, type the weight and reps, then tap the tick. ' +
        'A rest timer starts on its own.</span></li>' +
        '<li><b>3</b><span>Tap Finish. Next week, Repeat this workout fills in ' +
        'everything you lifted.</span></li></ol></div>' +
        '<button class="co-x" data-act="learned" data-key="basics" ' +
        'aria-label="Hide this">' + icon('close') + '</button></div>';
    }

    var recent = d.workouts.slice(-6).reverse();
    if (recent.length) {
      html += '<div class="sec-head"><h2>Recent workouts</h2>' +
        '<span class="meta">' + d.workouts.length + ' total</span></div><div class="rows">';
      recent.forEach(function (w) {
        var s = SPLIT_BY_ID[w.split];
        html += '<button class="row" data-hue="' + s.hue + '" data-act="open-summary" data-id="' + w.id + '">' +
          '<span class="row-bar"></span><span class="row-main">' +
          '<span class="row-k">' + esc(s.name) + '</span>' +
          '<span class="row-sub">' + fmtDate(w.ts) + ' · ' + plural(setsOfWorkout(w), 'set') +
          (w.cardio.done ? ' · cardio' : '') + '</span></span>' +
          '<span class="row-v"><span class="cell-v">' + group(volumeOfWorkout(w)) +
          '<small>' + UNIT + '</small></span></span>' +
          '<span class="row-chev">' + icon('chev') + '</span></button>';
      });
      html += '</div>';
    }

    view.innerHTML = '<div class="screen">' + html + '</div>';
  }

  /* --- 7.2 Workout ------------------------------------------------------------ */

  function isLive() { return DB().logMode === 'live'; }
  function logDateOf(a) { return (a && a.logDate) || Date.now(); }

  /* Back-dating: keep the clock time so two sessions on one day still order,
     but move the day to the one you actually trained. */
  function openDateSheet() {
    var a = DB().active;
    var chosen = dayKey(logDateOf(a));
    var rows = '';
    for (var i = 0; i < 10; i++) {
      var ts = startOfDay(Date.now()) - i * 86400000;
      var k = dayKey(ts);
      rows += '<button class="sh-item" data-act="set-date" data-day="' + k + '">' +
        '<span class="si-ic">' + icon(k === chosen ? 'check' : 'clock') + '</span>' +
        '<span class="si-main"><span class="si-k">' +
        (i === 0 ? 'Today' : i === 1 ? 'Yesterday' : fmtDay(ts)) + '</span>' +
        (i > 1 ? '' : '<span class="si-sub">' + fmtDate(ts) + '</span>') +
        '</span></button>';
    }
    openSheet('<h3>When did you do this?</h3>' +
      '<p class="sh-sub">Filing it on the right day keeps your streak and history honest.</p>' +
      rows +
      '<div class="sh-group">Further back</div>' +
      '<input class="sh-search" type="date" id="dateInput" value="' + chosen +
      '" max="' + dayKey(Date.now()) + '">' +
      '<button class="btn btn-primary" data-act="set-date-custom">Use this date</button>');
  }

  function applyLogDate(dayStr) {
    var a = DB().active;
    if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) return;
    var parts = dayStr.split('-');
    var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(d.getTime()) || startOfDay(d.getTime()) > startOfDay(Date.now())) {
      toast('Pick today or a day already past');
      return;
    }
    var now = new Date();
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);
    a.logDate = d.getTime();
    Store.save();
    closeSheet();
    render();
  }

  /* The set structure you did last time for this exercise. */
  function prevSetsFor(name) {
    var sess = lastSessionOf(name);
    return sess ? sess.sets : null;
  }
  function targetSetsFor(name) {
    var t = DB().targets[name];
    return (t && t.length) ? t : null;
  }
  /* What the greyed numbers show. Your configured defaults decide how many
     sets the sheet has — that's your routine — and last session supplies the
     numbers for the sets it covers. Records and progress only ever compare
     against real history; a target is a plan, not a result. */
  function ghostSetsFor(name) {
    var prev = prevSetsFor(name), tgt = targetSetsFor(name);
    if (!tgt) return prev;
    if (!prev) return tgt;
    /* The target owns the shape — how many sets, and which are warm-ups.
       Last session only supplies the numbers, matched set for set. */
    var out = tgt.map(function (t, i) {
      var p = prev[i];
      return p ? { w: p.w, r: p.r, warm: !!t.warm } : t;
    });
    for (var i = tgt.length; i < prev.length; i++) out.push(prev[i]);
    return out;
  }
  function ghostSetFor(name, idx) {
    var g = ghostSetsFor(name);
    if (!g) return null;
    return g[idx] || g[g.length - 1] || null;
  }
  function usingTarget(name) { return !prevSetsFor(name) && !!targetSetsFor(name); }

  /* "3 sets · 35 / 42.5 / 47.5 kg" — readable at a glance in a list row. */
  function summariseTarget(name) {
    var t = targetSetsFor(name);
    if (!t) return '';
    var timed = typeOf(name) === 'time';
    var work = t.filter(function (s) { return !s.warm; });
    var warm = t.length - work.length;
    var body = timed
      ? work.map(function (s) { return s.r + 's'; }).join(' / ')
      : work.map(function (s) { return n(s.w); }).join(' / ') + ' ' + UNIT +
        ' × ' + work.map(function (s) { return s.r; }).join(' / ');
    return plural(work.length, 'set') + (warm ? ' + ' + warm + ' warm-up' : '') + ' · ' + body;
  }
  /* Set numbering skips warm-ups, the way you'd count them aloud. */
  function workingIndex(sets, idx) {
    var c = 0;
    for (var i = 0; i < idx; i++) if (!sets[i].warm) c++;
    return c;
  }

  function buildEntry(name, prefill) {
    var shape = ghostSetsFor(name);
    var sets = [];
    if (shape && shape.length) {
      shape.forEach(function (p) {
        sets.push({
          w: prefill ? p.w : null,
          r: prefill ? p.r : null,
          warm: !!p.warm, done: false
        });
      });
    } else {
      for (var i = 0; i < 3; i++) sets.push({ w: null, r: null, warm: false, done: false });
    }
    return { exercise: name, note: '', restSec: restOf(name), sets: sets };
  }

  function startWorkout(splitId, prefill) {
    var names = DB().plan[splitId] || [];
    DB().active = {
      split: splitId,
      startedAt: Date.now(),
      cardio: { done: false, minutes: CARDIO.defaultMinutes },
      rest: null,
      entries: names.map(function (nm) { return buildEntry(nm, prefill); })
    };
    Store.save();
    go('workout');
  }

  function repeatLast() {
    var last = lastWorkout();
    if (!last) { toast('Nothing to repeat yet'); return; }
    DB().active = {
      split: last.split,
      startedAt: Date.now(),
      cardio: { done: false, minutes: last.cardio.minutes },
      rest: null,
      entries: last.entries.map(function (e) {
        return {
          exercise: e.exercise,
          note: e.note || '',
          restSec: restOf(e.exercise),
          sets: e.sets.map(function (s) {
            return { w: s.w, r: s.r, warm: !!s.warm, done: false };
          })
        };
      })
    };
    Store.save();
    go('workout');
  }

  function screenWorkout() {
    var a = DB().active;
    if (!a) { go('home'); return; }
    var split = SPLIT_BY_ID[a.split];
    document.body.classList.add('is-focusmode');

    var live = isLive();
    var html = '<div class="screen" data-hue="' + split.hue + '">';
    html += '<div class="wk-head" data-hue="' + split.hue + '">' +
      '<button class="icon-btn" data-act="home" aria-label="Back to home">' + icon('back') + '</button>' +
      '<div class="wk-title"><h2>' + esc(split.name) + '</h2>' +
      '<div class="wk-sub" id="wkSub">' + workoutSubline(a) + '</div></div>' +
      (live
        ? '<div class="wk-clock" id="clock">' + fmtClock(Date.now() - a.startedAt) + '</div>'
        : '<button class="wk-date" data-act="pick-date">' + fmtDay(logDateOf(a)) + '</button>') +
      '</div>';

    /* Coaching is app-level guidance, so it keeps the action colour rather
       than the workout's. */
    if (!DB().learned.sheet) {
      html += '<div class="coach" data-hue="blue">' +
        '<span class="ic">' + icon('note') + '</span>' +
        '<div class="co-main"><h3>Filling in the sheet</h3>' +
        '<p>Tap any weight or reps box to change it. <b>Previous</b> shows what you ' +
        'lifted last time — tap it to copy that set across. Tick every set you did' +
        (live ? ', and a rest timer starts each time.'
              : '. Not from today? Tap the date to change it.') + '</p></div>' +
        '<button class="co-x" data-act="learned" data-key="sheet" ' +
        'aria-label="Hide this">' + icon('close') + '</button></div>';
    }

    a.entries.forEach(function (e, i) { html += exerciseBlock(e, i); });

    html += '<button class="btn" data-act="add-exercise" style="margin-bottom:12px">' +
      '<span style="width:18px;height:18px">' + icon('plus') + '</span>Add an exercise</button>';

    html += '<button class="cardio" data-act="cardio" aria-pressed="' + a.cardio.done + '">' +
      '<span class="box">' + icon('check') + '</span>' +
      '<span><span class="c-name">' + esc(CARDIO.name) + '</span><br>' +
      '<span class="c-sub">Tap when it\'s done</span></span>' +
      '<span class="c-mins" data-act="cardio-mins">' + a.cardio.minutes + ' min</span></button>';

    html += '<button class="btn btn-ghost btn-danger" data-act="discard">Discard this workout</button>';
    html += '</div>';

    html += '<div class="finishbar" data-hue="' + split.hue + '"><div class="inner">' +
      '<button class="btn btn-primary" data-act="finish">Finish workout</button></div></div>';

    view.innerHTML = html;
    a.entries.forEach(function (e, i) { paintVerdict(i); });
    if (live) { startTicker(); paintRest(); }
    else restEl.hidden = true;
  }

  function workoutSubline(a) {
    var done = 0, total = 0, vol = 0;
    a.entries.forEach(function (e) {
      working(e.sets).forEach(function (s) {
        total++;
        if (s.done) done++;
      });
      vol += volumeOfSets(e.exercise, e.sets.filter(function (s) { return s.done; }));
    });
    return done + ' of ' + total + ' sets done · ' + group(vol) + ' ' + UNIT + ' lifted';
  }

  function exerciseBlock(e, i) {
    var name = e.exercise, t = typeOf(name);
    var best = bestEverOf(name);
    var timed = t === 'time';

    /* No e1RM here — it is one more number to decode mid-set. It lives on
       Records, where there is room to explain it. */
    var onTarget = usingTarget(name);
    var metaBits = [];
    metaBits.push(best
      ? 'Your best: <b>' + fmtSetFull(name, best.set) + '</b>'
      : (onTarget ? 'Using your defaults' : 'First time doing this one'));
    metaBits.push('rest ' + fmtClock(e.restSec * 1000));

    var head =
      '<div class="ex-head"><div class="ex-id">' +
      '<div class="ex-name">' + esc(name) + '</div>' +
      '<div class="ex-meta">' + metaBits.join(' · ') + '</div></div>' +
      '<button class="icon-btn" data-act="ex-menu" data-ex="' + i + '" aria-label="Options for ' +
      esc(name) + '">' + icon('more') + '</button></div>' +
      (e.note ? '<button class="ex-note" data-act="menu-note" data-ex="' + i + '">' +
        esc(e.note) + '</button>' : '');

    var header = '<div class="sets-head"><span>Set</span>' +
      '<span>' + (onTarget ? 'Target' : 'Previous') + '</span>' +
      (timed ? '' : '<span>' + UNIT + '</span>') +
      '<span>' + (timed ? 'Seconds' : 'Reps') + '</span><span></span></div>';

    var rows = e.sets.map(function (s, j) { return setRow(e, i, j); }).join('');

    return '<section class="ex" data-ex="' + i + '" data-type="' + t + '">' +
      head + header + '<div class="sets">' + rows + '</div>' +
      '<div class="ex-foot"><button class="add-set" data-act="add-set" data-ex="' + i + '">' +
      'Add set</button></div>' +
      '<div class="verdict" data-ex="' + i + '" data-trend=""></div>' +
      '</section>';
  }

  function setRow(e, i, j) {
    var s = e.sets[j], name = e.exercise, timed = typeOf(name) === 'time';
    var prev = ghostSetFor(name, j);
    var label = s.warm ? 'W' : (workingIndex(e.sets, j) + 1);

    var cell = function (field) {
      var val = s[field];
      var ghost = prev ? prev[field] : null;
      var shown = val !== null ? n(val) : (ghost !== null && ghost !== undefined ? n(ghost) : '—');
      return '<button class="cell' + (val === null ? ' is-ghost' : '') + '" data-act="cell" ' +
        'data-ex="' + i + '" data-set="' + j + '" data-field="' + field + '">' + shown + '</button>';
    };

    return '<div class="set' + (s.done ? ' is-done' : '') + (s.warm ? ' is-warm' : '') +
      '" data-ex="' + i + '" data-set="' + j + '">' +
      '<button class="set-n" data-act="toggle-warm" data-ex="' + i + '" data-set="' + j +
      '" aria-label="Toggle warm-up set">' + label + '</button>' +
      '<button class="set-prev" data-act="fill-prev" data-ex="' + i + '" data-set="' + j + '"' +
      (prev ? ' data-fill="1"' : '') + '>' + (prev ? fmtSetValue(name, prev) : '—') + '</button>' +
      (timed ? '' : cell('w')) + cell('r') +
      '<button class="set-done" data-act="toggle-set" data-ex="' + i + '" data-set="' + j +
      '" aria-label="Mark set complete">' + icon('check') + '</button>' +
      '</div>';
  }

  /* Repaint one row and its exercise verdict without rebuilding the screen. */
  function paintSet(i, j) {
    var e = DB().active.entries[i], s = e.sets[j];
    var row = $('.set[data-ex="' + i + '"][data-set="' + j + '"]');
    if (!row) return;
    row.classList.toggle('is-done', !!s.done);
    row.classList.toggle('is-warm', !!s.warm);
    $('.set-n', row).textContent = s.warm ? 'W' : (workingIndex(e.sets, j) + 1);

    var prev = ghostSetFor(e.exercise, j);
    ['w', 'r'].forEach(function (f) {
      var cell = $('.cell[data-field="' + f + '"]', row);
      if (!cell) return;
      var ghost = prev ? prev[f] : null;
      cell.textContent = s[f] !== null ? n(s[f])
        : (ghost !== null && ghost !== undefined ? n(ghost) : '—');
      cell.classList.toggle('is-ghost', s[f] === null);
    });
    paintVerdict(i);
    var sub = $('#wkSub');
    if (sub) sub.textContent = workoutSubline(DB().active);
  }

  function paintNumbers(i) {
    var e = DB().active.entries[i];
    e.sets.forEach(function (s, j) { paintSet(i, j); });
  }

  function paintVerdict(i) {
    var e = DB().active.entries[i];
    var box = $('.verdict[data-ex="' + i + '"]');
    if (!box) return;
    /* Judge only what you've actually ticked. Prefilled numbers are a
       suggestion, not a result — calling them "matched" before you lift
       is just wrong. */
    var done = e.sets.filter(function (s) { return s.done; });
    var v = done.length
      ? verdictFor(e.exercise, done, prevSetsFor(e.exercise), bestEverOf(e.exercise))
      : null;
    if (!v) { box.innerHTML = ''; box.setAttribute('data-trend', ''); return; }
    box.setAttribute('data-trend', v.trend);
    box.innerHTML = '<span class="dot"></span><span>' + esc(v.text) + '</span>';
  }

  function toggleSet(i, j) {
    var e = DB().active.entries[i], s = e.sets[j];
    if (s.done) {
      s.done = false;
      paintSet(i, j);
      saveSoon();
      return;
    }
    /* Ticking an untouched set adopts the greyed values. */
    if (s.w === null || s.r === null) {
      var prev = ghostSetFor(e.exercise, j);
      if (!prev) { openCellPad(i, j, typeOf(e.exercise) === 'time' ? 'r' : 'w'); return; }
      if (s.w === null) s.w = prev.w;
      if (s.r === null) s.r = prev.r;
    }
    s.done = true;
    buzz(18);
    paintSet(i, j);
    Store.save();
    /* A rest timer is only meaningful if you're standing at the machine. */
    if (isLive()) startRest(e.restSec, s.warm ? 'Warm-up rest' : 'Rest');
  }

  function finishWorkout() {
    var a = DB().active;
    if (!a) return;

    var pending = 0;
    a.entries.forEach(function (e) {
      e.sets.forEach(function (s) {
        if (!s.done && s.w !== null && s.r !== null) pending++;
      });
    });
    if (pending && !confirm(plural(pending, 'set') + (pending === 1 ? ' still isn\'t' : ' still aren\'t') +
      ' ticked. Unticked sets are not saved. Finish anyway?')) return;

    var entries = [];
    a.entries.forEach(function (e) {
      var done = e.sets.filter(function (s) { return s.done && s.w !== null && s.r !== null; })
        .map(function (s) { return { w: s.w, r: s.r, warm: !!s.warm }; });
      if (done.length) entries.push({ exercise: e.exercise, note: e.note || '', sets: done });
    });

    if (!entries.length && !a.cardio.done) {
      toast('Tick at least one set first');
      return;
    }

    var ts = isLive() ? Date.now() : logDateOf(a);
    var prs = [];
    entries.forEach(function (e) {
      var todayBest = bestSetIn(e.exercise, e.sets);
      if (!todayBest) return;
      var prevBest = bestEverOf(e.exercise, ts);
      if (!prevBest || setRank(e.exercise, todayBest) > setRank(e.exercise, prevBest.set)) {
        prs.push({
          exercise: e.exercise, w: todayBest.w, r: todayBest.r,
          prevW: prevBest ? prevBest.set.w : null,
          prevR: prevBest ? prevBest.set.r : null
        });
      }
    });

    /* Anything logged today that isn't in the split yet — offer to keep it. */
    var planNames = DB().plan[a.split] || [];
    var added = entries.map(function (e) { return e.exercise; })
      .filter(function (nm) { return planNames.indexOf(nm) < 0; });

    var workout = {
      id: 'w' + ts, ts: ts, split: a.split,
      /* No session clock when logging afterwards — a made-up duration is
         worse than none. */
      durationMs: isLive() ? Math.max(0, Date.now() - a.startedAt) : 0,
      cardio: { done: a.cardio.done, minutes: a.cardio.minutes },
      entries: entries, prs: prs
    };

    var backDated = DB().workouts.some(function (w) { return w.ts > ts; });
    DB().workouts.push(workout);
    if (backDated) {
      /* Inserting into the middle of history invalidates every later
         record, so rebuild them all in date order. */
      DB().workouts.sort(function (x, y) { return x.ts - y.ts; });
      recomputeAllPRs();
    }
    DB().active = null;
    Store.save();
    stopTicker();
    restEl.hidden = true;
    go('summary', { id: workout.id, newExercises: added });
  }

  /* --- 7.3 Summary ------------------------------------------------------------- */

  function screenSummary() {
    var w = DB().workouts.filter(function (x) { return x.id === state.params.id; })[0];
    if (!w) { go('home'); return; }
    var split = SPLIT_BY_ID[w.split];
    var fresh = Date.now() - w.ts < 120000;
    var added = state.params.newExercises || [];
    document.body.classList.remove('is-focusmode');

    var html = '<div class="screen" data-hue="' + split.hue + '">';
    html += '<div class="done-mark">' + icon('check') + '</div>' +
      '<h1 class="done-title">' + esc(split.name) + (fresh ? ' logged' : '') + '</h1>' +
      '<p class="done-sub">' + fmtDay(w.ts) +
      (w.durationMs ? ' · ' + fmtDuration(w.durationMs) : '') + '</p>';

    if (w.prs && w.prs.length) {
      html += '<div class="sec-head"><h2>' + plural(w.prs.length, 'new record') + '</h2></div>';
      w.prs.forEach(function (p) {
        var now = fmtSetFull(p.exercise, { w: p.w, r: p.r });
        var was = p.prevW !== null
          ? 'was <s>' + fmtSetFull(p.exercise, { w: p.prevW, r: p.prevR }) + '</s>'
          : 'first time on the board';
        html += '<div class="pr-card"><div class="pr-k">Best set yet</div>' +
          '<div class="pr-ex">' + esc(p.exercise) + '</div>' +
          '<div class="pr-v">' + now + ' — ' + was + '</div></div>';
      });
    }

    if (fresh && added.length) {
      html += '<div class="sec-head"><h2>New to this workout</h2></div>';
      added.forEach(function (nm) {
        html += '<div class="card" style="display:flex;align-items:center;gap:12px;margin-bottom:10px">' +
          '<span style="flex:1"><div style="font-weight:650">' + esc(nm) + '</div>' +
          '<div class="hint">Add it to ' + esc(split.name) + ' for next time?</div></span>' +
          '<button class="btn btn-sm" data-act="keep-exercise" data-name="' + esc(nm) +
          '" data-split="' + w.split + '">Keep</button></div>';
      });
    }

    html += '<div class="sec-head"><h2>How it went</h2></div>' +
      '<div class="stats' + (w.durationMs ? '' : ' stats-3') + '">' +
      (w.durationMs ? statTile(fmtDuration(w.durationMs), '', 'Time in the gym', '', '') : '') +
      statTile(w.entries.length, '', 'Exercises done', '', '') +
      statTile(setsOfWorkout(w), '', 'Sets that count' + what('warmup'),
        (function () {
          var warm = w.entries.reduce(function (s, e) {
            return s + e.sets.filter(function (x) { return x.warm; }).length;
          }, 0);
          return warm ? 'plus ' + plural(warm, 'warm-up') : '';
        })(), '') +
      statTile(group(volumeOfWorkout(w)), UNIT, 'Total weight lifted' + what('volume'),
        'Weight × reps, added up', '') +
      '</div>';

    html += '<div class="sec-head"><h2>Cardio</h2></div>' +
      '<div class="card" style="display:flex;align-items:center;gap:12px">' +
      '<span style="width:22px;height:22px;flex:none;color:var(--' + (w.cardio.done ? 'green' : 'ink-3') + ')">' +
      icon(w.cardio.done ? 'check' : 'run') + '</span>' +
      '<span><div style="font-weight:640">' + esc(CARDIO.name) + '</div>' +
      '<div class="hint">' + (w.cardio.done ? w.cardio.minutes + ' minutes completed' : 'Not completed') +
      '</div></span></div>';

    html += '<div class="sec-head"><h2>Every set</h2></div><div class="rows">';
    w.entries.forEach(function (e) {
      var isPR = (w.prs || []).some(function (p) { return p.exercise === e.exercise; });
      var top = bestSetIn(e.exercise, e.sets);
      html += '<button class="row" data-hue="' + split.hue + '" data-act="open-history" data-ex="' +
        esc(e.exercise) + '"><span class="row-bar"></span><span class="row-main">' +
        '<span class="row-k">' + esc(e.exercise) + (isPR ? '<span class="badge">PR</span>' : '') + '</span>' +
        '<span class="row-sub">' + e.sets.map(function (s) {
          return fmtSetValue(e.exercise, s) + (s.warm ? ' (w)' : '');
        }).join(' · ') + '</span></span>' +
        '<span class="row-v"><span class="cell-v">' + fmtSetValue(e.exercise, top) + '</span></span>' +
        '<span class="row-chev">' + icon('chev') + '</span></button>';
    });
    html += '</div><button class="btn btn-primary" data-act="home">Done</button></div>';

    view.innerHTML = html;
  }

  /* --- 7.4 Records --------------------------------------------------------------- */

  function screenRecords() {
    var names = allExercisesLogged();
    var html = '<div class="screen"><header class="masthead"><h1>Records</h1>' +
      '<span class="tagline">Your best set on every exercise</span></header>';

    if (!names.length) {
      view.innerHTML = html + '<div class="card empty"><h3>No records yet</h3>' +
        '<p>Finish one workout and your best set on every exercise shows up here, ' +
        'so you always know what to beat.</p></div></div>';
      return;
    }

    if (!DB().learned.records) {
      html += '<div class="coach" data-hue="blue">' +
        '<span class="ic">' + icon('note') + '</span>' +
        '<div class="co-main"><h3>What counts as your best</h3>' +
        '<p>When two sets used different weights, Strongr compares them by ' +
        'estimated 1-rep max — so 60 kg × 10 beats 65 kg × 5. Tap any exercise ' +
        'to see how it has changed over time.</p></div>' +
        '<button class="co-x" data-act="learned" data-key="records" ' +
        'aria-label="Hide this">' + icon('close') + '</button></div>';
    }

    var grouped = {}, loose = [];
    names.forEach(function (nm) {
      var sp = splitOfExercise(nm);
      if (sp) { (grouped[sp.id] = grouped[sp.id] || []).push(nm); }
      else loose.push(nm);
    });

    var block = function (title, hue, list) {
      if (!list.length) return '';
      var out = '<div class="sec-head"><h2>' + esc(title) + '</h2></div><div class="rows">';
      list.forEach(function (nm) {
        var best = bestEverOf(nm);
        if (!best) return;
        var isNew = daysBetween(best.ts, Date.now()) <= 7;
        var t = typeOf(nm);
        var big = t === 'time' ? best.set.r + '<small>s</small>'
          : (best.set.w ? n(best.set.w) + '<small>' + UNIT + '</small>'
            : best.set.r + '<small>reps</small>');
        /* One line per row. The 1-rep max estimate has room to be named
           properly on the exercise's own page, so it lives there. */
        var sub = fmtSetFull(nm, best.set) + ' · ' + relDay(best.ts);
        out += '<button class="row"' + (hue ? ' data-hue="' + hue + '"' : '') +
          ' data-act="open-history" data-ex="' + esc(nm) + '">' +
          '<span class="row-bar"></span><span class="row-main">' +
          '<span class="row-k">' + esc(nm) + (isNew ? '<span class="badge">New</span>' : '') + '</span>' +
          '<span class="row-sub">' + sub + '</span></span>' +
          '<span class="row-v"><span class="cell-v">' + big + '</span></span>' +
          '<span class="row-chev">' + icon('chev') + '</span></button>';
      });
      return out + '</div>';
    };

    SPLITS.forEach(function (s) {
      html += block(s.name, s.hue, (DB().plan[s.id] || []).filter(function (nm) {
        return (grouped[s.id] || []).indexOf(nm) >= 0;
      }));
    });
    html += block('Other exercises', null, loose);

    view.innerHTML = html + '</div>';
  }

  /* --- 7.5 Exercise history --------------------------------------------------------- */

  function screenHistory() {
    var name = state.params.ex;
    var sp = splitOfExercise(name);
    var hue = sp ? sp.hue : 'blue';
    var h = historyOf(name);
    var timed = typeOf(name) === 'time';

    var html = '<div class="screen" data-hue="' + hue + '">' +
      '<div class="wk-head" style="position:static;background:none;backdrop-filter:none;' +
      '-webkit-backdrop-filter:none;border:0;margin:0 0 10px;padding:0">' +
      '<button class="icon-btn" data-act="back" aria-label="Back">' + icon('back') + '</button>' +
      '<div class="wk-title"><h2>' + esc(name) + '</h2>' +
      '<div class="wk-sub">' + (sp ? esc(sp.name) + ' · ' : '') + plural(h.length, 'session') +
      '</div></div></div>';

    if (!h.length) {
      view.innerHTML = html + '<div class="card empty"><h3>Not logged yet</h3>' +
        '<p>Train this at least twice and its progression chart appears here.</p></div></div>';
      return;
    }

    var best = bestEverOf(name);
    var firstBest = bestSetIn(name, h[0].sets);
    var lastBest = bestSetIn(name, h[h.length - 1].sets);
    var gain = (timed ? lastBest.r - firstBest.r : lastBest.w - firstBest.w);

    var showMax = typeOf(name) === 'weight' && best.set.w;
    html += '<div class="stats' + (showMax ? ' stats-3' : '') + '" style="margin-bottom:12px">' +
      statTile(timed ? best.set.r : n(best.set.w), timed ? 's' : UNIT, 'Best set' + what('bestset'),
        fmtSetFull(name, best.set), '') +
      (showMax ? statTile(e1rmText(best.set.w, best.set.r), UNIT,
        '1-rep max' + what('e1rm'), 'Estimated', '') : '') +
      statTile(signed(gain), timed ? 's' : UNIT, 'Since ' + fmtShort(h[0].ts),
        h.length > 1 ? plural(daysBetween(h[0].ts, h[h.length - 1].ts), 'day') + ' in' : 'One session in',
        gain > 0 ? 'delta-down' : gain < 0 ? 'delta-up' : 'delta-flat') +
      '</div>';

    var points = h.map(function (sess) {
      var b = bestSetIn(name, sess.sets);
      return { ts: sess.ts, value: timed ? b.r : b.w, set: b, name: name };
    });
    html += '<div class="card chart-wrap"><div class="chart-read" id="chartRead"></div>' +
      chartSVG(points) + '</div>';

    html += '<div class="sec-head"><h2>Every session</h2></div><div class="rows">';
    h.slice().reverse().forEach(function (sess, idx, arr) {
      var b = bestSetIn(name, sess.sets);
      var prevSess = arr[idx + 1];
      var pb = prevSess ? bestSetIn(name, prevSess.sets) : null;
      var delta = pb ? (timed ? b.r - pb.r : b.w - pb.w) : null;
      var cls = delta > 0 ? 'delta-down' : delta < 0 ? 'delta-up' : 'delta-flat';
      html += '<div class="sess"><div class="sess-top">' +
      '<span class="sess-date">' + fmtDay(sess.ts) + '</span>' +
        '<span class="sess-sum ' + cls + '">' +
        (delta === null ? plural(working(sess.sets).length, 'set')
          : (delta === 0 ? 'matched' : signed(delta) + (timed ? 's' : ' ' + UNIT))) +
        '</span></div><div class="sess-sets">' +
        (function () {
          /* Tied sets happen. Only the first one wears the crown. */
          var crowned = false;
          return sess.sets.map(function (s) {
            var isTop = !crowned && b && !s.warm && s.w === b.w && s.r === b.r;
            if (isTop) crowned = true;
            return '<span class="sess-set' + (s.warm ? ' is-warm' : isTop ? ' is-top' : '') + '">' +
              fmtSetValue(name, s) + '</span>';
          }).join('');
        })() +
        '</div>' + (sess.note ? '<div class="hint" style="margin-top:6px">' + esc(sess.note) + '</div>' : '') +
        '</div>';
    });
    html += '</div></div>';

    view.innerHTML = html;
    wireChart(points);
  }

  /* One series, so the heading names it and no legend is needed.
     Tap a point to read it out; labels only at the scale edges. */
  function chartSVG(points) {
    var W = 320, H = 150, padL = 8, padR = 46, padT = 18, padB = 26;
    var vals = points.map(function (p) { return p.value; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min -= 1; max += 1; }
    var span = max - min, innerW = W - padL - padR, innerH = H - padT - padB;

    var X = function (i) {
      return points.length === 1 ? padL + innerW / 2 : padL + i * innerW / (points.length - 1);
    };
    var Y = function (v) { return padT + (1 - (v - min) / span) * innerH; };

    var line = points.map(function (p, i) {
      return (i ? 'L' : 'M') + n(X(i)) + ' ' + n(Y(p.value));
    }).join(' ');
    var band = line + ' L' + n(X(points.length - 1)) + ' ' + n(padT + innerH) +
      ' L' + n(X(0)) + ' ' + n(padT + innerH) + ' Z';

    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
      'Top set across ' + points.length + ' sessions">';
    s += '<line class="grid" x1="' + padL + '" y1="' + padT + '" x2="' + (W - padR) + '" y2="' + padT + '"/>';
    s += '<line class="grid" x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (W - padR) +
      '" y2="' + (padT + innerH) + '"/>';
    s += '<text class="ax" x="' + (W - padR + 7) + '" y="' + (padT + 4) + '">' + n(max) + '</text>';
    s += '<text class="ax" x="' + (W - padR + 7) + '" y="' + (padT + innerH + 4) + '">' + n(min) + '</text>';
    s += '<path class="band" d="' + band + '"/><path class="plot" d="' + line + '"/>';
    points.forEach(function (p, i) {
      s += '<circle class="pt" data-i="' + i + '" cx="' + n(X(i)) + '" cy="' + n(Y(p.value)) + '" r="4"/>';
    });
    var slot = innerW / Math.max(1, points.length);
    points.forEach(function (p, i) {
      s += '<rect class="hit" data-i="' + i + '" x="' + n(X(i) - slot / 2 - 6) + '" y="0" width="' +
        n(slot + 12) + '" height="' + H + '"/>';
    });
    s += '<text class="ax" x="' + padL + '" y="' + (H - 6) + '">' + fmtShort(points[0].ts) + '</text>';
    if (points.length > 1) {
      s += '<text class="ax" x="' + (W - padR) + '" y="' + (H - 6) + '" text-anchor="end">' +
        fmtShort(points[points.length - 1].ts) + '</text>';
    }
    return s + '</svg>';
  }

  function wireChart(points) {
    var read = $('#chartRead');
    if (!read) return;
    var select = function (i) {
      var p = points[i];
      read.innerHTML = '<span class="cr-v">' + fmtSetFull(p.name, p.set) + '</span>' +
        '<span class="cr-d">' + fmtDay(p.ts) + '</span>';
      $$('.chart .pt').forEach(function (c) {
        c.classList.toggle('is-on', +c.getAttribute('data-i') === i);
      });
    };
    $$('.chart .hit').forEach(function (r) {
      r.addEventListener('pointerdown', function () { select(+r.getAttribute('data-i')); });
    });
    select(points.length - 1);
  }

  /* --- 7.6 Split editor ------------------------------------------------------------ */

  function screenPlans() {
    var d = DB();
    var html = '<div class="screen"><header class="masthead"><h1>Your workouts</h1>' +
      '<span class="tagline">Reorder, remove, or add exercises</span></header>' +
      '<p class="hint" style="margin:0 2px 18px">Tap an exercise to set the weights and ' +
      'reps you normally do, and new sheets arrive filled in. Removing an exercise ' +
      'keeps its history.</p>';

    SPLITS.forEach(function (s) {
      var list = d.plan[s.id] || [];
      html += '<div class="sec-head" data-hue="' + s.hue + '"><h2>' + esc(s.name) + '</h2>' +
        '<span class="meta">' + plural(list.length, 'exercise') + '</span></div><div class="rows">';
      list.forEach(function (nm, i) {
        var target = summariseTarget(nm);
        html += '<div class="row" data-hue="' + s.hue + '">' +
          '<span class="row-bar"></span>' +
          '<button class="row-main" data-act="plan-defaults" data-name="' + esc(nm) + '">' +
          '<span class="row-k">' + esc(nm) + '</span>' +
          '<span class="row-sub' + (target ? '' : ' is-unset') + '">' +
          (target ? esc(target) : 'Tap to set your usual sets') + '</span></button>' +
          '<button class="icon-btn" data-act="plan-move" data-split="' + s.id + '" data-i="' + i +
          '" data-dir="-1"' + (i === 0 ? ' disabled style="opacity:.3"' : '') +
          ' aria-label="Move up"><svg viewBox="0 0 24 24"><path d="M12 7l6 7H6z"/></svg></button>' +
          '<button class="icon-btn" data-act="plan-move" data-split="' + s.id + '" data-i="' + i +
          '" data-dir="1"' + (i === list.length - 1 ? ' disabled style="opacity:.3"' : '') +
          ' aria-label="Move down"><svg viewBox="0 0 24 24"><path d="M12 17l-6-7h12z"/></svg></button>' +
          '<button class="icon-btn" data-act="plan-remove" data-split="' + s.id + '" data-i="' + i +
          '" aria-label="Remove ' + esc(nm) + '" style="color:var(--down)">' + icon('trash') +
          '</button></div>';
      });
      html += '</div><button class="btn btn-sm" data-act="plan-add" data-split="' + s.id +
        '" style="margin-top:10px;width:100%">Add an exercise</button>';
    });

    view.innerHTML = html + '</div>';
  }

  /* --- 7.7 Weight -------------------------------------------------------------------- */

  function screenWeight() {
    var d = DB(), cur = bwCurrent();
    var wk = bwChange(7), mo = bwChange(30), best = bwBest(), trend = bwTrend();

    var cls = function (v) {
      if (v === null || Math.abs(v) < 0.05) return 'delta-flat';
      return (d.goal === 'gain' ? v > 0 : v < 0) ? 'delta-down' : 'delta-up';
    };

    var html = '<div class="screen" data-hue="blue">' +
      '<header class="masthead"><h1>Weight</h1>' +
      '<span class="tagline">One number, same time each day</span></header>';

    html += '<div class="card" style="margin-bottom:12px"><div class="bw-entry">' +
      '<button class="bw-big num" id="bwField" data-act="bw-pad">' +
      n(state.bwDraft !== undefined ? state.bwDraft : (cur ? cur.kg : 75)) +
      '<small>' + UNIT + '</small></button>' +
      '<button class="btn btn-primary btn-sm" data-act="bw-save" style="margin:0;height:58px">Save</button>' +
      '</div><div class="hint" style="margin-top:10px">' +
      'Saving twice on one day replaces that day\'s entry.</div></div>';

    html += '<div class="stats" style="margin-bottom:12px">' +
      statTile(cur ? n(cur.kg) : '—', cur ? UNIT : '', 'Current',
        cur ? relDay(cur.ts) : 'Nothing logged', '') +
      statTile(wk ? signed(wk.delta) : '—', wk ? UNIT : '', 'Past week',
        wk ? 'from ' + n(wk.from.kg) : 'Needs 2 entries', cls(wk ? wk.delta : null)) +
      statTile(mo ? signed(mo.delta) : '—', mo ? UNIT : '', 'Past month',
        mo ? 'from ' + n(mo.from.kg) : 'Needs 2 entries', cls(mo ? mo.delta : null)) +
      statTile(best ? n(best.kg) : '—', best ? UNIT : '', d.goal === 'gain' ? 'Heaviest' : 'Lightest',
        best ? fmtDate(best.ts) : '', '') +
      '</div>';

    if (trend !== null) {
      var tText = Math.abs(trend) < 0.05 ? 'flat'
        : (trend < 0 ? 'down' : 'up') + ' ' + n(Math.abs(trend)) + ' ' + UNIT + ' a week';
      html += '<div class="insight" data-hue="blue"><span class="ic">' + icon('bolt') + '</span>' +
        '<div><p>Trending <b>' + tText + '</b>.</p>' +
        '<div class="i-sub">From your last five entries</div></div></div>';
    }

    html += '<div class="sec-head"><h2>Goal</h2><span class="seg">' +
      '<button data-act="goal" data-goal="lose" aria-pressed="' + (d.goal !== 'gain') + '">Lose</button>' +
      '<button data-act="goal" data-goal="gain" aria-pressed="' + (d.goal === 'gain') + '">Gain</button>' +
      '</span></div><p class="hint" style="margin:0 2px">' +
      'Sets which direction counts as progress.</p>';

    if (d.bodyweight.length) {
      var list = d.bodyweight.slice().reverse();
      html += '<div class="sec-head"><h2>History</h2><span class="meta">' +
        d.bodyweight.length + (d.bodyweight.length === 1 ? ' entry' : ' entries') +
        '</span></div><div class="rows">';
      list.slice(0, 40).forEach(function (b, i) {
        var prev = list[i + 1];
        var delta = prev ? b.kg - prev.kg : null;
        html += '<div class="row" data-hue="blue"><span class="row-bar"></span>' +
          '<span class="row-main"><span class="row-k num">' + n(b.kg) + ' ' + UNIT + '</span>' +
          '<span class="row-sub">' + fmtDay(b.ts) + '</span></span>' +
          '<span class="row-v"><span class="cell-v ' + cls(delta) + '" style="font-size:14px">' +
          (delta === null ? '' : Math.abs(delta) < 0.05 ? '—' : signed(delta)) +
          '</span></span></div>';
      });
      html += '</div>';
    }

    view.innerHTML = html + '</div>';
  }

  function openBwPad() {
    var cur = bwCurrent();
    var val = state.bwDraft !== undefined ? state.bwDraft : (cur ? cur.kg : 75);
    state.bwBuffer = '';
    renderBwPad(val);
  }
  function renderBwPad(val) {
    state.bwDraft = val;
    openSheet('<h3>Bodyweight</h3><p class="sh-sub">' + fmtDay(Date.now()) + '</p>' +
      '<div class="pad-read"><span class="pr-k">Weight</span>' +
      '<span class="pr-v num">' + (state.bwBuffer || n(val)) + '<small>' + UNIT + '</small></span></div>' +
      '<div class="pad-quick">' +
      [-0.5, -0.1, 0.1, 0.5].map(function (c) {
        return '<button data-act="bw-step" data-by="' + c + '">' + signedKey(c) + '</button>';
      }).join('') + '</div><div class="pad-keys">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (k) {
        return '<button data-act="bw-key" data-k="' + k + '">' + k + '</button>';
      }).join('') +
      '<button data-act="bw-key" data-k="." class="k-fn">.</button>' +
      '<button data-act="bw-key" data-k="0">0</button>' +
      '<button data-act="bw-back" class="k-fn">Delete</button>' +
      '<button data-act="bw-commit" class="k-wide k-go">Save weight</button>' +
      '<button data-act="close-sheet" class="k-fn">Close</button></div>', 'blue');
  }

  function saveBodyweight(kg) {
    if (!isFinite(kg) || kg <= 0 || kg > 500) { toast('Enter a weight between 1 and 500'); return; }
    kg = Math.round(kg * 10) / 10;
    var today = dayKey(Date.now()), list = DB().bodyweight, existing = null;
    list.forEach(function (b) { if (dayKey(b.ts) === today) existing = b; });
    if (existing) { existing.kg = kg; existing.ts = Date.now(); }
    else list.push({ ts: Date.now(), kg: kg });
    list.sort(function (a, b) { return a.ts - b.ts; });
    Store.save();
    toast((existing ? 'Today updated to ' : 'Saved ') + n(kg) + ' ' + UNIT);
    state.bwDraft = kg;
    render();
  }

  /* --- 7.8 Insights ---------------------------------------------------------------- */

  function screenInsights() {
    var items = buildInsights(), d = DB();
    var html = '<div class="screen"><header class="masthead"><h1>Insights</h1>' +
      '<span class="tagline">Read out of your own logs</span></header>';

    if (!items.length) {
      html += '<div class="card empty"><h3>Not enough data yet</h3>' +
        '<p>Log two or three sessions and patterns start showing up here.</p></div>';
    } else {
      items.forEach(function (it) {
        html += '<div class="insight" data-hue="' + it.hue + '">' +
          '<span class="ic">' + icon(it.icon) + '</span><div><p>' + it.html + '</p>' +
          (it.sub ? '<div class="i-sub">' + esc(it.sub) + '</div>' : '') + '</div></div>';
      });
    }

    var pr = latestPR();
    html += '<div class="sec-head"><h2>At a glance</h2></div><div class="stats">' +
      statTile(workoutsThisWeek(), '', 'This week', 'Aiming for ' + SESSIONS_PER_WEEK, '') +
      statTile(cardioThisMonth(), '', 'Cardio this month', CARDIO.name, '') +
      statTile(group(d.workouts.reduce(function (s, w) { return s + volumeOfWorkout(w); }, 0)), UNIT,
        'Lifted all time' + what('volume'), plural(d.workouts.length, 'workout'), '') +
      statTile(pr ? fmtSetValue(pr.pr.exercise, { w: pr.pr.w, r: pr.pr.r }) : '—', '',
        'Latest record', pr ? esc(pr.pr.exercise) : 'None yet', '') +
      '</div>';

    html += '<div class="sec-head"><h2>When do you log?</h2>' +
      '<span class="seg">' +
      [['after', 'Afterwards'], ['live', 'In the gym']].map(function (m) {
        return '<button data-act="logmode" data-mode="' + m[0] + '" aria-pressed="' +
          (d.logMode === m[0]) + '">' + m[1] + '</button>';
      }).join('') +
      '</span></div>' +
      '<p class="hint" style="margin:0 2px">' + (d.logMode === 'live'
        ? 'A session clock runs and a rest timer starts after every set.'
        : 'No clock and no rest timer. You can set the date a workout happened, ' +
          'so logging Tuesday\'s session on Thursday still files it under Tuesday.') +
      '</p>';

    html += '<div class="sec-head"><h2>Appearance</h2>' +
      '<span class="seg">' +
      [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(function (t) {
        return '<button data-act="theme" data-theme="' + t[0] + '" aria-pressed="' +
          (d.theme === t[0]) + '">' + t[1] + '</button>';
      }).join('') +
      '</span></div>' +
      '<p class="hint" style="margin:0 2px">Auto follows your phone\'s light or dark setting.</p>';

    html += '<div class="sec-head"><h2>Your data</h2></div><div class="card">' +
      '<p class="hint">Everything stays in this browser — nothing is uploaded anywhere. ' +
      'Save a copy before you clear site data or move to a new phone.</p>' +
      '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
      '<button class="btn btn-sm" data-act="export">Save a copy</button>' +
      '<button class="btn btn-sm" data-act="import">Restore a copy</button>' +
      (d.workouts.length ? '' : '<button class="btn btn-sm" data-act="seed">Sample data</button>') +
      '<button class="btn btn-sm btn-danger" data-act="wipe">Erase everything</button>' +
      '</div></div>';

    if (Object.keys(d.learned).length) {
      html += '<button class="btn btn-ghost btn-sm" data-act="reset-tips" ' +
        'style="width:100%;margin-top:10px">Show the tips again</button>';
    }

    view.innerHTML = html + '</div>';
  }

  /* --- 7.9 Import / export ---------------------------------------------------------- */

  function exportData() {
    try {
      var blob = new Blob([JSON.stringify(DB(), null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'strongr-' + dayKey(Date.now()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('Export started');
    } catch (e) { toast('Export failed in this browser'); }
  }

  function importData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          if (!parsed || !Array.isArray(parsed.workouts)) throw new Error('shape');
          Store.data = Store.merge(parsed);
          Store.save();
          toast('Imported ' + plural(Store.data.workouts.length, 'workout'));
          go('home');
        } catch (e) { toast('That file isn\'t a Strongr export'); }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  /* =======================================================================
     8. Router & events
     ======================================================================= */

  var SCREENS = {
    home: screenHome, workout: screenWorkout, summary: screenSummary,
    records: screenRecords, history: screenHistory, plans: screenPlans,
    weight: screenWeight, insights: screenInsights
  };
  var TABS = { home: 'home', records: 'records', weight: 'weight', insights: 'insights' };

  function go(screen, params) {
    if (screen === 'history') state.prev = { screen: state.screen, params: state.params };
    else if (screen !== state.screen) state.prev = null;
    state.screen = screen;
    state.params = params || {};
    render();
    window.scrollTo(0, 0);
  }
  function goBack() {
    var p = state.prev;
    state.prev = null;
    if (p && SCREENS[p.screen] && p.screen !== 'history') go(p.screen, p.params);
    else go('records');
  }

  function render() {
    stopTicker();
    if (state.screen !== 'workout') {
      document.body.classList.remove('is-focusmode');
      restEl.hidden = true;
    }
    (SCREENS[state.screen] || screenHome)();
    $$('.tab').forEach(function (t) {
      if (TABS[state.screen] === t.getAttribute('data-go')) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  /* --- Delegated taps ---------------------------------------------------------- */

  document.addEventListener('click', function (ev) {
    if (ev.target === scrimEl) { closeSheet(); return; }

    var tab = ev.target.closest && ev.target.closest('[data-go]');
    if (tab) { closeSheet(); go(tab.getAttribute('data-go')); return; }

    var el = ev.target.closest && ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var exIdx = el.hasAttribute('data-ex') ? parseInt(el.getAttribute('data-ex'), 10) : null;
    var setIdx = el.hasAttribute('data-set') ? parseInt(el.getAttribute('data-set'), 10) : null;
    var a = DB().active;

    switch (act) {
      /* Navigation */
      case 'home': go('home'); break;
      case 'back': goBack(); break;
      case 'resume': go('workout'); break;
      case 'repeat': repeatLast(); break;
      case 'start': startWorkout(el.getAttribute('data-split'), false); break;
      case 'open-summary': go('summary', { id: el.getAttribute('data-id') }); break;
      case 'open-history': go('history', { ex: el.getAttribute('data-ex') }); break;
      case 'edit-plans': go('plans'); break;
      case 'close-sheet': closeSheet(); break;
      case 'finish': finishWorkout(); break;

      /* Set grid */
      case 'cell':
        openCellPad(exIdx, setIdx, el.getAttribute('data-field'));
        break;

      /* Default sets */
      case 'menu-defaults': openDefaults(a.entries[exIdx].exercise); break;
      case 'menu-capture': captureDefaults(exIdx); break;
      case 'plan-defaults': openDefaults(el.getAttribute('data-name')); break;
      case 'def-cell':
        openDefaultsPad(parseInt(el.getAttribute('data-set'), 10), el.getAttribute('data-field'));
        break;
      case 'def-warm': {
        var ds = defaults.sets[parseInt(el.getAttribute('data-set'), 10)];
        ds.warm = !ds.warm;
        renderDefaults();
        break;
      }
      case 'def-del': {
        if (defaults.sets.length <= 1) { toast('Keep at least one set'); break; }
        defaults.sets.splice(parseInt(el.getAttribute('data-set'), 10), 1);
        renderDefaults();
        break;
      }
      case 'def-add': {
        var lastD = defaults.sets[defaults.sets.length - 1];
        defaults.sets.push({ w: lastD ? lastD.w : null, r: lastD ? lastD.r : null, warm: false });
        renderDefaults();
        break;
      }
      case 'def-save': saveDefaults(); break;
      case 'def-cancel': finishDefaults(''); break;
      case 'def-clear': {
        delete DB().targets[defaults.name];
        Store.save();
        finishDefaults('Defaults removed');
        break;
      }
      case 'toggle-set': toggleSet(exIdx, setIdx); break;
      case 'toggle-warm': {
        var s0 = a.entries[exIdx].sets[setIdx];
        s0.warm = !s0.warm;
        paintNumbers(exIdx);
        saveSoon();
        toast(s0.warm ? 'Warm-up — kept out of records and volume' : 'Counted as a working set');
        break;
      }
      case 'fill-prev': {
        var e1 = a.entries[exIdx], prevS = prevSetFor(e1.exercise, setIdx);
        if (!prevS) { toast('No previous session for this exercise'); break; }
        var s1 = e1.sets[setIdx];
        s1.w = prevS.w; s1.r = prevS.r;
        paintSet(exIdx, setIdx);
        saveSoon();
        break;
      }
      case 'add-set': {
        var e2 = a.entries[exIdx];
        var lastS = e2.sets[e2.sets.length - 1];
        e2.sets.push({ w: lastS ? lastS.w : null, r: lastS ? lastS.r : null, warm: false, done: false });
        Store.save();
        render();
        break;
      }

      /* Exercise menu */
      case 'ex-menu': openExerciseMenu(exIdx); break;
      case 'menu-addset': {
        var e3 = a.entries[exIdx], l3 = e3.sets[e3.sets.length - 1];
        e3.sets.push({ w: l3 ? l3.w : null, r: l3 ? l3.r : null, warm: false, done: false });
        Store.save(); closeSheet(); render();
        break;
      }
      case 'menu-delset': {
        var e4 = a.entries[exIdx];
        if (e4.sets.length > 1) e4.sets.pop();
        Store.save(); closeSheet(); render();
        break;
      }
      case 'menu-note': openNoteSheet(exIdx); break;
      case 'save-note': {
        a.entries[exIdx].note = ($('#noteInput').value || '').slice(0, 120);
        Store.save(); closeSheet(); render();
        break;
      }
      case 'menu-rest': openRestPicker(exIdx); break;
      case 'set-rest': {
        var secs = parseInt(el.getAttribute('data-rest'), 10);
        a.entries[exIdx].restSec = secs;
        DB().library[a.entries[exIdx].exercise].rest = secs;
        Store.save(); closeSheet(); render();
        break;
      }
      case 'menu-swap': openPicker({ kind: 'replace', exIdx: exIdx }); break;
      case 'menu-remove': {
        a.entries.splice(exIdx, 1);
        Store.save(); closeSheet(); render();
        break;
      }
      case 'add-exercise': openPicker({ kind: 'add' }); break;
      case 'plan-add': openPicker({ kind: 'plan', splitId: el.getAttribute('data-split') }); break;

      case 'pick': {
        var name = el.getAttribute('data-name');
        if (pickerMode.kind === 'plan') {
          var list = DB().plan[pickerMode.splitId];
          if (list.indexOf(name) < 0) list.push(name);
          Store.save(); closeSheet(); render();
          toast(name + ' added');
        } else if (pickerMode.kind === 'replace') {
          a.entries[pickerMode.exIdx] = buildEntry(name, false);
          Store.save(); closeSheet(); render();
          toast('Swapped in ' + name);
        } else {
          a.entries.push(buildEntry(name, false));
          Store.save(); closeSheet(); render();
          var block = $('.ex[data-ex="' + (a.entries.length - 1) + '"]');
          if (block) block.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        break;
      }
      case 'new-exercise': renderNewExercise($('#pickSearch') ? $('#pickSearch').value : ''); break;
      case 'new-type': {
        $$('#newType button').forEach(function (b) {
          b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
        });
        break;
      }
      case 'new-rest': {
        $$('#newRest button').forEach(function (b) {
          b.setAttribute('aria-pressed', b === el ? 'true' : 'false');
        });
        break;
      }
      case 'save-exercise': {
        var nm = ($('#newName').value || '').trim().slice(0, 40);
        if (!nm) { toast('Give the exercise a name'); break; }
        if (DB().library[nm]) { toast(nm + ' already exists'); break; }
        var tSel = $('#newType button[aria-pressed="true"]');
        var rSel = $('#newRest button[aria-pressed="true"]');
        DB().library[nm] = {
          type: tSel ? tSel.getAttribute('data-type') : 'weight',
          rest: rSel ? parseInt(rSel.getAttribute('data-rest'), 10) : 90,
          group: 'Yours'
        };
        if (pickerMode && pickerMode.kind === 'plan') {
          DB().plan[pickerMode.splitId].push(nm);
        } else if (a) {
          if (pickerMode && pickerMode.kind === 'replace') a.entries[pickerMode.exIdx] = buildEntry(nm, false);
          else a.entries.push(buildEntry(nm, false));
        }
        Store.save(); closeSheet(); render();
        toast(nm + ' created');
        break;
      }
      case 'keep-exercise': {
        var kn = el.getAttribute('data-name'), ks = el.getAttribute('data-split');
        if (DB().plan[ks].indexOf(kn) < 0) DB().plan[ks].push(kn);
        Store.save();
        el.textContent = 'Kept';
        el.setAttribute('disabled', 'disabled');
        toast(kn + ' added to ' + SPLIT_BY_ID[ks].name);
        break;
      }

      /* Number pad */
      case 'pad-key': {
        var k = el.getAttribute('data-k');
        if (k === '.' && pad.buffer.indexOf('.') >= 0) break;
        if (pad.buffer.length >= 6) break;
        pad.buffer += k;
        var out = $('#padOut');
        if (out) out.firstChild.nodeValue = pad.buffer;
        break;
      }
      case 'pad-back': {
        pad.buffer = pad.buffer.length ? pad.buffer.slice(0, -1) : '';
        var out2 = $('#padOut');
        if (out2) out2.firstChild.nodeValue = pad.buffer || n(padValue());
        break;
      }
      case 'pad-clear': { padSetValue(0); break; }
      case 'pad-step': { padSetValue(padValue() + parseFloat(el.getAttribute('data-by'))); break; }
      case 'pad-go': {
        padCommit();
        if (pad.field === 'w' && typeOf(pad.name) !== 'time') {
          pad.field = 'r'; pad.buffer = '';
          renderPad(); markActiveCell();
        } else {
          pad.onDone();
        }
        break;
      }
      case 'pad-close': {
        var back = pad.returnTo;
        closeSheet();
        if (back) back();
        break;
      }

      /* Rest timer */
      case 'rest-nudge': nudgeRest(parseInt(el.getAttribute('data-by'), 10)); break;
      case 'rest-skip': stopRest(); break;

      /* Cardio */
      case 'cardio-mins': ev.stopPropagation(); openCardioSheet(); break;
      case 'cardio': {
        a.cardio.done = !a.cardio.done;
        el.setAttribute('aria-pressed', a.cardio.done ? 'true' : 'false');
        saveSoon();
        break;
      }
      case 'set-cardio': {
        a.cardio.minutes = parseInt(el.getAttribute('data-mins'), 10);
        a.cardio.done = true;
        Store.save(); closeSheet(); render();
        break;
      }

      /* Split editor */
      case 'plan-move': {
        var sid = el.getAttribute('data-split');
        var from = parseInt(el.getAttribute('data-i'), 10);
        var to = from + parseInt(el.getAttribute('data-dir'), 10);
        var arr = DB().plan[sid];
        if (to < 0 || to >= arr.length) break;
        var tmp = arr[from]; arr[from] = arr[to]; arr[to] = tmp;
        Store.save(); render();
        break;
      }
      case 'plan-remove': {
        var sid2 = el.getAttribute('data-split');
        var idx2 = parseInt(el.getAttribute('data-i'), 10);
        var removed = DB().plan[sid2].splice(idx2, 1)[0];
        Store.save(); render();
        toast(removed + ' removed — its history is kept');
        break;
      }

      /* Bodyweight */
      case 'bw-pad': openBwPad(); break;
      case 'bw-key': {
        var bk = el.getAttribute('data-k');
        if (bk === '.' && state.bwBuffer.indexOf('.') >= 0) break;
        if (state.bwBuffer.length >= 5) break;
        state.bwBuffer += bk;
        $('.pad-read .pr-v').firstChild.nodeValue = state.bwBuffer;
        break;
      }
      case 'bw-back': {
        state.bwBuffer = state.bwBuffer.slice(0, -1);
        $('.pad-read .pr-v').firstChild.nodeValue = state.bwBuffer || n(state.bwDraft);
        break;
      }
      case 'bw-step': {
        var base = state.bwBuffer ? parseFloat(state.bwBuffer) : state.bwDraft;
        state.bwBuffer = '';
        renderBwPad(Math.max(0, Math.round((base + parseFloat(el.getAttribute('data-by'))) * 10) / 10));
        break;
      }
      case 'bw-commit': {
        var v = state.bwBuffer ? parseFloat(state.bwBuffer) : state.bwDraft;
        state.bwBuffer = '';
        closeSheet();
        saveBodyweight(v);
        break;
      }
      case 'bw-save': {
        var cur2 = bwCurrent();
        saveBodyweight(state.bwDraft !== undefined ? state.bwDraft : (cur2 ? cur2.kg : 75));
        break;
      }
      case 'goal': { DB().goal = el.getAttribute('data-goal'); Store.save(); render(); break; }

      /* Learning aids */
      case 'explain': openGlossary(el.getAttribute('data-term')); break;
      case 'learned': {
        DB().learned[el.getAttribute('data-key')] = true;
        Store.save(); render();
        break;
      }
      case 'reset-tips': { DB().learned = {}; Store.save(); render(); toast('Tips are back'); break; }
      case 'logmode': {
        DB().logMode = el.getAttribute('data-mode');
        if (!isLive() && DB().active) DB().active.rest = null;
        Store.save(); render();
        break;
      }
      case 'pick-date': openDateSheet(); break;
      case 'set-date': applyLogDate(el.getAttribute('data-day')); break;
      case 'set-date-custom': {
        var di = $('#dateInput');
        if (di && di.value) applyLogDate(di.value);
        else toast('Pick a date first');
        break;
      }
      case 'theme': {
        DB().theme = el.getAttribute('data-theme');
        Store.save(); applyTheme(); render();
        break;
      }

      /* Data */
      case 'export': exportData(); break;
      case 'import': importData(); break;
      case 'seed': seedSample(); break;
      case 'discard': {
        if (confirm('Discard this workout? Nothing is saved.')) {
          DB().active = null; Store.save(); stopTicker(); restEl.hidden = true; go('home');
        }
        break;
      }
      case 'wipe': {
        if (confirm('Erase every workout, record and weight entry? This cannot be undone.')) {
          Store.reset(); toast('All data erased'); go('home');
        }
        break;
      }
    }
  });

  /* Live search in the exercise picker */
  document.addEventListener('input', function (ev) {
    if (ev.target.id === 'pickSearch') {
      var pos = ev.target.value;
      renderPicker(pos);
      var box = $('#pickSearch');
      if (box) { box.focus(); box.setSelectionRange(pos.length, pos.length); }
    }
  });

  /* Physical keyboard support for the number pad */
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && sheetOpen()) { closeSheet(); return; }
    if (!pad || !sheetOpen()) return;
    if (/^[0-9]$/.test(ev.key) || ev.key === '.') {
      ev.preventDefault();
      var btn = $('.pad-keys button[data-k="' + ev.key + '"]');
      if (btn) btn.click();
    } else if (ev.key === 'Backspace') {
      ev.preventDefault();
      var b = $('[data-act="pad-back"]');
      if (b) b.click();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      var g = $('[data-act="pad-go"]');
      if (g) g.click();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (state.screen === 'workout' && DB().active && isLive()) { startTicker(); paintRest(); }
  });

  /* =======================================================================
     9. Sample data — ten weeks of plausible training
     ======================================================================= */

  /* start / end load over the block, and the rep scheme down the sets.
     Warm-up sets are included where a real lifter would take one. */
  var SAMPLE = {
    'Lat Pulldown':                [45,  65,  [12, 10, 8],  true],
    'Seated Cable Row':            [45,  62.5, [12, 10, 10], false],
    'Incline Dumbbell Curl':       [10,  14,  [12, 10, 10], false],
    'Cable Curl':                  [22.5, 32.5, [12, 12, 10], false],
    'Preacher Curl':               [15,  20,  [12, 10, 8],  false],
    'Flat Dumbbell Press':         [22.5, 32.5, [12, 10, 8],  true],
    'Incline Dumbbell Press':      [20,  28,  [12, 10, 8],  false],
    'Pec Deck':                    [40,  55,  [12, 12, 10], false],
    'Triceps Rope Pushdown':       [25,  35,  [14, 12, 10], false],
    'Overhead Dumbbell Extension': [15,  22.5, [12, 12, 10], false],
    'Reverse Pushdown':            [15,  22.5, [15, 12, 10], false],
    'Dips':                        [0,   10,  [10, 9, 8],   false],
    'Dumbbell Shoulder Press':     [16,  24,  [12, 10, 8],  true],
    'Lateral Raise':               [7.5, 12.5, [14, 12, 10], false],
    'Reverse Pec Deck':            [25,  35,  [14, 12, 12], false],
    'Face Pull':                   [20,  30,  [15, 12, 12], false],
    'Captain Chair Leg Raise':     [0,   0,   [12, 11, 10], false],
    'Machine Crunch':              [30,  45,  [15, 14, 12], false],
    'Plank':                       [45,  90,  [1, 1, 1],    false],
    'Squat':                       [60,  90,  [10, 8, 6],   true],
    'Leg Press':                   [120, 180, [12, 10, 10], true],
    'Leg Extension':               [40,  60,  [15, 12, 12], false],
    'Leg Curl':                    [35,  50,  [12, 12, 10], false],
    'Romanian Deadlift':           [50,  75,  [10, 10, 8],  false],
    'Walking Lunges':              [12,  20,  [12, 12, 10], false],
    'Standing Calf Raise':         [60,  90,  [15, 15, 12], false]
  };

  function seedSample() {
    if (DB().workouts.length &&
      !confirm('Replace your existing data with a ten-week sample block?')) return;

    var d = Store.blank();
    Store.data = d;

    var order = ['back', 'chest', 'shoulder', 'legs'];
    var monday = weekStart(Date.now()) - 9 * 7 * 86400000;
    var session = 0;

    for (var w = 0; w < 10; w++) {
      for (var k = 0; k < order.length; k++) {
        var splitId = order[k];
        /* Two skipped leg days in the middle, so the insights have something true to say. */
        if (splitId === 'legs' && (w === 5 || w === 6)) continue;

        var ts = monday + (w * 7 + k * 2) * 86400000 + 18 * 3600000 + (session % 5) * 300000;
        if (ts > Date.now()) continue;

        var entries = [];
        d.plan[splitId].forEach(function (name) {
          var spec = SAMPLE[name];
          if (!spec) return;
          var t = typeOf(name);
          /* Gains come quickly then flatten — linear progression decays,
             it doesn't run forever. */
          var progress = 1 - Math.pow(1 - w / 9, 1.8);
          var step = t === 'time' ? 5 : (BIG_STEP.indexOf(name) >= 0 ? 5 : 2.5);
          var raw = spec[0] + (spec[1] - spec[0]) * progress;
          var load = Math.round(raw / step) * step;
          var reps = spec[2];
          var sets = [];

          if (spec[3] && load > step * 2) {
            sets.push({ w: Math.round(load * 0.5 / step) * step, r: 10, warm: true });
          }
          reps.forEach(function (r, ri) {
            if (t === 'time') {
              sets.push({ w: 0, r: Math.round(load), warm: false });
              return;
            }
            /* Reps wobble a little session to session, and the heavy lifts
               take a back-off on the last set — which is what happens. */
            var jitter = [0, -1, 0, 1][(w * 3 + ri * 2 + k) % 4];
            var backOff = (spec[3] && ri === reps.length - 1) ? step : 0;
            var setLoad = Math.max(t === 'bodyweight' ? 0 : step, load - backOff);
            sets.push({ w: setLoad, r: Math.max(5, r + jitter), warm: false });
          });
          entries.push({ exercise: name, note: '', sets: sets });
        });

        var workout = {
          id: 'w' + ts, ts: ts, split: splitId,
          durationMs: (44 + (session % 11)) * 60000,
          cardio: { done: session % 4 !== 3, minutes: [15, 15, 20, 12][session % 4] },
          entries: entries, prs: []
        };
        d.workouts.push(workout);
        session++;
      }
    }

    /* Recompute records exactly the way a live session would. */
    d.workouts.forEach(function (workout) {
      workout.entries.forEach(function (e) {
        var todayBest = bestSetIn(e.exercise, e.sets);
        if (!todayBest) return;
        var prevBest = bestEverOf(e.exercise, workout.ts);
        if (!prevBest || setRank(e.exercise, todayBest) > setRank(e.exercise, prevBest.set)) {
          workout.prs.push({
            exercise: e.exercise, w: todayBest.w, r: todayBest.r,
            prevW: prevBest ? prevBest.set.w : null,
            prevR: prevBest ? prevBest.set.r : null
          });
        }
      });
    });

    var kg = 82.4;
    for (var i = 68; i >= 0; i -= 2) {
      d.bodyweight.push({ ts: startOfDay(Date.now()) - i * 86400000 + 25200000, kg: Math.round(kg * 10) / 10 });
      kg -= 0.16 + (i % 3) * 0.04;
    }
    d.bodyweight.sort(function (a, b) { return a.ts - b.ts; });

    Store.save();
    toast('Ten weeks of sample training loaded');
    go('home');
  }

  /* =======================================================================
     Boot
     ======================================================================= */

  function attachManifest() {
    try {
      var m = {
        name: 'Strongr', short_name: 'Strongr', description: 'Track. Progress. Repeat.',
        display: 'standalone',
        background_color: '#F4F6FA', theme_color: '#2563D6',
        icons: [{
          src: 'data:image/svg+xml,' + encodeURIComponent(
            "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>" +
            "<rect width='512' height='512' rx='112' fill='#2563D6'/>" +
            "<g fill='#FFFFFF'><rect x='64' y='176' width='56' height='160' rx='24'/>" +
            "<rect x='392' y='176' width='56' height='160' rx='24'/>" +
            "<rect x='136' y='224' width='240' height='64' rx='32'/></g></svg>"),
          sizes: '512x512', type: 'image/svg+xml', purpose: 'any'
        }]
      };
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
      document.head.appendChild(link);
    } catch (e) {}
  }

  Store.load();
  applyTheme();
  attachManifest();

  /* Only follow the system when the user asked for Auto. */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { if (DB().theme === 'auto') applyTheme(); };
    if (mq.addEventListener) mq.addEventListener('change', onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  go(DB().active ? 'workout' : 'home');

})();
