import '@videojs/html/video/player';
import '@videojs/html/ui/container';
import '@videojs/html/ui/controls';
import '@videojs/html/ui/controls-content';
import '@videojs/html/ui/play-button';
import '@videojs/html/ui/seek-button';
import '@videojs/html/ui/mute-button';
import '@videojs/html/ui/fullscreen-button';
import '@videojs/html/ui/pip-button';
import '@videojs/html/ui/time-slider';
import '@videojs/html/ui/volume-slider';
import '@videojs/html/ui/slider-track';
import '@videojs/html/ui/slider-buffer';
import '@videojs/html/ui/slider-fill';
import '@videojs/html/ui/slider-thumb';
import '@videojs/html/ui/time';
import '@videojs/html/ui/hotkey';
import '@videojs/html/ui/status-announcer';
import '@videojs/html/ui/buffering-indicator';
import '@videojs/html/ui/error-dialog';
import '@videojs/html/ui/dialog-popup';
import '@videojs/html/ui/dialog-title';
import '@videojs/html/ui/dialog-description';
import '@videojs/html/ui/dialog-close';
import {
  UIElement,
  PlayerController,
  playerContext,
  selectPlayback,
  selectVolume,
  selectFullscreen,
  selectPlaybackRate,
} from '@videojs/html';

/* ---------- tape-deck sounds (all synthesised, no audio files) ---------- */
let audio, master, noiseBuf;
let sfxOn = true;
function ctx() {
  if (!sfxOn) return null;
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      const comp = audio.createDynamicsCompressor();
      master = audio.createGain();
      master.gain.value = 0.8;
      master.connect(comp).connect(audio.destination);
      noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  } catch {
    return null;
  }
}
function shape(g, t, attack, peak, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function noise(c, at, dur, type, f0, f1, q, peak) {
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  shape(g, t, 0.004, peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}
function tone(c, at, dur, type, f0, f1, peak, attack = 0.004) {
  const t = c.currentTime + at;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  shape(g, t, attack, peak, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + attack + 0.05);
}
const sfx = {
  // "ka-chunk": latch click, then the key bottoming out with a little spring ring
  key(weight = 1) {
    const c = ctx();
    if (!c) return;
    noise(c, 0, 0.012, 'highpass', 3200, 2400, 0.7, 0.5);
    noise(c, 0.022, 0.07, 'bandpass', 900, 420, 1.1, 0.7 * weight);
    tone(c, 0.022, 0.11, 'sine', 170 * (2 - weight), 52, 0.6 * weight);
    tone(c, 0.026, 0.16, 'triangle', 2140, 2090, 0.035);
    tone(c, 0.026, 0.12, 'triangle', 3310, 3260, 0.02);
  },
  // capstan motor spinning up / winding down
  motorUp() {
    const c = ctx();
    if (!c) return;
    tone(c, 0.05, 0.42, 'sawtooth', 38, 118, 0.07, 0.08);
    noise(c, 0.05, 0.5, 'bandpass', 500, 2600, 0.8, 0.07);
  },
  motorDown() {
    const c = ctx();
    if (!c) return;
    tone(c, 0.03, 0.34, 'sawtooth', 118, 30, 0.07, 0.02);
    noise(c, 0.03, 0.3, 'bandpass', 2400, 400, 0.8, 0.06);
  },
  // tape shuttling past the head
  scrub(dir) {
    const c = ctx();
    if (!c) return;
    const [a, b] = dir > 0 ? [700, 3400] : [3400, 700];
    noise(c, 0.04, 0.26, 'bandpass', a, b, 5, 0.42);
    tone(c, 0.04, 0.24, 'sawtooth', a / 3, b / 3, 0.035, 0.03);
    noise(c, 0.3, 0.05, 'bandpass', 800, 500, 1, 0.3);
  },
  tick() {
    const c = ctx();
    if (!c) return;
    noise(c, 0, 0.008, 'bandpass', 2600, 2200, 2, 0.32);
    tone(c, 0, 0.018, 'sine', 1250, 900, 0.07, 0.001);
  },
  pop() {
    const c = ctx();
    if (!c) return;
    tone(c, 0, 0.07, 'sine', 240, 70, 0.4, 0.002);
  },
  // CRT on-screen-display beeps
  menuOpen() {
    const c = ctx();
    if (!c) return;
    tone(c, 0.05, 0.05, 'square', 880, 880, 0.06, 0.002);
    tone(c, 0.12, 0.08, 'square', 1320, 1320, 0.06, 0.002);
  },
  menuClose() {
    const c = ctx();
    if (!c) return;
    tone(c, 0, 0.05, 'square', 1320, 1320, 0.06, 0.002);
    tone(c, 0.07, 0.08, 'square', 880, 880, 0.06, 0.002);
  },
  select() {
    const c = ctx();
    if (!c) return;
    tone(c, 0, 0.045, 'square', 1760, 1760, 0.05, 0.002);
  },
  // tube warming up with a degauss thump / collapsing to a dot
  crtOn() {
    const c = ctx();
    if (!c) return;
    tone(c, 0, 0.5, 'sine', 55, 50, 0.5, 0.01);
    tone(c, 0, 0.45, 'sawtooth', 110, 96, 0.06, 0.01);
    noise(c, 0, 0.35, 'highpass', 5000, 9000, 0.5, 0.09);
    tone(c, 0.02, 0.6, 'sine', 9000, 12500, 0.012, 0.05);
  },
  crtOff() {
    const c = ctx();
    if (!c) return;
    tone(c, 0, 0.18, 'sine', 1400, 60, 0.25, 0.002);
    noise(c, 0, 0.05, 'highpass', 6000, 3000, 0.5, 0.12);
  },
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Focus rings are for keyboard navigation: on after Tab, off again on the next click or tap.
const kbdNav = (on) => document.documentElement.toggleAttribute('data-kbd', on);
document.addEventListener('keydown', (e) => e.key === 'Tab' && kbdNav(true), true);
document.addEventListener('pointerdown', () => kbdNav(false), true);

class SideADeck extends UIElement {
  #playback = new PlayerController(this, playerContext, selectPlayback);
  #volume = new PlayerController(this, playerContext, selectVolume);
  #fullscreen = new PlayerController(this, playerContext, selectFullscreen);
  #rate = new PlayerController(this, playerContext, selectPlaybackRate);
  #abort = null;
  #last = {};
  #menuTrigger = null;
  #staticTimer = 0;
  #activeTimer = 0;
  #dragging = false;

  connectedCallback() {
    super.connectedCallback();
    this.hidden = true;
    const root = (this.root = this.closest('media-container'));
    this.video = root.querySelector('video');
    this.menu = root.querySelector('.menu');
    this.knob = root.querySelector('.knob');
    this.staticCanvas = root.querySelector('.static');
    this.#abort?.abort();
    this.#abort = new AbortController();
    const { signal } = this.#abort;

    root.addEventListener('click', this.#onClick, { signal });
    root.addEventListener('pointerdown', this.#poke, { signal, capture: true });
    root.querySelector('.screen').addEventListener('pointermove', this.#poke, { signal });
    root.addEventListener('dblclick', this.#onDblClick, { signal });
    this.menu.addEventListener('keydown', this.#onMenuKey, { signal });
    document.addEventListener('keydown', this.#onDocKey, { signal });
    this.knob.addEventListener('pointerdown', this.#onKnobDown, { signal });
    this.knob.addEventListener('pointermove', this.#onKnobMove, { signal });
    this.knob.addEventListener('pointerup', this.#onKnobUp, { signal });
    this.knob.addEventListener('pointercancel', this.#onKnobUp, { signal });
    this.knob.addEventListener('keydown', this.#onKnobKey, { signal });
    this.knob.addEventListener('wheel', this.#onKnobWheel, { signal, passive: false });
    this.video.addEventListener('ratechange', () => this.requestUpdate?.(), { signal });
    try {
      if (localStorage.getItem('side-a-crt') === 'off') this.#setCrt(false, true);
    } catch {}
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abort?.abort();
    this.#abort = null;
    clearInterval(this.#staticTimer);
    clearTimeout(this.#activeTimer);
  }

  update(changed) {
    super.update(changed);
    const root = this.root;
    if (!root) return;
    const pb = this.#playback.value;
    const vol = this.#volume.value;
    const fs = this.#fullscreen.value;
    const rate = this.#rate.value;
    const last = this.#last;

    if (pb) {
      const state = pb.ended ? 'ended' : !pb.started ? 'idle' : pb.paused ? 'paused' : 'playing';
      if (state !== last.state) {
        if (last.state !== undefined) {
          sfx.key(state === 'playing' ? 1 : 0.85);
          if (state === 'playing') sfx.motorUp();
          else if (last.state === 'playing') sfx.motorDown();
        }
        last.state = state;
        root.dataset.state = state;
        this.#poke();
        this.#syncStatic();
        root.querySelector('[data-key="play"]').setAttribute('aria-pressed', String(state === 'playing'));
        root.querySelector('[data-key="pause"]').setAttribute('aria-pressed', String(state === 'paused'));
        root.querySelector('[data-prompt]').textContent = state === 'ended' ? 'END OF TAPE' : 'PRESS PLAY';
      }
    }

    if (vol) {
      const pct = Math.round(vol.volume * 100);
      if (pct !== last.pct || vol.muted !== last.muted) {
        if (last.pct !== undefined && pct !== last.pct) sfx.tick();
        else if (last.muted !== undefined && vol.muted !== last.muted) sfx.pop();
        last.pct = pct;
        last.muted = vol.muted;
        this.#poke();
        this.knob.style.setProperty('--turn', `${-135 + 270 * vol.volume}deg`);
        this.knob.setAttribute('aria-valuenow', String(pct));
        this.knob.setAttribute('aria-valuetext', vol.muted ? `${pct}%, muted` : `${pct}%`);
        root.querySelector('[data-readout]').textContent = vol.muted || pct === 0 ? 'MUTE' : `${pct}%`;
        root.toggleAttribute('data-muted', vol.muted || pct === 0);
      }
    }

    if (fs && fs.isFullscreen !== last.fs) {
      if (last.fs !== undefined) sfx.key(1.25);
      last.fs = fs.isFullscreen;
      this.#poke();
      root.toggleAttribute('data-fs', fs.isFullscreen);
    }

    const r = rate?.playbackRate ?? 1;
    if (r !== last.rate) {
      last.rate = r;
      this.#poke();
      for (const b of this.menu.querySelectorAll('[data-rate]')) {
        const on = Number(b.dataset.rate) === r;
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on ? 0 : -1;
      }
    }

    const s = root.dataset.state;
    const label = s === 'playing' ? 'PLAY ▶' : s === 'paused' ? 'PAUSE ❚❚' : s === 'ended' ? 'END' : 'STOP';
    root.querySelector('[data-status]').textContent = r !== 1 ? `${label}  ${r}x` : label;
  }

  /* ---------- wake the on-screen time bar and labels for a moment ---------- */
  #poke = () => {
    this.root.toggleAttribute('data-active', true);
    clearTimeout(this.#activeTimer);
    this.#activeTimer = setTimeout(() => this.root.removeAttribute('data-active'), 2600);
  };

  /* ---------- actions ---------- */
  #play() {
    this.#playback.value?.play()?.catch?.(() => {});
  }
  #toggle() {
    const pb = this.#playback.value;
    if (!pb) return;
    if (pb.paused || pb.ended) this.#play();
    else pb.pause();
  }
  #setVolume(v) {
    const vol = this.#volume.value;
    if (!vol) return;
    v = clamp(v, 0, 1);
    vol.setVolume(v);
    if (vol.muted && v > 0) vol.setMuted(false);
  }

  #onClick = (e) => {
    const t = e.target.closest('[data-action],[data-rate],[data-toggle],.key,media-seek-button,video,.fx,.osd-prompt');
    if (!t || !this.root.contains(t)) return;
    if (t.matches('video,.fx,.osd-prompt')) return this.#toggle();
    if (t.dataset.rate) {
      sfx.select();
      return this.#rate.value?.setPlaybackRate(Number(t.dataset.rate));
    }
    if (t.dataset.toggle) {
      const on = t.getAttribute('aria-pressed') !== 'true';
      if (t.dataset.toggle === 'crt') return this.#setCrt(on);
      t.setAttribute('aria-pressed', String(on));
      t.textContent = on ? 'ON' : 'OFF';
      if (t.dataset.toggle === 'loop') this.video.loop = on;
      else sfxOn = on;
      sfx.select();
      return;
    }
    switch (t.dataset.action) {
      case 'play':
        if (this.root.dataset.state === 'playing') sfx.key(0.6);
        return this.#play();
      case 'pause':
        if (this.root.dataset.state !== 'playing') sfx.key(0.6);
        return this.#playback.value?.pause();
      case 'menu':
        sfx.key(0.85);
        return this.menu.hidden ? this.#openMenu(t) : this.#closeMenu();
      case 'menu-close':
        return this.#closeMenu();
      default:
        if (t.matches('media-seek-button')) {
          sfx.key(0.85);
          sfx.scrub(Number(t.getAttribute('seconds')) > 0 ? 1 : -1);
        }
    }
  };

  #onDblClick = (e) => {
    if (!e.target.matches('video,.fx,.osd-prompt')) return;
    const fs = this.#fullscreen.value;
    if (!fs) return;
    (fs.isFullscreen ? fs.exitFullscreen() : fs.requestFullscreen())?.catch?.(() => {});
  };

  /* ---------- TV static before the tape starts (part of the retro effect) ---------- */
  #drawStatic() {
    const c = this.staticCanvas;
    const g = c.getContext('2d');
    const d = g.createImageData(c.width, c.height);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }
  #syncStatic() {
    const on = this.root.dataset.state === 'idle' && !this.root.hasAttribute('data-crt-off');
    clearInterval(this.#staticTimer);
    this.#staticTimer = 0;
    if (!on || !this.staticCanvas) return;
    this.#drawStatic();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.#staticTimer = setInterval(() => {
      if (!document.hidden) this.#drawStatic();
    }, 70);
  }

  /* ---------- CRT effect ---------- */
  #setCrt(on, silent = false) {
    this.root.toggleAttribute('data-crt-off', !on);
    this.#syncStatic();
    const b = this.menu.querySelector('[data-toggle="crt"]');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'ON' : 'OFF';
    try {
      localStorage.setItem('side-a-crt', on ? 'on' : 'off');
    } catch {}
    if (silent) return;
    on ? sfx.crtOn() : sfx.crtOff();
    const screen = this.root.querySelector('.screen');
    screen.classList.remove('crt-flick');
    void screen.offsetWidth;
    screen.classList.add('crt-flick');
  }

  /* ---------- settings menu ---------- */
  #openMenu(trigger) {
    this.#menuTrigger = trigger;
    this.menu.hidden = false;
    this.root.toggleAttribute('data-menu', true);
    sfx.menuOpen();
    (this.menu.querySelector('[aria-checked="true"]') ?? this.menu.querySelector('button')).focus();
  }
  #closeMenu() {
    if (this.menu.hidden) return;
    this.menu.hidden = true;
    this.root.removeAttribute('data-menu');
    sfx.menuClose();
    const t = this.#menuTrigger;
    if (t && t.offsetParent !== null) t.focus();
    else this.root.querySelector('.key[data-key="settings"]')?.focus();
  }
  #onMenuKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      return this.#closeMenu();
    }
    const radios = [...this.menu.querySelectorAll('[data-rate]')];
    const i = radios.indexOf(document.activeElement);
    if (i >= 0 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      kbdNav(true);
      e.preventDefault();
      e.stopPropagation();
      const next = radios[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + radios.length) % radios.length];
      next.focus();
      next.click();
      return;
    }
    if (e.key === 'Tab') {
      const items = [...this.menu.querySelectorAll('button')].filter((b) => b.tabIndex !== -1);
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  /* ---------- key travel for keyboard shortcuts ---------- */
  #flash(name) {
    const key = this.root.querySelector(`.key[data-key="${name}"]`);
    if (!key) return;
    key.classList.add('is-down');
    setTimeout(() => key.classList.remove('is-down'), 150);
  }
  #onDocKey = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.('input,textarea,select,[contenteditable]')) return;
    if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) this.#poke();
    if (!this.menu.hidden) {
      // Keep playback shortcuts out of the way while the menu is open.
      if (e.key === 'Escape') this.#closeMenu();
      else if (e.key.toLowerCase() === 'r' && !e.repeat) this.#setCrt(this.root.hasAttribute('data-crt-off'));
      return;
    }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 's' && !e.repeat) {
      kbdNav(true);
      const fsBtn = this.root.querySelector('.bar [data-action="menu"]');
      sfx.key(0.85);
      this.#flash('settings');
      this.#openMenu(this.root.hasAttribute('data-fs') ? fsBtn : this.root.querySelector('.key[data-key="settings"]'));
    } else if (k === 'ArrowLeft' && e.target !== this.knob) {
      this.#flash('back');
      sfx.key(0.85);
      sfx.scrub(-1);
    } else if (k === 'ArrowRight' && e.target !== this.knob) {
      this.#flash('forward');
      sfx.key(0.85);
      sfx.scrub(1);
    } else if (k === 'f' && !e.repeat) {
      this.#flash('fullscreen');
    } else if (k === 'r' && !e.repeat) {
      this.#setCrt(this.root.hasAttribute('data-crt-off'));
    }
  };

  /* ---------- rotary volume knob ---------- */
  #fromPointer(e) {
    const r = this.knob.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < r.width * 0.12) return null;
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise positive
    return (clamp(deg, -135, 135) + 135) / 270;
  }
  #onKnobDown = (e) => {
    if (e.button) return;
    e.preventDefault();
    this.knob.focus();
    this.knob.setPointerCapture(e.pointerId);
    this.#dragging = true;
    this.knob.toggleAttribute('data-dragging', true);
    const v = this.#fromPointer(e);
    if (v !== null) this.#setVolume(v);
  };
  #onKnobMove = (e) => {
    if (!this.#dragging) return;
    const v = this.#fromPointer(e);
    const cur = this.#volume.value?.volume ?? 0;
    // Ignore the jump across the dead zone at the bottom of the dial.
    if (v === null || Math.abs(v - cur) > 0.5) return;
    this.#setVolume(v);
  };
  #onKnobUp = () => {
    this.#dragging = false;
    this.knob.removeAttribute('data-dragging');
  };
  #onKnobKey = (e) => {
    const cur = this.#volume.value?.volume ?? 0;
    const step = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.1, PageDown: -0.1 }[e.key];
    let v;
    if (step) v = cur + step;
    else if (e.key === 'Home') v = 0;
    else if (e.key === 'End') v = 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    this.#setVolume(Math.round(v * 100) / 100);
  };
  #onKnobWheel = (e) => {
    e.preventDefault();
    const cur = this.#volume.value?.volume ?? 0;
    this.#setVolume(Math.round((cur + (e.deltaY < 0 ? 0.04 : -0.04)) * 100) / 100);
  };
}

customElements.define('side-a-deck', SideADeck);


/* ---------- page motion: headline type-on, scroll reveals, live key legend ---------- */
document.documentElement.classList.replace('no-js', 'js');
{
  const h1 = document.querySelector('.hero h1');
  if (h1) {
    let i = 0;
    for (const node of [...h1.childNodes]) {
      if (node.nodeType !== 3) continue;
      const frag = document.createDocumentFragment();
      for (const word of node.textContent.split(' ')) {
        const w = document.createElement('span');
        w.className = 'word';
        w.setAttribute('aria-hidden', 'true');
        for (const ch of word) {
          const s = document.createElement('span');
          s.className = 'ch';
          s.style.setProperty('--i', i++);
          s.textContent = ch;
          w.append(s);
        }
        frag.append(w, ' ');
      }
      node.replaceWith(frag);
    }
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    const sibs = el.parentElement.querySelectorAll(':scope > [data-reveal]');
    el.style.setProperty('--d', `${[...sibs].indexOf(el) * 90}ms`);
    io.observe(el);
  });
  // the SIDE A wordmark resets the page
  document.querySelector('[data-home]')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo(0, 0);
    window.location.reload();
  });
  // the keyboard legend lights up as you type
  const legend = (e, on) => {
    const k = /^\d$/.test(e.key) ? 'digit' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
    document.querySelectorAll(`.hotkeys kbd[data-k="${CSS.escape(k)}"]`).forEach((el) => el.classList.toggle('on', on));
  };
  document.addEventListener('keydown', (e) => legend(e, true));
  document.addEventListener('keyup', (e) => legend(e, false));
  window.addEventListener('blur', () => document.querySelectorAll('.hotkeys kbd.on').forEach((el) => el.classList.remove('on')));
}
