'use strict';

require('should');

var fromNodeStream = require('./index');

var stream = require('stream');

describe('fromNodeStream', function () {
    it('should throw if not given a node Readable stream', function () {
        (function () {
            fromNodeStream();
        }).should.throw(/Invalid readable stream/);
        (function () {
            fromNodeStream({ _readableState: { } });
        }).should.throw(/Invalid readable stream/);
        (function () {
            fromNodeStream(new stream.Writable());
        }).should.throw(/Invalid readable stream/);
        (function () {
            fromNodeStream(null);
        }).should.throw(/Invalid readable stream/);
    });
    it('should accept readable, duplex streams', function () {
        fromNodeStream(new stream.Duplex());
        fromNodeStream(new stream.PassThrough());
        fromNodeStream(new stream.Readable());
    });
    it('should end when the node stream ends', function (done) {
        var pt = new stream.PassThrough(),
            obs = fromNodeStream(pt);
        
        obs.onEnd(done);
        setImmediate(function () {
            pt.end();
        });
    });
    it('should end when the node stream is already ended', function (done) {
        var pt = new stream.PassThrough(),
            obs = fromNodeStream(pt);
        
        pt.end();
        obs.onEnd(done);
    });
    it('should emit an error and end if the node stream emits an error', function (done) {
        var gotError = false;
        
        var pt = new stream.PassThrough(),
            obs = fromNodeStream(pt);
        
        obs.onError(function (err) {
            err.should.equal('foo');
            gotError = true;
        });
        obs.onEnd(function () {
            gotError.should.equal(true);
            done();
        });
        pt.emit('error', 'foo');
    });
    it('should pass data', function (done) {
        var pt = new stream.PassThrough(),
            obs = fromNodeStream(pt);
        
        var buf = new Buffer('foo');
        obs.onValue(function (chunk) {
            chunk.toString().should.equal(buf.toString());
        });
        obs.onEnd(done);
        pt.end(buf);
    });
    it('should pass data when in ended state if there is still queued data', function (done) {
        var pt = new stream.PassThrough(),
            obs = fromNodeStream(pt);
        
        pt.end('foo');
        
        var gotData = false;
        obs.onValue(function (chunk) {
            gotData = true;
        });
        obs.onEnd(function () {
            gotData.should.equal(true);
            done();
        });
    });
    it('might combine data', function (done) {
        var pt = new stream.PassThrough(),
            obs = fromNodeStream(pt);
        
        setImmediate(function () {
            obs.onValue(function (chunk) {
                chunk.toString().should.equal('foo');
            });
            obs.onEnd(done);
        });
        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();
    });
    it('should work when setEncoding has been called on the source stream', function (done) {
        var pt = new stream.PassThrough();
        pt.setEncoding('utf8');
        
        var obs = fromNodeStream(pt);
        
        setImmediate(function () {
            obs.onValue(function (chunk) {
                chunk.should.equal('foo');
            });
            obs.onEnd(done);
        });
        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();
    });
    it('shouldn\'t combine data in object mode', function (done) {
        var pt = new stream.PassThrough({ objectMode: true }),
            obs = fromNodeStream(pt);

        var expect = [ 'f', 'o', 'o' ];
        setImmediate(function () {
            obs.onValue(function (chunk) {
                chunk.toString().should.equal(expect.shift());
            });
            obs.onEnd(done);
        });
        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();
    });
    it('should emit multiple times in the same tick if the source provides for it', function (done) {
        var pt = new stream.PassThrough({ objectMode: true }),
            obs = fromNodeStream(pt);
        
        var expect = [ 'f', 'o', 'o' ];
        setImmediate(function () {
            var timer;
            obs.onValue(function (chunk) {
                if (!timer) { 
                    timer = setImmediate(function () {
                        throw new Error('Was supposed to consume input in one tick');
                    });
                }
                chunk.toString().should.equal(expect.shift());
            });
            obs.onEnd(function () {
                clearImmediate(timer);
                done();
            });
        });
        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();
    });
    it('should allow resubscriptions', function (done) {
        // 'readable' is emitted for the beginning of a readable stream
        // but if the stream has emitted readable and we're just not reading
        // from it we have to be sure to call pump in the subscription function!
        
        var pt = new stream.PassThrough({ objectMode: true }),
            obs = fromNodeStream(pt);
        
        obs.take(1).onEnd(function () {
            setImmediate(function () {
                obs.onEnd(done);
            });
        });

        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();        
    });
    it('should lazily consume input', function (done) {
        var pt = new stream.PassThrough({ objectMode: true }),
            obs = fromNodeStream(pt);
        
        var first = obs.take(1);
        
        // consume one chunk, throw if more are pushed
        first.onValue(function (chunk) {
            chunk.toString().should.equal('f');
        });
        first.onEnd(function () {
            setImmediate(function () {
                // consume the rest
                obs.onValue(function () { });
                obs.onEnd(done);
            });
        });
        
        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();
    });
    it('should resume pumping data if not unsubscribed', function (done) {
        var pt = new stream.PassThrough({ objectMode: true }),
            obs = fromNodeStream(pt);
        
        var expect = ['f', 'o', 'o'];
        var count = 0;
        obs.onValue(function (chunk) {
            chunk.toString().should.equal(expect.shift());
            count++;
            if (count > 1) { return; }
            setImmediate(function () {
                pt.write('o');
                pt.write('o');
                pt.end();
            });
        });
        obs.onEnd(function () {
            expect.length.should.equal(0);
            done();
        });
        
        pt.write('f');
    });
    it('should not leak event handlers', function (done) {
        var pt = new stream.PassThrough({ objectMode: true }),
            obs = fromNodeStream(pt);
        
        obs.take(1).onEnd(function () {
            setImmediate(function () {
                // stream comes with one listener to start with
                pt.listeners('end').length.should.equal(1);
                done();
            });
        });
        
        pt.write('f');
        pt.write('o');
        pt.write('o');
        pt.end();
    });
});
