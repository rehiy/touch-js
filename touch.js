/**
 * @author 若海<mail@anrip.com>
 * @github https://github.com/anrip/touchjs
 * @modified 2015-9-23 03:19
 * 
 */

(function() {

    /**
     * 获取触摸事件名称
     */
    var touchEvt = (function() {
        if('ontouchstart' in window) {
           return ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
        }
        if('onpointerdown' in window) {
           return ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
        }
        if('onMSPointerDown' in window) {
            return touchEvt = ['MSPointerDown', 'MSPointerMove', 'MSPointerUp', 'MSPointerCancel'];
        }
        return ['mousedown', 'mousemove', 'mouseup', 'mouseout'];
    })();

    /**
     * 判断是否拥有某个class
     */
    function hasClass(elem, classSingle) {
        return elem.className.match(
            new RegExp('(\\s|^)' + classSingle + '(\\s|$)')
        );
    }

    /**
     * 判断swipe方向
     */
    function swipeDirection(x1, x2, y1, y2) {
        if(Math.abs(x1 - x2) >= Math.abs(y1 - y2)) {
            return x1 - x2 > 0 ? 'Left': 'Right';
        }
        return y1 - y2 > 0 ? 'Up': 'Down';
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
    function eventCallback(name, fn, elem, e) {
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
        var result = fn.call(elem, ep);
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
    function Touch(elem) {
        this.evtList = {};
        this.elem = elem;
        this.listen();
    }

    /**
     * @method 事件触发器
     * @param string 事件名
     * @param object 原生event对象
     */
    Touch.prototype.trigger = function(evtName, e) {
        var self = this;

        //事件堆无该事件，结束触发
        self.evtList = self.evtList || {};
        if(!self.evtList[evtName]) {
            return;
        }

        //记录尚未被执行掉的事件绑定
        var evtRest = self.evtList[evtName];
        var evtList, classStr, callback, i;

        //从事件源target开始向上冒泡
        var target = e.target;
        while(1) {
            //若没有需要执行的事件，结束冒泡
            if(!evtRest.length) {
                return;
            }
            //若已经冒泡至顶，检测顶级绑定，结束冒泡
            if(!target || target === self.elem) {
                //遍历剩余所有事件绑定
                for(i = 0; i < evtRest.length; i++) {
                    callback = evtRest[i]['fn'];
                    classStr = evtRest[i]['className'];
                    //未指定事件委托，直接执行
                    if(classStr === null) {
                        eventCallback(evtName, callback, target, e);
                    }
                }
                return;
            }
            //当前需要校验的事件集
            evtList = evtRest;
            //置空尚未执行掉的事件集
            evtRest = [];
            //遍历事件所有绑定
            for(i = 0; i < evtList.length; i++) {
                callback = evtList[i]['fn'];
                classStr = evtList[i]['className'];
                //符合事件委托，执行
                if(hasClass(target, classStr)) {
                    //返回false停止事件冒泡及后续事件，其余继续执行
                    if(eventCallback(evtName, callback, target, e) === false) {
                        return;
                    }
                } else {
                    //不符合执行条件，压回到尚未执行掉的列表中
                    evtRest.push(evtList[i]);
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
        var tap, longTap;

        //断定事件为轻击事件
        function emitTap() {
            touchCancel();
            self.trigger('tap', lastEvent);
        }

        //断定事件为长按事件
        function emitLongTap() {
            touchCancel();
            self.trigger('longTap', lastEvent);
        }

        //断定事件为两次轻击事件
        function emitDoubleTap() {
            touchCancel();
            self.trigger('doubleTap', lastEvent);
        }

        //单次用户操作结束
        function touchCancel() {
            doTouch = doSwipe = 0;
            clearTimeout(longTap);
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
            clearTimeout(longTap);
            longTap = setTimeout(emitLongTap, 600);
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
                    clearTimeout(longTap);//放弃长按事件
                    self.trigger('swipeStart', e);
                    doSwipe = 1;
                }
            }
            //触发监听函数
            self.trigger('swipe', e);
        }

        //触摸结束
        function touchEnd(e) {
            if(doTouch < 2) {
                return;
            }
            doTouch = 1;
            //缓存事件
            e.startPosition = lastEvent.startPosition;
            e.lastTouches = lastEvent.touches;
            lastEvent = e;
            //断定此次事件为移动手势
            if(doSwipe === 1) {
                touchCancel();//终止触摸
                var direction = swipeDirection(x1, x2, y1, y2);
                self.trigger('swipe' + direction, e);
                self.trigger('swipeEnd', e);
                return;
            }
            //获取当前时间
            var now = new Date();
            //若未监听doubleTap，直接响应tap
            if(!self.evtList.doubleTap || !self.evtList.doubleTap.length) {
                emitTap();
            } else if(now - endTouchTime > 200) {
                tap = setTimeout(emitTap, 190);
            } else {
                emitDoubleTap();
            }
            //触发监听函数
            endTouchTime = now;
        }

        /**
         * 对开始手势的监听
         */
        self.elem.addEventListener(touchEvt[0], touchStart);
        self.elem.addEventListener(touchEvt[1], touchMove);
        self.elem.addEventListener(touchEvt[2], touchEnd);
        self.elem.addEventListener(touchEvt[3], touchEnd);

    };

    /**
     * @method 增加事件监听
     * @param string 事件名
     * @param string 事件委托至某个class（可选）
     * @param function 符合条件的事件被触发时需要执行的回调函数 
     **/
    Touch.prototype.on = function(eventList, fn, x) {

        //捕获可变参数
        var className = null;
        if(typeof(fn) === 'string') {
            className = fn.replace(/^\./, '');
            fn = x;
        }

        //检测callback是否合法,事件名参数是否存在·
        if(eventList && typeof(fn) === 'function') {
            eventList = eventList.split(/\s+/);
            for(var i = 0, evtName; i < eventList.length; i++) {
                evtName = eventList[i];
                //动态创建事件堆
                if(!this.evtList[evtName]) {
                    this.evtList[evtName] = [];
                }
                //将事件推入事件堆
                this.evtList[evtName].push({
                    className: className,
                    fn: fn
                });
            }
        }

        //提供链式调用的支持
        return this;

    };

    //对外提供接口
    window.touch = function(elem) {
        return new Touch(elem);
    };

})();
