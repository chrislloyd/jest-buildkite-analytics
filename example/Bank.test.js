const Bank = require('./Bank.js');

describe("Bank", () => {
  describe("balance", () => {
    test("credits correctly", () => {
      const bank = new Bank();
      bank.credit(100);
      bank.credit(200);
      expect(bank.balance()).toBe(300);
    });

    test("debits correctly", () => {
      const bank = new Bank();
      bank.credit(100);
      bank.debit(200);
      expect(bank.balance()).toBe(-100);
    })
  })
})