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

var nfc = window.nfc = {};

nfc._reset = function() {
	nfc._busName = "org.neard";
	nfc._bus = null;
	nfc._uri = null;
	nfc._manager = null;
	nfc._adapter = null;
	nfc.polling = false;
};


nfc._adapterChanged = function(key, value) {
	
	var tag = null;
	var peer = null;
	
	function onTagPropsOk(props) {
		tag.props = props;
		tag.type = props.Type;
		if (nfc.ontagfound)
			nfc.ontagfound({type: "tagfound", param: tag});
	}
	
	function onPeerPropsOk(props) {
		peer.props = props;
		if (nfc.onpeerfound)
			nfc.onpeerfound({type: "peerfound", param: peer});
	}
	
	function onTagFound(tagId) {
		if (tag) /* trigger "found" callback only once */
			return;
		tag = new nfc.NFCTag(nfc._bus.getObject(nfc._busName, tagId));
		tag.proxy.callMethod("org.neard.Tag", "GetProperties", 
				[]).then(onTagPropsOk);
	}
	
	function onPeerFound(deviceId) {
		if (peer) /* trigger "found" callback only once */
			return;
		peer = new nfc.NFCPeer(nfc._bus.getObject(nfc._busName, deviceId));
		peer.proxy.callMethod("org.neard.Device", "GetProperties", 
				[]).then(onPeerPropsOk);
	}
	
	if (key == "Tags") {
		if (value.length == 0) {
			tag = null;
			if (nfc.ontaglost)
				nfc.ontaglost({type: "taglost"});
			nfc.startPoll();
		}
		else
			onTagFound(value[0]);
	}
	if (key == "Devices") {
		if (value.length == 0) {
			peer = null;
			if (nfc.onpeerlost)
				nfc.onpeerlost({type: "peerlost"});
			nfc.startPoll();
		}
		else
			onPeerFound(value[0]);
	}
	if (key == "Polling") {
		nfc.polling = value;
		if (value) {
			if (nfc.onpollstart)
				nfc.onpollstart({type: "pollstart"});
		}
		else {
			if (nfc.onpollstop)
				nfc.onpollstop({type: "pollstop"});
		}
	}
	
};


nfc._init = function(uri, manifest) {
	nfc._reset();
	
	var future = new cloudeebus.Future(function (resolver) {
		function onAdapterPropsOk(props) {
			nfc._adapter.props = props;
			nfc.polling = props.Polling ? true : false;
			resolver.accept();
		}
		
		function onAdapterOk() {
			nfc._adapter.GetProperties().then(onAdapterPropsOk, onerror);
		}
		
		function onManagerPropsOk(props) {
			if (props.Adapters.length == 0)
				resolver.reject("No NFC Adapter found", true);	
			else {
				nfc._adapter = nfc._bus.getObject(nfc._busName, 
						props.Adapters[0], 
						onAdapterOk, 
						onerror);
				nfc._adapter.connectToSignal("org.neard.Adapter","PropertyChanged",
						nfc._adapterChanged);
			}
		}
		
		function onManagerOk() {
			nfc._manager.GetProperties().then(onManagerPropsOk, onerror);
		}
		
		function onConnectOk() {
			nfc._bus = cloudeebus.SystemBus();
			nfc._uri = uri;
			nfc._manager = nfc._bus.getObject(nfc._busName, "/", onManagerOk, onerror);
		}
		
		function onerror(error) {
			cloudeebus.log("NFC init error: " + error.desc);
			resolver.reject(error.desc, true);			
		}
		
		cloudeebus.connect(uri, manifest, onConnectOk, onerror);
	});
	
	return future;
};


nfc.startPoll = function() {
	function onsuccess() {
		cloudeebus.log("startPoll onsuccess Future state: " + this.state + ", result: " + this.result);
		nfc.polling = true;
	}
	
	function onerror() {
		cloudeebus.log("startPoll onerror Future state: " + this.state + ", result: " + this.result);
	}
	
	return nfc._adapter.StartPollLoop("Initiator").then(onsuccess, onerror);
};


nfc.stopPoll = function() {
	function onsuccess() {
		cloudeebus.log("stopPoll onsuccess Future state: " + this.state + ", result: " + this.result);
		nfc.polling = false;
	}
	
	function onerror() {
		cloudeebus.log("stopPoll onerror Future state: " + this.state + ", result: " + this.result);
	}
	
	return nfc._adapter.StopPollLoop("Initiator").then(onsuccess, onerror);
};



/*****************************************************************************/

nfc.NFCPeer = function(proxy) {
	this.proxy = proxy;
	if (proxy) {
		this.id = proxy.objectPath;
	}
	this.isConnected = false;
	return this;
};


nfc.NFCPeer.prototype.setReceiveNDEFListener = function(receiveCB, errorCB) {
	
	var self = this;
	
	if (!self.props)
		return errorCB("Peer properties unknown.");
	
	var records = [];
	
	function onRecPropsOk(props) {
		records.push(nfc.NDEFRecordForProps(props));
		if (records.length == self.props.Records.length && receiveCB)
			receiveCB(new NDEFMessage(records));
	}
	
	function NDEFMessageForRecords() {
		records = [];
		for (var i=0; i<self.props.Records.length; i++) {
			var recProxy = nfc._bus.getObject(nfc._busName, self.props.Records[i]);
			recProxy.callMethod("org.neard.Record", "GetProperties", 
					[]).then(onRecPropsOk, errorCB);
		}
	}
	
	function onPropertyChanged(key, table) {
		if (key == "Records") {
			self.props.Records = table;
			NDEFMessageForRecords();
		}
	}

	if (!self.isConnected) {
		self.proxy.connectToSignal("org.neard.Device","PropertyChanged",
				onPropertyChanged);
		self.isConnected = true;
		NDEFMessageForRecords();
	}
};


nfc.NFCPeer.prototype.unsetReceiveNDEFListener = function() {
	this.proxy.disconnectSignal("org.neard.Device","PropertyChanged");
	this.isConnected = false;
};


nfc.NFCPeer.prototype.sendNDEF = function(ndefMessage, successCB, errorCB) {
	for (var i=0; i< ndefMessage.records.length; i++) {
		var ndefRecord = ndefMessage.records[i];
		var rec = ndefRecord.neardRecord();
		this.proxy.callMethod("org.neard.Device", "Push", 
			[rec]).then(successCB, errorCB);
	}
};


nfc.NFCPeer.prototype.startHandover = function(type, successCB, errorCB) {
	this.proxy.callMethod("org.neard.Device", "Push", 
		[{
			 Type: "Handover",
			 Carrier: type
		}]).then( 
		successCB, errorCB);
};



/*****************************************************************************/

nfc.NFCTag = function(proxy) {
	this.proxy = proxy;
	this.type = "GENERIC_TARGET";
	if (proxy) {
		this.id = proxy.objectPath;
	}
	return this;
};


nfc.NFCTag.prototype.readNDEF = function(readCB, errorCB) {
	
	var self = this;
	
	if (!self.props)
		return errorCB("Tag properties unknown.");
	
	var records = [];
	
	function onRecPropsOk(props) {
		records.push(nfc.NDEFRecordForProps(props));
		if (records.length == self.props.Records.length && readCB)
			readCB(new NDEFMessage(records));
	}
	
	for (var i=0; i<self.props.Records.length; i++) {
		var recProxy = nfc._bus.getObject(nfc._busName, self.props.Records[i]);
		recProxy.callMethod("org.neard.Record", "GetProperties", 
				[]).then(onRecPropsOk, errorCB);
	}
};


nfc.NFCTag.prototype.writeNDEF = function(ndefMessage, successCB, errorCB) {
	var ndefRecord = ndefMessage.records[0];
	var rec = ndefRecord.neardRecord();
	this.proxy.callMethod("org.neard.Tag", "Write", 
			[rec]).then(successCB, errorCB);
};



/*****************************************************************************/

nfc.NDEFMessage = function() {
	return this;
};


NDEFMessage = function(records) {
	nfc.NDEFMessage.call(this);
	this.records = records;
	return this;
};

NDEFMessage.prototype = new nfc.NDEFMessage();
NDEFMessage.prototype.constructor = NDEFMessage;



/*****************************************************************************/

nfc.NDEFRecord = function(props) {
	return this;
};


nfc.NDEFRecord.prototype.neardRecord = function() {
	return {};
};



/*****************************************************************************/

nfc.NDEFRecordText = function(props) {
	nfc.NDEFRecord.call(this,props);
	if (props) {
		this.text = props.Representation;
		this.languageCode = props.Language;
		this.encoding = props.Encoding;
	}
	return this;
};

nfc.NDEFRecordText.prototype = new nfc.NDEFRecord();
nfc.NDEFRecordText.prototype.constructor = nfc.NDEFRecordText;


nfc.NDEFRecordText.prototype.neardRecord = function() {
	return {
		Type: "Text",
		Representation: this.text,
		Language: this.languageCode,
		Encoding: this.encoding
	};
};


NDEFRecordText = function(text, languageCode, encoding) {
	nfc.NDEFRecordText.call(this);
	this.text = text;
	this.languageCode = languageCode ? languageCode : "en-US";
	this.encoding = encoding ? encoding : "UTF-8";
	return this;
};

NDEFRecordText.prototype = new nfc.NDEFRecordText();
NDEFRecordText.prototype.constructor = NDEFRecordText;



/*****************************************************************************/

nfc.NDEFRecordURI = function(props) {
	nfc.NDEFRecord.call(this,props);
	if (props) {
		this.uri = props.URI;
	}
	return this;
};

nfc.NDEFRecordURI.prototype = new nfc.NDEFRecord();
nfc.NDEFRecordURI.prototype.constructor = nfc.NDEFRecordURI;


nfc.NDEFRecordURI.prototype.neardRecord = function() {
	return {
		Type: "URI",
		URI: this.uri
	};
};


NDEFRecordURI = function(uri) {
	nfc.NDEFRecordURI.call(this);
	this.uri = uri;
	return this;
};

NDEFRecordURI.prototype = new nfc.NDEFRecordURI();
NDEFRecordURI.prototype.constructor = NDEFRecordURI;



/*****************************************************************************/

nfc.NDEFRecordForProps = function(props) {
	if (props.Type == "Text")
		return new nfc.NDEFRecordText(props);
	if (props.Type == "URI")
		return new nfc.NDEFRecordURI(props);
	return new nfc.NDEFRecord(props);
};







