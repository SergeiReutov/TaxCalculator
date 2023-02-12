const TYPES = {
  BUY: 'BUY',
  SELL: 'SELL',
  DIVIDEND: 'DIVIDEND',
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

const DATE_FORMAT = 'DD/MM/YYYY HH:mm:ss';

export {
  TYPES,
  PROPERTIES,
  DATE_FORMAT
};