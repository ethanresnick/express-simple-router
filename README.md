This module can be used as an Express 4 middleware to augment the built-in router. It supports named routes and offers a helper function for getting the url for a named route, which is very useful for templating. It allows you to define a set of handlers (controllers) to a set of routes in a more convential, MVC-style format.

# Usage
```javascript
//Define an array of routes, each in the format described below, e.g.:
var routes = [
	{ path: "/test", handler: "Test.index", name: "test" }
]; 

//Define an object of controllers (i.e. route handlers). 
//Each key is the name of a controller, as used by the router.
//The controller methods are automatically called with the urlFor
//function as their fourth argument, so you can do.,
// res.redirect(urlFor("test")) instead of hardcoding the redirect path.
var controllers = {
	Test: { 
		index: function(req, res, next, urlFor) { 
			res.send("index!"); 
		} 
	}
}; 

//Use the module.
//The second argument is the host for your app, used in url generation
var app = require("express")();
var router = require("express-simple-router")(routes, "your-project-hostname.com");

app.use(router.handle(controllers));

router.urlFor("test"); //returns ‘/test’
router.routes; //gives back the routes object
```
That’s it! Now a `GET` request to `/test` would return a page saying “index!”.

### Route format
Each route is an object with the following keys.

- _path_: the path to match, in the format used by the Express Router
- _handler_: a string corresponding to a controller method that should be used to handle the route, e.g. “Event.list”, where “Event” would be the name of the controller and “list” the name of the method.
- _name_ (optional): a name for the route. Used by the ``urlFor`` method generate a url to that route.
- _method_ (optional, defaults to “get”): the HTTP method associated with this route; if the request method doesn’t match the one provided here, the controller won’t be called. Any value allowed by the Express router can be used here.
