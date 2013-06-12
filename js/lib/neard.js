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
// Generic definition for an agent
var neardService = {
	name : "org.cloudeebus",
	NDEFagents : {},
	NDEFagentSize : 0,
    service : null
};

/*****************************************************************************/

// Generic definition for an agent
Agent = function(srvDbusName, objPath, xml) {
	this.srvName = srvDbusName;
	this.registered = false;
	this.xml = xml;
	return this;
};

// creation of an agent specific for NDEF
NDEFAgent = function(srvDbusName, tagType) {
	this.tagType = tagType;
	this.objectPath = tagType.replace(/:/g, "");
	this.objectPath = this.objectPath.replace(/-/g, "_");
	this.objectPath = this.objectPath.toUpperCase();
	this.objectPath = "/CloudeebusNdefagent/" + this.objectPath;
	var specificXml = '<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"\n"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">\n<node><interface name="org.neard.NDEFAgent"><method name="GetNDEF"><arg name="values" type="a{sv}" direction="in"/></method><method name="Release"></method></interface></node>';	
	Agent.call(this, srvDbusName, this.objectPath, specificXml);
	
	this.tagType = tagType;
};


/*****************************************************************************/
neardService.registerNdefAgent = function(tagType) {
	
	// For debug only
	cloudeebus.log = ndefLog_func;

	var future = new cloudeebus.Future(function (resolver) {
		
		var ndefAgent = new NDEFAgent(neardService.name, tagType);

		function errorCB(error) {
			errorStr = error.desc + " : " + error.uri;
			resolver.reject(errorStr, true);
		}

		function NeardNDEFAgentUnregisteredSuccessCB() {
    	    if (neardService.NDEFagentSize <= 0) {
	    	    neardService.service.remove();				    	  
  	        }
		}
		
		NdefAgentHandler = {
			interfaceProxies : {
			    "org.neard.NDEFAgent" : {
			        GetNDEF: function(values) {
			        	cloudeebus.log("Record datas : "+ values.Records);
			        	cloudeebus.log("NDEF datas : "+ values.NDEF);
                    }, 
			        Release: function() {			        	
			        	if (1) { // until fixed (Neard side)
							if (neardService.NDEFagents[ndefAgent.tagType] != null) {
					        	neardService.service.delAgent(ndefAgent.objectPath);
								delete neardService.NDEFagents[ndefAgent.tagType];
								neardService.NDEFagentSize--;
								var errorStr = "Agent : " + ndefAgent.objectPath + " removed!";
								resolver.accept(errorStr, true);
								NeardNDEFAgentUnregisteredSuccessCB();
							}
			        	} else
			        		nfc._manager.UnregisterNDEFAgent(ndefAgent.objectPath, ndefAgent.tagType).then(NeardNDEFAgentUnregisteredSuccessCB);
			        },
			    },
            }
        };
		
		function NeardNDEFAgentRegisteredSuccessCB() {
			try {
				var result = [ndefAgent];
				resolver.accept(result[0], true);
			}
			catch (e) {
				cloudeebus.log("Method callback exception: " + e);
				resolver.reject(e, true);
			}
		}

		function onAgentAdded() {
			if (neardService.NDEFagents[ndefAgent.tagType] != null)
				delete neardService.NDEFagents[ndefAgent.tagType];
			neardService.NDEFagents[ndefAgent.tagType] = ndefAgent;
			neardService.NDEFagentSize++;
			nfc._manager.RegisterNDEFAgent(ndefAgent.objectPath, ndefAgent.tagType).then(NeardNDEFAgentRegisteredSuccessCB, errorCB);
		}

		function onServiceAdded_addAgent(service) {
			neardService.service = service;
			service.addAgent(ndefAgent.objectPath, ndefAgent.xml, NdefAgentHandler, onAgentAdded, errorCB);
		}

		// Create service if needed
		if (!neardService.service) {			
			nfc._bus.addService(neardService.name).then(onServiceAdded_addAgent);
		} else {
			// Adding directly agent if service already exist
			neardService.service.addAgent(ndefAgent.objectPath, ndefAgent.xml, NdefAgentHandler, onAgentAdded, errorCB);
		}
	});
	
	return future;
};
/*****************************************************************************/


neardService.unregisterNdefAgent = function(tagType) {
	
	// For debug only
	cloudeebus.log = ndefLog_func;

	var future = new cloudeebus.Future(function (resolver) {
		
		var ndefAgent = neardService.NDEFagents[tagType];
		if (!ndefAgent) {
			errorStr = "There is no registered agent for tag type : " + tagType;
			resolver.reject(errorStr, true);
			return;
		}
			
		function errorCB(error) {
			errorStr = error.desc + " : " + error.uri;
			resolver.reject(errorStr, true);
		}

		function onServiceRemoved(serviceName) {
			neardService.service = null;
			var errorStr = "Service : " + serviceName + " removed!";
			resolver.accept(errorStr, true);
		}

		function onAgentRemoved(objectPath) {
			if (neardService.NDEFagents[ndefAgent.tagType] != null) {
				delete neardService.NDEFagents[ndefAgent.tagType];
				neardService.NDEFagentSize--;
			}
			var errorStr = "Agent : " + objectPath + " removed!";
			resolver.accept(errorStr, true);
    	    if (neardService.NDEFagentSize <= 0) {
	    	    neardService.service.remove(onServiceRemoved, errorCB);				    	  
  	        }
		}

		function onNDEFAgentUnregistered(objectPath) {
			// Remove agent from service
			if (neardService.NDEFagents[ndefAgent.tagType] != null)
				neardService.service.delAgent(ndefAgent.objectPath, onAgentRemoved, errorCB);
		}

		nfc._manager.UnregisterNDEFAgent(ndefAgent.objectPath, ndefAgent.tagType).then(onNDEFAgentUnregistered, errorCB);
	});
	
	return future;
};
/*****************************************************************************/


neardService.unregisterService = function() {
	
	// For debug only
	cloudeebus.log = ndefLog_func;

	var future = new cloudeebus.Future(function (resolver) {
		
		// Release all NDEF agents
		for (var ndefAgent in neardService.NDEFagents)
			cloudeebus.log(JSON.stringify(ndefAgent));
	});
	
	return future;
};