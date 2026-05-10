// stock-view — Interactive stock chart viewer
// Loads a stock-data JSON file and renders price + volume charts.

;(async () => {
  // ── Determine which JSON file to load ──────────────────────
  const params = new URLSearchParams(window.location.search)
  const jsonFile = window.STOCK_JSON || params.get('json') || 'AAPL.json'
  document.title = `Stock View — ${jsonFile.replace('.json', '')}`

  // (Directory listing removed to avoid ERR_UNEXPECTED on custom protocols)

  // ── Fetch the JSON data ────────────────────────────────────
  let data
  try {
    const resp = await fetch(jsonFile)
    data = await resp.json()
  } catch (_err) {
    document.body.innerHTML = `<div class="header"><span style="color:var(--red)">Failed to load ${jsonFile}</span></div>`
    return
  }

  // ── Validate format ────────────────────────────────────────
  if (!data.history || !Array.isArray(data.history)) {
    document.body.innerHTML = `<div class="header"><span style="color:var(--red)">Invalid stock data format — "history" array missing</span></div>`
    return
  }

  // ── Render header ─────────────────────────────────────────
  const info = data.info || {}
  const meta = data.metadata || {}
  const history = data.history
  const currentPrice = info.current_price
  const prevClose = info.previous_close
  const change =
    currentPrice != null && prevClose != null ? currentPrice - prevClose : null
  const changePct =
    change != null && prevClose ? (change / prevClose) * 100 : null

  const header = document.createElement('div')
  header.className = 'header'
  const dir = change == null ? '' : change >= 0 ? 'up' : 'down'
  const sign = change == null ? '' : change >= 0 ? '+' : ''
  header.innerHTML = `
    <span class="symbol">${info.name || meta.symbol || '???'}</span>
    <span class="name">${meta.symbol || ''} · ${info.exchange || ''}</span>
    <span class="price">${fmtCurrency(currentPrice, info.currency)}</span>
    ${change != null ? `<span class="change ${dir}">${sign}${fmtCurrency(change, info.currency)} (${sign}${changePct.toFixed(2)}%)</span>` : ''}
  `
  document.body.appendChild(header)

  // ── Main layout ────────────────────────────────────────────
  const main = document.createElement('div')
  main.className = 'main'
  main.innerHTML = `
    <div class="chart-area">
      <div class="chart-panel" style="flex:2"><canvas id="price-chart"></canvas></div>
      <div class="chart-panel" style="flex:1"><canvas id="volume-chart"></canvas></div>
    </div>
    <div class="sidebar" id="sidebar"></div>
  `
  document.body.appendChild(main)

  // ── Sidebar info ──────────────────────────────────────────
  const sidebar = document.getElementById('sidebar')
  sidebar.innerHTML = `
    <div>
      <h3>Company</h3>
      ${stat('Sector', info.sector)}
      ${stat('Industry', info.industry)}
      ${stat('Market Cap', fmtBig(info.market_cap, info.currency))}
      ${stat('Currency', info.currency)}
    </div>
    <div>
      <h3>Price Stats</h3>
      ${stat('50-Day Avg', fmtCurrency(info.fifty_day_avg, info.currency))}
      ${stat('200-Day Avg', fmtCurrency(info.two_hundred_day_avg, info.currency))}
    </div>
    <div>
      <h3>Data</h3>
      ${stat('Records', history.length)}
      ${stat('Period', meta.period)}
      ${stat('Interval', meta.interval)}
      ${stat('Fetched', formatDate(meta.fetched_at))}
    </div>
  `

  // ── Charts ────────────────────────────────────────────────
  const labels = history.map((r) => {
    const d = new Date(r.date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
  const closes = history.map((r) => r.close)
  const highs = history.map((r) => r.high)
  const lows = history.map((r) => r.low)
  const _opens = history.map((r) => r.open)
  const volumes = history.map((r) => r.volume)

  const gridColor = 'rgba(200, 210, 230, 0.06)'
  const textColor = '#6b7084'

  // Price chart — high/low range + close line
  new Chart(document.getElementById('price-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Close',
          data: closes,
          borderColor: '#5b9cf5',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          order: 1,
        },
        {
          label: 'High-Low Range',
          data: highs,
          borderColor: 'rgba(91, 156, 245, 0.25)',
          backgroundColor: 'rgba(91, 156, 245, 0.08)',
          borderWidth: 1,
          pointRadius: 0,
          fill: 1,
          order: 2,
        },
        {
          label: '', // invisible — just to create the fill target
          data: lows,
          borderColor: 'transparent',
          backgroundColor: 'transparent',
          pointRadius: 0,
          fill: false,
          order: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d27',
          borderColor: '#2a2d3a',
          borderWidth: 1,
          titleColor: '#c8d0e0',
          bodyColor: '#c8d0e0',
          bodyFont: { family: 'JetBrains Mono, monospace', size: 11 },
          callbacks: {
            title: (ctx) => `📅 ${history[ctx[0].dataIndex].date}`,
            label: (ctx) => {
              const r = history[ctx.dataIndex]
              return [
                `  Open  : ${fmtNum(r.open)}`,
                `  High  : ${fmtNum(r.high)}`,
                `  Low   : ${fmtNum(r.low)}`,
                `  Close : ${fmtNum(r.close)}`,
                `  Vol   : ${fmtBig(r.volume)}`,
              ]
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: 12 },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, callback: (v) => fmtNum(v) },
        },
      },
    },
  })

  // Volume chart
  const volColors = history.map((r, i) => {
    if (i === 0) return 'rgba(91,156,245,0.5)'
    return r.close >= history[i - 1].close
      ? 'rgba(52,211,153,0.5)'
      : 'rgba(248,113,113,0.5)'
  })

  new Chart(document.getElementById('volume-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Volume',
          data: volumes,
          backgroundColor: volColors,
          borderColor: 'transparent',
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d27',
          borderColor: '#2a2d3a',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `  Vol: ${fmtBig(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, maxTicksLimit: 12 },
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, callback: (v) => fmtBig(v) },
        },
      },
    },
  })

  // ── Footer ──────────────────────────────────────────────────
  const footer = document.createElement('div')
  footer.className = 'footer'
  footer.innerHTML = `<span>🔮 Aynite Stock View</span><span>${meta.fetched_at ? `Fetched ${formatDate(meta.fetched_at)}` : ''}</span>`
  document.body.appendChild(footer)

  // ── Helpers ─────────────────────────────────────────────────
  function stat(label, value) {
    if (value == null || value === 'N/A' || value === '') return ''
    return `<div class="stat-row"><span class="label">${label}</span><span class="value">${value}</span></div>`
  }

  function fmtCurrency(v, currency) {
    if (v == null) return '—'
    const c = currency || 'USD'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: c,
    }).format(v)
  }

  function fmtNum(v) {
    if (v == null) return '—'
    return Number(v).toFixed(2)
  }

  function fmtBig(v, currency) {
    if (v == null) return '—'
    if (currency) return fmtCurrency(v, currency)
    if (Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(2)}B`
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(2)}K`
    return v.toFixed(0)
  }

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
})()
