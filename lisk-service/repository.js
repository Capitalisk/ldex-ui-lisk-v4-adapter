const metaStore = require('./meta');
const axios = require('axios');

const defaultTestNetURL = 'https://testnet-service.lisk.com';
const defaultMainNetURL = 'https://service.lisk.com';

const LISK_TOKEN_ID = '0000000000000000';

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

  async postTransaction(transaction) {
    return this.post(metaStore.Transactions.path, { transaction });
  };

  async getTransactions(filterParams) {
    return (await this.get(metaStore.Transactions.path, filterParams)).data;
  }

  async getBalanceByAddress(walletAddress) {
    const balance = (
      await this.get(metaStore.Balances.path, {
        [metaStore.Balances.filter.address]: walletAddress,
      })
    ).data.find(bal => bal.tokenID === LISK_TOKEN_ID);
    return balance == null ? null : balance.availableBalance;
  }

  async getAuthByAddress(walletAddress) {
    const authData = (
      await this.get(metaStore.Auth.path, {
        [metaStore.Auth.filter.address]: walletAddress,
      })
    ).data
    return authData || null;
  }

  async getOutboundTransactions(senderAddress, limit) {
    const transactionFilterParams = {
      [metaStore.Transactions.filter.senderAddress]: senderAddress,
      [metaStore.Transactions.filter.limit]: limit,
      [metaStore.Transactions.filter.moduleCommand]: 'token:transfer',
      [metaStore.Transactions.filter.sort]: metaStore.Transactions.sortBy.timestampDesc,
    };
    return this.getTransactions(transactionFilterParams);
  }
}

module.exports = LiskServiceRepository;
