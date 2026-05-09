import type { StockData } from './types'

export const calculateSMA = (data: StockData[], period: number): number[] => {
  const sma = new Array(data.length).fill(NaN)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close
    if (i >= period) {
      sum -= data[i - period].close
    }
    if (i >= period - 1) {
      sma[i] = sum / period
    }
  }
  return sma
}

export const calculateEMA = (data: StockData[], period: number): number[] => {
  const k = 2 / (period + 1)
  const ema = new Array(data.length).fill(NaN)

  if (data.length === 0) return ema

  let prevEma = data[0].close
  ema[0] = prevEma

  for (let i = 1; i < data.length; i++) {
    const currentEma = data[i].close * k + prevEma * (1 - k)
    ema[i] = currentEma
    prevEma = currentEma
  }
  return ema
}

export const calculateVWAP = (data: StockData[]): number[] => {
  const vwap = new Array(data.length).fill(NaN)
  let cumVol = 0
  let cumVolPrice = 0

  for (let i = 0; i < data.length; i++) {
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3
    const vol = data[i].volume

    cumVol += vol
    cumVolPrice += typicalPrice * vol

    vwap[i] = cumVolPrice / cumVol
  }
  return vwap
}

export const calculateDonchian = (data: StockData[], period: number) => {
  const highs = new Array(data.length).fill(NaN)
  const lows = new Array(data.length).fill(NaN)

  for (let i = period - 1; i < data.length; i++) {
    let max = -Infinity
    let min = Infinity
    for (let j = 0; j < period; j++) {
      const d = data[i - j]
      if (d.high > max) max = d.high
      if (d.low < min) min = d.low
    }
    highs[i] = max
    lows[i] = min
  }
  return { highs, lows }
}

export const calculateBollinger = (
  data: StockData[],
  period: number,
  multiplier: number,
) => {
  const sma = calculateSMA(data, period)
  const upper = new Array(data.length).fill(NaN)
  const lower = new Array(data.length).fill(NaN)

  for (let i = period - 1; i < data.length; i++) {
    const mean = sma[i]
    let sumSqDiff = 0

    for (let j = 0; j < period; j++) {
      const val = data[i - j].close
      sumSqDiff += (val - mean) * (val - mean)
    }

    const stdDev = Math.sqrt(sumSqDiff / period)
    upper[i] = mean + stdDev * multiplier
    lower[i] = mean - stdDev * multiplier
  }
  return { upper, lower }
}

export const calculateMACD = (data: StockData[]) => {
  const ema12 = calculateEMA(data, 12)
  const ema26 = calculateEMA(data, 26)

  const macdLine = new Array(data.length).fill(NaN)
  for (let i = 0; i < data.length; i++) {
    if (!Number.isNaN(ema12[i]) && !Number.isNaN(ema26[i])) {
      macdLine[i] = ema12[i] - ema26[i]
    }
  }

  const signalLine = new Array(data.length).fill(NaN)
  const period = 9
  const k = 2 / (period + 1)

  let firstValidIndex = -1
  for (let i = 0; i < macdLine.length; i++) {
    if (!Number.isNaN(macdLine[i])) {
      firstValidIndex = i
      break
    }
  }

  if (firstValidIndex !== -1) {
    let prevEma = macdLine[firstValidIndex]
    signalLine[firstValidIndex] = prevEma
    for (let i = firstValidIndex + 1; i < macdLine.length; i++) {
      const val = macdLine[i]
      if (Number.isNaN(val)) {
        signalLine[i] = NaN
        continue
      }
      const currentEma = val * k + prevEma * (1 - k)
      signalLine[i] = currentEma
      prevEma = currentEma
    }
  }

  const histogram = new Array(data.length).fill(NaN)
  for (let i = 0; i < data.length; i++) {
    if (!Number.isNaN(macdLine[i]) && !Number.isNaN(signalLine[i])) {
      histogram[i] = macdLine[i] - signalLine[i]
    }
  }

  return { macdLine, signalLine, histogram }
}

export const calculateRSI = (
  data: StockData[],
  period: number = 14,
): number[] => {
  const rsi = new Array(data.length).fill(NaN)
  if (data.length <= period) return rsi

  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period

  if (avgLoss === 0) rsi[period] = 100
  else {
    const rs = avgGain / avgLoss
    rsi[period] = 100 - 100 / (1 + rs)
  }

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    if (avgLoss === 0) {
      rsi[i] = 100
    } else {
      const rs = avgGain / avgLoss
      rsi[i] = 100 - 100 / (1 + rs)
    }
  }
  return rsi
}

export const calculateATR = (
  data: StockData[],
  period: number = 14,
): number[] => {
  const tr = new Array(data.length).fill(0)
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevClose = data[i - 1].close
    const val1 = high - low
    const val2 = Math.abs(high - prevClose)
    const val3 = Math.abs(low - prevClose)
    tr[i] = Math.max(val1, val2, val3)
  }

  const atr = new Array(data.length).fill(NaN)
  if (data.length <= period) return atr

  let sum = 0
  for (let i = 1; i <= period; i++) {
    sum += tr[i]
  }
  atr[period] = sum / period

  for (let i = period + 1; i < data.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
  }

  return atr
}

export const calculateStochastic = (data: StockData[], period: number = 14) => {
  const stochK = new Array(data.length).fill(NaN)

  for (let i = period - 1; i < data.length; i++) {
    let low = Infinity
    let high = -Infinity
    for (let j = 0; j < period; j++) {
      const d = data[i - j]
      if (d.low < low) low = d.low
      if (d.high > high) high = d.high
    }

    const close = data[i].close
    if (high === low) {
      stochK[i] = 50
    } else {
      stochK[i] = ((close - low) / (high - low)) * 100
    }
  }

  const stochD = new Array(data.length).fill(NaN)
  const smoothPeriod = 3

  for (let i = 0; i < stochK.length; i++) {
    if (i >= period + smoothPeriod - 2) {
      let s = 0
      let c = 0
      for (let j = 0; j < smoothPeriod; j++) {
        if (i - j >= 0 && !Number.isNaN(stochK[i - j])) {
          s += stochK[i - j]
          c++
        }
      }
      if (c === smoothPeriod) {
        stochD[i] = s / smoothPeriod
      }
    }
  }

  return { stochK, stochD }
}

export const calculateCCI = (
  data: StockData[],
  period: number = 20,
): number[] => {
  const tp = data.map((d) => (d.high + d.low + d.close) / 3)
  const cci = new Array(data.length).fill(NaN)

  const smaTP = new Array(data.length).fill(NaN)
  let sum = 0
  for (let i = 0; i < tp.length; i++) {
    sum += tp[i]
    if (i >= period) sum -= tp[i - period]
    if (i >= period - 1) smaTP[i] = sum / period
  }

  for (let i = period - 1; i < data.length; i++) {
    const sma = smaTP[i]
    let meanDev = 0
    for (let j = 0; j < period; j++) {
      meanDev += Math.abs(tp[i - j] - sma)
    }
    meanDev /= period

    if (meanDev === 0) cci[i] = 0
    else cci[i] = (tp[i] - sma) / (0.015 * meanDev)
  }
  return cci
}

export const calculateSAR = (data: StockData[]): number[] => {
  const sar = new Array(data.length).fill(NaN)
  if (data.length < 2) return sar

  let af = 0.02
  const maxAf = 0.2
  let isUp = true
  let ep = data[0].high
  let currentSar = data[0].low

  for (let i = 1; i < data.length; i++) {
    sar[i] = currentSar

    if (isUp) {
      if (data[i].high > ep) {
        ep = data[i].high
        af = Math.min(af + 0.02, maxAf)
      }
      currentSar = currentSar + af * (ep - currentSar)

      if (data[i].low < currentSar) {
        isUp = false
        currentSar = ep
        ep = data[i].low
        af = 0.02
      }
    } else {
      if (data[i].low < ep) {
        ep = data[i].low
        af = Math.min(af + 0.02, maxAf)
      }
      currentSar = currentSar + af * (ep - currentSar)

      if (data[i].high > currentSar) {
        isUp = true
        currentSar = ep
        ep = data[i].high
        af = 0.02
      }
    }
  }
  return sar
}

export const calculateKeltner = (
  data: StockData[],
  period: number = 20,
  multiplier: number = 2,
) => {
  const ema = calculateEMA(data, period)
  const atr = calculateATR(data, 10)

  const upper = new Array(data.length).fill(NaN)
  const lower = new Array(data.length).fill(NaN)

  for (let i = 0; i < data.length; i++) {
    if (Number.isNaN(ema[i]) || Number.isNaN(atr[i])) {
      continue
    }
    upper[i] = ema[i] + multiplier * atr[i]
    lower[i] = ema[i] - multiplier * atr[i]
  }

  return { middle: ema, upper, lower }
}

export const enrichDataWithIndicators = (data: StockData[]): StockData[] => {
  const sma5 = calculateSMA(data, 5)
  const sma10 = calculateSMA(data, 10)
  const sma20 = calculateSMA(data, 20)
  const sma50 = calculateSMA(data, 50)
  const sma100 = calculateSMA(data, 100)
  const sma200 = calculateSMA(data, 200)

  const ema12 = calculateEMA(data, 12)
  const ema26 = calculateEMA(data, 26)
  const ema50 = calculateEMA(data, 50)
  const ema200 = calculateEMA(data, 200)

  const vwap = calculateVWAP(data)
  const { upper: bbUpper, lower: bbLower } = calculateBollinger(data, 20, 2)
  const { highs: dcHigh, lows: dcLow } = calculateDonchian(data, 20)
  const { macdLine, signalLine, histogram } = calculateMACD(data)
  const rsi = calculateRSI(data, 14)

  const atr = calculateATR(data, 14)
  const { stochK, stochD } = calculateStochastic(data, 14)
  const cci = calculateCCI(data, 20)
  const sar = calculateSAR(data)
  const {
    middle: keltnerMiddle,
    upper: keltnerUpper,
    lower: keltnerLower,
  } = calculateKeltner(data)

  return data.map((d, i) => ({
    ...d,
    sma5: Number.isNaN(sma5[i]) ? undefined : sma5[i],
    sma10: Number.isNaN(sma10[i]) ? undefined : sma10[i],
    sma20: Number.isNaN(sma20[i]) ? undefined : sma20[i],
    sma50: Number.isNaN(sma50[i]) ? undefined : sma50[i],
    sma100: Number.isNaN(sma100[i]) ? undefined : sma100[i],
    sma200: Number.isNaN(sma200[i]) ? undefined : sma200[i],
    ema12: Number.isNaN(ema12[i]) ? undefined : ema12[i],
    ema26: Number.isNaN(ema26[i]) ? undefined : ema26[i],
    ema50: Number.isNaN(ema50[i]) ? undefined : ema50[i],
    ema200: Number.isNaN(ema200[i]) ? undefined : ema200[i],
    vwap: vwap[i],
    bollingerUpper: Number.isNaN(bbUpper[i]) ? undefined : bbUpper[i],
    bollingerLower: Number.isNaN(bbLower[i]) ? undefined : bbLower[i],
    donchianHigh: Number.isNaN(dcHigh[i]) ? undefined : dcHigh[i],
    donchianLow: Number.isNaN(dcLow[i]) ? undefined : dcLow[i],
    macdLine: Number.isNaN(macdLine[i]) ? undefined : macdLine[i],
    signalLine: Number.isNaN(signalLine[i]) ? undefined : signalLine[i],
    histogram: Number.isNaN(histogram[i]) ? undefined : histogram[i],
    rsi: Number.isNaN(rsi[i]) ? undefined : rsi[i],
    atr: Number.isNaN(atr[i]) ? undefined : atr[i],
    stochK: Number.isNaN(stochK[i]) ? undefined : stochK[i],
    stochD: Number.isNaN(stochD[i]) ? undefined : stochD[i],
    cci: Number.isNaN(cci[i]) ? undefined : cci[i],
    sar: Number.isNaN(sar[i]) ? undefined : sar[i],
    keltnerMiddle: Number.isNaN(keltnerMiddle[i])
      ? undefined
      : keltnerMiddle[i],
    keltnerUpper: Number.isNaN(keltnerUpper[i]) ? undefined : keltnerUpper[i],
    keltnerLower: Number.isNaN(keltnerLower[i]) ? undefined : keltnerLower[i],
  }))
}

export const aggregateData = (
  data: StockData[],
  interval: string,
): StockData[] => {
  if (interval === '1d') return data

  const getKey = (d: StockData) => {
    const date = new Date(d.time)
    if (interval === '1w') {
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(date.setDate(diff))
      monday.setHours(0, 0, 0, 0)
      return monday.toISOString().split('T')[0]
    }
    if (interval === '1m') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    }
    if (interval === '1y') {
      return `${date.getFullYear()}-01-01`
    }
    return d.time
  }

  const groups: { [key: string]: StockData[] } = {}
  data.forEach((d) => {
    const key = getKey(d)
    if (!groups[key]) groups[key] = []
    groups[key].push(d)
  })

  return Object.keys(groups)
    .sort()
    .map((key) => {
      const group = groups[key]
      group.sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      )

      const first = group[0]
      const last = group[group.length - 1]

      let high = -Infinity
      let low = Infinity
      let volume = 0

      group.forEach((d) => {
        if (d.high > high) high = d.high
        if (d.low < low) low = d.low
        volume += d.volume
      })

      return {
        time: last.time,
        open: first.open,
        high: high,
        low: low,
        close: last.close,
        volume: volume,
      }
    })
}
