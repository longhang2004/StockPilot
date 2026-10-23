'use client';

import {
  ArrowUpRight,
  ClipboardText,
  Cube,
  SquaresFour,
} from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import overviewPreview from '../../public/product/overview.png';
import ordersPreview from '../../public/product/orders.png';
import inventoryPreview from '../../public/product/inventory.png';

const screens = [
  {
    key: 'overview',
    image: overviewPreview,
    label: 'Overview',
    Icon: SquaresFour,
    title: 'Your next decisions, in one view.',
    copy: 'Orders waiting for review, stock approaching its minimum and the next handoff.',
  },
  {
    key: 'orders',
    image: ordersPreview,
    label: 'Orders',
    Icon: ClipboardText,
    title: 'From request to a completed order.',
    copy: 'Review the items, check availability and follow every order through fulfillment.',
  },
  {
    key: 'inventory',
    image: inventoryPreview,
    label: 'Inventory',
    Icon: Cube,
    title: 'Know what you can promise.',
    copy: 'Keep on-hand, reserved and available quantities separate. Open a SKU to understand its balance.',
  },
] as const;

export function ProductTour() {
  const [selected, setSelected] = useState<(typeof screens)[number]>(
    screens[0],
  );
  const href = '/login?role=manager';
  return (
    <section
      className="product-tour"
      id="product-tour"
      aria-labelledby="tour-title"
    >
      <div className="tour-topline">
        <h2 id="tour-title">One workspace. The full picture.</h2>
        <span>Inside StockPilot</span>
      </div>
      <div className="tour-frame">
        <div className="tour-tabs">
          <div aria-label="Product preview">
            {screens.map((screen) => (
              <button
                type="button"
                key={screen.key}
                aria-pressed={selected.key === screen.key}
                onClick={() => setSelected(screen)}
              >
                <screen.Icon size={17} aria-hidden="true" />
                {screen.label}
              </button>
            ))}
          </div>
          <Link href={href}>
            Open demo <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <Link href={href} aria-label={`Explore ${selected.label} in the demo`}>
          <Image
            src={selected.image}
            width={1440}
            height={1000}
            alt={`StockPilot ${selected.label} workspace with illustrative demo data`}
            sizes="(max-width: 1200px) 94vw, 1120px"
            loading="eager"
          />
        </Link>
      </div>
      <div className="tour-caption" aria-live="polite">
        <h3>{selected.title}</h3>
        <p>{selected.copy}</p>
        <small>Application screenshots · Illustrative demo data</small>
      </div>
    </section>
  );
}
