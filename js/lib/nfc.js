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
	nfc._tag = null;
	nfc._peer = null;
	nfc.polling = false;
	nfc.powered = false;
};



/*****************************************************************************/

nfc._NDEFRecordForProps = function(props) {
	if (props.Type == "Text")
		return new nfc.NDEFRecordText(props);
	if (props.Type == "URI")
		return new nfc.NDEFRecordURI(props);
	return new nfc.NDEFRecord(props);
};


nfc._NDEFMessageForRecordIds = function(ids) {
	
	var promise = new cloudeebus.Promise(function (resolver) {
		
		var records = [];
		
		function onRecPropsOk(props) {
			records.push(nfc._NDEFRecordForProps(props));
			if (records.length == ids.length)
				resolver.resolve(new NDEFMessage(records), true);
		}
		
		for (var i=0; i<ids.length; i++) {
			var recProxy = nfc._bus.getObject(nfc._busName, ids[i]);
			recProxy.callMethod("org.neard.Record", "GetProperties", 
					[]).then(onRecPropsOk, function(err) {resolver.reject(err,true)});
		}
	});
	
	return promise;
}



/*****************************************************************************/

nfc._peerChanged = function(key, value) {
	
	if (key == "Records") {
		nfc._peer.props.Records = value;
		if (nfc._peer.onmessageread)
			nfc._NDEFMessageForRecordIds(nfc._peer.props.Records).then(
					function(msg) {
						nfc._peer.onmessageread({type: "messageread", message: msg});
					});
	}
};


nfc._adapterChanged = function(key, value) {
	
	function onTagPropsOk(props) {
		nfc._tag.props = props;
		if (nfc.ontagfound)
			nfc.ontagfound({type: "tagfound", tag: nfc._tag});
	}
	
	function onPeerPropsOk(props) {
		nfc._peer.props = props;
		if (nfc.onpeerfound)
			nfc.onpeerfound({type: "peerfound", peer: nfc._peer});
	}
	
	function onTagFound(tagId) {
		if (nfc._tag) /* trigger "found" callback only once */
			return;
		nfc._tag = new nfc.NFCTag(nfc._bus.getObject(nfc._busName, tagId));
		nfc._tag.proxy.callMethod("org.neard.Tag", "GetProperties", 
				[]).then(onTagPropsOk);
	}
	
	function onPeerFound(deviceId) {
		if (nfc._peer) /* trigger "found" callback only once */
			return;
		nfc._peer = new nfc.NFCPeer(nfc._bus.getObject(nfc._busName, deviceId));
		nfc._peer.proxy.callMethod("org.neard.Device", "GetProperties", 
				[]).then(onPeerPropsOk);
		nfc._peer.proxy.connectToSignal("org.neard.Device","PropertyChanged",
				nfc._peerChanged);
		}
	
	if (key == "Tags") {
		if (value.length == 0) {
			nfc._tag = null;
			if (nfc.ontaglost)
				nfc.ontaglost({type: "taglost"});
			nfc.startPoll();
		}
		else
			onTagFound(value[0]);
	}
	if (key == "Devices") {
		if (value.length == 0) {
			nfc._peer = null;
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
	if (key == "Powered") {
		nfc.powered = value;
		if (value) {
			if (nfc.onpoweron)
				nfc.onpoweron({type: "poweron"});
		}
		else {
			if (nfc.onpoweroff)
				nfc.onpoweroff({type: "poweroff"});
		}
	}
	
};



/*****************************************************************************/

nfc._init = function(uri, manifest) {
	nfc._reset();
	
	var promise = new cloudeebus.Promise(function (resolver) {
		function onAdapterPropsOk(props) {
			nfc._adapter.props = props;
			nfc.polling = props.Polling ? true : false;
			nfc.powered = props.Powered ? true : false;
			resolver.fulfill();
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
	
	return promise;
};



/*****************************************************************************/

nfc.powerOn = function() {
	return nfc._adapter.SetProperty("Powered", 1).then(function(){nfc.powered=true;});
};


nfc.powerOff = function() {
	return nfc._adapter.SetProperty("Powered", 0).then(function(){nfc.powered=false;});
};



/*****************************************************************************/

nfc.startPoll = function() {
	return nfc._adapter.StartPollLoop("Initiator").then(function(){nfc.polling=true;});
};


nfc.stopPoll = function() {
	return nfc._adapter.StopPollLoop().then(function(){nfc.polling=false;});
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


nfc.NFCPeer.prototype.sendNDEF = function(ndefMessage) {
	var promises = [];
	for (var i=0; i< ndefMessage.records.length; i++) {
		var ndefRecord = ndefMessage.records[i];
		var rec = ndefRecord.neardRecord();
		promises.push(this.proxy.callMethod("org.neard.Device", "Push", [rec]));
	}
	return cloudeebus.Promise.every.apply(cloudeebus.Promise,promises);
};


nfc.NFCPeer.prototype.startHandover = function(type) {
	return this.proxy.callMethod("org.neard.Device", "Push", 
		[{
			 Type: "Handover",
			 Carrier: type
		}]);
};



/*****************************************************************************/

nfc.NFCTag = function(proxy) {
	this.proxy = proxy;
	if (proxy) {
		this.id = proxy.objectPath;
	}
	return this;
};


nfc.NFCTag.prototype.readNDEF = function() {
	if (!this.props)
		return cloudeebus.Promise.reject("Tag properties unknown.");
	
	return nfc._NDEFMessageForRecordIds(this.props.Records);
};


nfc.NFCTag.prototype.writeNDEF = function(ndefMessage) {
	var ndefRecord = ndefMessage.records[0];
	var rec = ndefRecord.neardRecord();
	return this.proxy.callMethod("org.neard.Tag", "Write", [rec]);
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







