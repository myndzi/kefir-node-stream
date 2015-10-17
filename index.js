'use strict';

var Kefir = require('kefir'),
    _stream = require('stream'),

/* istanbul ignore next */
debug = function () { };

module.exports = function (stream) {
    if (!stream || !(stream instanceof _stream.Stream) || !stream.hasOwnProperty('_readableState')) {
        debug('Called with invalid readable stream');
        throw new Error('Invalid readable stream');
    }
    return Kefir.stream(function (emitter) {
        debug('Subscribed');
        
        if (stream._readableState.length === 0 && stream._readableState.ended) {
            debug('Subscribed to ended stream');
            emitter.end();
            return;
        }
        var readable = true;
        
        function pump() {
            var chunk, more = true;
            while (readable && more) {
                chunk = stream.read();
                if (chunk === null) {
                    debug('Got null chunk, waiting for readable event');
                    readable = false;
                    break;
                }
                debug('Pump');
                more = emitter.emit(chunk);
            }
        }
        
        var _cleanup, _onreadable, _onerror, _onend;
        
        _cleanup = function () {
            debug('_cleanup called');
            readable = false;
            stream.removeListener('readable', _onreadable);
            stream.removeListener('error', _onerror);
            stream.removeListener('end', _onend);
        };
        _onreadable = function () {
            debug('_onreadable called');
            readable = true;
            pump();
        };
        _onerror = function (err) {
            debug('_onerror called: ', err.message);
            emitter.error(err);
            emitter.end();
            _cleanup();
        };
        _onend = function () {
            debug('_onend called');
            emitter.end();
            _cleanup();
        };
        stream.on('readable', _onreadable);
        stream.on('error', _onerror);
        stream.on('end', _onend);
        
        debug('Initial pump');
        pump();
        
        return function () {
            debug('Unsubscribed');
            
            stream.removeListener('readable', _onreadable);
            stream.removeListener('error', _onerror);
            stream.removeListener('end', _onend);
        };
    });
};
