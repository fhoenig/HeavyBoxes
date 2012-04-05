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


var DomActor = Class.create({
    initialize: function(id, element, body) {
        this._element = element;
        this._body = body;
        this._element._domActor = this;
        this._id = id;
    }
});

DomActor._lastId = 1;


var HeavyBoxes = Class.create({
    
    initialize: function(worldElement) {

        // scale factor view/world
        this._scaleFactor = 100.0; // 1 pixel in browser ^= 1cm in physical world
        
        // the containing world DOM element
        this._worldElement = $(worldElement);
        
        // the physical world
        this._world = this._createWorld();

        // auto-increment object ids
        this._lastId = 1;
        
        // objects in the world (DOM elements and their bodies)
        this._objects = new Hash();
        
        // the run loop
        this._runLoop = null;
        
        // transform property
        this._transform = this._getTransformProperty(worldElement);
    },
    
    getObjectCount: function() {
        // returns the amount of movable objects in the world
        return this._objects.size();  
    },
    
    run: function(c) {
        
        // start the run loop once
        if (this._runLoop != null)
            return;
            
        var instance = this;
        
        this._runLoop = new PeriodicalExecuter(function(pe){
            // animation step
            var timeStep = 1.0/60.0;
            var iteration = 1;
            instance._world.Step(timeStep, iteration);
            instance._updateWorld();
        }, 10/1000);
    },
    
    stop: function() {
        if (this._runLoop != null) {
            this._runLoop.stop();
            this._runLoop = null;
        }
    },
    
    addBox: function(left, top, contents, vx, vy) {
        return this.addElement('box', left, top, contents, vx, vy);
    },
    
    addBall: function(left, top, contents, vx, vy) {
        return this.addElement('ball', left, top, contents, vx, vy);
    },
    
    addElement: function(shape, left, top, contents, vx, vy) {
        
        // wrap up a box
        var obj = {};
        var objId = this._lastId++;
        var div = new Element('div', {'id': "box-"+objId }).update(contents);

        div.setStyle({
            position: 'absolute',
            display: 'block',
            overflow: 'hidden',
            border:0,
            margin:0,
            padding:0,
            top: top+"px",
            left: left+"px"
        });
        
        this._worldElement.appendChild(div);

        // now set fixed dimensions to make sure it always reflects the physical body
        var dim = div.getDimensions();
        div.setStyle({
            width: dim.width + "px!important",
            height: dim.height + "px!important"
        });

        var bodyX = left + dim.width/2.0;
        var bodyY = top + dim.height/2.0;
        var physbody = null;
        
        if (shape == "ball")
            physbody = this._createBall(this.v2w(bodyX), this.v2w(bodyY), this.v2w(dim.width/2.0));
        else
            physbody = this._createBox(this.v2w(bodyX), this.v2w(bodyY), this.v2w(dim.width/2.0), this.v2w(dim.height/2.0), false);
        physbody.m_userData = objId;

        // set inital linear velocity
        var linX = (typeof(vx) != 'undefined') ? vx : 0;
        var linY = (typeof(vy) != 'undefined') ? vy : 0;       
        physbody.SetLinearVelocity(new b2Vec2(linX, linY));

        return this._objects.set(objId, {elem: div, body: physbody});
    },
    
    
    _createWorld: function() {

        // set up the physical reality
        var worldAABB = new b2AABB();
    	worldAABB.minVertex.Set(-10, -10);
    	worldAABB.maxVertex.Set(10, 10);
        var gravity = new b2Vec2(0, 1);
        var doSleep = true;
        var w = new b2World(worldAABB, gravity, doSleep);
        this._initWalls(w);
        return w;
    },

    _initWalls: function(w) {
        
        // frame the world's div with invisible walls
        var dim = this._worldElement.getDimensions();

        dim.width = this.v2w(dim.width);
        dim.height = this.v2w(dim.height);
        var thick = this.v2w(10.0);

        // ground
        var groundSd = new b2BoxDef();
        groundSd.extents.Set(dim.width/2.0, thick);
        groundSd.restitution = 0.1;
        var groundBd = new b2BodyDef();
        groundBd.AddShape(groundSd);
        groundBd.position.Set(dim.width/2.0, dim.height + thick);
        var ground = w.CreateBody(groundBd);
        
        // left wall
        var leftSd = new b2BoxDef();
        leftSd.extents.Set(thick, dim.height/2.0);
        leftSd.restitution = 0.1;
        var leftBd = new b2BodyDef();
        leftBd.AddShape(leftSd);
        leftBd.position.Set(-1*thick, dim.height/2.0);
        var left = w.CreateBody(leftBd);

        // right wall
        var rightSd = new b2BoxDef();
        rightSd.extents.Set(thick, dim.height/2.0);
        rightSd.restitution = 0.1;
        var rightBd = new b2BodyDef();
        rightBd.AddShape(rightSd);
        rightBd.position.Set(dim.width + thick, dim.height/2.0);
        var right = w.CreateBody(rightBd);
    },

    _createBox: function (x, y, width, height, fixed) {
        
        // adds a body box to the physical world
        if (typeof(fixed) == 'undefined') fixed = true;
        var boxSd = new b2BoxDef();
        if (!fixed) boxSd.density = 1.0;
        boxSd.extents.Set(width, height);
        var boxBd = new b2BodyDef();
        boxBd.AddShape(boxSd);
        boxBd.position.Set(x,y);
        return this._world.CreateBody(boxBd);
    },
    
    _createBall: function (x, y, radius) {
    	var ballSd = new b2CircleDef();
    	ballSd.density = 1.0;
    	ballSd.radius = radius;
    	ballSd.restitution = 0.2;
    	ballSd.friction = 0.1;
    	var ballBd = new b2BodyDef();
    	ballBd.AddShape(ballSd);
    	ballBd.position.Set(x,y);
    	return this._world.CreateBody(ballBd);
    },
    
    _updateWorld: function() {

        var node = this._world.GetBodyList();
        while (node) {
            var b = node;
            node = node.GetNext();
            
            // update all bodies linked to a DOM element
            var objId = b.GetUserData();
            if (!objId) continue;
            
            // destroy bodies where the DOM element is gone
            var actor = this._objects.get(objId);
            if (!actor || !actor.elem || actor.elem.parentNode == null ) {
                this._world.DestroyBody(b);
                this._objects.unset(objId);
                continue;
            }
            
            // update dom to reflect world
            if (!b.IsSleeping())
                this._updateElement(b, actor.elem);
        }
    },
    
    _updateElement: function(body, div) {
        
        var rotRad = body.GetRotation();
        var shape = body.GetShapeList(); // we only deal with single-shape bodies
        var rot = rotRad * (180.0/Math.PI);
        // var dim = div.getDimensions();

        div.style['top'] = (this.w2v(shape.m_position.y) - div.offsetHeight/2.0) +"px";
        div.style['left'] = (this.w2v(shape.m_position.x) - div.offsetWidth/2.0) +"px";
        div.style[this._transform] = 'rotate(' + (rot % 360) + 'deg)';
    },
    
    _getTransformProperty: function(element) {
        
        // Utility function to determine cross-browser rotation property
        var properties = [
            'transform',
            'WebkitTransform',
            'MozTransform',
            'msTransform',
            'OTransform'
        ];
        var p;
        while (p = properties.shift()) {
            if (typeof element.style[p] != 'undefined') {
                return p;
            }
        }
        return false;
    },
    
    v2w: function(viewUnit) {
        // convert view to world units
        return (viewUnit / this._scaleFactor);
    },
    w2v: function(worldUnit) {
        // convert world to view units
        return (worldUnit * this._scaleFactor);        
    }
    
});