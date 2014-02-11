'use strict';

/* jshint camelcase:false */

describe('Service: Base64', function () {
  var base64;

  beforeEach(function(){
    // load the service's module
    module('aomitayo.angular-oauth-client');
    // instantiate service
    inject(function (_Base64_){
      base64 = _Base64_;
    });
  });

  it('Correctly Encodes to base64', function () {
    expect(base64).to.respondTo('encode');
    expect(base64.encode('this is a string')).to.equal('dGhpcyBpcyBhIHN0cmluZw==');
  });

  it('Correctly decodes from base64', function () {
    expect(base64).to.respondTo('decode');
    expect(base64.decode('dGhpcyBpcyBhIHN0cmluZw==')).to.equal('this is a string');
  });

});
