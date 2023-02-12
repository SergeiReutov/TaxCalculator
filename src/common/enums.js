const TAX_RATE = 0.19;

const NBP_BASE_URL = 'http://api.nbp.pl/api/exchangerates/rates/A/USD';

const TYPES = {
  BUY: 'BUY',
  SELL: 'SELL',
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
  PRICE: 'Price',
  TOTAL_AMOUNT: 'Total Amount',
  // inner properties, don't change them
  FX_RATE: 'FX Rate',
  TOTAL_PLN: 'Total PLN',
};

export {
  TAX_RATE,
  NBP_BASE_URL,
  TYPES,
  PROPERTIES,
};