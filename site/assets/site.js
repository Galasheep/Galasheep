{
  // Home: Wix rearranges the collage for each window width. We captured its layout at several widths
  // and use the one closest to this window, scaled to fit, so tiles keep the same size as on Wix.
  const L = window.GAL_LAYOUTS;
  const arrange = () => {
    if (!L || innerWidth <= 640) return;
    document.querySelectorAll('.gal[data-gal]').forEach(g => {
      const set = L[g.dataset.gal], gw = g.clientWidth;
      let best = set[0];
      for (const l of set) if (Math.abs(l[0] - gw) < Math.abs(best[0] - gw)) best = l;
      const [w, h, items] = best, tiles = g.children;
      g.style.aspectRatio = w + '/' + h;
      items.split(';').forEach(p => {
        const [i, x, y, tw, th] = p.split(',').map(Number), t = tiles[i];
        if (!t) return;
        t.style.left = (x / w * 100) + '%'; t.style.top = (y / h * 100) + '%';
        t.style.width = (tw / w * 100) + '%'; t.style.height = (th / h * 100) + '%';
      });
    });
  };
  arrange();
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(arrange, 100); });

  // Home: tiles play a muted preview while hovered, like the Wix gallery
  //  - data-video: Wix-hosted clip (local mp4)
  //  - data-embed: "yt:ID" (YouTube) or "vm:ID" (Vimeo)
  const canHover = matchMedia('(hover:hover)').matches;
  const embedUrl = e => {
    const [src, id] = e.split(':');
    return src === 'yt'
      ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&loop=1&playlist=${id}&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`
      : `https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&dnt=1`;
  };
  document.querySelectorAll('.tile[data-video], .tile[data-embed]').forEach(t => {
    let el = null, timer = 0;
    const cap = t.querySelector('.cap');
    const start = () => {
      if (t.dataset.video) {
        if (!el) {
          el = document.createElement('video');
          Object.assign(el, { muted: true, loop: true, playsInline: true, src: t.dataset.video });
          t.insertBefore(el, cap);
        }
        el.play().catch(() => {});
      } else {
        timer = setTimeout(() => {           // short delay so passing the mouse over tiles doesn't load every player
          const w = t.clientWidth, h = t.clientHeight;
          const fw = Math.max(w, h * 16 / 9);  // cover the tile at 16:9
          el = document.createElement('iframe');
          el.allow = 'autoplay; encrypted-media';
          el.referrerPolicy = 'strict-origin-when-cross-origin';
          el.tabIndex = -1;
          el.style.width = Math.ceil(fw) + 'px';
          el.style.height = Math.ceil(fw * 9 / 16) + 'px';
          el.src = embedUrl(t.dataset.embed);
          t.insertBefore(el, cap);
        }, 150);
      }
    };
    const stop = () => {
      clearTimeout(timer);
      if (!el) return;
      if (el.tagName === 'VIDEO') el.pause();
      else { el.remove(); el = null; }
    };
    if (canHover) {
      t.addEventListener('mouseenter', start);
      t.addEventListener('mouseleave', stop);
    }
  });

  // Project pages: autoplay loops only while on screen (saves bandwidth and battery)
  const vids = document.querySelectorAll('.wvid video, .vgrid video');
  if (vids.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    }), { rootMargin: '200px' });
    vids.forEach(v => { v.removeAttribute('autoplay'); io.observe(v); });
  }

  // Transparent videos (Wix "alpha" clips): top half = picture, bottom half = transparency mask.
  // Draw them on a WebGL canvas so the background colour shows through, like on the Wix site.
  document.querySelectorAll('video[data-alpha]').forEach(v => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    if (!gl) { v.style.opacity = 1; return; }
    v.after(c);
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 uv;void main(){uv=p;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 uv;uniform sampler2D t;void main(){vec3 col=texture2D(t,vec2(uv.x,uv.y*.5)).rgb;float a=texture2D(t,vec2(uv.x,.5+uv.y*.5)).r;gl_FragColor=vec4(col*a,a);}'));
    gl.linkProgram(pr); gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const draw = () => {
      if (v.readyState >= 2) {
        if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight / 2; gl.viewport(0, 0, c.width, c.height); }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (!v.paused) loop();
    };
    const loop = () => v.requestVideoFrameCallback ? v.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
    v.addEventListener('play', loop);
    v.addEventListener('loadeddata', draw);
  });

  // Lightbox for project images
  const lb = document.querySelector('.lb');
  if (lb) {
    const pics = [...document.querySelectorAll('.ph[data-full]')];
    const im = lb.querySelector('img');
    let i = 0;
    const show = n => { i = (n + pics.length) % pics.length; im.src = pics[i].dataset.full; };
    const close = () => { lb.hidden = true; pics[i]?.focus(); };
    pics.forEach((p, n) => p.addEventListener('click', () => { show(n); lb.hidden = false; lb.querySelector('.lb-x').focus(); }));
    lb.querySelector('.lb-x').addEventListener('click', close);
    lb.querySelector('.lb-p').addEventListener('click', e => { e.stopPropagation(); show(i - 1); });
    lb.querySelector('.lb-n').addEventListener('click', e => { e.stopPropagation(); show(i + 1); });
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(i - 1);
      if (e.key === 'ArrowRight') show(i + 1);
    });
    if (pics.length < 2) lb.querySelectorAll('.lb-p,.lb-n').forEach(b => b.hidden = true);
  }
}
{
  // Phone menu (burger button)
  const bt = document.querySelector('.burger'), menu = document.querySelector('.menu');
  if (bt && menu) {
    const set = open => { menu.classList.toggle('open', open); bt.setAttribute('aria-expanded', open); bt.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); };
    bt.addEventListener('click', () => set(!menu.classList.contains('open')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }
}
