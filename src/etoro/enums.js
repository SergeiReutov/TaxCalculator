const TYPES = {
  BUY: 'BUY',
  SELL: 'SELL',
  CUSTODY_FEE: 'xxxxxx',
  DIVIDEND: 'xxxxxx',
  CASH_IN: 'Deposit',
  CASH_OUT: 'xxxxxx',
  STOCK_SPLIT: 'xxxxxx',
};

const PROPERTIES = {
  // properties from your trade list
  TYPE: 'Type',
  TICKER: 'Details',
  DATE: 'Date',
  QUANTITY: 'Units',
  TOTAL_AMOUNT: 'Amount',
  // inner properties, don't change them
  FX_RATE: 'FX Rate',
  TOTAL_PLN: 'Total PLN',
};

const DATE_FORMAT = 'DD/MM/YYYY HH:mm:ss';

module.exports = {
  TYPES,
  PROPERTIES,
  DATE_FORMAT
};