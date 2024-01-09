/**
 * Recorded typed path + params information used for querying data from lisk-service
 * https://github.com/LiskHQ/lisk-service/blob/development/docs/api/version2.md#network
 * @type {{Transactions: string, Blocks: string, Network: string, SentVotes: {filter: {address: string, publicKey: string, username: string}, path: string}, ReceivedVotes: {path: string, address: string, publicKey: string, username: string, aggregate: string}, Accounts: {filter: {isDelegate: string, search: string, address: string, offset: string, limit: string, publicKey: string, sort: string, username: string, status: string}, path: string, sortBy: {balanceDesc: string, balanceAsc: string, rankAsc: string, randDesc: string}, delegateStatus: {standby: string, nonEligible: string, active: string, banned: string, punished: string}}}}
 */

const Store = {
  Auth: {
    path: '/api/v3/auth',
    filter: {
      address: 'address', // Resolves new and old address system
      publicKey: 'publicKey',
      username: 'username',
      isDelegate: 'isDelegate',
      status: 'status', // [active, standby, banned, punished, non-eligible] (Multiple choice possible i.e. active,banned)
      search: 'search',
      limit: 'limit',
      offset: 'offset',
      sort: 'sort',
    },
    sortBy: {
      balanceAsc: 'balance:asc',
      balanceDesc: 'balance:desc',
      rankAsc: 'rank:asc',        // Rank is dedicated to delegate accounts
      randDesc: 'rank:desc',
    },
  },
  Balances: {
    path: '/api/v3/token/balances',
    filter: {
      address: 'address',
    },
    sortBy: {
      balanceAsc: 'balance:asc',
      balanceDesc: 'balance:desc',
    },
  },
  Blocks: {
    path: '/api/v3/blocks',
    filter: {
      blockId: 'blockId',
      height: 'height', // Can be expressed as an interval ie. 1:20
      generatorAddress: 'generatorAddress', // Resolves new and old address system
      generatorPublicKey: 'generatorPublicKey',
      generatorUsername: 'generatorUsername',
      timestamp: 'timestamp', // Can be expressed as interval ie. 100000:200000
      limit: 'limit',
      offset: 'offset',
      sort: 'sort',
    },
    sortBy: {
      heightAsc: 'height:asc',
      heightDesc: 'height:desc',
      timestampAsc: 'timestamp:asc',
      timestampDesc: 'timestamp:desc',
    },
  },
  Transactions: {
    path: '/api/v3/transactions',
    filter: {
      transactionID: 'transactionID',
      moduleCommand: 'moduleCommand', // Transfer transaction: moduleName = token, assetName = transfer eg. token:transfer
      senderAddress: 'senderAddress',
      senderPublicKey: 'senderPublicKey',
      senderUsername: 'senderUsername',
      recipientAddress: 'recipientAddress',
      recipientPublicKey: 'recipientPublicKey',
      recipientUsername: 'recipientUsername',
      amount: 'amount', // Can be expressed as interval ie. 100000:200000
      timestamp: 'timestamp', // Can be expressed as interval ie. 100000:200000
      blockId: 'blockID',
      height: 'height',
      search: 'search', // Wildcard search
      data: 'data', // Wildcard search
      includePending: 'includePending',
      nonce: 'nonce', // In conjunction with senderAddress
      limit: 'limit',
      offset: 'offset',
      sort: 'sort',
    },
    sortBy: {
      amountAsc: 'amount:asc',
      amountDesc: 'amount:desc',
      timestampAsc: 'timestamp:asc',
      timestampDesc: 'timestamp:desc',
    },
  }
};

module.exports = Store;
