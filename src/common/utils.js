/* eslint-env commonjs, amd */

// UMD based on https://github.com/umdjs/umd/blob/master/templates/returnExports.js
// TODO: move to ES6 and transpiler

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.wvy = root.wvy || {};
    root.wvy.utils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  //console.debug("utils.js", window.name);

  /**
   * Module for misc utils
   * 
   * @module utils
   * @returns {WeavyUtils}
   */

  var WeavyUtils = {};

  /**
   * Generate a S4 alphanumeric 4 character sequence suitable for non-sensitive GUID generation etc.
   */
  WeavyUtils.S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };

  // FUNCTION WRAPPERS

  /**
   * Wraps an event handler with a delegate selector, so it can be used for generic listening similar to jQuerys `$(element).on("click", ".my-selector", handler)`.
   * 
   * @example
   * document.body.addEventListener("click", WeavyUtils.delegate("button.btn", function(event) { ... });
   * 
   * @param {string} selector - The selector to match.
   * @param {function} handler - The handler function to wrap.
   */
  WeavyUtils.delegate = function (selector, handler) {
    return function (event) {
      var targ = event.target;
      do {
        if (targ.matches(selector)) {
          handler.apply(targ, arguments);
        }
      } while ((targ = targ.parentNode) && targ !== event.currentTarget);
    }
  }

  WeavyUtils.debounce = function (func, delay) {
    let inDebounce
    let debounce = function () {
      const context = this;
      const args = arguments;
      clearTimeout(inDebounce);
      inDebounce = setTimeout(() => func.apply(context, args), delay);
    };
    debounce.cancel = function () { clearTimeout(inDebounce) };
    return debounce;
  }

  WeavyUtils.throttle = function (func, limit, skipTrailing) {
    let lastFunc;
    let lastRan;
    let throttle = function () {
      const context = this;
      const args = arguments;
      if (!lastRan) {
        func.apply(context, args)
        lastRan = Date.now()
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(function () {
          if ((Date.now() - lastRan) >= limit) {
            if (skipTrailing) {
              lastRan = null;
            } else {
              func.apply(context, args);
              lastRan = Date.now();
            }
          }
        }, limit - (Date.now() - lastRan));
      }
    };
    throttle.cancel = function () { clearTimeout(lastFunc) };
    return throttle;
  }

  /**
   * Parse any HTML string into a HTMLCollection. Use WeavyUtils.parseHTML(html)[0] to get the first HTMLElement.
   * 
   * @param {any} html
   * @returns {HTMLCollection} List of all parsed HTMLElements
   */
  WeavyUtils.parseHTML = function (html) {
    if ('content' in document.createElement('template')) {
      var template = document.createElement('template');
      template.innerHTML = html.trim();
      return template.content.children;
    } else {
      // IE etc
      var parseDoc = document.implementation.createHTMLDocument();
      parseDoc.body.innerHTML = html.trim();
      return parseDoc.body.children;
    }
  }
  /**
   * Checks if an element is visible, similar to jQuery :visible
   * @param {HTMLElement} el
   */
  WeavyUtils.isVisible = function (el) {
    return el.isConnected && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
  }

  /*
   * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
   *
   * Copyright (c) 2014-2017, Jon Schlinkert.
   * Released under the MIT License.
   */

  /**
   * Checks if an object is an object.
   * 
   * @param {any} maybeObject - The object to check
   * @returns {boolean} True if the object is an object
   */
  WeavyUtils.isObject = function (maybeObject) {
    return Object.prototype.toString.call(maybeObject) === '[object Object]';
  }

  /**
   * Checks if an object is a plain object {}, similar to jQuery.isPlainObject()
   * 
   * @param {any} maybePlainObject - The object to check
   * @returns {boolean} True if the object is plain
   */
  WeavyUtils.isPlainObject = function (maybePlainObject) {
    var ctor, prot;

    if (WeavyUtils.isObject(maybePlainObject) === false) return false;

    // If has modified constructor
    ctor = maybePlainObject.constructor;
    if (ctor === undefined) return true;

    // If has modified prototype
    prot = ctor.prototype;
    if (WeavyUtils.isObject(prot) === false) return false;

    // If constructor does not have an Object-specific method
    if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
      return false;
    }

    // Most likely a plain Object
    return true;
  };

  /**
   * Check if an object is a jquery collection containing at least one item.
   * 
   * @param {any} maybeJQuery
   * @returns {boolean} True if object is jQuery containing at least one item
   */
  WeavyUtils.isJQuery = function (maybeJQuery) {
    return !!(maybeJQuery && maybeJQuery.jquery && maybeJQuery.length)
  }

  /**
   * Method for extending plainObjects/options, similar to Object.assign() but with deep/recursive merging. If the recursive setting is applied it will merge any plain object children. Note that Arrays are treated as data and not as tree structure when merging. 
   * 
   * The original options passed are left untouched.
   * 
   * @name WeavyUtils#assign
   * @function
   * @param {Object} source - Original options.
   * @param {Object} properties - Merged options that will replace options from the source.
   * @param {boolean} [recursive=false] True will merge any sub-objects of the options recursively. Otherwise sub-objects are treated as data.
   * @returns {Object} A new object containing the merged options.
   */
  WeavyUtils.assign = function (source, properties, recursive) {
    source = source || {};
    properties = properties || {};

    var property;

    // Make a copy
    var copy = {};
    for (property in source) {
      if (Object.prototype.hasOwnProperty.call(source, property)) {
        copy[property] = source[property];
      }
    }

    // Apply properties to copy
    for (property in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, property)) {
        if (recursive && copy[property] && WeavyUtils.isPlainObject(copy[property]) && WeavyUtils.isPlainObject(properties[property])) {
          copy[property] = WeavyUtils.assign(copy[property], properties[property], recursive);
        } else {
          copy[property] = properties[property];
        }
      }
    }
    return copy;
  };

  /**
   * Always returns an Array.
   * 
   * @example
   * WeavyUtils.asArray(1); // [1]
   * WeavyUtils.asArray([1]); // [1]
   * 
   * @param {any} maybeArray
   * @returns {Array}
   */
  WeavyUtils.asArray = function (maybeArray) {
    return maybeArray && (Array.isArray(maybeArray) ? maybeArray : [maybeArray]) || [];
  };

  /**
   * Returns an element from an HTMLElement, string query selector, html string or jquery element
   * 
   * @param {any} elementOrSelector
   * @returns {HTMLElement}
   */
  WeavyUtils.asElement = function (elementOrSelector) {
    if (elementOrSelector) {
      if (elementOrSelector instanceof HTMLElement) {
        return elementOrSelector;
      }

      if (typeof elementOrSelector === "string") {
        if (elementOrSelector.indexOf("<") === 0) {
          return WeavyUtils.parseHTML(elementOrSelector)[0];
        } else {
          return document.querySelector(elementOrSelector);
        }
      }

      if (WeavyUtils.isJQuery(elementOrSelector)) {
        console.warn("Weavy: providing jQuery elements is deprecated, please provide a HTMLElement or selector query instead.")
        return elementOrSelector[0];
      }
    }
  }

  /**
   * Case insensitive string comparison
   * 
   * @param {any} str1 - The first string to compare
   * @param {any} str2 - The second string to compare
   * @param {boolean} ignoreType - Skipe type check and use any stringified value
   * @returns {boolean}
   */
  WeavyUtils.eqString = function (str1, str2, ignoreType) {
    return (ignoreType || typeof str1 === "string" && typeof str2 === "string") && String(str1).toUpperCase() === String(str2).toUpperCase();
  };

  /**
   * Compares two plain objects. Compares all the properties in a to any properties in b.
   * 
   * @param {any} a - The plain object to compare with b
   * @param {any} b - The plain object to compare properties from a to
   * @param {any} skipLength - Do not compare the number of properties
   * @returns {boolean}
   */
  WeavyUtils.eqObjects = function (a, b, skipLength) {
    if (!WeavyUtils.isPlainObject(a) || !WeavyUtils.isPlainObject(b)) {
      return false;
    }

    var aProps = Object.getOwnPropertyNames(a);
    var bProps = Object.getOwnPropertyNames(b);

    if (!skipLength && aProps.length !== bProps.length) {
      return false;
    }

    for (var i = 0; i < aProps.length; i++) {
      var propName = aProps[i];
      var propA = a[propName];
      var propB = b[propName];

      if (propA !== propB && !WeavyUtils.eqJQuery(propA, propB) && !WeavyUtils.eqObjects(propA, propB, skipLength)) {
        return false;
      }
    }

    return true;
  };

  /**
   * Compares two jQuery objects.
   *
   * @param {any} a - The first jQuery object to compare
   * @param {any} b - The second jQuery object to compare
   * @returns {boolean}
   */
  WeavyUtils.eqJQuery = function (a, b) {
    return a && b && a.jquery && b.jquery && a.jquery === b.jquery && a.length === b.length && a.length === a.filter(b).length;
  }


  // JSON HELPERS

  /**
   * Removes HTMLElement and Node from object before serializing. Used with JSON.stringify().
   * 
   * @example
   * var jsonString = JSON.stringify(data, WeavyUtils.sanitizeJSON);
   * 
   * @param {string} key
   * @param {any} value
   * @returns {any} - Returns the value or undefined if removed.
   */
  WeavyUtils.sanitizeJSON = function (key, value) {
    // Filtering out DOM Elements and nodes
    if (value instanceof HTMLElement || value instanceof Node) {
      return undefined;
    }
    return value;
  };

  /**
   * Changes a string to snake_case from camelCase, PascalCase and spinal-case.
   * 
   * @param {string} str - The string to change to snake case
   * @returns {string} The processed string as snake_case
   */
  WeavyUtils.toSnakeCase = function (str) {
    if (str.length > 0) {
      return str.replace(/([a-z\d])([A-Z]+)/g, '$1_$2').replace(/-|\s+/g, '_').toLowerCase();
    } else {
      return str;
    }
  }

  /**
   * Changes a string to camelCase from PascalCase, spinal-case and snake_case.
   * 
   * @param {string} str - The string to change to camel case
   * @param {boolean} pascal - Make ste string PascalCase
   * @returns {string} The processed string as camelCase or PascalCase
   */
  WeavyUtils.toCamelCase = function (str, pascal) {
    if (pascal) {
      // to PascalCase
      str = str[0].toUpperCase() + str.substring(1);
    } else {
      // from PascalCase
      str = str[0].toLowerCase() + str.substring(1);
    }

    // from snake_case and spinal-case
    return str.replace(/([-_][a-z])/ig, function ($1) {
      return $1.toUpperCase()
        .replace('-', '')
        .replace('_', '');
    });
  };

  /**
   * Changes all object keys recursively to camelCase from PascalCase, spinal-case and snake_case.
   * 
   * @param {Object} obj - The object containing keys to process
   * @param {boolean} pascal - Make keys PascalCase
   * @returns {Object} The processed object with any camelCase or PascalCase keys
   */
  WeavyUtils.keysToCamelCase = function (obj, pascal) {
    if (WeavyUtils.isPlainObject(obj)) {
      const n = {};

      Object.keys(obj)
        .forEach(function (k) {
          n[WeavyUtils.toCamelCase(k, pascal)] = WeavyUtils.keysToCamelCase(obj[k], pascal);
        });

      return n;
    } else if (Array.isArray(obj)) {
      return obj.map(function (i) {
        return WeavyUtils.keysToCamelCase(i, pascal);
      });
    }

    return obj;
  };

  /**
   * Changes all object keys recursively to PascalCase from camelCase, spinal-case and snake_case.
   * 
   * @param {Object} obj - The object containing keys to process
   * @returns {Object} The processed object with any PascalCase keys
   */
  WeavyUtils.keysToPascalCase = function (obj) {
    return WeavyUtils.keysToCamelCase(obj, true);
  }

  /**
   * Serializes a form to an object with data.
   * 
   * @param {HTMLFormElement} form - The form to serialize
   * @param {boolean} snake_case - Use snake case for property names
   * @returns {Object}
   */
  WeavyUtils.serializeObject = function (form, snake_case) {
    snake_case = snake_case || false;
    var o = {};
    var d = new FormData(form);

    d.forEach((value, name) => {
      var n = snake_case ? WeavyUtils.toSnakeCase(name) : name;
      if (o[n] !== undefined) {
        if (!o[n].push) {
          o[n] = [o[n]];
        }
        o[n].push(value || '');
      } else {
        o[n] = value || '';
      }
    })
    return o;
  };


  /**
   * Processing of JSON in a fetch response
   * 
   * @param {external:Response} response - The fetch response to parse
   * @returns {Object|Response} The data if sucessful parsing, otherwise the response or an rejected error
   */
  WeavyUtils.processJSONResponse = function (response) {
    if (response) {
      let contentType = (response.headers.has("content-type") ? response.headers.get("content-type") : "").split(";")[0];

      if (response.ok) {
        if (contentType === "application/json") {
          try {
            return response.json().then(function (jsonResponse) {
              return WeavyUtils.keysToCamelCase(jsonResponse);
            }).catch(function () {
              return null;
            });
          } catch (e) {
            return null;
          }
        }
        return response;
      } else {
        if (contentType.match(/json$/i)) {
          try {
            return response.json().then(function (jsonResponse) {
              return WeavyUtils.keysToCamelCase(jsonResponse);
            }).then(function (responseError) {
              return Promise.reject(new Error(responseError.detail || responseError.title || responseError.message || response.statusText || responseError.status));
            }, function () {
              return Promise.reject(new Error(response.statusText));
            });
          } catch (e) { /* Could not extract any details */ }
        }
        return Promise.reject(new Error(response.statusText));
      }
    }
  };

  // OTHER HELPERS
  var _storageAvailable = [];

  WeavyUtils.storageAvailable = function (type) {
    if (!(type in _storageAvailable)) {
      var storage;
      try {
        storage = window[type];
        var x = '__storage_test__';
        storage.setItem(x, x);
        if (storage.getItem(x) !== x) {
          var er = new Error("Mismatching storage items.");
          er.name = "StorageMismatchError"
        }
        storage.removeItem(x);
        _storageAvailable[type] = true;
      } catch (e) {
        return e instanceof DOMException && (
          // everything except Firefox
          e.code === 22 ||
          // Firefox
          e.code === 1014 ||
          // test name field too, because code might not be present
          e.name === 'StorageMismatchError' ||
          // everything except Firefox
          e.name === 'QuotaExceededError' ||
          // Firefox
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
          // acknowledge QuotaExceededError only if there's something already stored
          (storage && storage.length !== 0);
      }
    }
    return !!_storageAvailable[type];
  };

  // Fallback storage;
  var _storage = new Map();

  /**
   * Stores data for the current domain in the weavy namespace.
   * 
   * @category options
   * @param {string} key - The name of the data
   * @param {data} value - Data to store
   * @param {boolean} [asJson=false] - True if the data in value should be stored as JSON
   */
  WeavyUtils.storeItem = function (key, value, asJson, type) {
    var keyName = 'weavy_' + window.location.hostname + "_" + key;
    type = type || 'localStorage';

    try {
      value = asJson ? JSON.stringify(value, WeavyUtils.sanitizeJSON) : value;

      if (WeavyUtils.storageAvailable(type)) {
        window[type].setItem(keyName, value);
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warning("Using fallback storage:", key);
      _storage.set(keyName, value);
    }
  };

  /**
   * Retrieves data for the current domain from the weavy namespace.
   * 
   * @category options
   * @param {string} key - The name of the data to retrieve
   * @param {boolean} [isJson=false] - True if the data shoul be decoded from JSON
   * @returns {any}
   */
  WeavyUtils.retrieveItem = function (key, isJson, type) {
    var value;
    var keyName = 'weavy_' + window.location.hostname + "_" + key;
    type = type || 'localStorage';

    try {
      if (WeavyUtils.storageAvailable(type)) {
        value = window[type].getItem(keyName);
      } else {
        throw new Error();
      }
    } catch (e) {
      console.warning("Retrieving fallback storage:", key);
      value = _storage.get(keyName);
    }

    if (value && isJson) {
      try {
        return JSON.parse(value);
      } catch (e) { /* value was not JSON */ }
    }

    return value;
  };

  /**
   * Same as jQuery.ready()
   * 
   * @param {Function} fn
   */
  WeavyUtils.ready = function (fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }
  }

  return WeavyUtils;
}));


/**
 * @external Response
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Response
 */
