'use strict';
/* globals console, describe, beforeEach, afterEach, module, inject, it, expect, browser */
/* jshint camelcase:false */

var userCredentials = {username:'johndoe', password:'doeword'},
	clientCredentials = {username:'js_client', password:'opensesame'},
	tokenEndpoint = '/api/v1/authz/oauth/token',
	tokenSuccessResponse = {
		access_token:'therealtoken',
		token_type: 'bearer',
		expires_in: 3600,
		refresh_token:'theplacebo',
		scope:'all'
	},
	tokenErrorResponse = {
		error:'invalid_grant',
		error_description: 'Unauthorized'
	},
	tokenResponseHeader = {
		'Content-Type': 'application/json',
		'Cache-Control':'no-store',
		'Pragma': 'no-cache'
	};

function parseQueryString (qString){
	var obj = {};
	var parts = qString.split('&');
	for(var i=0; i< parts.length; i++){
		var pair = parts[i].split('=');
		obj[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
	}
	return obj;
}

function accessTokenResponder(correctCredentials, success, error, headers){
	return function(method, url, data, headers){
		data = parseQueryString(data);
		if(data.username === correctCredentials.username && data.password === correctCredentials.password){
			return [200, JSON.stringify(success), headers];
		}
		else{
			return [400, JSON.stringify(error), headers];
		}
	};
}


describe('Oauth Service', function(){

	beforeEach(function(){
		module('aomitayo.angular-oauth-client', function(oauthProvider){
			oauthProvider
			.client('/api/v1/', {
				tokenEndpoint: '/api/v1/authz/oauth/token',
			});
		});
	});
	
	it('Should Respond to authorize', inject(function(oauth){
		expect(oauth).to.respondTo('authorize');
	}));

	it('Should Respond to startClient', inject(function(oauth){
		expect(oauth).to.respondTo('startClient');
	}));

	it('Should Respond to stopClient', inject(function(oauth){
		expect(oauth).to.respondTo('stopClient');
	}));
});

describe('Oauth.authorize', function(){
	var $httpBackend, $rootScope, oauth, Base64;
	beforeEach(function(){
		module('aomitayo.angular-oauth-client', function(oauthProvider){
			oauthProvider
			.client('/api/v1/', {
				tokenEndpoint: tokenEndpoint,
				credentials:clientCredentials
			})
			.client('/api/v2/', {
				tokenEndpoint: tokenEndpoint,
				credentials:clientCredentials
			});
		});
		inject(function(_$httpBackend_, _$rootScope_, _oauth_, _Base64_){
			oauth = _oauth_;
			Base64 = _Base64_;
			$rootScope = _$rootScope_;

			$httpBackend = _$httpBackend_;
			$httpBackend
			.whenPOST(tokenEndpoint)
			.respond(accessTokenResponder(userCredentials, tokenSuccessResponse, tokenErrorResponse, tokenResponseHeader));
		});
	});
	
	it('Broadcasts Oauth:tokenRequestStart event', function(done){
		$rootScope.$on('Oauth:tokenRequestStart', function(){
			done();
		});
		oauth.authorize('/api/v1/', {
			grant_type: 'password',
			userCredentials: userCredentials
		});
		$httpBackend.flush();
	});

	it('Broadcasts Oauth:tokenRequestSuccess event', function(done){
		$rootScope.$on('Oauth:tokenRequestSuccess', function(){
			done();
		});
		oauth.authorize('/api/v1/', {
			grant_type: 'password',
			userCredentials: userCredentials
		});
		$httpBackend.flush();
	});

	it('Broadcasts Oauth:tokenRequestError event', function(done){  
		$rootScope.$on('Oauth:tokenRequestError', function(){
			done();
		});
		oauth.authorize('/api/v1/', {
			grant_type: 'password',
			userCredentials: {username:'wrong', password:'wrong'}
		});
		$httpBackend.flush();
	});

	it('Broadcasts Oauth:clientStarted event', function(done){
		$rootScope.$on('Oauth:clientStarted', function( ){
			done();
		});
		oauth.authorize('/api/v1/', {
			grant_type: 'password',
			userCredentials: userCredentials
		});
		$httpBackend.flush();
	});

	it('Token Request Includes correct client authorization header', function(done){
		$httpBackend.expectPOST(tokenEndpoint, undefined, function(headers){
			var authorizationHeader = 'Basic ' + Base64.encode(clientCredentials.username + ':' + clientCredentials.password);
			expect(headers).to.have.property('Authorization');
			expect(headers.Authorization).to.match(new RegExp(authorizationHeader));
			done();
			return true;
		}).respond(function(method, url, data, headers){
			done();
			return [200, 'John Doe'];
		});
		oauth.authorize('/api/v2/', {
			grant_type: 'password',
			userCredentials: userCredentials
		});
		$httpBackend.flush();
	});

	it('Token Request Body Includes grant_type, username, password and scope fields', function(done){
		$httpBackend.expectPOST(tokenEndpoint, function(body, headers){
			body = parseQueryString(body);
			expect(body).to.have.property('grant_type');
			expect(body).to.have.property('username');
			expect(body).to.have.property('password');
			done();
			return true;
		}).respond(function(method, url, data, headers){
			done();
			return [200, 'John Doe'];
		});
		oauth.authorize('/api/v2/', {
		grant_type: 'password',
		userCredentials: userCredentials
	});
	$httpBackend.flush();
	});
});

describe('Oauth Resource interception', function(){
	var $httpBackend, $http, $rootScope, oauth;

	beforeEach(function(){
		module('aomitayo.angular-oauth-client', function(oauthProvider){
			oauthProvider
			.client('/api/v1/', {
				tokenEndpoint: tokenEndpoint,
				credentials:clientCredentials
			});
		});
		inject(function(_$httpBackend_, _$http_, _$rootScope_, _oauth_){
			oauth = _oauth_;
			$rootScope = _$rootScope_;
			$http = _$http_;
			$httpBackend = _$httpBackend_;
			$httpBackend
			.whenPOST(tokenEndpoint)
			.respond(accessTokenResponder(userCredentials, tokenSuccessResponse, tokenErrorResponse, tokenResponseHeader));

			oauth.authorize('/api/v1/', {
				grant_type: 'password',
				userCredentials: userCredentials
			});
			$httpBackend.flush();

		});
	});

	afterEach(function(){
		$httpBackend.verifyNoOutstandingExpectation();
		$httpBackend.verifyNoOutstandingRequest();
	});

	it('A correct Authorization header is added', function(done){
		$httpBackend.expectGET('/api/v1/@me', function(headers){
			expect(headers).to.have.property('Authorization');
			expect(headers.Authorization).to.match(new RegExp('Bearer\\s+' + tokenSuccessResponse.access_token));
			return true;
		}).respond(200, 'John Doe');
		
		$http.get('/api/v1/@me').success(function(data){
			expect(data).to.equal('John Doe');
			done();
		});
		$httpBackend.flush();
	});
});