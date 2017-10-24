'use strict';
var express     = require('express'),
    url         = require('url'),
    pathToRegex = require('path-to-regexp');

module.exports = function(routes, host, basePath) {
  //validate the host
  if(!host) {
    throw new Error("The host can't be empty.");
  }

  //create a dictionary of routesByName for later use, esp. by urlFor
  var routesByName = {};
  for(var i = 0, len = routes.length; i < len; i++) {
    if(routes[i].name) {
      if(routesByName[routes[i].name]) {
        throw new Error("Can't add two routes with the same name.");
      }
      routesByName[routes[i].name] = routes[i];
    }
  }

  //the key routing helper; urlForRaw, but partially applied.
  var urlFor = function(routeName, options) {
      return urlForRaw(routeName, routesByName, options, host, basePath);
  };

  var getRouter = function(controllers) {
    var router = express.Router();

    routes.forEach(function(route) {
      try {
        var httpMethod = route.method ? route.method.toLowerCase() : 'get';

        // Route handler can be a function or a string to look up in controllers.
        var method = typeof route.handler === 'string'
          ? (function() {
            var parts = route.handler.split('.');
            var controller = controllers[parts[0]];
            return controller[parts[1]].bind(controller);
          }())
          : route.handler;

        if(typeof method !== "function") {
          throw new Error("Handler undefined or not a function.");
        }

        router[httpMethod](route.path, function(func) {
          return function(req, res, next) {
            func(req, res, next, urlFor);
          }
        }(method));
      }
      catch (error) {
        throw new Error("Invalid route handler (" + route.handler + ") or HTTP method ("+ httpMethod +").");
      }
    });

    return router;
  }

  return {
    routes: routes,
    urlFor: urlFor,
    getRouter: getRouter,
    handle: getRouter // handle is an old name for backwards compat
  };
};

// A private helper used by urlFor.
function urlForRaw(routeName, routes, options, host, basePath) {
  var route = routes[routeName];

  if(!route) {
    throw new Error("No route known with name: " + routeName);
  }

  options = options || {};
  var routeParts = url.parse(route.path);
  var urlOptions = {
    pathname: (basePath || "") + substitute(routeParts.pathname, options.params),
    query: options.params,
    hash: routeParts.hash || options.hash
  };

  var isAbsolute = options.absolute || false;

  if (isAbsolute || route.https) {
    urlOptions.host = host;
    urlOptions.protocol = route.https ? 'https' : 'http';
  }

  return url.format(urlOptions);
};

//A helper for urlFor, borrowed from express-dryroutes.
function substitute(path, params) {
  var key, value, tokenRegexp;
  params = params || {};
  for(key in params) {
    value = params[key];
    tokenRegexp = new RegExp(":" + key + "(?:\\([^\\)]+\\))?");
    if (tokenRegexp.test(path)) {
      path = path.replace(tokenRegexp, value);
      delete params[key];
    }
  }

  //todo: if any non-optional params remain
  //unsubsituted, throw an error. E.g.
  var keys = [], re = pathToRegex(path, keys);
  keys.forEach(function(value) {
    if(value.optional == false && !params[value.name]) {
      throw new Error("Can't generate a url for path " + path + ' without ' + value.name + ' parameter.');
    }
  })

  // Path may contain an optional param that
  //wasn't subtituted, so we get rid of it
  return path.replace(/\/:\w+?\?/g, '');
}
