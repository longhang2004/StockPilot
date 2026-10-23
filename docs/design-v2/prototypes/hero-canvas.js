/* global window, document, ResizeObserver, IntersectionObserver */
'use strict';

// Original, illustrative logistics map. Geography and shipments are fictional.
window.mountLogisticsMap = function (hero) {
  const canvas = hero.querySelector('canvas');
  const context = canvas.getContext('2d');
  const toggle = hero.querySelector('.motion-toggle');
  if (!context) {
    canvas.hidden = true;
    return;
  }
  const background = document.createElement('canvas');
  const map = background.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const palette = window.getComputedStyle(hero);
  const colors = Object.fromEntries(
    ['surface', 'subtle', 'border', 'accent', 'active', 'muted'].map((key) => [
      key,
      palette.getPropertyValue(`--${key}`).trim(),
    ]),
  );
  let width = 0;
  let height = 0;
  let routes = [];
  let warehouses = [];
  let frame = 0;
  let previous = 0;
  let time = 0;
  let visible = false;
  let paused = false;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function project(x, depth) {
    return [
      width / 2 + x * (0.55 + depth * 0.7),
      height * (0.035 + depth * 0.35 + depth * depth * 0.7),
    ];
  }

  function path(ctx, points, stroke, opacity, lineWidth = 1) {
    ctx.beginPath();
    points.forEach(([x, y], index) =>
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
    );
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function warehouse(x, y, name) {
    map.save();
    map.translate(x, y);
    map.fillStyle = colors.surface;
    map.strokeStyle = colors.accent;
    map.lineWidth = 1.3;
    map.globalAlpha = 0.75;
    map.beginPath();
    map.moveTo(-21, -4);
    map.lineTo(0, -17);
    map.lineTo(21, -4);
    map.lineTo(21, 19);
    map.lineTo(-21, 19);
    map.closePath();
    map.fill();
    map.stroke();
    path(
      map,
      [
        [-21, -4],
        [21, -4],
      ],
      colors.accent,
      0.65,
    );
    map.fillStyle = colors.active;
    map.fillRect(-11, 5, 22, 14);
    for (let slot = -7; slot <= 7; slot += 7)
      path(
        map,
        [
          [slot, 6],
          [slot, 18],
        ],
        colors.accent,
        0.5,
      );
    map.font = '600 10px Source, sans-serif';
    map.textAlign = 'center';
    map.fillStyle = colors.accent;
    map.globalAlpha = 0.7;
    map.fillText(name, 0, 39);
    map.restore();
  }

  function buildMap() {
    map.clearRect(0, 0, width, height);
    const block = width < 700 ? 62 : 98;
    const columns = Math.ceil(width / block) + 5;
    // Street blocks recede towards a horizon, forming a map beneath the content.
    for (let row = 0; row < 10; row++) {
      for (let column = -columns; column <= columns; column++) {
        const x = column * block + Math.sin(row * 0.7) * 13;
        const top = row / 10;
        const bottom = (row + 0.78) / 10;
        const corners = [
          project(x + 9, top),
          project(x + block - 9, top),
          project(x + block - 9, bottom),
          project(x + 9, bottom),
        ];
        if (corners[2][0] < -100 || corners[0][0] > width + 100) continue;
        map.beginPath();
        corners.forEach(([px, py], index) =>
          index ? map.lineTo(px, py) : map.moveTo(px, py),
        );
        map.closePath();
        map.fillStyle =
          (column + row) % 7 === 0 ? colors.active : colors.subtle;
        map.globalAlpha = 0.38;
        map.fill();
        map.strokeStyle = colors.border;
        map.lineWidth = 0.7;
        map.globalAlpha = 0.48;
        map.stroke();
      }
    }
    // An unlabelled waterway and arterial roads give the network a cartographic scale.
    const river = Array.from({ length: 70 }, (_, i) => {
      const depth = i / 69;
      return project(width * (-0.66 + Math.sin(depth * 4.3) * 0.14), depth);
    });
    path(map, river, colors.border, 0.32, 18);
    path(map, river, colors.surface, 0.8, 11);
    for (const offset of [-0.58, -0.24, 0.29, 0.61]) {
      const road = Array.from({ length: 40 }, (_, i) =>
        project(width * (offset + Math.sin(i / 12) * 0.04), i / 39),
      );
      path(map, road, colors.surface, 0.8, 6);
      path(map, road, colors.border, 0.5, 0.8);
    }

    const locations = [
      [-0.48, 0.47, 'WEST WAREHOUSE'],
      [0.49, 0.32, 'NORTH HUB'],
      [0.37, 0.8, 'EAST WAREHOUSE'],
      [-0.37, 0.83, 'SOUTH DEPOT'],
      [-0.71, 0.76, 'SUPPLIER'],
      [0.7, 0.59, 'DISPATCH'],
      [-0.4, 0.1, 'RECEIVING'],
    ];
    warehouses = locations.map(([x, depth, name]) => ({
      point: project(width * x, depth),
      name,
    }));
    const links = [
      [0, 1, -0.08],
      [1, 2, 0.08],
      [2, 3, 0.1],
      [3, 0, -0.07],
      [4, 0, 0.05],
      [2, 5, -0.03],
      [6, 0, 0.02],
    ];
    routes = links.map(([from, to, bend], index) => {
      const start = warehouses[from].point;
      const end = warehouses[to].point;
      const control = [
        (start[0] + end[0]) / 2 + width * bend,
        (start[1] + end[1]) / 2 - height * 0.13,
      ];
      const points = Array.from({ length: 81 }, (_, i) => {
        const t = i / 80;
        return [
          (1 - t) ** 2 * start[0] +
            2 * (1 - t) * t * control[0] +
            t * t * end[0],
          (1 - t) ** 2 * start[1] +
            2 * (1 - t) * t * control[1] +
            t * t * end[1],
        ];
      });
      map.setLineDash([3, 5]);
      path(map, points, colors.accent, 0.27, 1.25);
      map.setLineDash([]);
      return { points, offset: index * 0.17, duration: 10 + index * 1.3 };
    });
    warehouses.forEach(({ point: [x, y], name }) => warehouse(x, y, name));
    map.globalAlpha = 1;
  }

  function shipment(route, index) {
    const progress = reduced.matches
      ? (0.28 + route.offset) % 1
      : (time / route.duration + route.offset) % 1;
    const at = Math.floor(progress * 80);
    const fraction = progress * 80 - at;
    const a = route.points[at];
    const b = route.points[at + 1];
    const x = a[0] + (b[0] - a[0]) * fraction;
    const y = a[1] + (b[1] - a[1]) * fraction;
    const trail = route.points.slice(Math.max(0, at - 9), at + 1);
    trail.push([x, y]);
    path(context, trail, colors.accent, 0.5, 2);
    context.save();
    context.translate(x, y);
    context.globalAlpha = 0.88;
    context.fillStyle = colors.surface;
    context.strokeStyle = colors.accent;
    context.lineWidth = 1.1;
    context.beginPath();
    context.roundRect(-12, -9, 24, 18, 4);
    context.fill();
    context.stroke();
    // Parcel marker represents an order in transit, distinct from warehouse roofs.
    path(
      context,
      [
        [-5, -2],
        [0, -5],
        [5, -2],
        [5, 4],
        [0, 7],
        [-5, 4],
        [-5, -2],
        [0, 1],
        [5, -2],
      ],
      colors.accent,
      0.9,
      1,
    );
    path(
      context,
      [
        [0, 1],
        [0, 7],
      ],
      colors.accent,
      0.8,
      1,
    );
    if (width > 900 && index < 4) {
      context.font = '10px Source, sans-serif';
      context.fillStyle = colors.accent;
      context.globalAlpha = 0.7;
      context.fillText(`SO–${1042 + index}`, 18, 4);
    }
    context.restore();
  }

  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(pointer.x, pointer.y);
    context.drawImage(background, 0, 0, width, height);
    routes.forEach(shipment);
    warehouses.forEach(({ point: [x, y] }, index) => {
      const phase = reduced.matches ? 0.45 : (time / 4 + index * 0.23) % 1;
      context.beginPath();
      context.ellipse(
        x,
        y + 8,
        27 + phase * 12,
        13 + phase * 6,
        0,
        0,
        Math.PI * 2,
      );
      context.strokeStyle = colors.accent;
      context.lineWidth = 1;
      context.globalAlpha = (1 - phase) * 0.22;
      context.stroke();
    });
    context.restore();
  }

  function animate(now) {
    frame = 0;
    if (paused || reduced.matches || !visible || document.hidden) return;
    if (now - previous >= 1000 / 30) {
      time += Math.min(now - (previous || now), 70) / 1000;
      previous = now;
      pointer.x += (pointer.targetX - pointer.x) * 0.08;
      pointer.y += (pointer.targetY - pointer.y) * 0.08;
      draw();
    }
    frame = window.requestAnimationFrame(animate);
  }

  function sync() {
    window.cancelAnimationFrame(frame);
    previous = 0;
    toggle.hidden = reduced.matches;
    toggle.dataset.paused = String(paused);
    toggle.setAttribute(
      'aria-label',
      paused ? 'Play logistics animation' : 'Pause logistics animation',
    );
    toggle.querySelector('span').textContent = paused
      ? 'Play motion'
      : 'Pause motion';
    if (reduced.matches) {
      pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
      draw();
    } else if (!paused && visible && !document.hidden)
      frame = window.requestAnimationFrame(animate);
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    sync();
  });
  hero.addEventListener(
    'pointermove',
    (event) => {
      if (!finePointer.matches || reduced.matches || paused) return;
      const bounds = hero.getBoundingClientRect();
      pointer.targetX = ((event.clientX - bounds.left) / width - 0.5) * 12;
      pointer.targetY = ((event.clientY - bounds.top) / height - 0.5) * 8;
    },
    { passive: true },
  );
  hero.addEventListener('pointerleave', () => {
    pointer.targetX = pointer.targetY = 0;
  });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('focus', sync);
  reduced.addEventListener('change', sync);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(hero);
  new ResizeObserver(() => {
    width = hero.clientWidth;
    height = hero.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const surface of [canvas, background]) {
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    map.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildMap();
    draw();
  }).observe(hero);
  document.fonts.ready.then(() => {
    buildMap();
    draw();
  });
  sync();
};
