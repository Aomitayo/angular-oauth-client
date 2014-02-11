'use strict';
// Source: src/angular-oauth-client.js
angular.module('aomitayo.angular-oauth-client',['ui.router']);

// Source: src/services/base64.js
/* jshint camelcase:false, bitwise:false */

angular.module('aomitayo.angular-oauth-client').factory('Base64', function() {
	var Base64 = {
		// private property
		_keyStr:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
		// public method for encoding
		encode : function (input) {
			var output = '';
			var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
			var i = 0;
			input = Base64._utf8_encode(input);
			while (i < input.length) {
				chr1 = input.charCodeAt(i++);
				chr2 = input.charCodeAt(i++);
				chr3 = input.charCodeAt(i++);
	 
				enc1 = chr1 >> 2;
				enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
				enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
				enc4 = chr3 & 63;
	 
				if (isNaN(chr2)) {
					enc3 = enc4 = 64;
				} else if (isNaN(chr3)) {
					enc4 = 64;
				}
	 
				output = output +
				this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
				this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
	 
			}
	 
			return output;
		},
	 
		// public method for decoding
		decode : function (input) {
			var output = '';
			var chr1, chr2, chr3;
			var enc1, enc2, enc3, enc4;
			var i = 0;
			input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
			while (i < input.length) {
				enc1 = this._keyStr.indexOf(input.charAt(i++));
				enc2 = this._keyStr.indexOf(input.charAt(i++));
				enc3 = this._keyStr.indexOf(input.charAt(i++));
				enc4 = this._keyStr.indexOf(input.charAt(i++));
	 
				chr1 = (enc1 << 2) | (enc2 >> 4);
				chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
				chr3 = ((enc3 & 3) << 6) | enc4;
				output = output + String.fromCharCode(chr1);
				if (enc3 != 64) {
					output = output + String.fromCharCode(chr2);
				}
				if (enc4 != 64) {
					output = output + String.fromCharCode(chr3);
				}
	 
			}
			output = Base64._utf8_decode(output);
			return output;
		},
		// private method for UTF-8 encoding
		_utf8_encode : function (string) {
			string = string.replace(/\r\n/g,'\n');
			var utftext = '';
			for (var n = 0; n < string.length; n++) {
				var c = string.charCodeAt(n);
				if (c < 128) {
					utftext += String.fromCharCode(c);
				}
				else if((c > 127) && (c < 2048)) {
					utftext += String.fromCharCode((c >> 6) | 192);
					utftext += String.fromCharCode((c & 63) | 128);
				}
				else {
					utftext += String.fromCharCode((c >> 12) | 224);
					utftext += String.fromCharCode(((c >> 6) & 63) | 128);
					utftext += String.fromCharCode((c & 63) | 128);
				}
	 
			}
			return utftext;
		},
	 
		// private method for UTF-8 decoding
		_utf8_decode : function (utftext) {
			var string = '';
			var i = 0;
			var c, c1, c2, c3;
			c = c1 = c2 = 0;
	 
			while ( i < utftext.length ) {
	 
				c = utftext.charCodeAt(i);
	 
				if (c < 128) {
					string += String.fromCharCode(c);
					i++;
				}
				else if((c > 191) && (c < 224)) {
					c2 = utftext.charCodeAt(i+1);
					string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
					i += 2;
				}
				else {
					c2 = utftext.charCodeAt(i+1);
					c3 = utftext.charCodeAt(i+2);
					string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
					i += 3;
				}
			}
	 
			return string;
		}
	};
	
	return Base64;
});

// Source: src/services/oauth.js
angular.module('aomitayo.angular-oauth-client')
.provider('oauth', ['$httpProvider', function($httpProvider){
	var oauthInstance;

	$httpProvider.interceptors.push(function(){
		return {
			'request':function(config){
				if(oauthInstance){
					return oauthInstance.interceptResourceRequest(config);
				}
				else{return config;}
			}
		};
	});

	function Oauth(provider, $urlMatcherFactory, $rootScope, Base64, $http, $injector){
		var self = this;
		self.provider = provider;
		self.clients = angular.copy(provider.clients);

		self.$urlMatcherFactory = $urlMatcherFactory;
		self.$rootScope = $rootScope;
		self.Base64 = Base64;
		self.$http = $http;
		self.$injector = $injector;

		self.sessions = self.provide(self.provider.sessions);

		angular.forEach(self.clients, function(client, apiRoot){
			client.sessions = self.provide(client.sessions);
			var sessions = self.provide(self.sessions || client.sessions);
			var authz = sessions && sessions.get(self.sessionKey(client));
			if(authz){
				self.startClient(client, authz, true);
			}
			client.urlMatcher = client.urlMatcher || self.$urlMatcherFactory.compile(apiRoot);
		});
	}

	Oauth.prototype = {
		constructor:Oauth,
		interceptResourceRequest: function(request){
			var self = this;
			var client = self.apiClient(request.url);
			
			if(client && client.tokenEndpoint != request.url && client.authz && client.authz.access_token){
				request.headers.Authorization = 'Bearer ' + client.authz.access_token;
			}
			return request;
		},
		authorize: function(apiRoot, options){
			var self = this;
			var client = self.apiClient(apiRoot);
			if(client){
				var strategy = 'authz_' + (options.grant_type || 'password');
				self[strategy](client, options);
			}
		},
		validateAuthz: function(authz){
			var required_fields = {
				access_token:/.*/,
				token_type:/.*/
			};
			var validated = [];
			angular.forEach(required_fields, function(rule, k){
				if( authz && authz[k] && rule.test(authz[k])){
					validated.push(k);
				}
			});
			return validated.length == 2;
		},
		provide: function(obj){
			var self = this;
			if(typeof obj === 'string'){
				return self.$injector.get(obj);
			}
			else if(typeof obj == 'function'){
				return self.$injector.invoke(obj);
			}
			else if(angular.isArray(obj) &&  typeof obj[obj.length-1] == 'function'){
				return self.$injector.invoke(obj);
			}else{
				return obj;
			}
		},
		sessionKey: function(client){return '/authz_/' + client.apiRoot;},
		startClient: function(apiRoot, authz, ignoreSessions){
			var self = this;
			var client = apiRoot && apiRoot.apiRoot? apiRoot : self.apiClient(apiRoot);
			if(client && self.validateAuthz(authz)){
				client.authz = authz;
				if(!ignoreSessions){
					var sessions = self.provide(self.sessions || client.sessions);
					(sessions || {put:function(){}}).put(self.sessionKey(client), client.authz);
				}
				
				self.$rootScope.$broadcast('Oauth:clientStarted', client);
			}
		},
		stopClient: function(apiRoot){
			var self = this;
			var client = apiRoot && apiRoot.apiRoot? apiRoot : self.apiClient(apiRoot);
			if(client){
				client.authz = undefined;
				var sessions = self.provide(self.sessions || client.sessions);
				var ignoreSessions = true && (self.sessions || client.sessions || {remove:function(){}}).remove(self.sessionKey(client));
				self.$rootScope.$broadcast('Oauth:clientStopped', client);
			}
		},
		apiClient: function(url){
			var self = this;
			var ret;
			angular.forEach(self.clients, function(client, apiRoot){
				client.urlMatcher = client.urlMatcher || self.$urlMatcherFactory.compile(apiRoot);

				var match = client.urlMatcher.exec(apiRoot) || url.indexOf(apiRoot) === 0;
				if(match){
					ret = client;
				}
			});	
			return ret;
		},
		authz_password: function(client, options){
			var self = this;
			var headers = {'Content-Type':'application/x-www-form-urlencoded'};
			if(client.credentials){
				var clientAuth = client.credentials.username + ':' + client.credentials.password;
				clientAuth = self.Base64.encode(clientAuth);
				headers.Authorization = 'Basic ' + clientAuth;
			}
			self.$rootScope.$broadcast('Oauth:tokenRequestStart', client);
			self.$http({
				method:'POST',
				url: client.tokenEndpoint,
				data: {
					grant_type:'password',
					username:options.userCredentials.username,
					password:options.userCredentials.password
				},
				headers:headers,
				transformRequest: function(obj){
					var str = [];
					angular.forEach(obj, function(v, k){
						str.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
					});
					return str.join('&');
				}
			})
			.success(function(response, status, headers, config){
				var authz = {
					access_token: response.access_token,
					token_type: response.token_type,
					expires_in: response.expires_in,
					refresh_token: response.refresh_token,
					scope: response.scope,
				};

				self.$rootScope.$broadcast('Oauth:tokenRequestSuccess', client);

				self.startClient(client, authz);
			})
			.error(function(data, status, headers, config){
				var err = data.error_description || data.error || data;
				self.$rootScope.$broadcast('Oauth:tokenRequestError', client, err);
			});
		}
	};

	return {
		clients: {},
		sessions: false,
		useSessions: function(store){
			this.sessions = store;
			return this;
		},
		client: function(apiRoot, config){
			var client = angular.copy(config);
			client.apiRoot = apiRoot;
			this.clients[apiRoot] = client;
			return this;
		},
		$get: ['$urlMatcherFactory', '$rootScope', 'Base64', '$http', '$injector', function($urlMatcherFactory, $rootScope, Base64, $http, $injector){
			oauthInstance = oauthInstance || new Oauth(this, $urlMatcherFactory, $rootScope, Base64, $http, $injector);
			return oauthInstance;
		}]
	};
}]);