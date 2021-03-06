var simpleRouter = require('../');
var expect = require('chai').expect;
var express = require('express');
var sinonChai = require("sinon-chai");
var sinon = require('sinon');
var supertest = require('supertest');

var hosts = {
    valid: 'localhost',
    empty: ''
};

var routes = {
    valid: [
        {path: '/index', name: 'home', handler: 'Test.index', method: 'get'},
        {path: '/users/:id', name: 'profile', handler: 'Test.user'},
        {path: '/account#/register', name: 'register', handler: 'Test.register'},
        {path: '/noNamePost', handler: 'Test.post', method: 'post'},
        {path: '/index', handler: 'Test.secondIndex'},
        {path: '/testThis', handler: 'Test.thisVal'},
        {path: '/methodHandler', handler: function() {}},
        {path: '/willRespond', handler: 'Test.respond', method: 'get'},

        // we're gonna test that this isn't called, after Test.respond responds.
        {path: '/willRespond', handler: 'Test.responseSkipped', method: 'get'}
    ],
    empty: [],
    duplicateName: [
        {path: '/test', name:'testRoute', handler: 'Test.index'},
        {path: '/test2', name: 'testRoute', handler: 'Test.index'}
    ],
    invalidMethod: [
        {path:'/test', handler:'Test.index', method:'invalid'},
        {path: '/noNameNoMethod', handler: 'Test.index'}
    ],
    missingHandler: [
        {path: '/test'}
    ]
};

var controllers = {
    'Test': {
        index: sinon.spy(function(req, res, next, urlFor) { next(); }),

        respond: sinon.spy(function(req, res, next, urlFor) {
            res.send('Response');
        }),

        responseSkipped: sinon.spy(function(req, res, next, urlFor) {
            res.send('Shouldn\'t be reached');
        }),

        secondIndex: sinon.spy(function(req, res, next, urlFor) { next(); }),

        user: sinon.spy(function(req, res, next, urlFor) { next(); }),

        register: sinon.spy(function(req, res, next, urlFor) { next(); }),

        post: sinon.spy(function(req, res, next, urlFor) { next(); }),

        thisVal: sinon.spy(function(req, res, next, urlFor) { next(); }),
    }
};


describe("the module", function() {
    it('should expose a function', function() {
        expect(simpleRouter).to.be.a('function');
    });

    it('should have an arity of three', function() {
        expect(simpleRouter.length).to.equal(3);
    });

    it('should return an object with proper keys when invoked', function() {
        var inst = simpleRouter(routes.valid, hosts.valid);
        expect(inst).to.be.an('object');
        expect(inst).to.have.property('routes').and.equal(routes.valid);
        expect(inst).to.have.property('handle').and.to.be.a('function');
        expect(inst).to.have.property('urlFor').and.to.be.a('function');
    });

    it('should throw an error if two routes have the same name', function() {
        expect(function() { simpleRouter(routes.duplicateName, hosts.valid) }).to.throw(Error);
    });

    it('should throw an error if the host is empty/invalid', function() {
        expect(function() { simpleRouter(routes.valid, hosts.empty) }).to.throw(Error);
    });
});

describe("urlFor()", function() {
    var inst = simpleRouter(routes.valid, hosts.valid);

    it('should throw an error if called with an invalid route name', function() {
        expect(function() { inst.urlFor('nonExistentRouteName'); }).to.throw(Error);
    });

    it('should generate a relative url by default', function() {
        expect(inst.urlFor('home')).to.equal('/index');
    });

    it('should generate an absolute url if requested', function() {
        expect(inst.urlFor('home', {absolute: true})).to.equal('http://' + hosts.valid + '/index');
    });

    it('should fill-in parameters in the route definition', function() {
        expect(inst.urlFor('profile', {params: {id: 42}})).to.equal('/users/42');
    });

    it('should append extra parameters as a query string', function() {
        expect(inst.urlFor('profile', {params: {id: 42, foo: 'bar'}})).to.equal('/users/42?foo=bar');
    });

    it('should throw an error if not given a required parameter', function() {
        expect(function() { inst.urlFor('profile'); }).to.throw(Error);
    });

    it('should preserve the hash, if present, after query params', function() {
        expect(inst.urlFor('register', { params: { foo: 'bar' } })).to.equal('/account?foo=bar#/register');
    });

    it('should support providing a hash as an option, but only if one isn\'t already in the route path', function() {
        expect(inst.urlFor('home', { hash: 'test'})).to.equal('/index#test');
        expect(inst.urlFor('register', { hash: 'test'})).to.equal('/account#/register');
    });
});

describe("handle()", function() {
    //for when the routes and controllers are valid'
    var base = simpleRouter(routes.valid, hosts.valid);
    var router = base.handle(controllers);

    // reset spies beforeEach test
    beforeEach(function() {
        Object.keys(controllers.Test).forEach(function(key) {
            controllers.Test[key].reset();
        });
    })

    it('registers a route with a get method when the method is ommitted', function(done) {
        router.handle({url: '/users/2', method: 'get'}, {}, function() {
            expect(controllers.Test.user.calledOnce).to.be.true;
            done();
        });
    });

    it('doesn\'t register a handler for matching paths with the wrong method', function(done) {
        router.handle({url: '/users/4', method: 'post'}, {}, function() {
            expect(controllers.Test.user.callCount).to.equal(0);
            done();
        });
    });

    it('registers a handler for the right method when one is provided explicitly', function(done) {
        router.handle({url: '/noNamePost', method: 'post'}, {}, function() {
            expect(controllers.Test.post.calledOnce).to.be.true;
            done();
        });
    });

    it('calls all matching handlers and in order', function(done) {
        router.handle({url: '/index', method: 'get'}, {}, function() {
            expect(controllers.Test.index.calledOnce).to.be.true;
            expect(controllers.Test.secondIndex.calledOnce).to.be.true;
            expect(controllers.Test.secondIndex.calledAfter(controllers.Test.index)).to.be.true;
            done();
        });
    });

    it('skips subsequent handlers if a prior one returns', function(done) {
        var app = express();
        app.use(router);
        supertest(app)
          .get('/willRespond')
          .expect('Response')
          .expect(function() {
            expect(controllers.Test.respond.callCount).to.equal(1);
              expect(controllers.Test.responseSkipped.called).to.be.false;
          })
          .end(done);
    });

    it('sets `this` in the route handler to be the controller object', function(done) {
        router.handle({url:'/testThis', method: 'get'}, {}, function() {
            expect(controllers.Test.thisVal.calledOn(controllers.Test)).to.be.true;
            done();
        });
    });

    it('calls the handler with four arguments, the last of which is urlFor', function(done) {
        router.handle({url:'/testThis', method: 'get'}, {}, function() {
            expect(controllers.Test.thisVal.args[0]).to.have.length(4);
            expect(controllers.Test.thisVal.args[0][3]).to.equal(base.urlFor);
            done();
        });
    });

    //for when the routes are invalid
    it('throws an error when trying to register an invalid route', function() {
        var invalidHTTPMethod = function() {
            simpleRouter(routes.invalidMethod, hosts.valid).handle(controllers);
        };

        var noHandler = function() {
            simpleRouter(routes.missingHandler, hosts.valid).handle(controllers);
        };

        expect(invalidHTTPMethod).to.throw(Error);
        expect(noHandler).to.throw(Error);
    });
});
