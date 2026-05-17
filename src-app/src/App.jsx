import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const EXCHANGES = {
  starch:    { min: 10, max: 12, label: 'Starch/Carb',   color: 'cat-starch',    badge: 'b-starch',    fill: '#f59e0b' },
  protein:   { min: 10, max: 12, label: 'Protein (Lean)', color: 'cat-protein',   badge: 'b-protein',   fill: '#ef4444' },
  vegetable: { min: 4,  max: 5,  label: 'Vegetable',      color: 'cat-vegetable', badge: 'b-vegetable', fill: '#10b981' },
  fruit:     { min: 3,  max: 4,  label: 'Fruit',          color: 'cat-fruit',     badge: 'b-fruit',     fill: '#ec4899' },
  fat:       { min: 7,  max: 9,  label: 'Fat',            color: 'cat-fat',       badge: 'b-fat',       fill: '#3b82f6' },
  milk:      { min: 2,  max: 2,  label: 'Milk (Low-fat)', color: 'cat-milk',      badge: 'b-milk',      fill: '#8b5cf6' },
}

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
const MEAL_COLORS = { Breakfast: '#f59e0b', Lunch: '#10b981', Dinner: '#3b82f6', Snack: '#ec4899' }
const EMPTY_EXCHANGES = { starch: 0, protein: 0, vegetable: 0, fruit: 0, fat: 0, milk: 0 }

export default function App() {
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('mealPlanLogs')
    return saved ? JSON.parse(saved) : []
  })
  const [displayDate, setDisplayDate] = useState(
    () => new Date().toISOString().split('T')[0],
  )
  const [foodName, setFoodName] = useState('')
  const [selectedMeal, setSelectedMeal] = useState('Breakfast')
  const [exchanges, setExchanges] = useState({ ...EMPTY_EXCHANGES })
  const [macros, setMacros] = useState({ carbs: '', protein: '', fat: '' })
  const [activeView, setActiveView] = useState('log')
  const [exporting, setExporting] = useState(false)
  const chartsRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('mealPlanLogs', JSON.stringify(logs))
  }, [logs])

  const displayedLogs = logs.filter(
    log => log.timestamp.split('T')[0] === displayDate,
  )

  const totals = Object.keys(EXCHANGES).reduce((acc, key) => {
    acc[key] = displayedLogs.reduce((sum, log) => sum + (log.exchanges[key] || 0), 0)
    return acc
  }, {})

  const mealBreakdown = MEALS.reduce((acc, meal) => {
    const mealLogs = displayedLogs.filter(l => l.meal === meal)
    acc[meal] = {
      logs: mealLogs,
      totals: Object.keys(EXCHANGES).reduce((t, key) => {
        t[key] = mealLogs.reduce((sum, log) => sum + (log.exchanges[key] || 0), 0)
        return t
      }, {}),
    }
    return acc
  }, {})

  const applyMacros = e => {
    e.preventDefault()
    const c = parseFloat(macros.carbs) || 0
    const p = parseFloat(macros.protein) || 0
    const f = parseFloat(macros.fat) || 0
    setExchanges(prev => ({
      ...prev,
      starch: prev.starch + Math.round(c / 15),
      protein: prev.protein + Math.round(p / 7),
      fat: prev.fat + Math.round(f / 5),
    }))
    setMacros({ carbs: '', protein: '', fat: '' })
  }

  const addFood = e => {
    e.preventDefault()
    const total = Object.values(exchanges).reduce((s, v) => s + v, 0)
    if (!foodName || total === 0) return
    setLogs(prev => [{
      id: Date.now().toString(),
      name: foodName,
      meal: selectedMeal,
      exchanges: { ...exchanges },
      timestamp: new Date(displayDate).toISOString(),
    }, ...prev])
    setFoodName('')
    setExchanges({ ...EMPTY_EXCHANGES })
  }

  const deleteFood = id => setLogs(prev => prev.filter(l => l.id !== id))

  const exportPDF = async () => {
    if (displayedLogs.length === 0) {
      alert('No food logged for this date to export.')
      return
    }
    setExporting(true)
    await new Promise(r => setTimeout(r, 400))

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = 210

    pdf.setFillColor(15, 23, 42)
    pdf.rect(0, 0, pageW, 297, 'F')

    pdf.setTextColor(248, 250, 252)
    pdf.setFontSize(22)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Dietary Exchange Report', pageW / 2, 18, { align: 'center' })

    pdf.setFontSize(11)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(148, 163, 184)
    pdf.text(`Date: ${displayDate}`, pageW / 2, 25, { align: 'center' })

    let cursorY = 30

    if (chartsRef.current) {
      const canvas = await html2canvas(chartsRef.current, {
        backgroundColor: '#1e293b',
        scale: 2,
        logging: false,
        useCORS: true,
      })
      const imgData = canvas.toDataURL('image/png')
      const imgW = pageW - 20
      const imgH = (canvas.height / canvas.width) * imgW
      const clampedH = Math.min(imgH, 170)
      pdf.addImage(imgData, 'PNG', 10, cursorY, imgW, clampedH)
      cursorY += clampedH + 8
    }

    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(248, 250, 252)
    pdf.text('Food Log', 10, cursorY)
    cursorY += 6

    for (const meal of MEALS) {
      const mealLogs = displayedLogs.filter(l => l.meal === meal)
      if (mealLogs.length === 0) continue

      if (cursorY > 270) {
        pdf.addPage()
        pdf.setFillColor(15, 23, 42)
        pdf.rect(0, 0, pageW, 297, 'F')
        cursorY = 15
      }

      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      const col = MEAL_COLORS[meal]
      pdf.setTextColor(
        parseInt(col.slice(1, 3), 16),
        parseInt(col.slice(3, 5), 16),
        parseInt(col.slice(5, 7), 16),
      )
      pdf.text(meal, 10, cursorY)
      cursorY += 5

      for (const log of mealLogs) {
        if (cursorY > 270) {
          pdf.addPage()
          pdf.setFillColor(15, 23, 42)
          pdf.rect(0, 0, pageW, 297, 'F')
          cursorY = 15
        }
        pdf.setFontSize(10)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(248, 250, 252)
        pdf.text(`  ${log.name}`, 12, cursorY)
        pdf.setTextColor(148, 163, 184)
        const exc = Object.entries(log.exchanges)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${EXCHANGES[k].label}: ${v}`)
          .join('  |  ')
        pdf.setFontSize(8)
        pdf.text(`  ${exc}`, 12, cursorY + 4)
        cursorY += 10
      }
      cursorY += 2
    }

    pdf.save(`meal-report-${displayDate}.pdf`)
    setExporting(false)
  }

  const stepExchange = (key, delta) => {
    setExchanges(prev => ({ ...prev, [key]: Math.max(0, prev[key] + delta) }))
  }

  return (
    <div className="app-container">
      {/* Left: Daily Plan */}
      <div className="card glass-panel" style={{ height: 'fit-content' }}>
        <header
          className="app-header"
          style={{
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h1 className="app-title" style={{ fontSize: '1.8rem' }}>Daily Plan</h1>
            <input
              type="date"
              value={displayDate}
              onChange={e => setDisplayDate(e.target.value)}
              style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <button
            onClick={exportPDF}
            className="secondary"
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
            disabled={exporting}
          >
            {exporting ? 'Exporting…' : '⬇ Export PDF'}
          </button>
        </header>

        <div className="progress-list">
          {Object.entries(EXCHANGES).map(([key, ex]) => {
            const val = totals[key]
            const pct = Math.min(100, (val / ex.max) * 100)
            const targetPct = (ex.min / ex.max) * 100
            return (
              <div key={key} className={`progress-item ${ex.color}`}>
                <div className="progress-header">
                  <span>{ex.label}</span>
                  <span>{val} / {ex.min}{ex.min !== ex.max ? `–${ex.max}` : ''}</span>
                </div>
                <div className="progress-track">
                  {ex.min !== ex.max && (
                    <div
                      className="progress-target"
                      style={{ left: `${targetPct}%` }}
                      title={`Minimum: ${ex.min}`}
                    />
                  )}
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Form + Log */}
      <div className="flex-col gap-6">
        {/* Log Food form */}
        <div className="card glass-panel">
          <h2 className="card-title">
            <span className="icon" style={{ fontSize: '1.2rem' }}>🥗</span> Log Food
          </h2>

          <div className="tabs">
            {MEALS.map(meal => (
              <button
                key={meal}
                type="button"
                className={`tab-btn ${selectedMeal === meal ? 'active' : ''}`}
                onClick={() => setSelectedMeal(meal)}
              >
                {meal}
              </button>
            ))}
          </div>

          <form onSubmit={addFood} className="form-grid">
            <div className="input-group">
              <label>What did you eat?</label>
              <input
                type="text"
                placeholder="e.g. Avocado Toast"
                value={foodName}
                onChange={e => setFoodName(e.target.value)}
                autoComplete="on"
                autoCorrect="on"
                autoCapitalize="words"
                required
              />
            </div>

            <div>
              <label
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Quick Macro Converter (optional)
              </label>
              <div className="macro-calc-row">
                {['carbs', 'protein', 'fat'].map(macro => (
                  <div key={macro} className="macro-input-wrapper">
                    <input
                      type="number"
                      min="0"
                      placeholder={macro.charAt(0).toUpperCase() + macro.slice(1)}
                      value={macros[macro]}
                      onChange={e => setMacros(prev => ({ ...prev, [macro]: e.target.value }))}
                    />
                    <span className="macro-unit">g</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={applyMacros}
                  className="secondary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem' }}
                >
                  Apply
                </button>
              </div>
            </div>

            <div>
              <label
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  display: 'block',
                  marginBottom: '0.5rem',
                }}
              >
                Exchange Servings
              </label>
              <div className="servings-grid">
                {Object.entries(EXCHANGES).map(([key, ex]) => (
                  <div key={key} className="serving-stepper">
                    <span className={`badge ${ex.badge} label`}>{ex.label}</span>
                    <div className="stepper-controls">
                      <button type="button" className="stepper-btn" onClick={() => stepExchange(key, -1)}>−</button>
                      <span className="stepper-val">{exchanges[key]}</span>
                      <button type="button" className="stepper-btn" onClick={() => stepExchange(key, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit">Add to Log</button>
          </form>
        </div>

        {/* Log viewer */}
        <div className="card glass-panel">
          <div className="tabs" style={{ marginBottom: '1.25rem' }}>
            <button
              type="button"
              className={`tab-btn ${activeView === 'log' ? 'active' : ''}`}
              onClick={() => setActiveView('log')}
            >
              Today's Log
            </button>
            <button
              type="button"
              className={`tab-btn ${activeView === 'by-meal' ? 'active' : ''}`}
              onClick={() => setActiveView('by-meal')}
            >
              By Meal
            </button>
          </div>

          {activeView === 'log' ? (
            <LogView logs={displayedLogs} onDelete={deleteFood} />
          ) : (
            <ByMealView mealBreakdown={mealBreakdown} onDelete={deleteFood} />
          )}
        </div>
      </div>

      {/* Off-screen charts rendered for PDF capture */}
      <div
        ref={chartsRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '680px',
          background: '#1e293b',
          padding: '20px',
          borderRadius: '12px',
        }}
      >
        <PDFCharts totals={totals} mealBreakdown={mealBreakdown} displayDate={displayDate} />
      </div>
    </div>
  )
}

function LogView({ logs, onDelete }) {
  if (logs.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
        No food logged for this day yet.
      </p>
    )
  }
  return (
    <div>
      {logs.map(log => (
        <LogItem key={log.id} log={log} onDelete={onDelete} showMeal />
      ))}
    </div>
  )
}

function ByMealView({ mealBreakdown, onDelete }) {
  const hasSomething = Object.values(mealBreakdown).some(m => m.logs.length > 0)

  if (!hasSomething) {
    return (
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
        No food logged for this day yet.
      </p>
    )
  }

  return (
    <div className="flex-col gap-4">
      {MEALS.map(meal => {
        const { logs, totals } = mealBreakdown[meal]
        if (logs.length === 0) return null

        const mealColor = MEAL_COLORS[meal]
        const exchangeTotal = Object.values(totals).reduce((s, v) => s + v, 0)

        return (
          <div key={meal} className="meal-section">
            <div
              style={{
                borderLeft: `3px solid ${mealColor}`,
                paddingLeft: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                <h3 style={{ color: mealColor, fontWeight: 600, fontSize: '1rem' }}>{meal}</h3>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  {exchangeTotal} total exchanges
                </span>
              </div>
              <div className="log-exchanges">
                {Object.entries(EXCHANGES)
                  .filter(([k]) => totals[k] > 0)
                  .map(([key, ex]) => (
                    <span key={key} className={`badge ${ex.badge}`}>
                      {ex.label}: {totals[key]}
                    </span>
                  ))}
              </div>
            </div>
            {logs.map(log => (
              <LogItem key={log.id} log={log} onDelete={onDelete} showMeal={false} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function LogItem({ log, onDelete, showMeal }) {
  return (
    <div className="log-item">
      <div className="log-info">
        <h4>
          {log.name}
          {showMeal && (
            <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.85rem', marginLeft: '0.5rem' }}>
              ({log.meal})
            </span>
          )}
        </h4>
        <div className="log-exchanges">
          {Object.entries(log.exchanges)
            .filter(([, v]) => v > 0)
            .map(([key]) => (
              <span key={key} className={`badge ${EXCHANGES[key].badge}`}>
                {EXCHANGES[key].label}: {log.exchanges[key]}
              </span>
            ))}
        </div>
      </div>
      <button
        onClick={() => onDelete(log.id)}
        className="secondary"
        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', minWidth: 'unset', flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  )
}

function PDFCharts({ totals, mealBreakdown, displayDate }) {
  const exchangeData = Object.entries(EXCHANGES).map(([key, ex]) => ({
    name: ex.label.replace(' (Lean)', '').replace(' (Low-fat)', ''),
    actual: totals[key],
    min: ex.min,
    fill: ex.fill,
  }))

  const mealData = MEALS.map(meal => ({
    name: meal,
    value: Object.values(mealBreakdown[meal].totals).reduce((s, v) => s + v, 0),
    fill: MEAL_COLORS[meal],
  })).filter(m => m.value > 0)

  const mealExchangeData = MEALS.map(meal => ({
    meal: meal.slice(0, 5),
    ...mealBreakdown[meal].totals,
  }))

  const chartStyle = { background: 'transparent' }
  const tickStyle = { fill: '#94a3b8', fontSize: 11 }
  const tooltipStyle = { contentStyle: { background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: 11 } }

  return (
    <div style={{ color: '#f8fafc', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 2, color: '#f8fafc', fontSize: 16 }}>
        Dietary Exchange Report
      </h2>
      <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 16, fontSize: 12 }}>{displayDate}</p>

      <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Daily Exchange Progress (vs. minimum target)</p>
      <ResponsiveContainer width="100%" height={200} style={chartStyle}>
        <BarChart data={exchangeData} margin={{ top: 4, right: 16, left: -10, bottom: 4 }}>
          <XAxis dataKey="name" tick={tickStyle} />
          <YAxis tick={tickStyle} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="min" name="Min Target" fill="#334155" radius={[2, 2, 0, 0]} />
          <Bar dataKey="actual" name="Actual" radius={[2, 2, 0, 0]}>
            {exchangeData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {mealData.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Exchanges by Meal</p>
            <ResponsiveContainer width="100%" height={160} style={chartStyle}>
              <PieChart>
                <Pie
                  data={mealData}
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                  style={{ fontSize: 10 }}
                >
                  {mealData.map((m, i) => (
                    <Cell key={i} fill={m.fill} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Exchange Breakdown by Meal</p>
            <ResponsiveContainer width="100%" height={160} style={chartStyle}>
              <BarChart data={mealExchangeData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <XAxis dataKey="meal" tick={tickStyle} />
                <YAxis tick={tickStyle} />
                <Tooltip {...tooltipStyle} />
                {Object.entries(EXCHANGES).map(([key, ex]) => (
                  <Bar key={key} dataKey={key} name={ex.label} stackId="a" fill={ex.fill} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
