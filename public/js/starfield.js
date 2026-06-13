// 星点漂浮 + 闪烁背景。纯装饰，独立运行。
export function initStarfield() {
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  let stars = [];
  let w = 0, h = 0;
  let raf = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function buildStars() {
    const count = Math.round((w * h) / 9000);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * 0.02 + 0.004,   // 闪烁速度
        dir: Math.random() < 0.5 ? 1 : -1,
        vx: (Math.random() - 0.5) * 0.05,    // 极慢漂移
        vy: (Math.random() - 0.5) * 0.05,
        hue: Math.random() < 0.85 ? 0 : (Math.random() < 0.5 ? 200 : 35), // 少量蓝/金
      });
    }
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.a += s.tw * s.dir;
      if (s.a > 0.95) { s.a = 0.95; s.dir = -1; }
      if (s.a < 0.12) { s.a = 0.12; s.dir = 1; }
      s.x += s.vx; s.y += s.vy;
      if (s.x < 0) s.x = w; else if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h; else if (s.y > h) s.y = 0;
      const col = s.hue === 0
        ? `rgba(220,235,255,${s.a})`
        : s.hue === 200 ? `rgba(150,200,255,${s.a})` : `rgba(255,210,140,${s.a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }

  resize();
  tick();
  window.addEventListener("resize", resize);

  // 标签页隐藏时暂停
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(raf); }
    else { tick(); }
  });
}
