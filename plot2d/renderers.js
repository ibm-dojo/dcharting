dojo.provide("dojox.charting.plot2d.renderers");

dojo.require("dojo.colors");
dojo.require("dojox.gfx");
dojo.require("dojox.lang.functional");
dojo.require("dojox.charting.scaler");

(function(){
	var dc = dojox.charting, df = dojox.lang.functional;
	
	var augmentColor = function(target, color){
		var t = new dojo.Color(target),
			c = new dojo.Color(color);
		c.a = t.a;
		return c;
	};
	
	var augmentStroke = function(stroke, color){
		var s = dojox.gfx.makeParameters(dojox.gfx.defaultStroke, stroke);
		s.color = augmentColor(s.color, color);
		return s;
	};

	var augmentFill = function(fill, color){
		var fc, c = new dojo.Color(color);
		if(typeof fill == "string" || fill instanceof dojo.Color){
			return augmentColor(fill, color);
		}
		return fill;
	};

	dojo.declare("dojox.charting.plot2d.renderers.Base", null, {
		constructor: function(kwArgs, chart){
			this.chart = chart;
		},
		clear: function(){
			return this;
		},
		setAxis: function(axis){
			return this;
		},
		addSeries: function(run){
			return this;
		},
		calculateAxes: function(dim){
			return this;
		},
		render: function(dim, offsets){
			return this;
		}
	});

	dojo.declare("dojox.charting.plot2d.renderers.Default", dojox.charting.plot2d.renderers.Base, {
		constructor: function(kwArgs, chart){
			this.opt = dojo.mixin({
				hAxis: "x",
				vAxis: "y",
				style: "lines",
				lines:   true,
				areas:   false,
				markers: false,
				shadows: null
			}, kwArgs);
			this.series = [];
			this.hAxis = this.opt.hAxis;
			this.vAxis = this.opt.vAxis;
		},
		clear: function(){
			this.series = [];
			this._hAxis = null;
			this._vAxis = null;
			return this;
		},
		setAxis: function(axis){
			if(axis){
				this[axis.vertical ? "_vAxis" : "_hAxis"] = axis;
			}
			return this;
		},
		addSeries: function(run){
			this.series.push(run);
			return this;
		},
		
		_calc: function(dim, stats){
			// calculate scaler
			if(this._hAxis){
				if(!this._hAxis.initialized()){
					this._hAxis.calculate(stats.hmin, stats.hmax, dim.width);
				}
				this._hScaler = this._hAxis.getScaler();
			}else{
				this._hScaler = {lowerBound: stats.hmin, upperBound: stats.hmax, 
					scale: dim.width / (stats.hmax - stats.hmin)};
			}
			if(this._vAxis){
				if(!this._vAxis.initialized()){
					this._vAxis.calculate(stats.vmin, stats.vmax, dim.height);
				}
				this._vScaler = this._vAxis.getScaler();
			}else{
				this._vScaler = {lowerBound: stats.vmin, upperBound: stats.vmax, 
					scale: dim.height / (stats.vmax - stats.vmin)};
			}
		},
		
		calculateAxes: function(dim){
			// collect statistics
			var stats = {hmin: 1, hmax: 0, vmin: Number.POSITIVE_INFINITY, vmax: Number.NEGATIVE_INFINITY};
			for(var i = 0; i < this.series.length; ++i){
				var run = this.series[i];
				stats.hmax = Math.max(stats.hmax, run.data.length);
				var haveMin = ("min" in run), haveMax = ("max" in run);
				if(haveMin){
					stats.vmin = Math.min(stats.vmin, run.min);
					if(haveMax){
						stats.vmax = Math.max(stats.vmax, run.max);
					}else{
						dojo.forEach(run.data, function(val){
							if(isNaN(val)){ val = 0; }
							stats.vmax = Math.max(stats.vmax, val);
						});
					}
				}else{
					if(haveMax){
						stats.vmax = Math.max(stats.vmax, run.max);
						dojo.forEach(run.data, function(val){
							if(isNaN(val)){ val = 0; }
							stats.vmin = Math.min(stats.vmin, val);
						});
					}else{
						dojo.forEach(run.data, function(val){
							if(isNaN(val)){ val = 0; }
							stats.vmin = Math.min(stats.vmin, val);
							stats.vmax = Math.max(stats.vmax, val);
						});
					}
				}
			}
			this._calc(dim, stats);
			return this;
		},
		render: function(dim, offsets){
			for(var i = this.series.length - 1; i >= 0; --i){
				var run = this.series[i],
					lpoly = dojo.map(run.data, function(v, i){
						return {
							x: this._hScaler.scale * (i + 1 - this._hScaler.lowerBound) + offsets.l,
							y: dim.height - offsets.b - this._vScaler.scale * (v - this._vScaler.lowerBound)
						};
					}, this);
				var t = this.chart.theme, s = this.chart.surface, color, stroke, marker;
				if(!run.fill || !run.stroke){
					// need autogenerated color
					color = new dojo.Color(t.next("color"));
				}
				if(this.opt.areas){
					var apoly = dojo.clone(lpoly);
					apoly.push({x: lpoly[lpoly.length - 1].x, y: dim.height - offsets.b});
					apoly.push({x: lpoly[0].x, y: dim.height - offsets.b});
					apoly.push(lpoly[0]);
					var f, fill = run.fill ? run.fill : (f = dojo.clone(color), f.a = 0.3, f);
					s.createPolyline(apoly).setFill(fill);
				}
				if(this.opt.lines || this.opt.markers){
					// need a stroke
					stroke = run.stroke ? run.stroke : augmentStroke(t.series.stroke, color);
				}
				if(this.opt.markers){
					// need a marker
					marker = run.marker ? run.marker : t.next("marker");
				}
				if(this.opt.shadows && stroke){
					var sh = this.opt.shadows, shadowColor = new dojo.Color([0, 0, 0, 0.3]),
						shadowStroke = dojo.clone(stroke),
						spoly = dojo.map(lpoly, function(c){
							return {x: c.x + sh.dx, y: c.y + sh.dy};
						});
					shadowStroke.color = shadowColor;
					shadowStroke.width += sh.dw ? sh.dw : 0;
					if(this.opt.lines){
						s.createPolyline(spoly).setStroke(shadowStroke);
					}
					if(this.opt.markers){
						dojo.forEach(spoly, function(c){
							s.createPath("M" + c.x + " " + c.y + " " + marker).setStroke(shadowStroke).setFill(shadowColor);
						});
					}
				}
				if(this.opt.lines){
					s.createPolyline(lpoly).setStroke(stroke);
				}
				if(this.opt.markers){
					dojo.forEach(lpoly, function(c){
						s.createPath("M" + c.x + " " + c.y + " " + marker).setStroke(stroke).setFill(stroke.color);
					});
				}
			}
			return this;
		}
	});

	dojo.declare("dojox.charting.plot2d.renderers.Lines", dojox.charting.plot2d.renderers.Default, {
		constructor: function(kwArgs, chart){
			this.opt.lines = true;
		}
	});

	dojo.declare("dojox.charting.plot2d.renderers.Areas", dojox.charting.plot2d.renderers.Default, {
		constructor: function(kwArgs, chart){
			this.opt.lines = true;
			this.opt.areas = true;
		}
	});

	dojo.declare("dojox.charting.plot2d.renderers.Markers", dojox.charting.plot2d.renderers.Default, {
		constructor: function(kwArgs, chart){
			this.opt.markers = true;
		}
	});

	dojo.declare("dojox.charting.plot2d.renderers.MarkersOnly", dojox.charting.plot2d.renderers.Default, {
		constructor: function(kwArgs, chart){
			this.opt.lines   = false;
			this.opt.markers = true;
		}
	});
})();
