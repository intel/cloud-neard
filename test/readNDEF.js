#!/usr/bin/env node

/******************************************************************************
 * Copyright 2013 Intel Corporation.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *****************************************************************************/



/*****************************************************************************/

var cloudNeard = require('../js/main.js');

var cloudeebus = cloudNeard.cloudeebus;
var nfc = cloudNeard.nfc;
var future = cloudNeard.future;


console.log("cloudeebus.version:" + cloudeebus.version);


/*****************************************************************************/

// Polling for NDEF message
var pollWaitInterval;
var pending = true;

function pollWait() {
	console.log("NFCManager polling: " + nfc.polling);
	if (!pending) {
		clearInterval(pollWaitInterval);
		process.exit();
	}
}

pollWaitInterval = setInterval(pollWait,2000);

function pollDone() {
	console.log("All done, exiting");
	pending=false;
}

function errorCB(str) {
	console.log("[ERROR] " + str);
}


/*****************************************************************************/

function logRecord(rec) {
	if (rec.text)
		console.log(rec.text + " (" + rec.encoding + " / " + rec.languageCode + ")");
	else if (rec.uri)
		console.log(rec.uri);
}

function logMessage(msg) {
	console.log("Found NDEF Message with " + msg.records.length + " records");
	for (var index=0; index < msg.records.length; index++) {
		logRecord(msg.records[index]);
	}
	console.log("");
}

function onTagFound(e) {
	console.log("Found NFC Tag");
	var tag = e.param;
	tag.readNDEF().then(logMessage, errorCB);
}

function onPeerFound(e) {
	console.log("Found NFC Peer device");
	var peer = e.param;
	peer.onmessageread = function(e) {
		logMessage(e.param);
	}
}

function pollForNDEF() {
	nfc.ontagfound = onTagFound;
	nfc.onpeerfound = onPeerFound;
	nfc.ontaglost = pollDone;
	nfc.onpeerlost = pollDone;
	nfc.startPoll();
}

/*****************************************************************************/


future.then(pollForNDEF,errorCB);


