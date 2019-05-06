(function ($) {
    var el = null;

    var plugin = {
        defaults: {
            debug: false,
            grid: false
        },

        options: {
            x: 0,
            y: 0,
            blockdatas: null,
            realmaskline: null,
            ispan: false,
            width: 2000,
            height: 1500,
            maskwidth: 2200,
            maskheight: 1500
        },

        stage: null,
        lineLayer: null,
        realLayer: null,
        panzoom: null,

        identity: function (type) {
            if (type === undefined) type = "name";

            switch (type.toLowerCase()) {
                case "version": return "2.0.0"; break;
                default: return "subwayMap Plugin"; break;
            }
        },

        _debug: function (s) {
            if (this.options.debug)
                this._log(s);
        },

        _log: function () {
            if (window.console && window.console.log)
                window.console.log('[subwayMap] ' + Array.prototype.join.call(arguments, ' '));
        },

        _init: function (sel) {
            el = sel;

            //this.options.width = 2000;
            //this.options.height = 1500;
            this.options.width = window.innerWidth;
            this.options.height = window.innerHeight;

            this.options.maskwidth = 2500;
            this.options.maskheight = 1500;

            this.stage = SVG('subway_map').size(this._parseNumber(this.options.width), this._parseNumber(this.options.height));
            $("svg").attr("id", "subwaymap_svg");

            var g = this.stage.group();
            g.addClass('svg-pan-zoom_viewport');

            this.lineLayer = g.group();
            this.realLayer = g.group();
            this.realLayer.hide();

            var pthis = this;
            setTimeout(function () { pthis._getRealDatas(pthis); }, 1000);
        },

        _parseNumber: function (val) {
            return parseFloat(val);
        },

        _offsetNumber: function (val) {
            return val;
        },

        //SingleLine
        _redraw: function () {
            this._drawTags();
            this._drawLines();
            this._resetDraw();
        },

        _resetDraw: function () {
            var pthis = this;

            var svgopts = {
                viewportSelector: '.svg-pan-zoom_viewport',
                zoomEnabled: true,
                panEnabled: true,
                controlIconsEnabled: false,
                fit: false,
                center: false,
                contain: false,
                minZoom: 0.3,
                maxZoom: 5,
                onUpdatedCTM: function () {
                    pthis.options.forceHideStationInfo();
                },
                onPan: function () {
                    if (SVG.select('.mask').length() > 0)
                        pthis.options.ispan = true;
                },
                customEventsHandler: {
                    haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
                    init: function (svgopts) {
                        var instance = svgopts.instance,
                            initialScale = 1,
                            pannedX = 0,
                            pannedY = 0;
                        // Init Hammer
                        // Listen only for pointer and touch events
                        this.hammer = Hammer(svgopts.svgElement, {
                            inputClass: Hammer.SUPPORT_POINTER_EVENTS ? Hammer.PointerEventInput : Hammer.TouchInput
                        }),

                            // Enable pinch
                            this.hammer.get('pinch').set({ enable: true }),

                            // Handle double tap
                            this.hammer.on('doubletap', function (ev) {
                                //instance.zoomIn();
                            }),

                            // Handle pan
                            this.hammer.on('panstart panmove', function (ev) {
                                // On pan start reset panned variables
                                if (ev.type === 'panstart') {
                                    pannedX = 0
                                    pannedY = 0
                                }

                                // Pan only the difference
                                instance.panBy({ x: ev.deltaX - pannedX, y: ev.deltaY - pannedY });
                                pannedX = ev.deltaX;
                                pannedY = ev.deltaY;
                            }),

                            // Handle pinch
                            this.hammer.on('pinchstart pinchmove', function (ev) {
                                // On pinch start remember initial zoom
                                if (ev.type === 'pinchstart') {
                                    initialScale = instance.getZoom();
                                    instance.zoom(initialScale * ev.scale);
                                }

                                instance.zoom(initialScale * ev.scale);
                            }),

                            // Prevent moving the page on some devices when panning over SVG
                            svgopts.svgElement.addEventListener('touchmove', function (e) { e.preventDefault(); });
                    },
                    destroy: function () {
                        this.hammer.destroy();
                    }
                }
            };

            this.panzoom = svgPanZoom('#subwaymap_svg', svgopts);
        },

        _initpos: function () {
            this.panzoom.pan({ x: -950 + window.innerWidth / 2, y: -770 + window.innerHeight / 2 });
        },

        _drawTags: function () {
            var tamimg = this.stage.image($("#tam_icon").attr("src"));
            tamimg.size(this._parseNumber(85), this._parseNumber(26)).move(this._offsetNumber(this._parseNumber(908)), this._offsetNumber(this._parseNumber(758)));

            var zhizuo = this.stage.image($("#zhizuo_icon").attr("src"));
            zhizuo.size(this._parseNumber(262), this._parseNumber(143)).move(this._offsetNumber(this._parseNumber(1460)), this._offsetNumber(this._parseNumber(1056)));

            var northimg = this.stage.image($("#north_icon").attr("src"));
            northimg.size(this._parseNumber(50), this._parseNumber(100)).move(this._offsetNumber(this._parseNumber(1710)), this._offsetNumber(this._parseNumber(250)));

            var airportimg = this.stage.image($("#airport_icon").attr("src"));
            airportimg.size(this._parseNumber(40), this._parseNumber(40)).move(this._offsetNumber(this._parseNumber(1510)), this._offsetNumber(this._parseNumber(355)));

            this.lineLayer.add(tamimg);
            this.lineLayer.add(zhizuo);
            this.lineLayer.add(northimg);
            this.lineLayer.add(airportimg);
        },

        _drawLines: function () {
            var pthis = this;
            $(this.options.xml).find("l").each(function (i) {
                pthis._drawSubwayLine($(this), 0, $(this).find('p').length - 1, true, true, false, false);
            });
        },

        _drawSubwayLine: function (linexml, startdn, enddn, dir, isline, ismask, isreal) {
            if (dir) {
                if (linexml.attr("loop") == "true" && startdn > enddn) {
                    enddn += linexml.find("p").length;
                }
            }
            else {
                if (linexml.attr("loop") == "true" && startdn < enddn) {
                    startdn += linexml.find("p").length;
                }

                var t = startdn;
                startdn = enddn;
                enddn = t;
                //dir = true;
            }

            if (isline) {
                var lns = linexml.attr("slb").split(",");
                var lps = linexml.attr("lp").split(";");
                for (var p = 0; p < lns.length; p++) {
                    var name = "";
                    if (lns[p].charAt(0) <= 57)
                        name = "地铁" + lns[p] + "号线";
                    else {
                        if (lns[p] == "机场")
                            name = lns[p] + "线";
                        else
                            name = "地铁" + lns[p] + "线";
                    }
                    this._drawLineName(name, lps[p], linexml.attr("lc").replace("0x", "#"), ismask);
                }
            }

            for (var i = startdn; i < enddn; i++) {
                this._drawStations(linexml, i, i + 1, dir, isline, ismask, isreal);
            }
            if (isline && linexml.attr("loop") == "true")
                this._drawStations(linexml, enddn, startdn, dir, isline, ismask, isreal);

            if (isreal) {
                var arrows = SVG.select('.arrow');
                for (var i = arrows.length() - 1; i >= 0; i--)
                    arrows.get(i).front();
            }

            for (var i = startdn; i < enddn; i++)
                this._drawStation(linexml, i, ismask);
            /*
            if (isline && linexml.attr("loop") == "true")  
                this._drawStation(linexml, enddn, ismask);
            else
                this._drawStation(linexml, enddn, ismask);
            */
            this._drawStation(linexml, enddn, ismask);
        },

        _drawLineName: function (name, rc, lc, ismask) {
            var rs = rc.split(",");

            var rect = this.stage.rect(this._parseNumber(rs[2]), this._parseNumber(rs[3]));
            rect.fill(lc).move(this._offsetNumber(this._parseNumber(rs[0])), this._offsetNumber(this._parseNumber(rs[1])));
            if (ismask)
                rect.addClass('mask');

            this.lineLayer.add(rect);

            var text = this.stage.text(name);
            text.move(this._offsetNumber(this._parseNumber(rs[0])) + this._parseNumber(rs[2]) / 2, this._offsetNumber(this._parseNumber(rs[1]))).font({ fill: 'white', family: '黑体', size: 12 });
            text.attr({ "text-anchor": "middle" });
            text.y(this._offsetNumber(this._parseNumber(rs[1])) + (this._parseNumber(rs[3]) - text.bbox().height) / 2);
            if (ismask)
                text.addClass('mask');

            this.lineLayer.add(text);
        },

        _drawStations: function (linexml, startdn, enddn, dir, isline, ismask, isreal) {
            var ps = linexml.find("p");

            var rsp = null;
            var rep = null;
            if (isreal) {
                var n = startdn % ps.length;
                rsp = ps.eq(n);
                while (rsp.attr("st") == "false")
                    rsp = ps.eq(--n);

                n = enddn % ps.length;
                rep = ps.eq(n);
                while (rep.attr("st") == "false")
                    rep = ps.eq(++n);
            }

            this._drawStationLine(ps.eq(startdn % ps.length), ps.eq(enddn % ps.length), rsp, rep, linexml.attr("lc").replace("0x", "#"), dir, isline, ismask, isreal);
        },

        _drawStation: function (linexml, dn, ismask) {
            var ps = linexml.find("p");
            var ai = dn % ps.length;
            var cp = ps.eq(ai);
            var lc = "#000000";

            if (cp.attr("st") == "true") {
                if (!(this._parseNumber(cp.attr("rx")) == 0 && this._parseNumber(cp.attr("ry")) == 0)) {
                    if (cp.attr("iu") == "true")
                        lc = "#000000";
                    else //暂缓开通 
                        lc = "#cccccc";

                    var text = this.stage.text(cp.attr("lb"));
                    text.move(this._offsetNumber(this._parseNumber(cp.attr("x"))) + this._parseNumber(cp.attr("rx")), this._offsetNumber(this._parseNumber(cp.attr("y"))) + this._parseNumber(cp.attr("ry")) + 5).font({ fill: lc, family: '黑体', size: 12 });
                    if (ismask)
                        text.addClass('mask');

                    this.lineLayer.add(text);

                    if (cp.attr("iu") == "false") {
                        text = this.stage.text("(暂缓开通)");
                        text.move(this._offsetNumber(this._parseNumber(cp.attr("x"))) + this._parseNumber(cp.attr("rx")), this._offsetNumber(this._parseNumber(cp.attr("y"))) + this._parseNumber(cp.attr("ry")) + this._parseNumber(18)).font({ fill: lc, family: '黑体', size: 12 });
                        if (ismask)
                            text.addClass('mask');

                        this.lineLayer.add(text);
                    }
                }

                var isex = cp.attr("ex");
                if (isex == "true") {
                    var img = this.stage.image($("#turn_icon").attr("src"));
                    img.size(this._parseNumber(14), this._parseNumber(14)).move(this._offsetNumber(this._parseNumber(cp.attr("x") - 7)), this._offsetNumber(this._parseNumber(cp.attr("y") - 7 + (cp.attr("dy") != undefined ? this._parseNumber(cp.attr("dy")) : 0))));
                    img.attr({ "sdata": cp.attr("lb") });
                    if (ismask)
                        img.addClass('mask');

                    if (cp.attr("iu") == "true") {
                        var pthis = this;
                        img.mouseover(function (env) {
                            pthis.options.showStationInfo(this.attr("sdata"), null, null, this.rbox().cx, this.rbox().cy, pthis.panzoom.getZoom());
                        });

                        img.mouseout(function (env) {
                            pthis.options.hideStationInfo();
                        });

                        if (ismask == false) {
                            img.click(function () {
                                pthis.options.selectStation(this.attr('sdata'), this.rbox().cx, this.rbox().cy);
                            });
                        }
                    }

                    this.lineLayer.add(img);
                } else {
                    var circle = this.stage.circle(this._parseNumber(8));
                    circle.fill('white').stroke({ color: 'black', width: this._parseNumber(1) }).move(this._offsetNumber(this._parseNumber(cp.attr("x")) - 4), this._offsetNumber(this._parseNumber(cp.attr("y")) - 4));
                    circle.attr({ "sdata": cp.attr("lb") });
                    if (ismask)
                        circle.addClass('mask');

                    if (cp.attr("iu") == "true") {
                        var pthis = this;
                        circle.mouseover(function (env) {
                            pthis.options.showStationInfo(this.attr("sdata"), null, null, this.rbox().cx, this.rbox().cy, pthis.panzoom.getZoom());
                        });

                        circle.mouseout(function (env) {
                            pthis.options.hideStationInfo();
                        });

                        if (ismask == false) {
                            circle.click(function () {
                                pthis.options.selectStation(this.attr('sdata'), this.rbox().cx, this.rbox().cy);
                            });
                        }
                    }

                    this.lineLayer.add(circle);
                }
            }
        },

        _drawStationLine: function (sp, ep, rsp, rep, lc, dir, isline, ismask, isreal) {
            var _lc = '';
            if (isreal) {
                var colors = this._getRealColors(rsp, rep);
                if (dir == true) {
                    lc = colors["ulc"];
                    _lc = colors["_ulc"];
                } else {
                    lc = colors["dlc"];
                    _lc = colors["_dlc"];
                }
            }

            if (sp.attr("arc") != undefined) {
                var aps = sp.attr("arc").split(":");

                var line = this.stage.path('M' + this._offsetNumber(this._parseNumber(sp.attr("x"))) + ' ' + this._offsetNumber(this._parseNumber(sp.attr("y"))) + ' Q' + this._offsetNumber(this._parseNumber(aps[0])) + ' ' + this._offsetNumber(this._parseNumber(aps[1])) + ' ' + this._offsetNumber(this._parseNumber(ep.attr("x"))) + ' ' + this._offsetNumber(this._parseNumber(ep.attr("y"))));
                line.fill('none').stroke({ color: lc, width: this._parseNumber(5), linecap: 'round', linejoin: 'round' });

                if (ismask)
                    line.addClass('mask');

                this.lineLayer.add(line);
            } else {
                var line = this.stage.line(this._offsetNumber(this._parseNumber(sp.attr("x"))), this._offsetNumber(this._parseNumber(sp.attr("y"))), this._offsetNumber(this._parseNumber(ep.attr("x"))), this._offsetNumber(this._parseNumber(ep.attr("y"))));
                line.stroke({ color: lc, width: this._parseNumber(5), linecap: 'round', linejoin: 'round' });

                if (ismask)
                    line.addClass('mask');

                this.lineLayer.add(line);
            }

            //if (isreal) {
            if (isreal && _lc != 'green') {
                if (sp.attr('st') == 'true') {
                    var img = null;
                    if (sp.attr('ai') != undefined) {
                        if (sp.attr('ai') == '2')
                            img = this.stage.image($("#arrow2_icon").attr("src"));
                    } else {
                        img = this.stage.image($("#arrow_icon").attr("src"));
                    }
                    img.size(this._parseNumber(14), this._parseNumber(5));
                    img.center(this._offsetNumber((sp.attr("ax") != undefined ? (this._parseNumber(sp.attr("ax"))) : 0)), this._offsetNumber((sp.attr("ay") != undefined ? this._parseNumber(sp.attr("ay")) : 0)));
                    if (sp.attr('aa') != undefined)
                        img.rotate(this._parseNumber(sp.attr('aa')) + (dir == true ? 0 : 180));

                    img.addClass('arrow');
                    if (ismask)
                        img.addClass('mask');

                    this.lineLayer.add(img);
                }
            }
        },

        _mapMask: function (exresult) {
            if ((typeof exresult) == "string")
                exresult = eval("(" + exresult + ")");

            if (exresult.length > 0) {
                var rect = this.stage.rect(this._parseNumber(this.options.maskwidth), this._parseNumber(this.options.maskheight));
                rect.fill('white').opacity(0.85).move(-250, 0);
                rect.addClass('mask');

                var pthis = this;
                rect.click(function () {
                    if (pthis.options.ispan == false)
                        pthis.options.clearSearch();
                    pthis.options.ispan = false;
                });

                this.lineLayer.add(rect);

                for (var i = 0; i < exresult.length; i++) {
                    for (var p = 1; p < exresult[i].length; p++) {
                        var dir = true;
                        if (parseInt(exresult[i][p - 1][3]) != 0) {
                            if (parseInt(exresult[i][p - 1][3]) > parseInt(exresult[i][p][3])) {
                                if (parseInt(exresult[i][p - 1][3]) - parseInt(exresult[i][p][3]) <= 4) //可能有占位点
                                    dir = false;
                            }
                        }
                        else {
                            if (parseInt(exresult[i][p][3]) > 3) //可能有占位点
                                dir = false;
                        }
                        this._showLight(exresult[i][0][0], parseInt(exresult[i][p - 1][3]), parseInt(exresult[i][p][3]), dir, false, false);
                    }
                }

                var ls = $(this.options.xml).find("l");
                var sps = ls.eq(this._getLineIndex(exresult[0][0][0])).find("p");
                var eps = ls.eq(this._getLineIndex(exresult[exresult.length - 1][exresult[exresult.length - 1].length - 1][0])).find("p");

                var sp = sps.eq(parseInt(exresult[0][0][3]));
                var ep = eps.eq(parseInt(exresult[exresult.length - 1][exresult[exresult.length - 1].length - 1][3]));

                var startimg = this.stage.image($("#start_icon").attr("src"));
                startimg.size(this._parseNumber(20), this._parseNumber(31)).move(this._offsetNumber(this._parseNumber(sp.attr("x") - 10)), this._offsetNumber(this._parseNumber(sp.attr("y") - 30)));
                startimg.addClass('mask');

                var endimg = this.stage.image($("#end_icon").attr("src"));
                endimg.size(this._parseNumber(20), this._parseNumber(31)).move(this._offsetNumber(this._parseNumber(ep.attr("x") - 10)), this._offsetNumber(this._parseNumber(ep.attr("y") - 30)));
                endimg.addClass('mask');

                this.lineLayer.add(startimg);
                this.lineLayer.add(endimg);

                var pw = Math.abs(this._parseNumber(sp.attr("x")) - this._parseNumber(ep.attr("x")));
                var ph = Math.abs(this._parseNumber(sp.attr("y")) - this._parseNumber(ep.attr("y")));
                var ps = Math.min(window.innerWidth / pw, window.innerHeight / ph);
                if (ps - 0.4 <= 0.3)
                    this.panzoom.zoom(0.3);
                else if (ps - 0.4 < 1)
                    this.panzoom.zoom(ps - 0.4);
                else
                    this.panzoom.zoom(1);

                var pan = this.panzoom.getPan();
                var zoom = this.panzoom.getZoom();
                this._animatePan({ sx: pan.x, sy: pan.y, tx: (-(this._parseNumber(sp.attr("x")) + this._parseNumber(ep.attr("x"))) / 2 * zoom) + window.innerWidth / 2, ty: (-(this._parseNumber(sp.attr("y")) + this._parseNumber(ep.attr("y"))) / 2 * zoom) + window.innerHeight / 2 });
            }
        },

        _mapRealMask: function (exresult) {
            if ((typeof exresult) == "string")
                exresult = eval("(" + exresult + ")");

            if (exresult.length > 0) {
                var rect = this.stage.rect(this._parseNumber(this.options.maskwidth), this._parseNumber(this.options.maskheight));
                rect.fill('white').opacity(0.85).move(-250, 0);
                rect.addClass('mask');

                var pthis = this;
                rect.click(function () {
                    if (pthis.options.ispan == false)
                        pthis.options.clearSearch();
                    pthis.options.ispan = false;
                });

                this.lineLayer.add(rect);

                for (var i = 0; i < exresult.length; i++) {
                    for (var p = 1; p < exresult[i].length; p++) {
                        var dir = true;
                        if (parseInt(exresult[i][p - 1][3]) != 0) {
                            if (parseInt(exresult[i][p - 1][3]) > parseInt(exresult[i][p][3])) {
                                if (parseInt(exresult[i][p - 1][3]) - parseInt(exresult[i][p][3]) < 4) //可能有占位点
                                    dir = false;
                            }
                        }
                        else {
                            if (parseInt(exresult[i][p][3]) > 3) //可能有占位点
                                dir = false;
                        }
                        this._showLight(exresult[i][0][0], parseInt(exresult[i][p - 1][3]), parseInt(exresult[i][p][3]), dir, false, true);
                    }
                }

                var ls = $(this.options.xml).find("l");
                var sps = ls.eq(this._getLineIndex(exresult[0][0][0])).find("p");
                var eps = ls.eq(this._getLineIndex(exresult[exresult.length - 1][exresult[exresult.length - 1].length - 1][0])).find("p");

                var sp = sps.eq(parseInt(exresult[0][0][3]));
                var ep = eps.eq(parseInt(exresult[exresult.length - 1][exresult[exresult.length - 1].length - 1][3]));

                var startimg = this.stage.image($("#start_icon").attr("src"));
                startimg.size(this._parseNumber(20), this._parseNumber(31)).move(this._offsetNumber(this._parseNumber(sp.attr("x") - 10)), this._offsetNumber(this._parseNumber(sp.attr("y") - 30)));
                startimg.addClass('mask');

                var endimg = this.stage.image($("#end_icon").attr("src"));
                endimg.size(this._parseNumber(20), this._parseNumber(31)).move(this._offsetNumber(this._parseNumber(ep.attr("x") - 10)), this._offsetNumber(this._parseNumber(ep.attr("y") - 30)));
                endimg.addClass('mask');

                this.lineLayer.add(startimg);
                this.lineLayer.add(endimg);

                //srlx = (this._offsetNumber(this._parseNumber(sp.attr("x")-10))+this._offsetNumber(this._parseNumber(ep.attr("x")-10)))/2/ratio-$(window).width()/2;
                //srly = (this._offsetNumber(this._parseNumber(sp.attr("y")-34))+this._offsetNumber(this._parseNumber(ep.attr("y")-34)))/2/ratio-$(window).height()/3;
            }
        },

        _removeMapMask: function () {
            var nodes = SVG.select(".mask");
            for (var i = nodes.length() - 1; i >= 0; i--)
                nodes.get(i).remove();

            nodes.clear();
        },

        _showLight: function (linenub, startn, endn, dir, isline, isreal) {
            var ls = $(this.options.xml).find("l");
            var line = ls.eq(this._getLineIndex(linenub));
            this._drawSubwayLine(line, startn, endn, dir, isline, true, isreal);
        },

        _highlightLine: function (line) {
            if (this.realLayer.visible())
                this._removeMapMask();
            else
                this.options.clearSearch();

            var startn = 0;
            var endn = 0;
            var lineid = 0;
            var ls = $(this.options.xml).find("l");
            for (var l = 0; l < ls.length; l++) {
                if (line == ls.eq(l).attr('lb')) {
                    endn = ls.eq(l).find("p").length - 1;
                    lineid = ls.eq(l).attr("lcode");
                    //move to line center
                    var pan = this.panzoom.getPan();
                    var zoom = this.panzoom.getZoom();
                    this._animatePan({ sx: pan.x, sy: pan.y, tx: (-this._parseNumber(ls.eq(l).attr("lbx")) * zoom) + window.innerWidth / 2, ty: (-this._parseNumber(ls.eq(l).attr("lby")) * zoom) + window.innerHeight / 2 });

                    break;
                }
            }

            var rect = this.stage.rect(this._parseNumber(this.options.maskwidth), this._parseNumber(this.options.maskheight));
            rect.fill('white').opacity(0.85).move(-250, 0);
            rect.addClass('mask');
            var pthis = this;
            if (this.realLayer.visible()) {
                rect.click(function () {
                    if (pthis.options.ispan == false) {
                        pthis.options.realmaskline = null;
                        pthis._refreshBlock();
                        pthis._removeMapMask();
                    }
                    pthis.options.ispan = false;
                });
                this.realLayer.add(rect);
                this._showRealLight(lineid, startn, endn, true, true);
            } else {
                rect.click(function () {
                    if (pthis.options.ispan == false)
                        pthis.options.clearSearch();
                    pthis.options.ispan = false;
                });
                this.lineLayer.add(rect);
                this._showLight(lineid, startn, endn, true, true, false);
            }
        },

        _getLineIndex: function (linenub) {
            var ls = $(this.options.xml).find("l");
            for (var l = 0; l < ls.length; l++) {
                if (parseInt(ls.eq(l).attr('lcode')) == parseInt(linenub))
                    return l;
            }
        },

        _animatePan: function (amount) { // {sx: 1, sy: 2, tx: 3, ty: 4}
            var animationTime = 300; // ms
            var animationStepTime = 15; // one frame per 30 ms
            var animationSteps = animationTime / animationStepTime;
            var animationStep = 0;
            var intervalID = null;
            var stepX = (amount.tx - amount.sx) / animationSteps;
            var stepY = (amount.ty - amount.sy) / animationSteps;

            var pthis = this;
            intervalID = setInterval(function () {
                if (animationStep++ < animationSteps) {
                    pthis.panzoom.panBy({ x: stepX, y: stepY });
                } else {
                    clearInterval(intervalID);
                }
            }, animationStepTime);
        },

        _animateZoom: function (zoom) {
            var animationTime = 50; // ms
            var animationStepTime = 15; // one frame per 30 ms
            var animationSteps = animationTime / animationStepTime;
            var animationStep = 0;
            var intervalID = null;
            var step = zoom / animationSteps;

            var svg = document.querySelector("#subwaymap_svg");
            var inversedScreenCTM = svg.getScreenCTM().inverse();
            var point = svg.createSVGPoint();
            point.x = window.innerWidth / 2;
            point.y = window.innerHeight / 2;
            var relativePoint = point.matrixTransform(inversedScreenCTM);

            var pthis = this;
            intervalID = setInterval(function () {
                if (animationStep++ < animationSteps) {
                    pthis.panzoom.zoomAtPointBy(1 + step, point);
                } else {
                    clearInterval(intervalID);
                }
            }, animationStepTime);
        },

        _setFromTo: function (ft, station) {
            var img = null;
            if (ft == 'from')
                img = this.stage.image($("#start_icon").attr("src"));
            else
                img = this.stage.image($("#end_icon").attr("src"));

            var stations = $(this.options.xml).find("p");
            for (var i = 0; i < stations.length; i++) {
                var s = stations.eq(i);
                if (s.attr("lb") == station) {
                    img.size(this._parseNumber(20), this._parseNumber(31)).move(this._offsetNumber(this._parseNumber(s.attr("x") - 10)), this._offsetNumber(this._parseNumber(s.attr("y") - 30)));
                    img.addClass('mask');
                    this.lineLayer.add(img);

                    break;
                }
            }
        },

        _zoomMap: function (io) {
            var zoom = this.panzoom.getZoom();

            if (io == 'in') {
                this._animateZoom(0.2);
            } else {
                this._animateZoom(-0.2);
            }
        },

        //RealTime
        _refreshRealTime: function () {
            if (this.realLayer.visible()) {
                //this.realLayer.clear();
                //this._drawRealTags();
                //this._drawRealLines();
                this._refreshRealLines();
            }
        },

        _refreshBlock: function () {
            if (this.realLayer.visible()) {
                var nodes = SVG.select(".block");
                for (var i = nodes.length() - 1; i >= 0; i--)
                    nodes.get(i).remove();
                nodes.clear();

                for (var i = 0; i < this.options.blockdatas.length; i++) {
                    var block = this.options.blockdatas[i];

                    var blocked = false;
                    var now = new Date();
                    var bts = block['blocktime'].split("|");
                    for (var b = 0; b < bts.length; b++) {
                        var _bts = bts[b].split("-");

                        var _sts = _bts[0].split(":");
                        var st = new Date();
                        st.setHours(parseInt(_sts[0]));
                        st.setMinutes(parseInt(_sts[1]));
                        st.setSeconds(0);

                        var _ets = _bts[1].split(":");
                        var et = new Date();
                        et.setHours(parseInt(_ets[0]));
                        et.setMinutes(parseInt(_ets[1]));
                        et.setSeconds(0);

                        if (now.getTime() >= st.getTime() && now.getTime() <= et.getTime()) {
                            blocked = true;
                            break;
                        }
                    }

                    if (blocked == false)
                        continue;

                    var station = null;

                    if (this.options.realmaskline == null) {
                        var ls = $(plugin.options.xml).find("l");
                        for (var l = 0; l < ls.length; l++) {
                            var ps = ls.eq(l).find("p");
                            for (var p = 0; p < ps.length; p++) {
                                var acc = $.trim(ps.eq(p).attr("acc"));
                                if (acc == block['acc']) {
                                    station = ps.eq(p);
                                    break;
                                }
                            }
                            if (station != null)
                                break;
                        }
                    } else {
                        var ps = this.options.realmaskline.find("p");
                        for (var p = 0; p < ps.length; p++) {
                            var acc = $.trim(ps.eq(p).attr("acc"));
                            if (acc == block['acc']) {
                                station = ps.eq(p);
                                break;
                            }
                        }
                    }

                    var SaturdaySunday = new Date();
                    if (SaturdaySunday.getDay() == 6) {

                    } else if (SaturdaySunday.getDay() == 0) {

                    } else {
                        if (station != null) {
                            var img = this.stage.image($("#block_icon").attr("src"));

                            img.size(this._parseNumber(10), this._parseNumber(10)).move(this._offsetNumber(this._parseNumber(station.attr("x") - 5)), this._offsetNumber(this._parseNumber(station.attr("y") - 5 + (station.attr("dy") != undefined ? this._parseNumber(station.attr("dy")) : 0))));
                            img.attr({ "sdata": station.attr("lb"), "acc": station.attr("acc"), "block": block['blocktime'] });
                            img.addClass('block');

                            var pthis = this;
                            img.mouseover(function (env) {
                                pthis.options.showStationInfo(this.attr("sdata"), this.attr("acc"), this.attr("block"), this.rbox().cx, this.rbox().cy, pthis.panzoom.getZoom());
                            });

                            img.mouseout(function (env) {
                                pthis.options.hideStationInfo();
                            });

                            this.realLayer.add(img);
                        }
                    }
                }

                var pthis = this;
                setTimeout(function () { pthis._refreshBlock(); }, 60000);
            }
        },

        _drawRealTime: function () {
            this.realLayer.clear();
            this._drawRealTags();
            this._drawRealLines();

            this.lineLayer.hide();
            this.realLayer.show();

            var pthis = this;
            setTimeout(function () { pthis._getRealDatas(pthis); }, 500);
            setTimeout(function () { pthis._getBlockDatas(pthis); }, 1000);
        },

        _hideRealTime: function () {
            this.realLayer.clear();
            this.realLayer.hide();
            this.lineLayer.show();
        },

        _showRealLight: function (linenub, startn, endn, dir, isline) {
            var ls = $(this.options.xml).find("l");
            var line = ls.eq(this._getLineIndex(linenub));
            this._drawRealSubwayLine(line, startn, endn, dir, isline, true);
            var arrows = SVG.select('.arrow');
            for (var i = arrows.length() - 1; i >= 0; i--)
                arrows.get(i).front();
            this._drawRealStaionDot(line, startn, endn, true, true, true);
            this.options.realmaskline = line;
            this._refreshBlock();
        },

        _drawRealTags: function () {
            var tamimg = this.stage.image($("#tam_icon").attr("src"));
            tamimg.size(this._parseNumber(85), this._parseNumber(26)).move(this._offsetNumber(this._parseNumber(908)), this._offsetNumber(this._parseNumber(758)));

            var zhizuo = this.stage.image($("#zhizuo_icon").attr("src"));
            zhizuo.size(this._parseNumber(261), this._parseNumber(143)).move(this._offsetNumber(this._parseNumber(1460)), this._offsetNumber(this._parseNumber(1056)));

            var northimg = this.stage.image($("#north_icon").attr("src"));
            northimg.size(this._parseNumber(50), this._parseNumber(100)).move(this._offsetNumber(this._parseNumber(1710)), this._offsetNumber(this._parseNumber(250)));

            var airportimg = this.stage.image($("#airport_icon").attr("src"));
            airportimg.size(this._parseNumber(40), this._parseNumber(40)).move(this._offsetNumber(this._parseNumber(1510)), this._offsetNumber(this._parseNumber(355)));

            // add the shape to the layer
            this.realLayer.add(tamimg);
            this.realLayer.add(zhizuo);
            this.realLayer.add(northimg);
            this.realLayer.add(airportimg);
        },

        _drawRealLines: function () {
            var pthis = this;
            $(this.options.xml).find("l").each(function (i) {
                pthis._drawRealSubwayLine($(this), 0, $(this).find('p').length - 1, true, true, false);
            });

            var arrows = SVG.select('.arrow');
            for (var i = arrows.length() - 1; i >= 0; i--)
                arrows.get(i).front();

            $(this.options.xml).find("l").each(function (i) {
                pthis._drawRealStaionDot($(this), 0, $(this).find('p').length - 1, true, true, false);
            });
        },

        _drawRealSubwayLine: function (linexml, startdn, enddn, dir, isline, ismask) {
            if (dir) {
                if (linexml.attr("loop") == "true" && startdn > enddn) {
                    enddn += linexml.find("p").length;
                }
            } else {
                if (linexml.attr("loop") == "true" && startdn < enddn) {
                    startdn += linexml.find("p").length;
                }

                var t = startdn;
                startdn = enddn;
                enddn = t;
                dir = true;
            }

            if (isline) {
                var lns = linexml.attr("slb").split(",");
                var lps = linexml.attr("lp").split(";");
                for (var p = 0; p < lns.length; p++) {
                    var name = "";
                    if (lns[p].charAt(0) <= 57)
                        name = "地铁" + lns[p] + "号线";
                    else {
                        if (lns[p] == "机场")
                            name = lns[p] + "线";
                        else
                            name = "地铁" + lns[p] + "线";
                    }
                    this._drawRealLineName(name, lps[p], linexml.attr("lc").replace("0x", "#"), ismask);
                }
            }

            for (var i = startdn; i < enddn; i++)
                this._drawRealStations(linexml, i, i + 1, ismask);

            if (isline && linexml.attr("loop") == "true")
                this._drawRealStations(linexml, enddn, startdn, ismask);
        },

        _drawRealStaionDot: function (linexml, startdn, enddn, dir, isline, ismask) {
            for (var i = startdn; i < enddn; i++)
                this._drawRealStation(linexml, i);
            /*
            if (isline && linexml.attr("loop") == "true")  
                this._drawStation(linexml,enddn);
            else
                this._drawStation(linexml,enddn);
            */
            this._drawRealStation(linexml, enddn, ismask);
        },

        _drawRealLineName: function (name, rc, lc, ismask) {
            var rs = rc.split(",");

            var rect = this.stage.rect(this._parseNumber(rs[2]), this._parseNumber(rs[3]));
            rect.fill(lc).move(this._offsetNumber(this._parseNumber(rs[0])), this._offsetNumber(this._parseNumber(rs[1])));
            if (ismask)
                rect.addClass('mask');

            this.realLayer.add(rect);

            var text = this.stage.text(name);
            text.move(this._offsetNumber(this._parseNumber(rs[0])) + this._parseNumber(rs[2]) / 2, this._offsetNumber(this._parseNumber(rs[1]))).font({ fill: 'white', family: '黑体', size: 12 });
            text.attr({ "text-anchor": "middle" });
            text.y(this._offsetNumber(this._parseNumber(rs[1])) + (this._parseNumber(rs[3]) - text.bbox().height) / 2);
            if (ismask)
                text.addClass('mask');

            this.realLayer.add(text);
        },

        _drawRealStations: function (linexml, startdn, enddn, ismask) {
            var ps = linexml.find("p");
            var rsp = null;
            var rep = null;
            var n = startdn % ps.length;
            rsp = ps.eq(n);
            while (rsp.attr("st") == "false")
                rsp = ps.eq(--n);

            n = enddn % ps.length;
            rep = ps.eq(n);
            while (rep.attr("st") == "false")
                rep = ps.eq(++n);

            this._drawRealStationLine(ps.eq(startdn % ps.length), ps.eq(enddn % ps.length), rsp, rep, ismask);
        },

        _drawRealStation: function (linexml, dn, ismask) {
            var ps = linexml.find("p");
            var ai = dn % ps.length;
            var cp = ps.eq(ai);
            var lc = "#000000";

            var rp = null;
            rp = ps.eq(ai);
            while (rp.attr("st") == "false")
                rp = ps.eq(--ai);

            var colors = this._getRealStationColor(rp);

            if (cp.attr("st") == "true") {
                if (!(this._parseNumber(cp.attr("rx")) == 0 && this._parseNumber(cp.attr("ry")) == 0)) {
                    if (cp.attr("iu") == "true")
                        lc = "#000000";
                    else //暂缓开通
                        lc = "#cccccc";

                    var text = this.stage.text(cp.attr("lb"));
                    text.move(this._offsetNumber(this._parseNumber(cp.attr("x"))) + this._parseNumber(cp.attr("rx")), this._offsetNumber(this._parseNumber(cp.attr("y"))) + this._parseNumber(cp.attr("ry")) + 5).font({ fill: lc, family: '黑体', size: 12 });
                    if (ismask)
                        text.addClass('mask');

                    this.realLayer.add(text);

                    if (cp.attr("iu") == "false") {
                        text = this.stage.text("(暂缓开通)");
                        text.move(this._offsetNumber(this._parseNumber(cp.attr("x"))) + this._parseNumber(cp.attr("rx")), this._offsetNumber(this._parseNumber(cp.attr("y"))) + this._parseNumber(cp.attr("ry")) + this._parseNumber(18)).font({ fill: lc, family: '黑体', size: 12 });
                        if (ismask)
                            text.addClass('mask');

                        this.realLayer.add(text);
                    }
                }

                var isex = cp.attr("ex");

                var circle = this.stage.circle(this._parseNumber(8));
                if (isex == "true")
                    circle.fill(colors['pc']).stroke({ color: colors['pc'], width: this._parseNumber(1) }).move(this._offsetNumber(this._parseNumber(cp.attr("x")) - 4), this._offsetNumber(this._parseNumber(cp.attr("y")) - 4));
                else
                    circle.fill(colors['pc']).stroke({ color: 'black', width: this._parseNumber(1) }).move(this._offsetNumber(this._parseNumber(cp.attr("x")) - 4), this._offsetNumber(this._parseNumber(cp.attr("y")) - 4));
                circle.attr({ "sdata": cp.attr("lb"), "acc": cp.attr("acc") });
                if (ismask)
                    circle.addClass('mask');

                var pthis = this;
                circle.mouseover(function (env) {
                    pthis.options.showStationInfo(this.attr("sdata"), this.attr("acc"), null, this.rbox().cx, this.rbox().cy, pthis.panzoom.getZoom());
                });

                circle.mouseout(function (env) {
                    pthis.options.hideStationInfo();
                });

                /*
                if (ismask == false) {
                    circle.click(function() {
                        pthis.options.selectStation(this.attr('sdata'));
                    });
                }
                */

                this.realLayer.add(circle);

                if (colors["pic"] != "") {
                    var img = this.stage.image($("#pictag_icon").attr("src"));
                    img.size(this._parseNumber(14), this._parseNumber(14)).move(this._offsetNumber(this._parseNumber(cp.attr("x") - 7)), this._offsetNumber(this._parseNumber(cp.attr("y") - 7 + (cp.attr("dy") != undefined ? this._parseNumber(cp.attr("dy")) : 0))));
                    if (ismask)
                        img.addClass('mask');

                    this.realLayer.add(img);
                }

                if (isex == "true") {
                    var img = this.stage.image($("#turnreal_icon").attr("src"));
                    img.size(this._parseNumber(14), this._parseNumber(14)).move(this._offsetNumber(this._parseNumber(cp.attr("x") - 7)), this._offsetNumber(this._parseNumber(cp.attr("y") - 7 + (cp.attr("dy") != undefined ? this._parseNumber(cp.attr("dy")) : 0))));
                    img.attr({ "sdata": cp.attr("lb"), "acc": cp.attr("acc") });
                    if (ismask)
                        img.addClass('mask');

                    var pthis = this;
                    img.mouseover(function (env) {
                        pthis.options.showStationInfo(this.attr("sdata"), this.attr("acc"), null, this.rbox().cx, this.rbox().cy, pthis.panzoom.getZoom());
                    });

                    img.mouseout(function (env) {
                        pthis.options.hideStationInfo();
                    });

                    /*
                    if (ismask == false) {
                        img.click(function() {
                            pthis.options.selectStation(this.attr('sdata'));
                        });
                    }
                    */

                    this.realLayer.add(img);
                }
            }
        },

        _getRealColors: function (rsp, rep) {
            var green = "#78bc89";
            var yellow = "#e3d433";
            var red = "#c62e43";
            var black = "#000000";

            var colors = {
                "_ulc": "green",
                "_dlc": "green",
                "ulc": green,
                "dlc": green
            };

            if (this.options.realdatas != null) {
                var realdatas = this.options.realdatas.r;
                if (rsp.attr('acc') != 0 && rep.attr('acc') != 0) {
                    for (var i = 0; i < realdatas.length; i++) {
                        if (realdatas[i].fs == rsp.attr('acc') && realdatas[i].ts == rep.attr('acc')) {
                            if (realdatas[i].color == "yellow") {
                                colors["ulc"] = yellow;
                                colors["_ulc"] = "yellow";
                            } else if (realdatas[i].color == "red") {
                                colors["ulc"] = red;
                                colors["_ulc"] = "red";
                            } else if (realdatas[i].color == "black") {
                                colors["ulc"] = black;
                                colors["_ulc"] = "black";
                            }
                        }

                        if (realdatas[i].fs == rep.attr('acc') && realdatas[i].ts == rsp.attr('acc')) {
                            if (realdatas[i].color == "yellow") {
                                colors["dlc"] = yellow;
                                colors["_dlc"] = "yellow";
                            } else if (realdatas[i].color == "red") {
                                colors["dlc"] = red;
                                colors["_dlc"] = "red";
                            } else if (realdatas[i].color == "black") {
                                colors["dlc"] = black;
                                colors["_dlc"] = "black";
                            }
                        }
                    }
                }
            }

            return colors;
        },

        _getRealStationColor: function (rp) {
            var green = "#78bc89";
            var yellow = "#e3d433";
            var red = "#c62e43";
            var black = "#000000";

            var colors = {
                "_pc": "green",
                "pc": green,
                "pic": ""
            };

            if (this.options.realdatas != null) {
                var srealdatas = this.options.realdatas.sr;
                for (var i = 0; i < srealdatas.length; i++) {
                    if (srealdatas[i].s == rp.attr('acc')) {
                        if (srealdatas[i].color == "yellow") {
                            colors["pc"] = yellow;
                            colors["_pc"] = "yellow";
                        } else if (srealdatas[i].color == "red") {
                            colors["pc"] = red;
                            colors["_pc"] = "red";
                        } else if (srealdatas[i].color == "black") {
                            colors["pc"] = black;
                            colors["_pc"] = "black";
                        }
                    }
                }

                var prealdatas = this.options.realdatas.p;
                for (var i = 0; i < prealdatas.length; i++) {
                    if (prealdatas[i].s == rp.attr('acc')) {
                        if (prealdatas[i].pic != "") {
                            colors["pic"] = prealdatas[i].pic;
                        }
                    }
                }
            }

            return colors;
        },

        _getRealStationColorByAcc: function (acc) {
            var green = "#78bc89";
            var yellow = "#e3d433";
            var red = "#c62e43";
            var black = "#000000";

            var colors = {
                "_pc": "green",
                "pc": green,
                "pic": ""
            };

            if (this.options.realdatas != null) {
                var srealdatas = this.options.realdatas.sr;
                for (var i = 0; i < srealdatas.length; i++) {
                    if (srealdatas[i].s == acc) {
                        if (srealdatas[i].color == "yellow") {
                            colors["pc"] = yellow;
                            colors["_pc"] = "yellow";
                        } else if (srealdatas[i].color == "red") {
                            colors["pc"] = red;
                            colors["_pc"] = "red";
                        } else if (srealdatas[i].color == "black") {
                            colors["pc"] = black;
                            colors["_pc"] = "black";
                        }
                    }
                }

                var prealdatas = this.options.realdatas.p;
                for (var i = 0; i < prealdatas.length; i++) {
                    if (prealdatas[i].s == acc) {
                        if (prealdatas[i].pic != "") {
                            colors["pic"] = prealdatas[i].pic;
                        }
                    }
                }
            }

            return colors;
        },

        _drawRealStationLine: function (sp, ep, rsp, rep, ismask) {
            var gap = 2;
            var lw = 3;

            var colors = this._getRealColors(rsp, rep);
            var _ulc = colors["_ulc"];
            var _dlc = colors["_dlc"];
            var ulc = colors["ulc"];
            var dlc = colors["dlc"];

            if (sp.attr("arc") != undefined) {
                var aps = sp.attr("arc").split(":");
                var uaps = sp.attr("uoarc").split(":");

                var uline = this.stage.path('M' + this._offsetNumber(this._parseNumber(sp.attr("x")) + this._parseNumber(sp.attr("uox")) * gap) + ' ' + this._offsetNumber(this._parseNumber(sp.attr("y")) + this._parseNumber(sp.attr("uoy")) * gap) + ' Q' + this._offsetNumber(this._parseNumber(aps[0]) + this._parseNumber(uaps[0]) * gap) + ' ' + this._offsetNumber(this._parseNumber(aps[1]) + this._parseNumber(uaps[1]) * gap) + ' ' + this._offsetNumber(this._parseNumber(ep.attr("x")) + this._parseNumber(ep.attr("uox")) * gap) + ' ' + this._offsetNumber(this._parseNumber(ep.attr("y")) + this._parseNumber(ep.attr("uoy")) * gap));
                uline.addClass('u' + rsp.attr('acc') + rep.attr('acc'));
                uline.fill('none').stroke({ color: ulc, width: this._parseNumber(lw), linecap: 'round', linejoin: 'round' });
                uline.attr('sdata', rsp.attr("lb") + ',' + rep.attr("lb") + "," + _ulc);
                if (ismask)
                    uline.addClass('mask');

                var daps = sp.attr("doarc").split(":");
                var dline = this.stage.path('M' + this._offsetNumber(this._parseNumber(sp.attr("x")) + this._parseNumber(sp.attr("dox")) * gap) + ' ' + this._offsetNumber(this._parseNumber(sp.attr("y")) + this._parseNumber(sp.attr("doy")) * gap) + ' Q' + this._offsetNumber(this._parseNumber(aps[0]) + this._parseNumber(daps[0]) * gap) + ' ' + this._offsetNumber(this._parseNumber(aps[1]) + this._parseNumber(daps[1]) * gap) + ' ' + this._offsetNumber(this._parseNumber(ep.attr("x")) + this._parseNumber(ep.attr("dox")) * gap) + ' ' + this._offsetNumber(this._parseNumber(ep.attr("y")) + this._parseNumber(ep.attr("doy")) * gap));
                dline.addClass('d' + rsp.attr('acc') + rep.attr('acc'));
                dline.fill('none').stroke({ color: dlc, width: this._parseNumber(lw), linecap: 'round', linejoin: 'round' });
                dline.attr('sdata', rep.attr("lb") + ',' + rsp.attr("lb") + "," + _dlc);
                if (ismask)
                    dline.addClass('mask');

                var pthis = this;
                uline.mouseover(function (evt) {
                    pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                });
                uline.mouseout(function (evt) {
                    pthis.options.hideLineRealInfo();
                });
                dline.mouseover(function (evt) {
                    pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                });
                dline.mouseout(function (evt) {
                    pthis.options.hideLineRealInfo();
                });

                this.realLayer.add(uline);
                this.realLayer.add(dline);
            } else {
                var uline = this.stage.line(this._offsetNumber(this._parseNumber(sp.attr("x")) + this._parseNumber(sp.attr("uox")) * gap), this._offsetNumber(this._parseNumber(sp.attr("y")) + this._parseNumber(sp.attr("uoy")) * gap), this._offsetNumber(this._parseNumber(ep.attr("x")) + this._parseNumber(ep.attr("uox")) * gap), this._offsetNumber(this._parseNumber(ep.attr("y")) + this._parseNumber(ep.attr("uoy")) * gap));
                uline.addClass('u' + rsp.attr('acc') + rep.attr('acc'));
                uline.stroke({ color: ulc, width: this._parseNumber(lw), linecap: 'round', linejoin: 'round' });
                uline.attr('sdata', rsp.attr("lb") + ',' + rep.attr("lb") + "," + _ulc);
                if (ismask)
                    uline.addClass('mask');

                var dline = this.stage.line(this._offsetNumber(this._parseNumber(sp.attr("x")) + this._parseNumber(sp.attr("dox")) * gap), this._offsetNumber(this._parseNumber(sp.attr("y")) + this._parseNumber(sp.attr("doy")) * gap), this._offsetNumber(this._parseNumber(ep.attr("x")) + this._parseNumber(ep.attr("dox")) * gap), this._offsetNumber(this._parseNumber(ep.attr("y")) + this._parseNumber(ep.attr("doy")) * gap));
                dline.addClass('d' + rsp.attr('acc') + rep.attr('acc'));
                dline.stroke({ color: dlc, width: this._parseNumber(lw), linecap: 'round', linejoin: 'round' });
                dline.attr('sdata', rep.attr("lb") + ',' + rsp.attr("lb") + "," + _dlc);
                if (ismask)
                    dline.addClass('mask');

                var pthis = this;
                uline.mouseover(function (evt) {
                    pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                });
                uline.mouseout(function (evt) {
                    pthis.options.hideLineRealInfo();
                });
                dline.mouseover(function (evt) {
                    pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                });
                dline.mouseout(function (evt) {
                    pthis.options.hideLineRealInfo();
                });

                this.realLayer.add(uline);
                this.realLayer.add(dline);
            }

            if (sp.attr('st') == 'true') {
                if (_ulc != 'green') {
                    var img = null;
                    if (sp.attr('ai') != undefined) {
                        if (sp.attr('ai') == '2')
                            img = this.stage.image($("#arrow2_icon").attr("src"));
                    } else {
                        img = this.stage.image($("#arrow_icon").attr("src"));
                    }
                    img.size(this._parseNumber(9), this._parseNumber(3));
                    img.center(this._offsetNumber((sp.attr("ax") != undefined ? (this._parseNumber(sp.attr("ax"))) : 0) + this._parseNumber(sp.attr("uox")) * gap), this._offsetNumber((sp.attr("ay") != undefined ? this._parseNumber(sp.attr("ay")) : 0) + this._parseNumber(sp.attr("uoy")) * gap));
                    if (sp.attr('aa') != undefined)
                        img.rotate(this._parseNumber(sp.attr('aa')));

                    img.addClass('arrow');
                    img.attr('sdata', rsp.attr("lb") + ',' + rep.attr("lb") + "," + _ulc);
                    if (ismask)
                        img.addClass('mask');

                    var pthis = this;
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });

                    this.realLayer.add(img);
                }

                if (_dlc != 'green') {
                    var img = null;
                    if (sp.attr('ai') != undefined) {
                        if (sp.attr('ai') == '2')
                            img = this.stage.image($("#arrow2_icon").attr("src"));
                    } else {
                        img = this.stage.image($("#arrow_icon").attr("src"));
                    }
                    img.size(this._parseNumber(9), this._parseNumber(3));
                    img.center(this._offsetNumber((sp.attr("ax") != undefined ? (this._parseNumber(sp.attr("ax"))) : 0) + this._parseNumber(sp.attr("dox")) * gap), this._offsetNumber((sp.attr("ay") != undefined ? this._parseNumber(sp.attr("ay")) : 0) + this._parseNumber(sp.attr("doy")) * gap));
                    if (sp.attr('aa') != undefined)
                        img.rotate(this._parseNumber(sp.attr('aa')) + 180);

                    img.addClass('arrow');
                    img.attr('sdata', rep.attr("lb") + ',' + rsp.attr("lb") + "," + _dlc);
                    if (ismask)
                        img.addClass('mask');

                    var pthis = this;
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });

                    this.realLayer.add(img);
                }
            }
        },

        _refreshRealLines: function () {
            var arrows = SVG.select('.arrow');
            for (var i = arrows.length() - 1; i >= 0; i--)
                arrows.get(i).remove();
            arrows.clear();

            var pthis = this;
            $(this.options.xml).find("l").each(function (i) {
                pthis._refreshRealSubwayLine($(this), 0, $(this).find('p').length - 1, true, true, false);
            });

            arrows = SVG.select('.arrow');
            for (var i = arrows.length() - 1; i >= 0; i--)
                arrows.get(i).front();
        },

        _refreshRealSubwayLine: function (linexml, startdn, enddn, dir, isline, ismask) {
            if (dir) {
                if (linexml.attr("loop") == "true" && startdn > enddn) {
                    enddn += linexml.find("p").length;
                }
            } else {
                if (linexml.attr("loop") == "true" && startdn < enddn) {
                    startdn += linexml.find("p").length;
                }

                var t = startdn;
                startdn = enddn;
                enddn = t;
                dir = true;
            }

            for (var i = startdn; i < enddn; i++)
                this._refreshRealStations(linexml, i, i + 1, ismask);

            if (isline && linexml.attr("loop") == "true")
                this._refreshRealStations(linexml, enddn, startdn, ismask);
        },

        _refreshRealStations: function (linexml, startdn, enddn, ismask) {
            var ps = linexml.find("p");
            var rsp = null;
            var rep = null;
            var n = startdn % ps.length;
            rsp = ps.eq(n);
            while (rsp.attr("st") == "false")
                rsp = ps.eq(--n);

            n = enddn % ps.length;
            rep = ps.eq(n);
            while (rep.attr("st") == "false")
                rep = ps.eq(++n);

            this._refreshRealStationLine(ps.eq(startdn % ps.length), ps.eq(enddn % ps.length), rsp, rep, ismask);
        },

        _refreshRealStationLine: function (sp, ep, rsp, rep, ismask) {
            var gap = 2;
            var lw = 3;

            var colors = this._getRealColors(rsp, rep);
            var _ulc = colors["_ulc"];
            var _dlc = colors["_dlc"];
            var ulc = colors["ulc"];
            var dlc = colors["dlc"];

            var uline = SVG.select('.u' + rsp.attr('acc') + rep.attr('acc'));
            uline.stroke(ulc);

            var dline = SVG.select('.d' + rsp.attr('acc') + rep.attr('acc'));
            dline.stroke(dlc);

            if (sp.attr('st') == 'true') {
                if (_ulc != 'green') {
                    var img = null;
                    if (sp.attr('ai') != undefined) {
                        if (sp.attr('ai') == '2')
                            img = this.stage.image($("#arrow2_icon").attr("src"));
                    } else {
                        img = this.stage.image($("#arrow_icon").attr("src"));
                    }
                    img.size(this._parseNumber(9), this._parseNumber(3));
                    img.center(this._offsetNumber((sp.attr("ax") != undefined ? (this._parseNumber(sp.attr("ax"))) : 0) + this._parseNumber(sp.attr("uox")) * gap), this._offsetNumber((sp.attr("ay") != undefined ? this._parseNumber(sp.attr("ay")) : 0) + this._parseNumber(sp.attr("uoy")) * gap));
                    if (sp.attr('aa') != undefined)
                        img.rotate(this._parseNumber(sp.attr('aa')));

                    img.addClass('arrow');
                    img.attr('sdata', rsp.attr("lb") + ',' + rep.attr("lb") + "," + _ulc);
                    if (ismask)
                        img.addClass('mask');

                    var pthis = this;
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });

                    this.realLayer.add(img);
                }

                if (_dlc != 'green') {
                    var img = null;
                    if (sp.attr('ai') != undefined) {
                        if (sp.attr('ai') == '2')
                            img = this.stage.image($("#arrow2_icon").attr("src"));
                    } else {
                        img = this.stage.image($("#arrow_icon").attr("src"));
                    }
                    img.size(this._parseNumber(9), this._parseNumber(3));
                    img.center(this._offsetNumber((sp.attr("ax") != undefined ? (this._parseNumber(sp.attr("ax"))) : 0) + this._parseNumber(sp.attr("dox")) * gap), this._offsetNumber((sp.attr("ay") != undefined ? this._parseNumber(sp.attr("ay")) : 0) + this._parseNumber(sp.attr("doy")) * gap));
                    if (sp.attr('aa') != undefined)
                        img.rotate(this._parseNumber(sp.attr('aa')) + 180);

                    img.addClass('arrow');
                    img.attr('sdata', rep.attr("lb") + ',' + rsp.attr("lb") + "," + _dlc);
                    if (ismask)
                        img.addClass('mask');

                    var pthis = this;
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });
                    img.mouseover(function (evt) {
                        pthis.options.showLineRealInfo(this.attr('sdata'), evt.x, evt.y);
                    });
                    img.mouseout(function (evt) {
                        pthis.options.hideLineRealInfo();
                    });

                    this.realLayer.add(img);
                }
            }
        },

        _getRealDatas: function (pthis) {
            $.ajax({
                url: pthis.options.getRealUrl,
                dataType: 'json',
                type: 'GET',
                timeout: 5000,
                error: function () {
                    pthis.options.realdatas = null;
                    setTimeout(function () { pthis._getRealDatas(pthis); }, 300000);
                },
                success: function (datas) {
                    pthis.options.realdatas = datas;
                    if (pthis.realLayer.visible()) {
                        pthis._refreshRealTime();
                        if (pthis.options.blockdatas != null)
                            pthis._refreshBlock();
                        setTimeout(function () { pthis._getRealDatas(pthis); }, 300000);
                    }
                }
            });
        },

        _getBlockDatas: function (pthis) {
            $.ajax({
                url: pthis.options.getBlockUrl,
                dataType: 'json',
                type: 'GET',
                timeout: 5000,
                error: function () {
                    pthis.options.blockdatas = null;
                    setTimeout(function () { pthis._getBlockDatas(pthis); }, 60000);
                },
                success: function (datas) {
                    pthis.options.blockdatas = datas;
                    pthis._refreshBlock();
                }
            });
        }
    }


    /*兼容ie,ff,chrome*/
 
    var methods = {
        init: function (options) {
            plugin.options = $.extend({}, plugin.defaults, options);
         
            $.ajax({
                // async: false,    
                url: "http://8081.gr002701.23ehgni5.0196bd.grapps.cn/api/list-stations",
                dataType: 'json',
                type: 'GET',
                // timeout: 5000,
                crossDomain: true,
                // dataType: 'jsonp',
                success: function (datas) {
                    console.log("datas", JSON.stringify(datas.data))
                    localStorage.setItem('order', JSON.stringify(datas.data));
                },
                error: function (err) {
                    console.log("err", err)
                },
            });


            $.ajax({
                url: "https://map.bjsubway.com/subwaymap/interchange.xml",
                header: "Access-Control-Allow-Origin:*",
                dataType: 'xml',
                type: 'GET',
                timeout: 5000,
                error: function (xml) {
                    plugin.options.exml = xml
                },
                success: function (xml) {
                    plugin.options.exml = xml;
                }
            });


            $.ajax({
                url: "https://map.bjsubway.com/subwaymap/stations.xml",
                header: "Access-Control-Allow-Origin:*",
                dataType: 'xml',
                type: 'GET',
                timeout: 5000,
                error: function (xml) {
                    plugin.options.sxml = xml;

                    // plugin.options.sxml = null
                },
                success: function (xml) {
                    plugin.options.sxml = xml;
                }
            });

            $.ajax({
                url: "http://8081.gr002701.23ehgni5.0196bd.grapps.cn/subway/beijing.xml",
                header: "Access-Control-Allow-Origin:*",
                dataType: 'xml',
                type: 'GET',
                timeout: 5000,
                error: function (xml) {
                    // plugin.options.xml = null;
                    plugin.options.sxml = xml;
                },
                success: function (xml) {
                    plugin.options.xml = xml;
                    plugin._redraw();
                    plugin._initpos();
                }
            });

            return this.each(function (index) {
                plugin.options = $.meta ? $.extend(plugin.options, $(this).data()) : plugin.options;
                plugin._debug("BEGIN: " + plugin.identity() + " for element " + index);
                plugin._init($(this));
          
                plugin._debug("END: " + plugin.identity() + " for element " + index);
            });
        },

        redraw: function (options) {
            plugin._mapMask(options.exresult);
        },

        showRealResult: function (options) {
            plugin._removeMapMask();
            plugin._mapRealMask(options.exresult);
        },

        hideRealResult: function (options) {
            plugin._removeMapMask();
            plugin._mapMask(options.exresult);
        },

        showRealTime: function (options) {
            plugin._drawRealTime();
        },

        hideRealTime: function (options) {
            plugin._hideRealTime();
        },

        getRealStationInfo: function (params) {
            var acc = params['acc'];
            return plugin._getRealStationColorByAcc(acc);
        },

        getStations: function () {
            var stations = [];

            if (plugin.options.xml == null || plugin.options.sxml == null)
                return stations;

            $(plugin.options.xml).find("l").each(function (i) {
                var ps = $(this).find("p");
                for (var i = 0; i < ps.length; i++) {
                    var s = $.trim(ps.eq(i).attr("lb"));
                    if (s != "" && stations.indexOf(s) == -1)
                        stations.push(s);
                }
            });

            return stations;
        },

        getStationInfo: function (params) {
            var infos = [];
            var station = params['station'];
            var stations = $(plugin.options.sxml).find("s");
            for (var i = 0; i < stations.length; i++) {
                var s = stations.eq(i);
                if (s.attr("name") == station) {
                    infos.push(s.attr("firstend"));
                }
            }

            return infos;
        },

        getStationAcc: function (params) {
            var station = $.trim(params['station']);
            var lines = $(plugin.options.xml).find("l");
            for (var l = 0; l < lines.length; l++) {
                var ps = lines.eq(l).find("p");
                for (var i = 0; i < ps.length; i++) {
                    if ($.trim(ps.eq(i).attr("lb")) == station) {
                        return ps.eq(i).attr("acc");
                    }
                }
            }

            return "";
        },

        getLineId: function (params) {
            var station = $.trim(params['station']);
            var lines = $(plugin.options.xml).find("l");
            for (var l = 0; l < lines.length; l++) {
                var ps = lines.eq(l).find("p");
                for (var i = 0; i < ps.length; i++) {
                    if ($.trim(ps.eq(i).attr("lb")) == station) {
                        return lines.eq(l).attr("lnub");
                    }
                }
            }

            return "";
        },

        getLines: function () {
            var lines = [];

            $(plugin.options.xml).find("l").each(function () {
                lines.push({ 'lnub': $(this).attr('lnub'), 'name': $(this).attr('lb'), 'color': $(this).attr('lc').replace('0x', '#') });
            });

            return lines;
        },

        getLineStations: function (params) {
            var line = params["line"];
            var stations = [];

            if (plugin.options.xml == null || plugin.options.sxml == null)
                return stations;

            var lines = $(plugin.options.xml).find("l");
            for (var i = 0; i < lines.length; i++) {
                if (lines.eq(i).attr("lnub") == line) {
                    var ps = lines.eq(i).find("p");
                    for (var j = 0; j < ps.length; j++) {
                        var s = $.trim(ps.eq(j).attr("lb"));
                        if (s != "" && ps.eq(j).attr("iu") == "true" && stations.indexOf(s) == -1)
                            stations.push(s);
                    }
                    break;
                }
            }

            return stations;
        },

        getLineColor: function (params) {
            var line = params['line'];
            var lines = $(plugin.options.xml).find("l");
            for (var i = 0; i < lines.length; i++) {
                if (lines.eq(i).attr("lb").replace('(东)', '').replace('(西)', '') == line) {
                    return lines.eq(i).attr("lc").replace("0x", "#");
                }
            }

            return "#008E9C";
        },

        getLineColorById: function (params) {
            var line = params['line'];
            var lines = $(plugin.options.xml).find("l");
            for (var i = 0; i < lines.length; i++) {
                if (lines.eq(i).attr("lnub") == line) {
                    return lines.eq(i).attr("lc").replace("0x", "#");
                }
            }

            return "#008E9C";
        },

        getLineNameById: function (params) {
            var line = params['line'];
            var lines = $(plugin.options.xml).find("l");
            for (var i = 0; i < lines.length; i++) {
                if (lines.eq(i).attr("lcode") == line) {
                    return lines.eq(i).attr("lb");
                }
            }

            return "";
        },

        getExchangeTime: function (params) {
            var fl = params['fl'];
            var tl = params['tl'];
            var s = params['s'];
            var exs = $(plugin.options.exml).find("ex");
            for (var e = 0; e < exs.length; e++) {
                var ex = exs.eq(e);
                if (ex.attr("fl") == fl && ex.attr("s") == s && ex.attr("tl") == tl) {
                    return parseInt(ex.attr("t"));
                }
            }

            return 0;
        },

        removeMapMask: function () {
            plugin._removeMapMask();
        },

        highlightLine: function (params) {
            var line = params['line'];
            plugin._highlightLine(line);
        },

        setFromTo: function (params) {
            var ft = params['ft'];
            var station = params['station'];
            plugin._setFromTo(ft, station);
        },

        zoomMap: function (params) {
            var io = params['io'];
            plugin._zoomMap(io);
        },

        fullScreen: function (params) {
            var oo = params['oo'];
            plugin._fullScreen(oo);
        },
    };

    $.fn.subwayMap = function (method) {
        //方法调用逻辑
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.tooltip');
        }
    };

    $.fn.subwayMap = function (method) {
        //方法调用逻辑
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.tooltip');
        }
    };
})(jQuery);

