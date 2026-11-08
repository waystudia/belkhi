import {currentAuth} from './auth.js';

let account;
export function initializeAccountStorage() {
  account = currentAuth()?.user?.id;
}

export function accountKey(key) {
  return account ? key + '/' + account : key;
}

export const accountStorage = {
  getItem: key => localStorage.getItem(accountKey(key)),
  setItem: (key, value) => localStorage.setItem(accountKey(key), value)
};
