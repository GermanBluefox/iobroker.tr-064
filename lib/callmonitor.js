"use strict";

const CALLMONITOR_NAME = 'callmonitor';

module.exports = function (adapter, devices, phonebook) {
    if (!adapter.config.useCallMonitor) return;
    adapter.log.debug('starting callmonitor');

    var net = require('net');
    var connections = {};
    var timeout;

    var client = new net.Socket();
    client.on('connect', function () {
        adapter.log.debug('callmonitor connected')  ;
    });

    client.on('close', function (hadError) {
        if (hadError) {
        } else {
        }
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(client.connect, 5000, { host: adapter.config.ip, port: 1012 });
    });

    client.on('data', function (data) {
        var raw = data.toString();
        var array = raw.split(";");
        var type = array[1];
        var id = array[2];
        var timestamp = array[0];
        var message;
        //var dev = new devices.CDevice(0, '');
        //dev.setDevice(CALLMONITOR_NAME, {common: {name: CALLMONITOR_NAME, role: 'channel'}, native: {} });
        var dev = new devices.CDevice(CALLMONITOR_NAME, '');
        var timer = null;

        function set(name) {
            if (timer) cancelTimeout(timer);
            dev.setChannel(name, name);
            for (var i in message) {
                if (i[0] != '_') dev.set(i, message[i]);
            }
            dev.set('timestamp', timestamp);
            message._type = name;
            if (adapter.config.usePhonebook && phonebook) {
                if (message.callerName == undefined && message.caller) {
                    message.callerName = phonebook.findNumber(message.caller);
                }
                dev.set('callerName', message.callerName);
            }
            dev.set('json', JSON.stringify(message));
            adapter.log.debug('callMonitor: caller=' + message.caller + ' callee=' + message.callee + (message.callerName ? ' callerName=' + message.callerName : ''));
            timer = setTimeout(function() {
                devices.update();
            }, 500);
        }

        switch (type) {
            case "CALL":
                message = { caller: array[4], callee: array[5], extension: array[3] };
                connections[id] = message;
                set('outbound');
                break;
            case "RING":
                message = { caller: array[3], callee: array[4] };
                connections[id] = message;
                set('inbound');
                break;
            case "CONNECT":
                message = connections[id];
                if (!message) break;
                message.extension = array[3];
                set('connect');
                break;
            case "DISCONNECT":
                message = connections[id];
                if (!message) break;
                switch (message._type) {
                    case "inbound":
                        message.type = "missed";
                        break;
                    case "connect":
                        message.type = "disconnect";
                        break;
                    case "outbound":
                        message.type = "unreached";
                        break;
                }
                message.duration = array[3] >> 0;
                //set('disconnect');
                set('lastCall');
                delete connections[id];
                break;
        }
    });
    client.connect({host: adapter.config.ip, port: 1012});
};
