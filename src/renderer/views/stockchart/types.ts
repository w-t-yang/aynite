interface StockData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  // SMA Indicators
  sma5?: number
  sma10?: number
  sma20?: number
  sma50?: number
  sma100?: number
  sma200?: number
  // EMA Indicators
  ema12?: number
  ema26?: number
  ema50?: number
  ema200?: number
  // Other Indicators
  vwap?: number
  bollingerUpper?: number
  bollingerLower?: number
  donchianHigh?: number
  donchianLow?: number
  // New Indicators
  keltnerUpper?: number
  keltnerLower?: number
  keltnerMiddle?: number
  sar?: number // Parabolic SAR
  atr?: number
  stochK?: number
  stochD?: number
  cci?: number
  // MACD
  macdLine?: number
  signalLine?: number
  histogram?: number
  // RSI
  rsi?: number
  compareClose?: number
}

export type { StockData }

export enum TimeInterval {
  D1 = '1d',
  W1 = '1w',
  M1 = '1m',
  Y1 = '1y',
}

const DEFAULT_INDICATORS = {
  sma5: false,
  sma10: false,
  sma20: true,
  sma50: false,
  sma100: false,
  sma200: false,
  ema12: false,
  ema26: false,
  ema50: false,
  ema200: false,
  vwap: false,
  bollinger: false,
  donchian: false,
  macd: true,
  rsi: true,
  keltner: false,
  sar: false,
  atr: false,
  stoch: false,
  cci: false,
}

export { DEFAULT_INDICATORS }
