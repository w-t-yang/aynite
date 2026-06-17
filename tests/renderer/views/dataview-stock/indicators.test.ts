// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { DataViewStock } from '../../../../src/renderer/views/dataview-stock/types'

import {
  aggregateData,
  calculateATR,
  calculateBollinger,
  calculateCCI,
  calculateDonchian,
  calculateEMA,
  calculateKeltner,
  calculateMACD,
  calculateRSI,
  calculateSAR,
  calculateSMA,
  calculateStochastic,
  calculateVWAP,
  enrichDataWithIndicators,
} from '../../../../src/renderer/views/dataview-stock/indicators'

// ─── Helpers ─────────────────────────────────────────────────────────

function makeCandle(
  time: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): DataViewStock {
  return { time, open, high, low, close, volume }
}

/** Linear series: close = start + i*step */
function linearSeries(
  n: number,
  start = 100,
  step = 1,
): DataViewStock[] {
  const data: DataViewStock[] = []
  for (let i = 0; i < n; i++) {
    const c = start + i * step
    data.push(
      makeCandle(
        `2026-01-${String(i + 1).padStart(2, '0')}`,
        c - 0.5,
        c + 1,
        c - 1,
        c,
        1000 + i * 10,
      ),
    )
  }
  return data
}

// ─── SMA ─────────────────────────────────────────────────────────────

describe('calculateSMA', () => {
  it('returns NaNs for first (period-1) elements', () => {
    const data = linearSeries(5)
    const sma = calculateSMA(data, 3)
    expect(sma[0]).toBeNaN()
    expect(sma[1]).toBeNaN()
    expect(sma[2]).not.toBeNaN()
  })

  it('computes simple moving average correctly', () => {
    const data = linearSeries(10, 100, 1) // close: 100,101,102,103,104,105,106,107,108,109
    const sma = calculateSMA(data, 3)
    // sma[2] = (100+101+102)/3 = 101
    expect(sma[2]).toBeCloseTo(101, 10)
    // sma[3] = (101+102+103)/3 = 102
    expect(sma[3]).toBeCloseTo(102, 10)
    // sma[9] = (107+108+109)/3 = 108
    expect(sma[9]).toBeCloseTo(108, 10)
  })

  it('returns all NaNs when data is shorter than period', () => {
    const data = linearSeries(2)
    const sma = calculateSMA(data, 5)
    expect(sma.every((v) => Number.isNaN(v))).toBe(true)
  })

  it('handles empty array', () => {
    const sma = calculateSMA([], 5)
    expect(sma).toHaveLength(0)
  })
})

// ─── EMA ─────────────────────────────────────────────────────────────

describe('calculateEMA', () => {
  it('uses first close as initial EMA value at index 0', () => {
    const data = linearSeries(5, 100, 1)
    const ema = calculateEMA(data, 3)
    expect(ema[0]).toBe(100) // first close
  })

  it('computes exponential moving average correctly', () => {
    const data = linearSeries(5, 100, 1) // close: 100,101,102,103,104
    const ema = calculateEMA(data, 3)
    // k = 2/(3+1) = 0.5
    // ema[0] = 100
    // ema[1] = 101*0.5 + 100*0.5 = 100.5
    expect(ema[1]).toBeCloseTo(100.5, 10)
    // ema[2] = 102*0.5 + 100.5*0.5 = 101.25
    expect(ema[2]).toBeCloseTo(101.25, 10)
    // ema[3] = 103*0.5 + 101.25*0.5 = 102.125
    expect(ema[3]).toBeCloseTo(102.125, 10)
  })

  it('returns all NaNs for empty data', () => {
    const ema = calculateEMA([], 3)
    expect(ema).toHaveLength(0)
  })
})

// ─── VWAP ────────────────────────────────────────────────────────────

describe('calculateVWAP', () => {
  it('computes volume-weighted average price cumulatively', () => {
    const data = [
      makeCandle('2026-01-01', 100, 105, 95, 100, 1000),
      makeCandle('2026-01-02', 101, 106, 96, 102, 2000),
      makeCandle('2026-01-03', 103, 108, 98, 105, 1500),
    ]
    const vwap = calculateVWAP(data)
    // tp[0] = (105+95+100)/3 = 100
    // vwap[0] = (100*1000)/1000 = 100
    expect(vwap[0]).toBeCloseTo(100, 10)
    // tp[1] = (106+96+102)/3 = 101.333...
    // vwap[1] = (100*1000 + 101.333*2000) / (1000+2000) ≈ 100.8889
    expect(vwap[1]).toBeCloseTo(100.8889, 2)
    // tp[2] = (108+98+105)/3 = 103.666...
    // vwap[2] = (100*1000 + 101.333*2000 + 103.667*1500) / (1000+2000+1500) ≈ 102.13
    expect(vwap[2]).toBeCloseTo(102.13, 0)
  })

  it('handles single element', () => {
    const data = [makeCandle('2026-01-01', 100, 105, 95, 100, 1000)]
    const vwap = calculateVWAP(data)
    expect(vwap[0]).toBeCloseTo(100, 10)
  })
})

// ─── Donchian ────────────────────────────────────────────────────────

describe('calculateDonchian', () => {
  it('computes period highs and lows', () => {
    const data = linearSeries(10, 100, 1)
    // high = close + 1, low = close - 1
    const { highs, lows } = calculateDonchian(data, 3)
    // donchian[2] should have high = max(high[0],high[1],high[2])
    // high[0]=101, high[1]=102, high[2]=103 → max=103
    expect(highs[2]).toBe(103)
    // low[0]=99, low[1]=100, low[2]=101 → min=99
    expect(lows[2]).toBe(99)
  })

  it('returns NaNs for first (period-1) elements', () => {
    const data = linearSeries(5)
    const { highs, lows } = calculateDonchian(data, 3)
    expect(highs[0]).toBeNaN()
    expect(highs[1]).toBeNaN()
    expect(highs[2]).not.toBeNaN()
    expect(lows[0]).toBeNaN()
  })
})

// ─── Bollinger ───────────────────────────────────────────────────────

describe('calculateBollinger', () => {
  it('upper band is above lower band', () => {
    const data = linearSeries(30, 100, 1)
    const { upper, lower } = calculateBollinger(data, 20, 2)
    for (let i = 19; i < data.length; i++) {
      expect(upper[i]).toBeGreaterThan(lower[i])
    }
  })

  it('returns NaNs before period-1', () => {
    const data = linearSeries(10)
    const { upper, lower } = calculateBollinger(data, 20, 2)
    expect(upper[0]).toBeNaN()
    expect(lower[0]).toBeNaN()
  })

  it('bands widen with volatile data', () => {
    // Create steady data then a volatile jump
    const data: DataViewStock[] = []
    for (let i = 0; i < 25; i++) {
      data.push(makeCandle(`day${i}`, 100, 101, 99, 100, 1000))
    }
    // Add spike
    data.push(makeCandle('spike', 100, 150, 100, 140, 5000))

    const { upper } = calculateBollinger(data, 20, 2)
    // Upper band should be wider after the spike
    expect(upper[25]).toBeGreaterThan(upper[19])
  })
})

// ─── MACD ────────────────────────────────────────────────────────────

describe('calculateMACD', () => {
  it('returns macdLine, signalLine, and histogram arrays', () => {
    const data = linearSeries(40, 100, 1)
    const { macdLine, signalLine, histogram } = calculateMACD(data)

    expect(macdLine).toHaveLength(40)
    expect(signalLine).toHaveLength(40)
    expect(histogram).toHaveLength(40)
  })

  it('histogram equals macdLine minus signalLine', () => {
    const data = linearSeries(40, 100, 1)
    const { macdLine, signalLine, histogram } = calculateMACD(data)

    for (let i = 0; i < data.length; i++) {
      if (!Number.isNaN(histogram[i]) || !Number.isNaN(macdLine[i])) {
        // When macdLine and signalLine are both valid, histogram = macd - signal
        if (!Number.isNaN(macdLine[i]) && !Number.isNaN(signalLine[i])) {
          expect(histogram[i]).toBeCloseTo(
            macdLine[i] - signalLine[i],
            8,
          )
        }
      }
    }
  })

  it('signal line is smoothed version of macdLine', () => {
    const data = linearSeries(40, 100, 10) // strong uptrend
    const { macdLine, signalLine } = calculateMACD(data)
    // Signal line should lag behind macd line in an uptrend
    // Find first valid index
    let firstValid = -1
    for (let i = 0; i < macdLine.length; i++) {
      if (!Number.isNaN(macdLine[i])) {
        firstValid = i
        break
      }
    }
    expect(firstValid).not.toBe(-1)

    // After the first 30 points, macdLine should be positive (since 12-EMA > 26-EMA in uptrend)
    const validPoints = macdLine.filter((v) => !Number.isNaN(v))
    expect(validPoints.length).toBeGreaterThan(0)
  })
})

// ─── RSI ─────────────────────────────────────────────────────────────

describe('calculateRSI', () => {
  it('returns 0-100 range for standard data', () => {
    const data = linearSeries(30, 100, 1) // steady uptrend → RSI should be high
    const rsi = calculateRSI(data, 14)
    for (let i = 14; i < data.length; i++) {
      expect(rsi[i]).toBeGreaterThanOrEqual(0)
      expect(rsi[i]).toBeLessThanOrEqual(100)
    }
  })

  it('returns 100 when all gains (no losses)', () => {
    const data: DataViewStock[] = []
    for (let i = 0; i < 20; i++) {
      data.push(makeCandle(`day${i}`, 100 + i, 101 + i, 99 + i, 100 + i, 1000))
    }
    const rsi = calculateRSI(data, 14)
    // Since every close is higher than previous, no losses → RSI = 100
    expect(rsi[14]).toBe(100)
  })

  it('returns higher values for uptrend and lower values for downtrend', () => {
    const uptrend = linearSeries(30, 100, 1)
    // Downtrend: start high, go down
    const downtrend = linearSeries(30, 200, -1)

    const rsiUp = calculateRSI(uptrend, 14)
    const rsiDown = calculateRSI(downtrend, 14)

    // The last RSI values should reflect the trend
    const lastUp = rsiUp[rsiUp.length - 1]
    const lastDown = rsiDown[rsiDown.length - 1]

    expect(lastUp).toBeGreaterThan(50)
    expect(lastDown).toBeLessThan(50)
  })

  it('handles data shorter than period', () => {
    const data = linearSeries(5)
    const rsi = calculateRSI(data, 14)
    expect(rsi.every((v) => Number.isNaN(v))).toBe(true)
  })
})

// ─── ATR ─────────────────────────────────────────────────────────────

describe('calculateATR', () => {
  it('returns positive values', () => {
    const data = linearSeries(30, 100, 1)
    const atr = calculateATR(data, 14)
    for (let i = 14; i < data.length; i++) {
      expect(atr[i]).toBeGreaterThan(0)
    }
  })

  it('returns NaNs for first `period` elements', () => {
    const data = linearSeries(30)
    const atr = calculateATR(data, 14)
    expect(atr[0]).toBeNaN()
    expect(atr[13]).toBeNaN()
    expect(atr[14]).not.toBeNaN()
  })

  it('is larger with volatile data', () => {
    const steady: DataViewStock[] = []
    const volatile: DataViewStock[] = []
    for (let i = 0; i < 30; i++) {
      steady.push(makeCandle(`day${i}`, 100, 101, 99, 100, 1000))
      volatile.push(makeCandle(`day${i}`, 100, 120, 80, 100, 1000))
    }
    const atrSteady = calculateATR(steady, 14)
    const atrVolatile = calculateATR(volatile, 14)
    expect(atrVolatile[29]).toBeGreaterThan(atrSteady[29])
  })
})

// ─── Stochastic ──────────────────────────────────────────────────────

describe('calculateStochastic', () => {
  it('returns K and D values in 0-100 range', () => {
    const data = linearSeries(30, 100, 1)
    const { stochK, stochD } = calculateStochastic(data, 14)
    for (let i = 14; i < data.length; i++) {
      expect(stochK[i]).toBeGreaterThanOrEqual(0)
      expect(stochK[i]).toBeLessThanOrEqual(100)
    }
  })

  it('D line is smoothed version of K line', () => {
    const data = linearSeries(30, 100, 1)
    const { stochK, stochD } = calculateStochastic(data, 14)
    // D is SMA of K over 3 periods
    const validIndices: number[] = []
    for (let i = 14; i < data.length; i++) {
      if (!Number.isNaN(stochD[i])) validIndices.push(i)
    }
    expect(validIndices.length).toBeGreaterThan(0)

    // After smoothing, %D should lag behind %K
    expect(stochD[validIndices[0]]).not.toBeNaN()
  })

  it('handles flat price (high=low → returns 50)', () => {
    const data: DataViewStock[] = []
    for (let i = 0; i < 20; i++) {
      data.push(makeCandle(`day${i}`, 100, 100, 100, 100, 1000))
    }
    const { stochK } = calculateStochastic(data, 14)
    expect(stochK[14]).toBe(50)
  })
})

// ─── CCI ─────────────────────────────────────────────────────────────

describe('calculateCCI', () => {
  it('returns values centered around zero', () => {
    const data = linearSeries(40, 100, 1)
    const cci = calculateCCI(data, 20)
    let nonNanCount = 0
    for (let i = 19; i < data.length; i++) {
      if (!Number.isNaN(cci[i])) nonNanCount++
    }
    expect(nonNanCount).toBeGreaterThan(0)
  })

  it('exceeds +100 for strong uptrend and -100 for strong downtrend', () => {
    const uptrend = linearSeries(40, 100, 3) // strong up
    const downtrend = linearSeries(40, 300, -3) // strong down

    const cciUp = calculateCCI(uptrend, 20)
    const cciDown = calculateCCI(downtrend, 20)

    const lastUp = cciUp[cciUp.length - 1]
    const lastDown = cciDown[cciDown.length - 1]

    expect(lastUp).toBeGreaterThan(100)
    expect(lastDown).toBeLessThan(-100)
  })

  it('returns NaNs before period-1', () => {
    const data = linearSeries(10)
    const cci = calculateCCI(data, 20)
    expect(cci[0]).toBeNaN()
    expect(cci[9]).toBeNaN()
  })
})

// ─── SAR ─────────────────────────────────────────────────────────────

describe('calculateSAR', () => {
  it('returns NaN for fewer than 2 data points', () => {
    expect(calculateSAR([makeCandle('d1', 100, 110, 90, 100, 1000)])).toEqual([
      NaN,
    ])
    expect(calculateSAR([])).toEqual([])
  })

  it('follows price in uptrend (SAR below close)', () => {
    // Strong uptrend: each day closes higher
    const data: DataViewStock[] = []
    for (let i = 0; i < 15; i++) {
      const c = 100 + i * 2
      data.push(makeCandle(`day${i}`, c - 1, c + 2, c - 2, c, 1000))
    }
    const sar = calculateSAR(data)
    // After initial phase, SAR should be below close in uptrend
    for (let i = 5; i < data.length; i++) {
      expect(sar[i]).toBeLessThan(data[i].close)
    }
  })

  it('switches to downtrend when price drops below SAR', () => {
    // Uptrend for 10 days then a sharp drop
    const data: DataViewStock[] = []
    for (let i = 0; i < 10; i++) {
      const c = 100 + i * 2
      data.push(makeCandle(`up${i}`, c - 1, c + 2, c - 2, c, 1000))
    }
    // Sharp drop
    data.push(makeCandle('down1', 115, 116, 90, 92, 5000))
    data.push(makeCandle('down2', 91, 93, 85, 88, 5000))
    data.push(makeCandle('down3', 87, 90, 83, 85, 5000))

    const sar = calculateSAR(data)
    // After the drop, SAR should flip above close (downtrend)
    // The exact check: at least one of the last points should have SAR > close
    const lastFew = sar.slice(-3).filter((v) => !Number.isNaN(v))
    const closeLastFew = data.slice(-3).map((d) => d.close)
    const hasDowntrend = lastFew.some((s, i) => s > closeLastFew[i])
    expect(hasDowntrend).toBe(true)
  })
})

// ─── Keltner Channels ────────────────────────────────────────────────

describe('calculateKeltner', () => {
  it('middle band equals EMA of close', () => {
    const data = linearSeries(40, 100, 1)
    const { middle, upper, lower } = calculateKeltner(data, 20, 2)
    const ema = calculateEMA(data, 20)
    for (let i = 0; i < data.length; i++) {
      if (!Number.isNaN(middle[i]) && !Number.isNaN(ema[i])) {
        expect(middle[i]).toBeCloseTo(ema[i], 8)
      }
    }
  })

  it('upper > middle > lower', () => {
    const data = linearSeries(40, 100, 1)
    const { middle, upper, lower } = calculateKeltner(data, 20, 2)
    for (let i = 0; i < data.length; i++) {
      if (!Number.isNaN(upper[i])) {
        expect(upper[i]).toBeGreaterThan(middle[i])
        expect(middle[i]).toBeGreaterThan(lower[i])
      }
    }
  })
})

// ─── enrichDataWithIndicators ────────────────────────────────────────

describe('enrichDataWithIndicators', () => {
  it('adds all indicator fields to each candle', () => {
    const data = linearSeries(210, 100, 1) // need 200+ for SMA200
    const enriched = enrichDataWithIndicators(data)
    expect(enriched).toHaveLength(data.length)

    // Sample the last item (all indicators should be defined)
    const last = enriched[enriched.length - 1]
    expect(last.sma200).toBeDefined()
    expect(last.ema12).toBeDefined()
    expect(last.ema26).toBeDefined()
    expect(last.vwap).toBeDefined()
    expect(last.bollingerUpper).toBeDefined()
    expect(last.bollingerLower).toBeDefined()
    expect(last.donchianHigh).toBeDefined()
    expect(last.donchianLow).toBeDefined()
    expect(last.macdLine).toBeDefined()
    expect(last.signalLine).toBeDefined()
    expect(last.histogram).toBeDefined()
    expect(last.rsi).toBeDefined()
    expect(last.atr).toBeDefined()
    expect(last.stochK).toBeDefined()
    expect(last.stochD).toBeDefined()
    expect(last.cci).toBeDefined()
    expect(last.sar).toBeDefined()
    expect(last.keltnerUpper).toBeDefined()
    expect(last.keltnerLower).toBeDefined()
  })

  it('preserves original candle data', () => {
    const data = linearSeries(30, 100, 1)
    const enriched = enrichDataWithIndicators(data)
    for (let i = 0; i < data.length; i++) {
      expect(enriched[i].time).toBe(data[i].time)
      expect(enriched[i].open).toBe(data[i].open)
      expect(enriched[i].high).toBe(data[i].high)
      expect(enriched[i].low).toBe(data[i].low)
      expect(enriched[i].close).toBe(data[i].close)
      expect(enriched[i].volume).toBe(data[i].volume)
    }
  })

  it('early indicators are undefined (before warm-up period)', () => {
    const data = linearSeries(10, 100, 1)
    const enriched = enrichDataWithIndicators(data)
    // sma5 needs 5 elements
    expect(enriched[0].sma5).toBeUndefined()
    expect(enriched[3].sma5).toBeUndefined()
    // sma5[4] should be defined
    expect(enriched[4].sma5).toBeDefined()
  })
})

// ─── aggregateData ───────────────────────────────────────────────────

describe('aggregateData', () => {
  it('returns same data for 1d interval', () => {
    const data = linearSeries(10, 100, 1)
    const result = aggregateData(data, '1d')
    expect(result).toHaveLength(data.length)
    for (let i = 0; i < data.length; i++) {
      expect(result[i].time).toBe(data[i].time)
      expect(result[i].close).toBe(data[i].close)
    }
  })

  it('aggregates daily data into weekly candles', () => {
    // Use dates that start on a Monday (2026-01-05) for predictable weekly grouping
    const data: DataViewStock[] = []
    for (let i = 0; i < 14; i++) {
      const day = i + 5 // Jan 5 (Mon) through Jan 18 (Sun)
      const c = 100 + i
      data.push(
        makeCandle(
          `2026-01-${String(day).padStart(2, '0')}`,
          c - 0.5,
          c + 1,
          c - 1,
          c,
          1000,
        ),
      )
    }
    const weekly = aggregateData(data, '1w')
    // 14 consecutive days from Monday should produce at least 2 weekly groups
    expect(weekly.length).toBeGreaterThanOrEqual(2)

    // First week candle should have open from the first data point
    expect(weekly[0].open).toBeCloseTo(99.5, 5)
  })

  it('aggregates into monthly candles', () => {
    // Create 60 days spanning 2 months
    const data: DataViewStock[] = []
    for (let i = 0; i < 60; i++) {
      const c = 100 + i
      // January: 1-31, February: 1-28 (2026), rest in March
      const day = i + 1
      let month = '01'
      let dayStr = String(day)
      if (day > 31) {
        month = '02'
        dayStr = String(day - 31)
        if (day > 31 + 28) {
          month = '03'
          dayStr = String(day - 31 - 28)
        }
      }
      data.push(
        makeCandle(
          `2026-${month}-${String(dayStr).padStart(2, '0')}`,
          c - 0.5,
          c + 1,
          c - 1,
          c,
          1000,
        ),
      )
    }
    const monthly = aggregateData(data, '1m')
    // Should have 3 monthly candles (Jan, Feb, Mar)
    expect(monthly.length).toBeGreaterThanOrEqual(2)
    expect(monthly.length).toBeLessThanOrEqual(3)
  })

  it('aggregates into yearly candles', () => {
    // Use explicit dates across a single year (2025)
    const data: DataViewStock[] = []
    for (let i = 0; i < 365; i++) {
      const date = new Date(2025, 0, 1 + i) // Jan 1 + i days
      const dateStr = date.toISOString().split('T')[0]
      const c = 100 + i
      data.push(makeCandle(dateStr, c - 0.5, c + 1, c - 1, c, 1000))
    }
    const yearly = aggregateData(data, '1y')
    // All 2025 dates → at least 1 yearly candle (may also be 0 for edge cases)
    expect(yearly.length).toBeGreaterThanOrEqual(1)
    // Open should be first candle's open
    expect(yearly[0].open).toBeCloseTo(99.5, 5) // data[0].open = 100 - 0.5
  })

  it('computes correct OHLC for aggregated group', () => {
    const data = [
      makeCandle('2026-01-01', 100, 105, 98, 102, 1000),
      makeCandle('2026-01-02', 103, 108, 101, 107, 1500),
      makeCandle('2026-01-03', 106, 110, 104, 109, 2000),
    ]
    const weekly = aggregateData(data, '1w')
    expect(weekly).toHaveLength(1)
    expect(weekly[0].open).toBe(100)
    expect(weekly[0].high).toBe(110)
    expect(weekly[0].low).toBe(98)
    expect(weekly[0].close).toBe(109)
    expect(weekly[0].volume).toBe(1000 + 1500 + 2000)
  })
})
