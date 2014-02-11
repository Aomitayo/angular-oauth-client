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


describe('Oauth.stopClient', function(){
	var $httpBackend, $rootScope, oauth, Base64;
	beforeEach(function(){
		module('aomitayo.angular-oauth-client', function(oauthProvider){
			oauthProvider
			.client('/api/v1/', {
				tokenEndpoint: tokenEndpoint,
				credentials:clientCredentials
			});
		});
		inject(function(_$rootScope_, _oauth_){
			oauth = _oauth_;
			$rootScope = _$rootScope_;
		});
	});

	it('Should Respond to stopClient', function(){
		expect(oauth).to.respondTo('stopClient');
	});
	
	it('Broadcasts Oauth:clientStopped event', function(done){
		$rootScope.$on('Oauth:clientStopped', function(){
			done();
		});
		oauth.stopClient('/api/v1/');
	});
});