'use strict';
/* globals console, describe, beforeEach, afterEach, module, inject, it, expect, browser */
/* jshint camelcase:false */

var clientCredentials = {username:'js_client', password:'opensesame'},
	tokenEndpoint = '/api/v1/authz/oauth/token',
	tokenSuccessResponse = {
		access_token:'therealtoken',
		token_type: 'bearer',
		expires_in: 3600,
		refresh_token:'theplacebo',
		scope:'all'
	};
describe('Oauth provider with ACTIVE sessions', function(){
	var sessionStoreGets = 0, sessionStorePuts = 0, sessionStoreRemoves = 0;
	var clientStarts = 0;
	var apiRoot = '/api/v1/';
	var config = {
		tokenEndpoint: tokenEndpoint,
		credentials:clientCredentials
	};
	var oauth, $rootScope;
	beforeEach(function(){
		module('aomitayo.angular-oauth-client', function(oauthProvider){
			oauthProvider
			.useSessions({
				get: function(k){
					sessionStoreGets++; return tokenSuccessResponse;
				},
				put: function(k, authz){
					expect(authz).to.exist;
					sessionStorePuts++;
				},
				remove: function(k){sessionStoreRemoves++;}
			})
			.client(apiRoot, config);
		});
		inject(function(_$rootScope_){
			$rootScope = _$rootScope_;
			$rootScope.$on('Oauth:clientStarted', function(){
				clientStarts++;
			});
		});
	});
	
	afterEach(function(){
		sessionStoreGets = 0;
		sessionStorePuts = 0;
		sessionStoreRemoves = 0;
		clientStarts = 0;
	});
	
	it('Attempted authz restoration on intialization', inject(function(oauth){
		expect(sessionStoreGets).to.equal(1);
	}));

	it('Successfully restored authz from session store on intialization', inject(function(oauth){
		expect(sessionStoreGets).to.equal(1);
		expect(clientStarts).to.equal(1);
	}));

	it('Attempted authz serialization on startClient', function(done){
		inject(function(oauth){
			$rootScope.$on('Oauth:clientStarted', function(){
				expect(sessionStoreGets).to.equal(1);
				expect(sessionStorePuts).to.equal(1);
				done();
			});
			oauth.startClient(apiRoot, tokenSuccessResponse);
		});
	});
	
	it('Attempted authz remove on stopClient', function(done){
		inject(function(oauth){
			$rootScope.$on('Oauth:clientStopped', function(){
				expect(sessionStoreRemoves).to.equal(1);
				done();
			});
			oauth.stopClient(apiRoot);
		});
	});
});

describe('Oauth client with INACTIVE sessions', function(){
	var sessionStoreGets = 0, sessionStorePuts = 0, sessionStoreRemoves = 0;
	var apiRoot = '/api/v1/';
	var config = {
		tokenEndpoint: tokenEndpoint,
		credentials:clientCredentials,
		sessions:false
	};
	var oauth, $rootScope;
	beforeEach(function(){
		module('aomitayo.angular-oauth-client', function(oauthProvider){
			oauthProvider
			.client(apiRoot, config);
		});
		inject(function(_$rootScope_, _oauth_){
			oauth = _oauth_;
			$rootScope = _$rootScope_;
		});
	});

	afterEach(function(){
		sessionStoreGets = 0;
		sessionStorePuts = 0;
		sessionStoreRemoves = 0;
	});

	it('Should not Attempt authz restoration on intialization', function(){
		expect(sessionStoreGets).to.equal(0);
	});

	it('Should not Attempt authz serialization on startClient', function(done){
		$rootScope.$on('Oauth:clientStarted', function(){
			expect(sessionStorePuts).to.equal(0);
			done();
		});
		oauth.startClient(apiRoot, tokenSuccessResponse);
	});

	it('Should not Attempt authz remove on stopClient', function(done){
		$rootScope.$on('Oauth:clientStopped', function(){
			expect(sessionStoreRemoves).to.equal(0);
			done();
		});
		oauth.stopClient(apiRoot);
	});
});