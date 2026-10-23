'use client';

import { Pause, Play } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

type Point = [number, number];
type Route = { points: Point[]; offset: number; duration: number };

/** Decorative, fictional network. No location or shipment data is requested. */
export function LogisticsMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    const context = canvas?.getContext('2d');
    const background = document.createElement('canvas');
    const map = background.getContext('2d');
    if (!canvas || !host || !context || !map) return;
    setSupported(true);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const colors = {
      surface: '#ffffff',
      subtle: '#f0f3ef',
      border: '#dce2dc',
      accent: '#225d43',
      active: '#e6eee7',
    };
    let width = 0;
    let height = 0;
    let frame = 0;
    let time = 0;
    let previous = 0;
    let visible = false;
    let disposed = false;
    let routes: Route[] = [];
    let warehouses: { point: Point; name: string }[] = [];
    const project = (x: number, depth: number): Point => [
      width / 2 + x * (0.55 + depth * 0.7),
      height * (0.035 + depth * 0.35 + depth * depth * 0.7),
    ];
    function path(
      ctx: CanvasRenderingContext2D,
      points: Point[],
      opacity: number,
      lineWidth = 1,
      color = colors.accent,
    ) {
      ctx.beginPath();
      points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.globalAlpha = opacity;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    function buildMap() {
      if (!map) return;
      map.clearRect(0, 0, width, height);
      const block = width < 700 ? 62 : 98;
      const columns = Math.ceil(width / block) + 5;
      for (let row = 0; row < 10; row++) {
        for (let column = -columns; column <= columns; column++) {
          const x = column * block + Math.sin(row * 0.7) * 13;
          const corners = [
            project(x + 9, row / 10),
            project(x + block - 9, row / 10),
            project(x + block - 9, (row + 0.78) / 10),
            project(x + 9, (row + 0.78) / 10),
          ];
          map.beginPath();
          corners.forEach(([px, py], i) =>
            i ? map.lineTo(px, py) : map.moveTo(px, py),
          );
          map.closePath();
          map.fillStyle =
            (column + row) % 7 === 0 ? colors.active : colors.subtle;
          map.globalAlpha = 0.38;
          map.fill();
          map.strokeStyle = colors.border;
          map.globalAlpha = 0.48;
          map.lineWidth = 0.7;
          map.stroke();
        }
      }
      const river = Array.from({ length: 70 }, (_, i) =>
        project(width * (-0.66 + Math.sin((i / 69) * 4.3) * 0.14), i / 69),
      );
      path(map, river, 0.32, 18, colors.border);
      path(map, river, 0.8, 11, colors.surface);
      for (const offset of [-0.58, -0.24, 0.29, 0.61]) {
        const road = Array.from({ length: 40 }, (_, i) =>
          project(width * (offset + Math.sin(i / 12) * 0.04), i / 39),
        );
        path(map, road, 0.8, 6, colors.surface);
        path(map, road, 0.5, 0.8, colors.border);
      }
      const locations: [number, number, string][] = [
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
      const links: [number, number, number][] = [
        [0, 1, -0.08],
        [1, 2, 0.08],
        [2, 3, 0.1],
        [3, 0, -0.07],
        [4, 0, 0.05],
        [2, 5, -0.03],
        [6, 0, 0.02],
      ];
      routes = links.map(([from, to, bend], index) => {
        const start = warehouses[from]!.point;
        const end = warehouses[to]!.point;
        const control: Point = [
          (start[0] + end[0]) / 2 + width * bend,
          (start[1] + end[1]) / 2 - height * 0.13,
        ];
        const points = Array.from({ length: 81 }, (_, i): Point => {
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
        path(map, points, 0.27, 1.25);
        map.setLineDash([]);
        return { points, offset: index * 0.17, duration: 10 + index * 1.3 };
      });
      for (const {
        point: [x, y],
        name,
      } of warehouses) {
        map.save();
        map.translate(x, y);
        map.fillStyle = colors.surface;
        map.strokeStyle = colors.accent;
        map.lineWidth = 1.3;
        map.globalAlpha = 0.75;
        map.beginPath();
        [
          [-21, -4],
          [0, -17],
          [21, -4],
          [21, 19],
          [-21, 19],
        ].forEach(([px, py], i) =>
          i ? map.lineTo(px!, py!) : map.moveTo(px!, py!),
        );
        map.closePath();
        map.fill();
        map.stroke();
        path(
          map,
          [
            [-21, -4],
            [21, -4],
          ],
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
            0.5,
          );
        map.font = '600 10px "Source Sans 3", sans-serif';
        map.textAlign = 'center';
        map.fillStyle = colors.accent;
        map.globalAlpha = 0.7;
        map.fillText(name, 0, 39);
        map.restore();
      }
    }
    function draw() {
      if (!context || !width || !height) return;
      context.clearRect(0, 0, width, height);
      context.drawImage(background, 0, 0, width, height);
      routes.forEach((route, index) => {
        const progress = motion.matches
          ? (0.28 + route.offset) % 1
          : (time / route.duration + route.offset) % 1;
        const at = Math.floor(progress * 80);
        const fraction = progress * 80 - at;
        const a = route.points[at]!;
        const b = route.points[at + 1]!;
        const x = a[0] + (b[0] - a[0]) * fraction;
        const y = a[1] + (b[1] - a[1]) * fraction;
        path(
          context,
          [...route.points.slice(Math.max(0, at - 9), at + 1), [x, y]],
          0.5,
          2,
        );
        context.save();
        context.translate(x, y);
        context.fillStyle = colors.surface;
        context.strokeStyle = colors.accent;
        context.globalAlpha = 0.88;
        context.beginPath();
        context.roundRect(-12, -9, 24, 18, 4);
        context.fill();
        context.stroke();
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
          0.9,
        );
        path(
          context,
          [
            [0, 1],
            [0, 7],
          ],
          0.8,
        );
        if (width > 900 && index < 4) {
          context.font = '10px "Source Sans 3", sans-serif';
          context.fillStyle = colors.accent;
          context.fillText(`SO–${1042 + index}`, 18, 4);
        }
        context.restore();
      });
    }
    function animate(now: number) {
      frame = 0;
      if (
        disposed ||
        pausedRef.current ||
        motion.matches ||
        !visible ||
        document.hidden
      )
        return;
      if (now - previous >= 1000 / 30) {
        time += Math.min(now - (previous || now), 70) / 1000;
        previous = now;
        draw();
      }
      frame = requestAnimationFrame(animate);
    }
    function sync() {
      cancelAnimationFrame(frame);
      previous = 0;
      if (motion.matches) draw();
      else if (!pausedRef.current && visible && !document.hidden)
        frame = requestAnimationFrame(animate);
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    intersection.observe(host);
    const resize = new ResizeObserver(() => {
      width = host.clientWidth;
      height = host.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      for (const surface of [canvas, background]) {
        surface.width = Math.round(width * dpr);
        surface.height = Math.round(height * dpr);
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      map.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildMap();
      draw();
    });
    resize.observe(host);
    host.addEventListener('motionchange', sync);
    document.addEventListener('visibilitychange', sync);
    motion.addEventListener('change', sync);
    void document.fonts.ready.then(() => {
      if (!disposed) {
        buildMap();
        draw();
      }
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      resize.disconnect();
      host.removeEventListener('motionchange', sync);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
    };
  }, []);

  return (
    <div className="logistics-map">
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="map-caption" aria-hidden="true">
        Illustrative logistics network
      </span>
      {supported ? (
        <button
          className="motion-toggle"
          type="button"
          aria-label={
            paused
              ? 'Play motion on logistics map'
              : 'Pause motion on logistics map'
          }
          onClick={() => {
            pausedRef.current = !pausedRef.current;
            setPaused(pausedRef.current);
            canvasRef.current?.parentElement?.dispatchEvent(
              new Event('motionchange'),
            );
          }}
        >
          {paused ? (
            <Play size={14} aria-hidden="true" />
          ) : (
            <Pause size={14} aria-hidden="true" />
          )}
          <span>{paused ? 'Play motion' : 'Pause motion'}</span>
        </button>
      ) : null}
    </div>
  );
}
