const { Mnemonic } = require('@liskhq/lisk-passphrase');
const liskCryptography = require('@liskhq/lisk-cryptography');
const liskTransactions = require('@liskhq/lisk-transactions');
const axios = require('axios');

const DEFAULT_API_MAX_PAGE_SIZE = 100;
const DEFAULT_API_TIMEOUT = 10000;

class LiskAdapter {
  constructor(options) {
    this.apiURL = options.apiURL;
    this.apiMaxPageSize = options.apiMaxPageSize || DEFAULT_API_MAX_PAGE_SIZE;
    this.apiTimeout = options.apiTimeout || DEFAULT_API_TIMEOUT;
  }

  async connect({ passphrase }) {
    this.passphrase = passphrase;
  }

  async disconnect() {}

  createTransfer({ amount, recipientAddress, message }) {
    return liskTransactions.transfer({
      amount,
      recipientId: recipientAddress,
      data: message,
      passphrase: this.passphrase
    });
  }

  createWallet() {
    let passphrase = Mnemonic.generateMnemonic();
    let address = this.getAddressFromPassphrase({ passphrase });
    return {
      address,
      passphrase
    };
  }

  validatePassphrase({ passphrase }) {
    return Mnemonic.validateMnemonic(passphrase, Mnemonic.wordlists.english);
  }

  getAddressFromPassphrase({ passphrase }) {
    return liskCryptography.getAddressAndPublicKeyFromPassphrase(passphrase).address;
  }

  async postTransaction({ transaction }) {
    await axios.post(`${this.apiURL}/transactions`, transaction);
  }

  async getLatestOutboundTransactions({ address, limit }) {
    let client = axios.create();
    client.defaults.timeout = this.apiTimeout;
    let result = await client.get(
      `${this.apiURL}/transactions?senderId=${
        address
      }&limit=${
        limit || this.apiMaxPageSize
      }&sort=timestamp:desc`
    );
    let txnList = result.data.data;
    for (let txn of txnList) {
      txn.message = (txn.asset && txn.asset.data) || '';
    }
    return txnList;
  }

  async getAccountBalance({ address }) {
    let client = axios.create();
    client.defaults.timeout = this.apiTimeout;
    let response = await client.get(`${this.apiURL}/accounts?address=${address}`);
    let balanceList = Array.isArray(response.data) ? response.data : response.data.data;
    if (!balanceList.length) {
      throw new Error(
        `Failed to fetch account balance for wallet address ${
          address
        } - Could not find any balance records for that account`
      );
    }
    return balanceList[0].balance;
  }
}

module.exports = LiskAdapter;
