const {firstOrNull} = require('../common/utils');
const HttpClient = require('./client');
const metaStore = require('./meta');

class LiskServiceRepository {

    static defaultTestNetURL = 'https://testnet-service.lisk.com';
    static defaultMainNetURL = 'https://service.lisk.com';

    constructor({config = {}, logger = console}) {
        this.liskServiceClient = new HttpClient({config: this.getDefaultHttpClientConfig(config), logger});
    }

    getDefaultHttpClientConfig = (config) => {
        let defaultURL = LiskServiceRepository.defaultMainNetURL;
        if (config.env === 'test') {
            defaultURL = LiskServiceRepository.defaultTestNetURL;
        }
        const baseURL = config.serviceURL ? config.serviceURL : defaultURL;
        if (!config.serviceURLFallbacks) {
            config.serviceURLFallbacks = [];
        }
        const fallbacks = [...config.serviceURLFallbacks, defaultURL];
        return {baseURL, fallbacks};
    };

    /**
     * For getting data at given path, with given filter params
     * @param metaStorePath - Meta store path to find the data (refer to meta.js)
     * @param filterParams - filter param object (key-value pairs)
     * @returns {Promise<*>}
     */

    get = async (metaStorePath, filterParams = {}) => {
        const response = await this.liskServiceClient.get(metaStorePath, filterParams);
        return response.data;
    };

    getAccounts = async (filterParams) => (await this.get(metaStore.Accounts.path, filterParams)).data;

    getTransactions = async (filterParams) => (await this.get(metaStore.Transactions.path, filterParams)).data;

    getAccountByAddress = async (walletAddress) => {
        const accounts = await this.getAccounts({
            [metaStore.Accounts.filter.address]: walletAddress,
        });
        return firstOrNull(accounts);
    };

    getOutboundTransactions = async (senderAddress, limit) => {
        const transactionFilterParams = {
            [metaStore.Transactions.filter.senderAddress]: senderAddress,
            [metaStore.Transactions.filter.limit]: limit,
            [metaStore.Transactions.filter.moduleAssetId]: '2:0', // transfer transaction
            [metaStore.Transactions.filter.moduleAssetName]: 'token:transfer', // token transfer,
            [metaStore.Transactions.filter.sort]: metaStore.Transactions.sortBy.timestampDesc,
        };
        return await this.getTransactions(transactionFilterParams);
    };
}

module.exports = LiskServiceRepository;