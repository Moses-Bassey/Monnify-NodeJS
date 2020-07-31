const _ = require('lodash');
require('dotenv').config();
const Base64 = require('base-64');
const Axios = require('axios').default;
const {createHash} = require('crypto');

const {
  NODE_ENV,
  WALLET_ID
} = process.env;
const isProduction = NODE_ENV === 'production';
const MONIFY_API_KEY = isProduction ? process.env.MONIFY_PROD_API_KEY : process.env.MONIFY_API_KEY;
const MONIFY_CLIENT_SECRET = isProduction ? process.env.MONIFY_PROD_CLIENT_SECRET : process.env.MONIFY_CLIENT_SECRET;
const CONTRACTCODE = isProduction ? process.env.CONTRACTCODE_PROD : process.env.CONTRACTCODE;
const MONIFYURL = isProduction ? process.env.MONIFY_PROD_URL : process.env.MONIFY_TEST_URL;

// const MONIFY_API_KEY = "MK_PROD_W9PUBUZSHY";
// const MONIFY_CLIENT_SECRET = "ZQAABGR77EXBHPLVDPG6YHY2H6NMSTH6";
// //const CONTRACTCODE = isProduction ? process.env.CONTRACTCODE_PROD : process.env.CONTRACTCODE;
// const MONIFYURL = "https://api.monnify.com";
//"https://nws.nugitech.com/payments/callback/"

const API = (path = '') => `${MONIFYURL}/api/v1/${path}`;
const Bearer = (token) => ({
  Authorization: `Bearer ${token}`
});
const Basic = {
  Authorization: `Basic ${Base64.encode(`${MONIFY_API_KEY}:${MONIFY_CLIENT_SECRET}`)}`
};
const queryString = (params) => (new URLSearchParams(_.pickBy(params))).toString();
const sendErrorMessage = (e) => {
  return Promise.reject(e.response.data.responseMessage);
};

module.exports = class Monify {
  /**
     * calculates the sha 512 of a string
     * @param {String} text
     */
  static sha512 (text) {
    return createHash('sha512').update(text, 'utf-8').digest('hex');
  }

  /**
     * calculates the transaction hash of a given transaction
     * @param {String} paymentReference
     * @param {Number} amountPaid
     * @param {Date} paidOn
     * @param {String} transactionReference
     */
    
  static generateHash ({
    paymentReference,
    amountPaid,
    paidOn,
    transactionReference
  }) {
    return this.sha512(`${MONIFY_CLIENT_SECRET}|${paymentReference}|${amountPaid}|${paidOn}|${transactionReference}`);
  }

  /**
     * generates an OAuth 2.0 bearer token to query monify API
     */
  static async auth () {
    const response = await Axios.post(API('auth/login'), {}, {
      headers: Basic
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody: {
          accessToken
        }
      }
    } = response;

    return accessToken;
  }

  /**
     * creates sub account(s)
     * @param {Array|Object} subAccounts
     */
  static async createSubAccount (subAccounts) {
    subAccounts = Array.isArray(subAccounts) ? subAccounts : [subAccounts];
    const response = await Axios.post(API('sub-accounts'), JSON.stringify(subAccounts.map(
      ({
        currencyCode,
        bankCode,
        accountNumber,
        email,
        defaultSplitPercentage
      }) => ({
        currencyCode,
        bankCode,
        accountNumber,
        email,
        defaultSplitPercentage
      })
    )), {
      headers: {
        ...Basic,
        'content-type': 'application/json'
      }
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  /**
     * returns the sub-accounts currently present
     */
  static async getSubAccounts () {
    const response = await Axios.get(
      API('sub-accounts'), {
        headers: Basic
      }
    ).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  /**
     * deletes a sub-account using its accountCode
     * @param {String} accountCode
     */
  static async deleteSubAccout ({
    accountCode
  }) {
    const response = await Axios.delete(API(`sub-accounts/${accountCode}`), {
      headers: Basic
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  /**
     * updates a subaccount detail
     * @param {Object}  subAccount
     */
  static async updateSubAccount ({
    subAccountCode,
    currencyCode,
    bankCode,
    accountNumber,
    email,
    defaultSplitPercentage
  }) {
    const response = await Axios.put(API('sub-accounts'), _.pickBy({
      currencyCode,
      bankCode,
      accountNumber,
      email,
      defaultSplitPercentage,
      subAccountCode
    }), {
      headers: {
        ...Basic,
        'content-type': 'application/json'
      }
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  /**
     * returns a transaction status
     * @param {Object} transactionReference
     */
  static async transactionStatus ({
    paymentReference,
    transactionReference
  }) {
    const response = await Axios.get(
      API(`merchant/transactions/query?${queryString({ paymentReference, transactionReference })}`), {
        headers: Basic
      }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  /**
     * returns transaction history for merchant
     * @param {Object} query
     */
  static async getTransactions ({
    limit,
    skip,
    paymentStatus,
    customerName,
    customerEmail
  }) {
    const response = await Axios.get(API(`transactions/search?${queryString({
            size: limit,
            page: skip,
            paymentStatus,
            customerEmail,
            customerName
        })}`), {
      headers: {
        ...Bearer(await this.auth())
      }
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody: {
          content: transactions,
          totalElements: transactionCount
        },
        responseMessage
      }
    } = response;

    return {
      transactions,
      transactionCount
    } || responseMessage;
  }

  /**
     * creates a reserved account
     * @param {Object} reservedAccount
     */
  static async createReservedAccount ({
    accountReference,
    accountName,
    customerEmail
  }) {
    const response = await Axios.post(API('bank-transfer/reserved-accounts'), _.pickBy({
      accountReference,
      accountName,
      currencyCode: 'NGN',
      contractCode: CONTRACTCODE,
      customerEmail
    }), {
      headers: {
        ...Bearer(await this.auth()),
        'content-type': 'application/json'
      }
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  /**
     * returns transaction history for a reserved account
     * @param {Object} query
     */
  static async getReservedAccountTransactions ({
    accountReference,
    limit,
    skip
  }) {
    const response = await Axios.get(API(`bank-transfer/reserved-accounts/transactions?${queryString({
            size: limit,
            page: skip,
            accountReference
        })}`), {
      headers: Bearer(await this.auth())
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody: {
          content: transactions,
          totalElements: transactionCount
        },
        responseMessage
      }
    } = response;

    return {
      transactions,
      transactionCount
    } || responseMessage;
  }

  /**
     * deletes a reserved account
     * @param {Object} accountNumber
     */
  static async deleteReservedAccount ({
    accountNumber
  }) {
    const response = await Axios.delete(API(`bank-transfer/reserved-accounts/${accountNumber}`), {
      headers: Bearer(await this.auth())
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  static async getReservedAccount(accountReference) {
    const response = await Axios.get(API(`bank-transfer/reserved-accounts/?${accountReference}`), {
      headers: Bearer(await this.auth())
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  static async getWalletBalance () {
    const response = await Axios.get(API(`disbursements/wallet-balance?walletId=${WALLET_ID}`), {
      headers: Basic
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;
    return responseBody || responseMessage;
  }

  static async verifyBankAccount ({
    accountNumber,
    bankCode
  }) {
    const response = await Axios.get(API(`disbursements/account/validate?${queryString({ accountNumber, bankCode })}`), {
      headers: Basic
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        responseBody,
        responseMessage
      }
    } = response;

    return responseBody || responseMessage;
  }

  static async disburse ({
    title,
    reference,
    narration,
    accountNumber,
    bankCode,
    amount
  }) {
    const response = await Axios.post(API('disbursements/single'), {
      title,
      reference,
      narration: narration || '',
      walletId: WALLET_ID,
      bankCode,
      accountNumber,
      amount,
      currency: 'NGN'
    }, {
      headers: Basic
    }).catch(sendErrorMessage);

    if (!response) {
      return Promise.reject('An error occured, please try again');
    }

    const {
      data: {
        requestSuccessful,
        responseBody,
        responseMessage
      }
    } = response;

    if (!requestSuccessful) {
      return Promise.reject(responseBody || responseMessage);
    }
    return responseBody || responseMessage;
  }
};
