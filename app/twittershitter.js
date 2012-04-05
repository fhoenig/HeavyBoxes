/*
	Copyright 2012 Florian Hoenig <rian.flo.h@gmail.com>

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

var TwitterShitter = Class.create({
    
    initialize: function(screen_name) {
        
        // constructor
        this._queue = new Array();
        this._endpoints = new Array();
        this._isFetched = new Array();
        this._emitterLoop = null;
        this._updateLoop = null;
        if (typeof(screen_name) != 'undefined')
            this.addUser(screen_name);
    },
    
    addUser: function(screen_name) {
        
        // adds a user timeline
        var url = 'http://twitter.com/status/user_timeline/'+screen_name+'.json?count=100';
        this._endpoints.push(url);
    },
    
    addPublicTimeline: function() {

        // add the public twitter timeline
        for (var i = this._endpoints.length - 1; i >= 0; i--) {
            if (this._endpoints[i].find('public_timeline'))
                return;
        }
        var url = 'http://api.twitter.com/1/statuses/public_timeline.json?count=100';
        this._endpoints.push(url);
    },
    
    emit: function(callback, sec) {
        
        // queue up new tweets and emit to callback
        if (this._emitterLoop != null || this._updateLoop != null)
            return;
            
        var instance = this;
        
        var emitterFunc = function(pe){
            if (instance._queue.length > 0) {
                var tweet = instance._queue.shift();
                if (callback(tweet) !== true) {
                    // if the emitter decided to not use the tweet, put it back
                    instance._queue.unshift(tweet);
                }
            }
        };
        this._emitterLoop = new PeriodicalExecuter(emitterFunc, sec);
        
        var updateFunc = function(pe){
            instance._update();
        };
        updateFunc();
        this._updateLoop = new PeriodicalExecuter(updateFunc, 30);
        emitterFunc();
    },
    
    stop: function() {
        if (this._emitterLoop != null) {
            this._emitterLoop.stop();
            this._emitterLoop = null;
        }
        if (this._updateLoop != null) {
            this._updateLoop.stop();
            this._updateLoop = null;
        }
    },
    
    _update: function() {

        // only update if necessary
        if (this._queue.length > 0)
            return;
            
        var instance = this;
        // handles fetching of new tweets
        for (var i=0; i < this._endpoints.length; i++) {
            new Ajax.JSONRequest(this._endpoints[i], {
                parameters: {},
                onSuccess: function(response) {
                    var res = response.responseJSON;
                    for (var i=0; i < res.length; i++) {

                        if (instance._isFetched[res[i].id] == true)
                            continue;
                        instance._queue.push(res[i]);
                        instance._isFetched[res[i].id] = true;
                    }
                }
            });
        }
    }
    
});