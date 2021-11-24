module.exports = class Bank {
  constructor() {
    this.transactions = [];
  }

  credit(amount) {
    this.transactions.push(Math.abs(amount));
  }

  debit(amount) {
    this.transactions.push(- Math.abs(amount));
  }

  balance() {
    return this.transactions.reduce((total, txn) => total + txn, 0);
  }
}