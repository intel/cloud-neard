/******************************************************************************
 * Copyright 2012 Intel Corporation.
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

nfc.reset = function() {
	nfc.busName = "org.neard";
	nfc.bus = null;
	nfc.uri = null;
	nfc.manager = null;
	nfc.adapter = null;
	nfc.defaultAdapter = null;
};


nfc.init = function(uri, manifest, successCB, errorCB) {
	nfc.reset();
	
	function onAdapterPropsOk(props) {
		nfc.adapter.props = props;
		nfc.defaultAdapter = new nfc.NFCAdapter(nfc.adapter);
		if (successCB)
			successCB();		
	}
	
	function onAdapterOk() {
		nfc.adapter.GetProperties(onAdapterPropsOk, errorCB);
	}
	
	function onManagerPropsOk(props) {
		if (props.Adapters.length == 0)
			errorCB("No NFC Adapter found");
		else {
			nfc.adapter = nfc.bus.getObject(nfc.busName, 
					props.Adapters[0], 
					onAdapterOk, 
					errorCB);
		}
	}
	
	function onManagerOk() {
		nfc.manager.GetProperties(onManagerPropsOk, errorCB);
	}
	
	function onConnectOk() {
		nfc.bus = cloudeebus.SystemBus();
		nfc.uri = uri;
		nfc.manager = nfc.bus.getObject(nfc.busName, "/", onManagerOk, errorCB);
	}
	
	cloudeebus.connect(uri, manifest, onConnectOk, errorCB);
};


nfc.getDefaultAdapter = function() {
	return nfc.defaultAdapter;
};



/*****************************************************************************/

nfc.NFCAdapter = function(proxy) {
	this.proxy = proxy;
	if (proxy) {
		this.id = proxy.objectPath;
		this.powered = proxy.props.Powered ? true : false;
		this.polling = proxy.props.Polling ? true : false;
	}
	this.tagListener = this.peerListener = null;
	return this;
};


nfc.NFCAdapter.prototype.setPowered = function(state, successCB, errorCB) {

	var self = this;

	function onPoweredOk() {
		self.powered = state;
		if (successCB)
			successCB();
	}

	self.proxy.SetProperty("Powered", state, onPoweredOk, errorCB);
};


nfc.NFCAdapter.prototype.setPolling = function(state, successCB, errorCB) {

	var self = this;

	function onPollingOk() {
		self.polling = state;
		if (successCB)
			successCB();
	}

	if (state)
		self.proxy.StartPollLoop("Initiator", onPollingOk, errorCB);
	else
		self.proxy.StopPollLoop(onPollingOk, errorCB);
};


nfc.NFCAdapter.prototype.setListener = function(listenerKey, errorCB) {
	
	var self = this;
	
	var tag = null;
	var peer = null;
	
	function onTagPropsOk(props) {
		tag.props = props;
		tag.type = props.Type;
		if (self.tagListener)
			self.tagListener.onattach(tag);
	}
	
	function onPeerPropsOk(props) {
		peer.props = props;
		if (self.peerListener)
			self.peerListener.onattach(peer);
	}
	
	function onTagFound(tagId) {
		if (tag) /* trigger "found" callback only once */
			return;
		tag = new nfc.NFCTag(nfc.bus.getObject(nfc.busName, tagId));
		tag.proxy.callMethod("org.neard.Tag", "GetProperties", 
				[]).then(onTagPropsOk, errorCB);
	}
	
	function onPeerFound(deviceId) {
		if (peer) /* trigger "found" callback only once */
			return;
		peer = new nfc.NFCPeer(nfc.bus.getObject(nfc.busName, deviceId));
		peer.proxy.callMethod("org.neard.Device", "GetProperties", 
				[]).then(onPeerPropsOk, errorCB);
	}
	
	function onPropertyChanged(key, table) {
		if (key == "Tags") {
			if (table.length == 0) {
				tag = null;
				if (self.tagListener)
					self.tagListener.ondetach();
				self.setPolling(true);
			}
			else
				onTagFound(table[0]);
		}
		if (key == "Devices") {
			if (table.length == 0) {
				peer = null;
				if (self.peerListener)
					self.peerListener.ondetach();
				self.setPolling(true);
			}
			else
				onPeerFound(table[0]);
		}
	}
	
	if (!self.connected) {
		self.proxy.connectToSignal("org.neard.Adapter","PropertyChanged",
				onPropertyChanged);
		self.connected = true;
	}
};


nfc.NFCAdapter.prototype.setTagListener = function(detectCB, errorCB, tagFilter) {
	this.tagListener = detectCB;
	return this.setListener("Tags", errorCB);
};


nfc.NFCAdapter.prototype.setPeerListener = function(detectCB, errorCB) {
	this.peerListener = detectCB;
	return this.setListener("Devices", errorCB);
};


nfc.NFCAdapter.prototype.unsetListener = function() {
	if (this.tagListener || this.peerListener)
		return;
	this.proxy.disconnectSignal("org.neard.Adapter","PropertyChanged");
	this.connected = false;
};


nfc.NFCAdapter.prototype.unsetTagListener = function() {
	this.tagListener = null;
	return this.unsetListener();
};


nfc.NFCAdapter.prototype.unsetPeerListener = function() {
	this.peerListener = null;
	return this.unsetListener();
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
			var recProxy = nfc.bus.getObject(nfc.busName, self.props.Records[i]);
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
		var recProxy = nfc.bus.getObject(nfc.busName, self.props.Records[i]);
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







