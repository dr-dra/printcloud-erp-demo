'use client';

import { useMemo, useState, type DragEvent } from 'react';
import PageTemplate from '@/components/PageTemplate';

type PressCard = {
  id: string;
  job: string;
  customer: string;
  sheet: string;
  due: string;
  run: string;
  chips: string[];
};

type PressColumn = {
  id: string;
  title: string;
  subtitle: string;
  count: number;
  tone: string;
  rail: string;
  cards: PressCard[];
};

const initialPressColumns: PressColumn[] = [
  {
    id: 'queued',
    title: 'Queued',
    subtitle: 'Intake & imposition',
    count: 6,
    tone: 'bg-amber-100 text-amber-900',
    rail: 'from-amber-400 via-amber-300 to-amber-200',
    cards: [
      {
        id: 'PC-1421',
        job: 'Aurora Lookbook',
        customer: 'Vivid Studio',
        sheet: 'SRA3 • Matte 170gsm',
        due: 'Today 4:00 PM',
        run: '4,500',
        chips: ['Offset', 'Cover'],
      },
      {
        id: 'PC-1415',
        job: 'Lumen Invites',
        customer: 'Northwind',
        sheet: 'A3 • Linen 120gsm',
        due: 'Today 6:30 PM',
        run: '1,200',
        chips: ['Digital', 'Foil'],
      },
      {
        id: 'PC-1411',
        job: 'Quarterly Planner',
        customer: 'Crescent Co',
        sheet: 'B2 • Gloss 130gsm',
        due: 'Tomorrow 9:00 AM',
        run: '8,000',
        chips: ['Offset', 'Book'],
      },
    ],
  },
  {
    id: 'plates',
    title: 'Plates Ready',
    subtitle: 'On deck for setup',
    count: 4,
    tone: 'bg-emerald-100 text-emerald-900',
    rail: 'from-emerald-400 via-emerald-300 to-emerald-200',
    cards: [
      {
        id: 'PC-1407',
        job: 'Glassline Brochure',
        customer: 'Axis Trade',
        sheet: 'SRA2 • Silk 150gsm',
        due: 'Today 3:00 PM',
        run: '2,400',
        chips: ['Offset', 'Fold'],
      },
      {
        id: 'PC-1403',
        job: 'Beacon Posters',
        customer: 'Naru Events',
        sheet: 'B1 • Satin 200gsm',
        due: 'Today 8:00 PM',
        run: '600',
        chips: ['Offset', 'Large'],
      },
    ],
  },
  {
    id: 'on-press',
    title: 'On Press',
    subtitle: 'Live runs',
    count: 3,
    tone: 'bg-sky-100 text-sky-900',
    rail: 'from-sky-400 via-sky-300 to-sky-200',
    cards: [
      {
        id: 'PC-1398',
        job: 'Metro Catalog',
        customer: 'Grey & Co',
        sheet: 'B2 • Matte 115gsm',
        due: 'Today 2:30 PM',
        run: '12,000',
        chips: ['Offset', 'Signature'],
      },
      {
        id: 'PC-1396',
        job: 'Opaline Menus',
        customer: 'Opaline Hotel',
        sheet: 'A2 • Soft Touch',
        due: 'Today 5:30 PM',
        run: '900',
        chips: ['Digital', 'Lamination'],
      },
    ],
  },
  {
    id: 'qc',
    title: 'QC + Drying',
    subtitle: 'Color + finish check',
    count: 5,
    tone: 'bg-slate-100 text-slate-900',
    rail: 'from-slate-400 via-slate-300 to-slate-200',
    cards: [
      {
        id: 'PC-1391',
        job: 'Citrine Labels',
        customer: 'Harbor Foods',
        sheet: 'A3 • Adhesive',
        due: 'Tomorrow 10:00 AM',
        run: '15,000',
        chips: ['Digital', 'Cut'],
      },
      {
        id: 'PC-1385',
        job: 'Studio Deck',
        customer: 'Kite & Co',
        sheet: 'SRA3 • Uncoated 250gsm',
        due: 'Today 7:00 PM',
        run: '2,200',
        chips: ['Offset', 'Deckle'],
      },
    ],
  },
  {
    id: 'complete',
    title: 'Ready for Post',
    subtitle: 'Move to bindery',
    count: 8,
    tone: 'bg-indigo-100 text-indigo-900',
    rail: 'from-indigo-400 via-indigo-300 to-indigo-200',
    cards: [
      {
        id: 'PC-1378',
        job: 'Orion Manuals',
        customer: 'Helios Labs',
        sheet: 'A3 • 100gsm',
        due: 'Today 1:00 PM',
        run: '3,600',
        chips: ['Offset', 'Book'],
      },
      {
        id: 'PC-1373',
        job: 'Echo Tickets',
        customer: 'Sunset Arena',
        sheet: 'SRA3 • Coated 170gsm',
        due: 'Today 12:30 PM',
        run: '10,000',
        chips: ['Digital', 'Numbered'],
      },
    ],
  },
];

const boardFilters = ['All Lines', 'B2 Press', 'SRA3 Press', 'Digital Press'];

export default function PressPage() {
  const [columns, setColumns] = useState<PressColumn[]>(initialPressColumns);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragSourceColumnId, setDragSourceColumnId] = useState<string | null>(null);
  const [dropColumnId, setDropColumnId] = useState<string | null>(null);
  const [dropCardId, setDropCardId] = useState<string | null>(null);

  const columnCounts = useMemo(
    () =>
      columns.reduce<Record<string, number>>((acc, column) => {
        acc[column.id] = column.cards.length;
        return acc;
      }, {}),
    [columns],
  );

  const handleDragStart = (event: DragEvent<HTMLDivElement>, cardId: string, columnId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify({ cardId, columnId }));
    setDraggedCardId(cardId);
    setDragSourceColumnId(columnId);
  };

  const handleDragEnd = () => {
    setDraggedCardId(null);
    setDragSourceColumnId(null);
    setDropColumnId(null);
    setDropCardId(null);
  };

  const handleDragOverColumn = (event: DragEvent<HTMLDivElement>, columnId: string) => {
    event.preventDefault();
    setDropColumnId(columnId);
    setDropCardId(null);
  };

  const handleDragOverCard = (
    event: DragEvent<HTMLDivElement>,
    columnId: string,
    cardId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDropColumnId(columnId);
    setDropCardId(cardId);
  };

  const moveCard = (
    sourceColumnId: string,
    cardId: string,
    targetColumnId: string,
    targetCardId?: string | null,
  ) => {
    setColumns((prev) => {
      const next = prev.map((column) => ({
        ...column,
        cards: [...column.cards],
      }));
      const sourceColumn = next.find((column) => column.id === sourceColumnId);
      const targetColumn = next.find((column) => column.id === targetColumnId);
      if (!sourceColumn || !targetColumn) return prev;

      const sourceIndex = sourceColumn.cards.findIndex((card) => card.id === cardId);
      if (sourceIndex === -1) return prev;

      const [card] = sourceColumn.cards.splice(sourceIndex, 1);
      if (!card) return prev;

      let insertIndex = targetColumn.cards.length;
      if (targetCardId) {
        const targetIndex = targetColumn.cards.findIndex((item) => item.id === targetCardId);
        if (targetIndex !== -1) {
          insertIndex = targetIndex;
        }
      }

      if (sourceColumnId === targetColumnId && targetCardId) {
        const targetIndex = targetColumn.cards.findIndex((item) => item.id === targetCardId);
        if (targetIndex !== -1 && sourceIndex < targetIndex) {
          insertIndex = Math.max(0, insertIndex - 1);
        }
      }

      targetColumn.cards.splice(insertIndex, 0, card);
      return next;
    });
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    columnId: string,
    cardId?: string | null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const data = event.dataTransfer.getData('text/plain');
    let payload: { cardId: string; columnId: string } | null = null;
    try {
      payload = data ? (JSON.parse(data) as { cardId: string; columnId: string }) : null;
    } catch {
      payload = null;
    }

    const sourceCardId = payload?.cardId ?? draggedCardId;
    const sourceColumnId = payload?.columnId ?? dragSourceColumnId;

    if (!sourceCardId || !sourceColumnId) return;
    if (sourceCardId === cardId) return;

    moveCard(sourceColumnId, sourceCardId, columnId, cardId);
    handleDragEnd();
  };

  return (
    <PageTemplate
      title="Press"
      description="Control live press runs, prioritize queues, and surface bottlenecks fast."
      buttonText="Schedule Press Run"
      onButtonClick={() => console.log('Schedule press run clicked')}
    >
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/70 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-10 h-64 w-64 rounded-full bg-gradient-to-br from-amber-200/70 via-rose-100/40 to-transparent blur-2xl dark:from-amber-400/20 dark:via-rose-400/10" />
          <div className="absolute -bottom-40 right-10 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-200/60 via-emerald-100/40 to-transparent blur-2xl dark:from-sky-400/20 dark:via-emerald-400/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08)_0%,_rgba(15,23,42,0)_55%)] dark:bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.18)_0%,_rgba(15,23,42,0)_55%)]" />
        </div>

        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Press Control Board
              </p>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                Today&apos;s run stack at a glance
              </h2>
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Keep the press floor moving with clear queues, due-time visibility, and fast
                reprioritization.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {boardFilters.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    index === 0
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900'
                      : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-5">
            {columns.map((column) => (
              <div
                key={column.id}
                className={`flex min-h-[320px] flex-col rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm transition dark:border-slate-700 dark:bg-slate-900/70 ${
                  dropColumnId === column.id ? 'ring-2 ring-slate-300 dark:ring-slate-500' : ''
                }`}
                onDragOver={(event) => handleDragOverColumn(event, column.id)}
                onDrop={(event) => handleDrop(event, column.id)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {column.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{column.subtitle}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${column.tone}`}>
                    {columnCounts[column.id] ?? column.count}
                  </span>
                </div>
                <div className={`mt-3 h-1 w-full rounded-full bg-gradient-to-r ${column.rail}`} />
                <div className="mt-4 flex flex-1 flex-col gap-3">
                  {column.cards.map((card) => (
                    <div
                      key={card.id}
                      className={`press-card relative rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-slate-700 dark:bg-slate-950/80 ${
                        draggedCardId === card.id ? 'opacity-60' : ''
                      } ${dropCardId === card.id ? 'ring-2 ring-slate-300 dark:ring-slate-500' : ''}`}
                      draggable
                      onDragStart={(event) => handleDragStart(event, card.id, column.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(event) => handleDragOverCard(event, column.id, card.id)}
                      onDrop={(event) => handleDrop(event, column.id, card.id)}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{card.id}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {card.run}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {card.job}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{card.customer}</p>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        {card.sheet}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {card.chips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Due</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {card.due}
                        </span>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-500 dark:hover:text-slate-200"
                  >
                    Add to {column.title}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .press-card {
          animation: lift-in 0.6s ease-out;
        }
        .press-card:nth-child(2) {
          animation-delay: 0.05s;
        }
        .press-card:nth-child(3) {
          animation-delay: 0.1s;
        }
        @keyframes lift-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </PageTemplate>
  );
}
