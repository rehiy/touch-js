/**
 * @author 若海<mail@anrip.com>
 * @github https://github.com/anrip/touchjs
 * @modified 2015-9-23 03:19
 * 
 */

(function() {

    /**
     * 判断是否拥有某个class
     */
    function hasClass(dom, name) {
        return dom.className.match(
            new RegExp('(\\s|^)' + name + '(\\s|$)')
        );
    }

    /**
     * 判断swipe方向
     */
    function swipeDirection(x1, x2, y1, y2) {
        if(Math.abs(x1 - x2) >= Math.abs(y1 - y2)) {
            return x1 - x2 > 0 ? 'left': 'right';
        }
        return y1 - y2 > 0 ? 'up': 'down';
    }

    /**
     * 获取事件坐标
     */
    function eventPostion(src) {
        //判断是否触摸事件
        var touches = src.lastTouches || src.touches;
        if(touches && touches.length > 0) {
            src = touches[0];
        }
        return {
            clientX: src.clientX || 0,
            clientY: src.clientT || 0,
            pageX: src.pageX,
            pageY: src.pageY
        };
    }

    /**
     * 执行绑定的回调函数
     * @param string   事件名
     * @param function 回调函数
     * @param object   指向的element
     * @param object   原生event对象
     */
    function eventCallback(name, fn, d, e) {
        var ep = eventPostion(e);
        //增加交互初始位置及移动距离
        if(name.match(/^swipe/) && e.startPosition) {
            ep.startX = e.startPosition.pageX;
            ep.startY = e.startPosition.pageY;
            ep.moveX = ep.pageX - ep.startX;
            ep.moveY = ep.pageY - ep.startY;
        }
        //增加基础属性
        ep.type = name;
        ep.target = e.target;
        //执行绑定事件的回调，并记录返回值
        var result = fn.call(d, ep);
        if(result !== false) {
            return result;
        }
        //若返回false，阻止浏览器默认事件
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
        if(!e.preventDefault) {//IE内核浏览器
            e.returnValue = false;
            e.cancelBubble = true;
        }
        return false;
    }

    /**
     * Touch基础类
     * 
     */
    var Touch = function(dom) {
        this.target = dom;
        this.events = {};
        this.listen();
    };

    /**
     * 获取触摸事件名称
     */
    var TouchEvent = (function() {
        if('ontouchstart' in window) {
           return ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
        }
        if('onpointerdown' in window) {
           return ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
        }
        if('onMSPointerDown' in window) {
            return TouchEvent = ['MSPointerDown', 'MSPointerMove', 'MSPointerUp', 'MSPointerCancel'];
        }
        return ['mousedown', 'mousemove', 'mouseup', 'mouseout'];
    })();

    /**
     * @method 事件触发器
     * @param string 事件名
     * @param object 原生event对象
     */
    Touch.prototype.trigger = function(name, e) {
        var self = this;

        //事件堆无该事件，结束触发
        if(!self.events[name]) {
            return;
        }

        //记录尚未被执行掉的事件绑定
        var restev = self.events[name];
        var events, classStr, callback, i;

        //从事件源target开始向上冒泡
        var target = e.target;
        while(1) {
            //若没有需要执行的事件，结束冒泡
            if(!restev.length) {
                return;
            }
            //若已经冒泡至顶，检测顶级绑定，结束冒泡
            if(!target || target === self.target) {
                //遍历剩余所有事件绑定
                for(i = 0; i < restev.length; i++) {
                    callback = restev[i]['fn'];
                    classStr = restev[i]['className'];
                    //未指定事件委托，直接执行
                    if(classStr === null) {
                        eventCallback(name, callback, target, e);
                    }
                }
                return;
            }
            //当前需要校验的事件集
            events = restev;
            //置空尚未执行掉的事件集
            restev = [];
            //遍历事件所有绑定
            for(i = 0; i < events.length; i++) {
                callback = events[i]['fn'];
                classStr = events[i]['className'];
                //符合事件委托，执行
                if(hasClass(target, classStr)) {
                    //返回false停止事件冒泡及后续事件，其余继续执行
                    if(eventCallback(name, callback, target, e) === false) {
                        return;
                    }
                } else {
                    //不符合执行条件，压回到尚未执行掉的列表中
                    restev.push(events[i]);
                }
            }
            //向上冒泡
            target = target.parentNode;
        }

    };

    /**
     * 监听原生的事件,主动触发模拟事件
     */
    Touch.prototype.listen = function() {
        var self = this;

        //记录当前事件状态
        var doTouch = 0;
        var doSwipe = 0;
        //轻击开始时间
        var doTouchTime = 0;
        //上一次点击时间
        var endTouchTime = 0;

        //当前坐标位置信息
        var x1, y1, x2, y2;
        //有坐标信息的事件
        var lastEvent = null;

        //轻击事件的延时器
        var tap, longtap;

        //断定为轻击事件
        function emitTap() {
            touchCancel();
            self.trigger('tap', lastEvent);
        }

        //断定为长按事件
        function emitLongtap() {
            touchCancel();
            self.trigger('longtap', lastEvent);
        }

        //断定为两次轻击事件
        function emitDoubletap() {
            touchCancel();
            self.trigger('doubletap', lastEvent);
        }

        //断定为划动事件
        function emitSwipeDirection() {
            var direction = swipeDirection(x1, x2, y1, y2);
            self.trigger('swipe' + direction, lastEvent);
        }

        //单次用户操作结束
        function touchCancel() {
            doTouch = doSwipe = 0;
            clearTimeout(longtap);
            clearTimeout(tap);
        }

        //触摸开始
        function touchStart(e) {
            //缓存事件
            lastEvent = e;
            //事件开始
            doTouch = 2;
            doTouchTime = new Date();
            //初始化坐标
            x1 = eventPostion(e).pageX;
            y1 = eventPostion(e).pageY;
            x2 = y2 = 0;
            //注册长按事件
            clearTimeout(longtap);
            longtap = setTimeout(emitLongtap, 600);
        }

        //手指移动
        function touchMove(e) {
            if(doTouch < 2) {
                return;
            }
            //缓存事件
            lastEvent = e;
            //记录坐标信息
            lastEvent.startPosition = {
                pageX: x1, pageY: y1
            };
            x2 = eventPostion(e).pageX;
            y2 = eventPostion(e).pageY;
            //断定此次事件为移动事件
            if(Math.abs(x1 - x2) > 2 || Math.abs(y1 - y2) > 2) {
                if(doSwipe === 0) {
                    doSwipe = 2;//划动开始
                    clearTimeout(longtap);//放弃长按事件
                    self.trigger('swipestart', e);//开始
                }
                if(doSwipe === 2 && new Date() - doTouchTime > 650) {
                    doSwipe = 1;//划动中
                    emitSwipeDirection();
                }
            }
            //划动中
            if(doSwipe > 0) {
                self.trigger('swipe', e);
            }
        }

        //触摸结束
        function touchEnd(e) {
            if(doTouch < 2) {
                return;
            }
            doTouch = 1;
            //解决touchend不提供touches问题
            e.startPosition = lastEvent.startPosition;
            e.lastTouches = lastEvent.touches;
            lastEvent = e;//缓存事件
            //断定为移动手势
            if(doSwipe > 0) {
                if(doSwipe === 2) {
                    doSwipe = 1;
                    emitSwipeDirection();
                }
                touchCancel();
                self.trigger('swipeend', e);
                return;
            }
            //获取当前时间
            var now = new Date();
            //若未监听doubletap，直接响应tap
            if(!self.events.doubletap || !self.events.doubletap.length) {
                emitTap();
            } else if(now - endTouchTime > 200) {
                tap = setTimeout(emitTap, 190);
            } else {
                emitDoubletap();
            }
            //触发监听函数
            endTouchTime = now;
        }

        /**
         * 对开始手势的监听
         */
        self.target.addEventListener(TouchEvent[3], touchEnd);
        self.target.addEventListener(TouchEvent[2], touchEnd);
        self.target.addEventListener(TouchEvent[1], touchMove);
        self.target.addEventListener(TouchEvent[0], touchStart);

    };

    /**
     * @method 增加事件监听
     * @param string 事件名
     * @param string 事件委托至某个class（可选）
     * @param function 符合条件的事件被触发时需要执行的回调函数 
     **/
    Touch.prototype.on = function(names, fn, x) {

        //捕获可变参数
        var className = null;
        if(typeof(fn) === 'string') {
            className = fn.replace(/^\./, '');
            fn = x;
        }

        //检测callback是否合法,事件名参数是否存在·
        if(names && typeof(fn) === 'function') {
            names = names.split(/\s+/);
            for(var i = 0, name; i < names.length; i++) {
                name = names[i];
                //动态创建事件堆
                if(!this.events[name]) {
                    this.events[name] = [];
                }
                //将事件推入事件堆
                this.events[name].push({
                    className: className,
                    fn: fn
                });
            }
        }

        //提供链式调用的支持
        return this;

    };

    //对外提供接口
    window.touch = function(dom) {
        return new Touch(dom);
    };

})();
