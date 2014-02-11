'use strict';
// Source: src/angular-oauth-client.js
angular.module('aomitayo.angular-oauth-client', ['ui.router']);

// Source: src/services/sentinel.js
/* jshint unused: false */

angular.module('aomitayo.angular-oauth-client')
.provider('sentinel', [ '$urlRouterProvider', function($urlRouterProvider){
	
	var defaultOptions = {
		whenDenied: 'denied',
		whenNoGrants: 'login',
		grants: null
	};

	function Sentinel(options, configs, $rootScope, $state, $location, $injector, $q){
		var self = this;

		self.options = angular.copy(options);
		self.configs = configs;
		self.$state = $state;
		self.$location = $location;
		self.$injector = $injector;
		self.$q = $q;

		$rootScope.$on('$stateChangeStart', function(evt, toState, toParams, fromState, fromParams){
			if(!self.active) return;
			
			var config = self.configs.states[toState.name];
			
			if(config){
				if(toState.sentinelAllow){
					toState.sentinelAllow = false;
					return;
				}

				evt.preventDefault();
				self.checkPermissions(toState.data, config, self.options.grants, $q)
				.then(function(allow){
					
					if(allow){	//permission granted
						toState.sentinelAllow = true;
						$state.go(toState.name, toParams);
					}
					else if(allow === null){	//no grants
						self.redirectTo(self.options.whenNoGrants);
					}
					else{	//denied
						self.redirectTo(self.options.whenDenied);
					}
				});
			}
		});
	}

	Sentinel.prototype = {
		constructor: Sentinel,
		intersection: function(arr1, arr2){
			var intersection = [];
			angular.forEach(arr1, function(v){
				if(arr2.indexOf(v) != -1){
					intersection.push(v);
				}
			});
			return intersection;
		},
		requireAll: function(required, granted){
			var intersection = this.intersection(required, granted);
			return intersection.length == required.length;
		},
		requireAny: function(required, granted){
			var intersection = this.intersection(required, granted);
			return intersection.length > 0;
		},
		checkPermissions: function(data, config, grants, $q){
			var self = this;
			data = data || {};
			
			return $q.all({
				grants: $q.when(self.resolveArray(grants)),
				all: $q.when(self.resolveArray(config.requireAll || data.requireAll || []) ),
				any: $q.when(self.resolveArray(config.requireAny || data.requireAny || []) )
			})
			.then(function(args){
				var ret =  args.grants &&  (
					self.requireAll(args.all, args.grants) || self.requireAny(args.any, args.grants)
				);
				return ret;
			});
		},
		resolveArray: function(val, injectionContext, locals){
			var self = this;
			injectionContext = injectionContext || {};
			locals = locals || {};
			//check val
			if(!angular.isFunction(val) && !angular.isArray(val)){
				throw new Error('Invalid type:  Array, function or Injection Annotated function expected');
			}
			//resolve value
			val = angular.isFunction(val) || (angular.isArray(val) && angular.isFunction(val[val.length-1]))?
				self.$injector.invoke(val, injectionContext, locals) : val;
			return val;
		},
		activate: function(){
			this.active = true;
		},
		deactivate: function(){
			this.active = false;
		},
		redirectTo: function(path){
			var self = this;
			var r = new RegExp('^.\/|\/');
			if(r.test(path)){ //it is a url
				self.$location.path(path);
			}
			else{	//it is a state
				self.$state.go(path);
			}
		}
	};

	return {
		options:{},
		configs:{
			states:{},
			routes:{}
		},
		sentinel: null,
		$get: ['$rootScope', '$state', '$location', '$injector', '$q', function($rootScope, $state, $location, $injector, $q){
			this.sentinel = this.sentinel || new Sentinel(this.options, this.configs, $rootScope, $state, $location, $injector, $q);
			return this.sentinel;
		}],
		setOptions: function(options){
			this.options = angular.extend(this.options, defaultOptions, options);
			return this;
		},
		watchState: function(name, config){
			this.configs.states[name] = config;
			return this;
		}
		/*watchRoute: function(route, config){
			this.configs.routes[route] = config;
			return this;
		}*/
	};	
}]);