import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

type ViewMode = 'command' | 'inventory' | 'reports'

type NavItem = {
  id: ViewMode
  label: string
  icon: string
}

type Stat = {
  label: string
  value: string
  note: string
  tone?: 'default' | 'warning' | 'success'
}

type StockItem = {
  name: string
  category: string
  qty: number
  min: number
  tone: 'warning' | 'success'
}

type ActivityItem = {
  title: string
  detail: string
  delta: string
  tone: 'blue' | 'amber' | 'green'
}

type RevenueRow = {
  day: string
  amount: string
  width: number
}

type SellerRow = {
  name: string
  units: string
  revenue: string
  profit: string
}

const NAV: NavItem[] = [
  { id: 'command', label: 'Command', icon: 'grid' },
  { id: 'inventory', label: 'Inventory', icon: 'box' },
  { id: 'reports', label: 'Reports', icon: 'chart' },
]

const STATS: Record<ViewMode, Stat[]> = {
  command: [
    { label: 'Tracked items', value: '248', note: 'Live SKUs in current organization' },
    { label: 'Orders moving now', value: '08', note: 'Driver workflow in motion', tone: 'success' },
    { label: 'Low-stock items', value: '12', note: 'Needs attention before noon', tone: 'warning' },
  ],
  inventory: [
    { label: 'Visible inventory', value: '248', note: 'Current filtered result set' },
    { label: 'Shortage pressure', value: '04', note: 'Items below hard floor', tone: 'warning' },
    { label: 'Healthy coverage', value: '91%', note: 'SKUs above safety stock', tone: 'success' },
  ],
  reports: [
    { label: 'Month revenue', value: '$18.4K', note: 'Realized cash + interac' },
    { label: 'Gross profit', value: '$8.9K', note: 'Healthy month pacing', tone: 'success' },
    { label: 'Restock drag', value: '$4.2K', note: 'Largest controllable spend' },
  ],
}

const STOCK: StockItem[] = [
  { name: 'Slate Planter 18"', category: 'Ceramics', qty: 9, min: 16, tone: 'warning' },
  { name: 'Rain Barrel Kit', category: 'Water systems', qty: 14, min: 20, tone: 'warning' },
  { name: 'Premium Potting Mix', category: 'Soil blend', qty: 88, min: 42, tone: 'success' },
]

const ACTIVITY: ActivityItem[] = [
  {
    title: 'Premium Potting Mix restocked',
    detail: 'Received by Maya · East shelf',
    delta: '+60',
    tone: 'green',
  },
  {
    title: 'Route #184 confirmed',
    detail: 'Driver assigned · 5 line items',
    delta: 'Out',
    tone: 'blue',
  },
  {
    title: 'Slate Planter 18" sold',
    detail: 'Cash + interac split captured',
    delta: '-2',
    tone: 'amber',
  },
]

const REVENUE: RevenueRow[] = [
  { day: 'Jul 12', amount: '$1,940', width: 82 },
  { day: 'Jul 13', amount: '$1,240', width: 53 },
  { day: 'Jul 14', amount: '$2,120', width: 90 },
  { day: 'Jul 15', amount: '$1,480', width: 64 },
  { day: 'Jul 16', amount: '$1,760', width: 74 },
]

const SELLERS: SellerRow[] = [
  { name: 'Premium Potting Mix', units: '88 units sold', revenue: '$4,620', profit: '$2,110' },
  { name: 'Rain Barrel Kit', units: '32 units sold', revenue: '$3,860', profit: '$1,780' },
  { name: 'Slate Planter 18"', units: '19 units sold', revenue: '$2,470', profit: '$1,220' },
]

function Icon({ name }: { name: string }) {
  switch (name) {
    case 'grid':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
        </svg>
      )
    case 'box':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.1 3.38L12 11 5.9 7.68 12 4.3ZM5 9.42l6 3.28v6.56l-6-3.33V9.42Zm14 0v6.51l-6 3.33V12.7l6-3.28Z" />
        </svg>
      )
    case 'chart':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19V9h3v10H5Zm5 0V5h3v14h-3Zm5 0v-7h3v7h-3Z" />
        </svg>
      )
    case 'route':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 19a3 3 0 1 1 0-6c1.2 0 2.23.7 2.72 1.72l4.17-2.09A3 3 0 0 1 15 7a3 3 0 1 1 2.82 4H17c-.35 0-.7-.06-1-.17l-4.35 2.17c.1.32.15.66.15 1a4.96 4.96 0 0 1-.14 1.16l4.36 2.18c.3-.11.64-.17.98-.17a3 3 0 1 1-2.82 4c-1.2 0-2.23-.7-2.72-1.72l-4.17-2.09A3 3 0 0 1 6 19Z" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
        </svg>
      )
  }
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  return (
    <motion.article
      className={`stat-card ${stat.tone ?? 'default'}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.08 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <span>{stat.label}</span>
      <strong>{stat.value}</strong>
      <small>{stat.note}</small>
    </motion.article>
  )
}

function PhonePreview() {
  return (
    <motion.aside
      className="phone-shell"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-status">
          <strong>9:41</strong>
          <strong>5G 100%</strong>
        </div>

        <motion.section
          className="phone-summary"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28 }}
        >
          <p className="phone-eyebrow">Driver board</p>
          <h3>Dashboard</h3>
          <p className="phone-copy">
            Calm surface, faster field decisions, clearer pressure points.
          </p>
          <div className="phone-revenue">
            <span>Today&apos;s revenue</span>
            <strong>$2,480</strong>
          </div>
        </motion.section>

        <div className="phone-section">
          <div className="phone-section-head">
            <h4>Needs restocking</h4>
            <span>View all</span>
          </div>
          <div className="phone-list">
            {STOCK.slice(0, 2).map((item, index) => (
              <motion.div
                key={item.name}
                className="phone-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.34 + index * 0.06 }}
              >
                <strong>{item.name}</strong>
                <span>
                  {item.qty} in stock · minimum {item.min}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="phone-section">
          <div className="phone-section-head">
            <h4>Recent activity</h4>
            <span>Timeline</span>
          </div>
          <div className="phone-list">
            {ACTIVITY.slice(0, 2).map((item, index) => (
              <motion.div
                key={item.title}
                className="phone-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: 0.46 + index * 0.06 }}
              >
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <nav className="phone-nav" aria-label="Preview mobile navigation">
          {[
            ['Command', 'grid'],
            ['Items', 'box'],
            ['Orders', 'route'],
            ['Reports', 'chart'],
          ].map(([label, icon], index) => (
            <motion.div
              key={label}
              className={`phone-nav-item ${index === 0 ? 'active' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.56 + index * 0.04 }}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </motion.div>
          ))}
        </nav>
      </div>
    </motion.aside>
  )
}

function CommandView() {
  return (
    <div className="panel-grid">
      <section className="panel">
        <header className="panel-head">
          <div>
            <p className="kicker">Attention queue</p>
            <h4>Low-stock items</h4>
            <p className="subcopy">
              Show where dispatch and same-day sales will feel pressure first.
            </p>
          </div>
          <button type="button" className="ghost-button">
            View all
          </button>
        </header>
        <div className="stack-list">
          {STOCK.map((item, index) => (
            <motion.article
              key={item.name}
              className="list-row"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 + index * 0.05 }}
              whileHover={{ y: -2 }}
            >
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.category} · {item.qty} in stock · target {item.min}
                </span>
              </div>
              <em className={`inline-tone ${item.tone}`}>{item.tone === 'warning' ? 'Low stock' : 'Healthy'}</em>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <p className="kicker">Movement stream</p>
            <h4>Recent activity</h4>
            <p className="subcopy">Readable operational events, not a raw changelog dump.</p>
          </div>
        </header>
        <div className="activity-stack">
          {ACTIVITY.map((item, index) => (
            <motion.article
              key={item.title}
              className="activity-row"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.36, delay: 0.14 + index * 0.06 }}
            >
              <div className={`activity-mark ${item.tone}`}>
                <Icon name={item.tone === 'blue' ? 'route' : item.tone === 'amber' ? 'box' : 'grid'} />
              </div>
              <div className="activity-copy">
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </div>
              <em className={`activity-delta ${item.tone}`}>{item.delta}</em>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  )
}

function InventoryView() {
  return (
    <section className="panel full">
      <header className="panel-head">
        <div>
          <p className="kicker">Inventory surface</p>
          <h4>Sharper item cards, cleaner controls</h4>
          <p className="subcopy">
            This is intentionally more severe than the current web UI: less softness, stronger category rhythm, clearer shortage signals.
          </p>
        </div>
      </header>
      <div className="toolbar">
        <div className="search-shell">Search by item name, category, or notes...</div>
        <button type="button" className="chip active">
          Low stock only
        </button>
        <button type="button" className="chip">
          Export CSV
        </button>
      </div>
      <div className="inventory-grid">
        {STOCK.map((item, index) => (
          <motion.article
            key={item.name}
            className="inventory-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.08 + index * 0.07 }}
            whileHover={{ y: -4, transition: { duration: 0.18 } }}
          >
            <div className="inventory-top">
              <span className={`inline-tone ${item.tone}`}>{item.tone === 'warning' ? 'Needs restock' : 'Healthy'}</span>
            </div>
            <h5>{item.name}</h5>
            <p>{item.category}</p>
            <strong>{item.qty}</strong>
            <small>in stock</small>
            <div className="inventory-foot">
              <span>Minimum target</span>
              <b>{item.min}</b>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

function ReportsView() {
  return (
    <div className="panel-grid reports">
      <section className="panel">
        <header className="panel-head">
          <div>
            <p className="kicker">Revenue pacing</p>
            <h4>Daily rhythm</h4>
            <p className="subcopy">Designed to read trend first, then amount.</p>
          </div>
        </header>
        <div className="chart-stack">
          {REVENUE.map((row, index) => (
            <motion.div
              key={row.day}
              className="chart-row"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, delay: 0.08 + index * 0.05 }}
            >
              <span>{row.day}</span>
              <div className="track">
                <motion.div
                  className="bar"
                  initial={{ width: 0 }}
                  animate={{ width: `${row.width}%` }}
                  transition={{ duration: 0.7, delay: 0.18 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <strong>{row.amount}</strong>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <p className="kicker">Top sellers</p>
            <h4>Product contribution</h4>
            <p className="subcopy">Revenue and profit kept together so product performance is legible.</p>
          </div>
        </header>
        <div className="seller-stack">
          {SELLERS.map((row, index) => (
            <motion.article
              key={row.name}
              className="seller-row"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, delay: 0.1 + index * 0.06 }}
            >
              <div>
                <strong>{row.name}</strong>
                <span>{row.units}</span>
              </div>
              <div className="seller-values">
                <strong>{row.revenue}</strong>
                <span>profit {row.profit}</span>
              </div>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  )
}

function App() {
  const [view, setView] = useState<ViewMode>('command')

  const viewTitle = useMemo(() => {
    if (view === 'inventory') return 'Inventory should feel exact, not decorative.'
    if (view === 'reports') return 'Reports should read like control, not bookkeeping wallpaper.'
    return 'A calmer, harder-edged command surface for a real operations tool.'
  }, [view])

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-shell">
      <motion.section
        className="intro-shell"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="intro-copy">
          <span className="intro-kicker">Framer Motion artifact · replacement direction</span>
          <h1>{viewTitle}</h1>
          <p>
            This concept intentionally rejects the glossy showroom style from the first artifact.
            The direction is darker, tighter, and more operational. Motion is used for spatial
            continuity, emphasis, and reveal rhythm, not decoration.
          </p>
        </div>
        <div className="intro-aside">
          <div className="aside-block">
            <span>Style posture</span>
            <strong>Industrial utility</strong>
          </div>
          <div className="aside-block">
            <span>Motion rules</span>
            <strong>Subtle, interruptible, stateful</strong>
          </div>
          <div className="aside-block">
            <span>Color language</span>
            <strong>Cobalt, steel, amber</strong>
          </div>
        </div>
      </motion.section>

      <div className="preview-grid">
        <motion.section
          className="desktop-shell"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.66, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sidebar-shell">
            <div className="brand-row">
              <div className="brand-mark">
                <svg viewBox="0 0 64 64" aria-hidden="true">
                  <path d="M30 7c5 0 9 4 9 9 0 2-1 4-2 6 8 1 14 8 14 17 0 10-8 18-18 18S15 49 15 39c0-8 5-14 12-17a10 10 0 0 1-1-6c0-5 4-9 9-9h-5Z" />
                </svg>
              </div>
              <div>
                <strong>Let It Rain</strong>
                <span>Operations</span>
              </div>
            </div>

            <LayoutGroup>
              <nav className="nav-stack" aria-label="Artifact navigation">
                {NAV.map((item) => {
                  const active = item.id === view
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-button ${active ? 'active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setView(item.id)}
                    >
                      {active ? <motion.div layoutId="nav-glow" className="nav-glow" /> : null}
                      <span className="nav-icon">
                        <Icon name={item.icon} />
                      </span>
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>
            </LayoutGroup>

            <div className="sidebar-card">
              <span className="sidebar-label">Quick pulse</span>
              <div className="pulse-row">
                <span>Low-stock items</span>
                <strong className="warning-text">12</strong>
              </div>
              <div className="pulse-row">
                <span>Orders moving now</span>
                <strong className="success-text">08</strong>
              </div>
              <div className="pulse-row">
                <span>Coverage signal</span>
                <strong>Stable</strong>
              </div>
              <button type="button" className="sidebar-cta">
                Add new item
              </button>
            </div>

            <div className="identity-shell">
              <div className="identity-mark">SF</div>
              <div>
                <strong>Shayan</strong>
                <span>admin@letitrain.app</span>
              </div>
            </div>
          </div>

          <div className="main-shell">
            <header className="main-topbar">
              <div>
                <strong>Friday operating brief</strong>
                <span>Internal launch mode · 7:45 AM snapshot</span>
              </div>
              <div className="topbar-actions">
                <button type="button" className="ghost-button">
                  Export
                </button>
                <button type="button" className="primary-button">
                  Dispatch summary
                </button>
              </div>
            </header>

            <section className="hero-band">
              <span className="hero-band-kicker">Operational direction</span>
              <h2>{viewTitle}</h2>
              <p>
                Stronger hierarchy, disciplined cards, no emoji iconography, and a darker shell
                that respects this product’s job instead of trying to behave like a startup landing page.
              </p>
              <div className="stats-grid">
                {STATS[view].map((stat, index) => (
                  <StatCard key={stat.label} stat={stat} index={index} />
                ))}
              </div>
            </section>

            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                {view === 'command' ? <CommandView /> : null}
                {view === 'inventory' ? <InventoryView /> : null}
                {view === 'reports' ? <ReportsView /> : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>

        <PhonePreview />
      </div>
    </div>
    </MotionConfig>
  )
}

export default App
