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

// creation of an agent specific for NDEF
NDEFAgent = function(srvDbusName, tagType, jsHdl) {
	var objPath = tagType.replace(/:/g, "");
	objPath = objPath.replace(/-/g, "_");
	objPath = "/CloudeebusNdefagent/" + objPath;
	var specificXml = '<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN"\n"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd">\n<node><interface name="org.neard.NDEFAgent"><method name="GetNDEF"><arg name="values" type="a{sv}" direction="in"/></method><method name="Release"></method></interface></node>';	
	cloudeebus.Agent.call(this, srvDbusName, objPath, jsHdl, specificXml);
	
	this.registered = false;
	this.tagType = tagType;
};


convertIntArrayToString = function(intArray, escape) {
	var lenght = 0;
	var newString = "";
	while (lenght < intArray.length) {
		var char = intArray[lenght++] & 0xFF;
		if (char > 32 && char < 128)
			newString = newString + String.fromCharCode(char);
		else
			if (escape)
				newString = newString + '\\' + char;
			else
				newString = newString + '.';
	}
	return newString;
};

/*****************************************************************************/
neardService.registerNdefAgent = function(tagType, parsingFunc) {
	
	// For debug only
	cloudeebus.log = ndefLog_func;

	var promise = new cloudeebus.Promise(function (resolver) {
		

		function errorCB(error) {
			resolver.reject(cloudeebus.getError(error), true);
		}

		function NeardNDEFAgentUnregisteredSuccessCB() {
    	    if (neardService.NDEFagentSize <= 0)
	    	    neardService.service.remove();				    	  
  	        }
		
		function onAgentRemoved(objectPath) {
			if (neardService.NDEFagents[ndefAgent.tagType] != null) {
				neardService.NDEFagents[ndefAgent.tagType] = null;
				neardService.NDEFagentSize--;
			}
			var errorStr = "Agent : " + objectPath + " removed!";
			resolver.fulfill(errorStr, true);
    	    if (neardService.NDEFagentSize <= 0)
	    	    neardService.service.remove().catch(errorCB);				    	  
		}

		
		NdefAgentHandler = {
			interfaceProxies : {
			    "org.neard.NDEFAgent" : {
			        GetNDEF: function(values) {
			        	cloudeebus.log("Record datas : "+ values.Records);
			        	var mimeTypeLen = values.NDEF[1];
			        	var rawDataAsString = convertIntArrayToString(values.NDEF, false);
			        	var rawDataAsStringEscaped = convertIntArrayToString(values.NDEF, true);
			        	var mimeType = rawDataAsString.substring(3, 3 + mimeTypeLen);
			        	parsingFunc(mimeType, 
			        				rawDataAsString.substring(3 + mimeTypeLen), 
			        				rawDataAsStringEscaped,
			        				rawDataAsString.length);
                    }, 
			        Release: function() {			        	
			        	neardService.service.removeAgent(ndefAgent).then(onAgentRemoved, errorCB);
			        },
			    }
			}
        };
		var ndefAgent = new NDEFAgent(neardService.name, tagType, NdefAgentHandler);

		function NeardNDEFAgentRegisteredSuccessCB() {
			ndefAgent.registered = true;
			resolver.fulfill(ndefAgent, true);
		}

		function onAgentAdded() {
			neardService.NDEFagents[ndefAgent.tagType] = ndefAgent;
			neardService.NDEFagentSize++;
			nfc._manager.RegisterNDEFAgent(ndefAgent.objectPath, ndefAgent.tagType).then(NeardNDEFAgentRegisteredSuccessCB, errorCB);
		}

		function onServiceAdded_addAgent(service) {
			neardService.service = service;
			service.addAgent(ndefAgent).then(onAgentAdded, errorCB);
		}

		
		// Create service if needed
		if (!neardService.service)			
			nfc._bus.addService(neardService.name).then(onServiceAdded_addAgent);
		else
			// Adding directly agent if service already exist
			neardService.service.addAgent(ndefAgent).then(onAgentAdded, errorCB);
	});
	
	return promise;
};
/*****************************************************************************/


neardService.unregisterNdefAgent = function(tagType) {
	
	// For debug only
	cloudeebus.log = ndefLog_func;

	var promise = new cloudeebus.Promise(function (resolver) {
		
		var ndefAgent = neardService.NDEFagents[tagType];
		if (!ndefAgent && !ndefAgent.registered) {
			errorStr = "There is no registered agent for tag type : " + tagType;
			resolver.reject(errorStr, true);
			return;
		}
			
		function errorCB(error) {
			resolver.reject(cloudeebus.getError(error), true);
		}

		function onServiceRemoved(serviceName) {
			neardService.service = null;
			var errorStr = "Service : " + serviceName + " removed!";
			cloudeebus.log(errorStr);
		}

		function onAgentRemoved(agent) {
			resolver.fulfill(agent, true);
			if (neardService.NDEFagents[agent.tagType] != null) {
				neardService.NDEFagents[agent.tagType] = null;
				neardService.NDEFagentSize--;
			}
		}
			
		function onNDEFAgentUnregistered() {
			ndefAgent.registered = false;
			neardService.service.removeAgent(ndefAgent).then(onAgentRemoved, errorCB);
		}

		if (neardService.NDEFagents[ndefAgent.tagType])
			nfc._manager.UnregisterNDEFAgent(ndefAgent.objectPath, ndefAgent.tagType).then(onNDEFAgentUnregistered, errorCB);
	});
	
	return promise;
};
/*****************************************************************************/


neardService.unregisterService = function() {
	
	// For debug only
	cloudeebus.log = ndefLog_func;

	var promise = new cloudeebus.Promise(function (resolver) {
		var current_agent = null;
		
		function onSuccessCB(serviceName) {
			resolver.fulfill(neardService.service, true);
			neardService.service = null;
			neardService.NDEFagentSize = 0;
			neardService.NDEFagents = {};
		}

		function onAgentsRemoved(promise) {
			neardService.service.remove().then(onSuccessCB, onErrorCB);				    	  
		}
			
		function onErrorCB(error) {
			resolver.reject(cloudeebus.getError(error), true);
		}

		// Release all NDEF agents
		var promises = [];
		for (var tagType in neardService.NDEFagents) {
			if (tagType != null) {
				current_agent = neardService.NDEFagents[tagType];
				// Unregister agent from Neard
				if (current_agent) {
					promises.push(neardService.unregisterNdefAgent(current_agent.tagType));
					cloudeebus.Promise.every.apply(neardService, promises).then(onAgentsRemoved, onErrorCB);
				} else  
				    cloudeebus.Service.remove.apply(neardService).then(onSuccessCB, onErrorCB);
			}
		}
		
	});
	
	return promise;
};