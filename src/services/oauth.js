'use strict';

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
				var ignoreSessions = true && (self.provider.sessions || client.sessions || {remove:function(){}}).remove(self.sessionKey(client));
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