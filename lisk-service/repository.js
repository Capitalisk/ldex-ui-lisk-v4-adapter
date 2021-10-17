const metaStore = require('./meta');
const axios = require('axios');

const defaultTestNetURL = 'https://testnet-service.lisk.com';
const defaultMainNetURL = 'https://service.lisk.com';

class LiskServiceRepository {

  constructor({config = {}, logger = console}) {
    let defaultURL = defaultMainNetURL;
    if (config.env === 'test') {
      defaultURL = defaultTestNetURL;
    }
    this.apiURL = config.apiURL ? config.apiURL : defaultURL;
  }

  /**
   * For getting data at given path, with given filter params
   * @param metaStorePath - Meta store path to find the data (refer to meta.js)
   * @param filterParams - filter param object (key-value pairs)
   * @returns {Promise<*>}
   */

  async get(metaStorePath, params = {}) {
    return (await axios.get(`${this.apiURL}${metaStorePath}`, {params})).data;
  }

  async post(metaStorePath, payload = {}) {
    const response = await axios.post(`${this.apiURL}${metaStorePath}`, payload);
    return response.data;
  };

  async postTransaction(payload) {
    return this.post(metaStore.Transactions.path, payload);
  };

  async getAccounts(filterParams) {
    return (await this.get(metaStore.Accounts.path, filterParams)).data;
  }

  async getTransactions(filterParams) {
    return (await this.get(metaStore.Transactions.path, filterParams)).data;
  }

  async getAccountByAddress(walletAddress) {
    const accounts = await this.getAccounts({
      [metaStore.Accounts.filter.address]: walletAddress,
    });
    return accounts && accounts.length ? accounts[0] : null;
  }

  async getOutboundTransactions(senderAddress, limit) {
    const transactionFilterParams = {
      [metaStore.Transactions.filter.senderAddress]: senderAddress,
      [metaStore.Transactions.filter.limit]: limit,
      [metaStore.Transactions.filter.moduleAssetId]: '2:0', // transfer transaction
      [metaStore.Transactions.filter.moduleAssetName]: 'token:transfer', // token transfer,
      [metaStore.Transactions.filter.sort]: metaStore.Transactions.sortBy.timestampDesc,
    };
    return this.getTransactions(transactionFilterParams);
  }
}

module.exports = LiskServiceRepository;
