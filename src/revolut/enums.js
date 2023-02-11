const TYPES = {
  BUY: 'BUY - MARKET',
  SELL: 'SELL - MARKET',
  CUSTODY_FEE: 'CUSTODY FEE',
  DIVIDEND: 'DIVIDEND',
  CASH_IN: 'CASH TOP-UP',
  CASH_OUT: 'CASH WITHDRAWAL',
  STOCK_SPLIT: 'STOCK SPLIT',
};

const PROPERTIES = {
  // properties from your trade list
  TYPE: 'Type',
  TICKER: 'Ticker',
  DATE: 'Date',
  QUANTITY: 'Quantity',
  TOTAL_AMOUNT: 'Total Amount',
  // inner properties, don't change them
  FX_RATE: 'FX Rate',
  TOTAL_PLN: 'Total PLN',
};

const DATE_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ';

const DIVIDEND_NET_RATE = 0.85;

module.exports = {
  TYPES,
  PROPERTIES,
  DATE_FORMAT,
  DIVIDEND_NET_RATE,
};