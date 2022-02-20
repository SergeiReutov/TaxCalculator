const TAX_RATE = 0.19;

const NBP_BASE_URL = 'http://api.nbp.pl/api/exchangerates/rates/A/USD';

const START_DATE = '2021-01-01';
const END_DATE = '2021-12-31';

const TYPES = {
  BUY: 'BUY',
  SELL: 'SELL',
  CUSTODY_FEE: 'CUSTODY_FEE',
  DIVIDEND: 'DIVIDEND',
  CASH_IN: 'CASH TOP-UP',
  CASH_OUT: 'CASH WITHDRAWAL'
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

const DATE_FORMAT = 'DD/MM/YYYY HH:mm:ss';

module.exports = {
  TAX_RATE,
  NBP_BASE_URL,
  START_DATE,
  END_DATE,
  TYPES,
  PROPERTIES,
  DATE_FORMAT
};