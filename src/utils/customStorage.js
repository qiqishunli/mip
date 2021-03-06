/**
 * @file customStorage Function. Support publiser management and localstorage
 * @author wupeng10@baidu.com
 */
define(function (require) {
    'use strict';

    var fn = require('./fn');

    /**
     * Type of storage
     *
     * @type {object}
     * @public
     */
    var storageType = {
        LOCALSTORAGE: 0,
        ASYNCSTORAGE: 1
    };

    /**
     * Error code
     *
     * @type {object}
     * @public
     */
    var eCode = {
        siteExceed: 21,
        lsExceed: 22
    };

    /**
     * When no support local storage, store data temporary
     *
     * @type {object}
     * @public
     */
    var lsCache = {};

    /**
     * Whether page in cache
     *
     * @type {object}
     * @public
     */
    var isCachePage = window.location.href.match('mipcache.bdstatic.com');

    /**
     * Domain of website
     *
     * @type {object}
     * @public
     */
    var HOST = window.location.href.match(/[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+\.?/g)[1];

    /**
     * Current domain storage size, max is 4k
     *
     * @type {object}
     * @public
     */
    var STORAGESIZE = 4 * 1024;

    /**
     * Update local storage operation time
     *
     * @param {Object} storage it's local storage
     */
    function updateTime(storage) {
        if (!storage) {
            return;
        }
        storage.u = new Date().getTime();
    }

    /**
     * Parse json link JSON.parse
     *
     * @param {string} str parse string
     * @return {string} parsed string
     */
    function parseJson(str) {
        try {
            str = JSON.parse(str);
        } catch (e) {
            str = JSON.stringify(str);
            str = JSON.parse(str);
        }
        return str;
    }

    /**
     * Get error message with error code
     *
     * @param {string} code error code
     * @param {string} name error name
     * @return {string} error message
     */
    function getErrorMess(code, name) {
        var mess;
        switch (code) {
            case eCode.siteExceed:
                mess = 'storage space need less than 4k';
            case eCode.lsExceed:
                mess = 'Uncaught DOMException: Failed to execute setItem on Storage: Setting the value of '
                        + name + ' exceeded the quota at ' + window.location.href;
        }
        return mess;
    }

    /**
     * Generate error object
     *
     * @param {string} code error code
     * @param {string} mess error name
     * @return {string} error object
     */
    function getError(code, mess) {
        return {
            errCode: code,
            errMess: mess
        };
    }

    /**
     * Get local storage
     *
     * @return {Object} value of local storage
     */
    function getLocalStorage() {
        var ls = supportLs() ? localStorage.getItem(HOST) : lsCache[HOST];
        ls = ls ? parseJson(ls) : {};
        updateTime(ls);
        return ls;
    }

    /**
     * Delete local storage
     *
     * @param {string} key the key of local storage
     */
    function rmLocalStorage(key) {
        if (!key) {
            key = HOST;
        }
        supportLs() ? localStorage.removeItem(key) : fn.del(lsCache, key);
    }

    /**
     * Whether support Local Storage
     *
     * @return {boolean} Whether support ls
     */
    function supportLs() {
        var support = false;
        if (window.localStorage && window.localStorage.setItem) {
            try {
                window.localStorage.setItem('lsExisted', '1');
                window.localStorage.removeItem('lsExisted');
                support = true;
            } catch (e) {
                support = false;
            }
        }
        return support;
    }

    /**
     * Storage Class
     *
     * @param {number} type type of storage
     * @class
     */
    function customStorage(type) {
        switch (type) {
            case storageType.ASYNCSTORAGE:
                this.storage = new AsyncStorage();
                break;
            case storageType.LOCALSTORAGE:
                this.storage = new LocalStorage();
                break;
        }
        return this.storage;
    }

    /**
     * Local Storage class
     *
     * @class
     */
    function LocalStorage() {
    }

    /**
     * Set current site data in local storage
     *
     * @param {string} name name of storage
     * @param {string} value value of storage
     * @param {string} expire optional
     * @param {string} callback if error callback to publisher
     */
    LocalStorage.prototype.set = function (name, value, expire, callback) {
        if (!name || !value) {
            return;
        }
        callback = typeof expire === 'function' ? expire : callback;
        if (isCachePage) {
            var ls = getLocalStorage();
            ls[name] = value;
            expire = parseInt(expire, 10);
            if (!isNaN(expire) && expire > 0) {
                ls.e = new Date().getTime() + expire * 1000;
            } else {
                fn.del(ls, 'e');
            }
            ls = JSON.stringify(ls);
            if (ls.length > STORAGESIZE) {
                callback && callback(getError(eCode.siteExceed, getErrorMess(eCode.siteExceed)));
                throw getErrorMess(eCode.siteExceed);
            }
            this._setLocalStorage(HOST, ls, expire, callback);
        } else {
            this._setLocalStorage(name, value, expire, callback);
        }
    };

    /**
     * Set local storage
     *
     * @param {string} key the key of local storage
     * @param {string} value the key of local storage
     * @param {string} expire the expire of local storage
     * @param {string} callback if error callback to publisher
     */
    LocalStorage.prototype._setLocalStorage = function (key, value, expire, callback) {
        var mess = getErrorMess(eCode.lsExceed, key);
        callback = typeof expire === 'function' ? expire : callback;
        if (supportLs()) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                if (this._isExceed(e) && isCachePage) {
                    this._exceedHandler(key, value, expire);
                } else if (this._isExceed(e) && !isCachePage) {
                    callback && callback(getError(eCode.lsExceed, mess));
                    throw mess;
                }
            }
        } else {
            var size = value.length / 1024.0 / 1024.0;
            for (var k in lsCache) {
                if (lsCache[k]) {
                    size += lsCache[k].length / 1024.0 / 1024.0;
                }
            }
            if (size > 5.0) {
                callback && callback(eCode.lsExceed, mess);
                throw mess;
            }
            lsCache[key] = value;
        }
    };

    /**
     * Get current site data in local storage
     *
     * @param {string} name name of storage
     * @return {string} get data with key
     */
    LocalStorage.prototype.get = function (name) {
        if (!fn.isString(name)) {
            return;
        }

        var result;
        if (isCachePage) {
            var ls = getLocalStorage();
            if (ls && ls[name]) {
                result = ls[name];
            }
        } else {
            result = supportLs() ? localStorage.getItem(name) : lsCache[name];
        }
        return result;
    };

    /**
     * Delete current site data in local storage with key
     *
     * @param {string} name name of storage
     */
    LocalStorage.prototype.rm = function (name) {
        if (!fn.isString(name)) {
            return;
        }

        if (isCachePage) {
            var ls = getLocalStorage();
            if (ls && ls[name]) {
                fn.del(ls, name);
                this._setLocalStorage(HOST, JSON.stringify(ls));
            }
        } else {
            supportLs() ? localStorage.removeItem(name) : fn.del(lsCache, name);
        }
    };

    /**
     * Clear current site local storage
     *
     */
    LocalStorage.prototype.clear = function () {
        if (isCachePage) {
            rmLocalStorage();
        } else {
            supportLs() ? localStorage.clear() : lsCache = {};
        }
    };

    /**
     * Delete all expire storage, scope is all sites
     *
     * @return {boolean} whether storage has expired
     */
    LocalStorage.prototype.rmExpires = function () {
        var hasExpires = false;
        if (isCachePage) {
            var ls = supportLs() ? localStorage : lsCache;
            for (var k in ls) {
                var val;
                if (typeof ls[k] === 'string') {
                    val = parseJson(ls[k]);
                }
                if (val && val.e) {
                    var expire = parseInt(parseJson(ls[k]).e, 10);
                    if (expire && new Date().getTime() >= expire) {
                        hasExpires = true;
                        rmLocalStorage(k);
                    }
                }
            }
        }
        return hasExpires;
    };

    /**
     * Whether local storage is exceed, http://crocodillon.com/blog/always-catch-localstorage-security-and-quota-exceeded-errors
     *
     * @param {Object} e set local storage error
     * @return {boolean} whether storage exceed
     */
    LocalStorage.prototype._isExceed = function (e) {
        var quotaExceeded = false;
        if (e) {
            if (e.code) {
                switch (e.code) {
                    case 22: {
                        quotaExceeded = true;
                        break;
                    }
                    case 1014: { // Firefox
                        if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                            quotaExceeded = true;
                        }
                        break;
                    }
                }
            } else if (e.number === -2147024882) { // Internet Explorer 8
                quotaExceeded = true;
            }
        }
        return quotaExceeded;
    };

    /**
     * Handle when storage exceed
     *
     * @param {string} name the key of local storage
     * @param {string} value the key of local storage
     * @param {string} expire the expire of local storage
     */
    LocalStorage.prototype._exceedHandler = function (name, value, expire) {
        var minTimeStamp;
        var key;
        if (!this.rmExpires()) {
            var ls = localStorage;
            for (var k in ls) {
                if (ls[k]) {
                    var item = parseJson(ls[k]).u;
                    if (!key || parseInt(item, 10) < minTimeStamp) {
                        key = k;
                        minTimeStamp = item ? parseInt(item, 10) : 0;
                    }
                }
            }
            rmLocalStorage(key);
        }
        this.set(name, value, expire);
    };

    /**
     * Publisher manage storage, via request
     *
     * @class
     */
    function AsyncStorage() {
    }

    /**
     * Send request to server with params
     *
     * @param {Object} opt request params
     */
    AsyncStorage.prototype.request = function (opt) {
        if (!opt || !opt.url) {
            return;
        }
        var myInit = {};
        myInit.mode = opt.mode ? opt.mode : null;
        myInit.method = opt.method ? opt.method : 'GET';
        myInit.credentials = opt.credentials ? opt.credentials : 'omit';
        myInit.cache = opt.cache ? opt.cache : 'default';
        if (opt.headers) {
            myInit.headers = opt.headers;
        }
        if (opt.body) {
            myInit.body = opt.body;
        }
        fetch(opt.url, myInit).then(function (res) {
            if (res.ok) {
                res.text().then(function (data) {
                    opt.success && opt.success(JSON.parse(data));
                });
            } else {
                opt.error && opt.error(res);
            }
        }).catch(function (err) {
            opt.error && opt.error(err);
        });
    };
    return customStorage;
});
