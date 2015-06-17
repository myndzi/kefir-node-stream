# kefir-node-stream

Make a Kefir observable from a node streams2 stream, with proper lazy read behavior.

# Example usage

    var fromNodeStream = require('kefir-node-stream');
    var index = require('fs').createReadableStream(__filename);
    
    fromNodeStream(index).log();

Output:

    [stream] <value> <Buffer ....>
    [stream] <end>

# Specific behavior

When applicable, data will be moved along in a while loop synchronously. Deactivation will cause handler events to be unbound and prevent further reading from the source. Behavior when calling on a streams1 stream or a streams2 stream in flowing mode is undefined.

This package contains only dev dependencies, with Kefir as a peer dependency. 
