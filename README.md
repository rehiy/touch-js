#TouchJs是什么

TouchJs是一个面向移动端web开发，兼容PC浏览器，通过监听原生事件模拟手势事件的库。

#支持事件

基本事件
 * singletap：轻击
 * doubletap：双击
 * longtap：长按
 * swipeup：上划
 * swiperight：右划
 * swipedown：下划
 * swipeleft：左划

高级事件
 * swipestart：滑动开始
 * swipe：滑动（阻止浏览器默认事件，滑动过程效果更佳）
 * swipeend：滑动结束

#简单入门

接口提供了链式调用的实现，及事件委托（仅支持class）。

```javascript
touch(document.getElementById('toucher'))
//轻击事件
.on('tap',function(e) {
    console.log(this, e);
})
//长按事件
.on('longtap',function(e) {
    console.log(this, e);
})
//委托轻击事件
.on('tap', '.class', function(e) {
    console.log(this, e);
    return false
});
```

#使用须知

1、目前尚不支持双指操作的事件，此类事件可能会在下次大的更新之后作为补充加入进来。

2、原则上支持手机浏览器、现代浏览器、IE9+，但在PC上使用Mouse事件模拟手势，流畅度较差。

3、事件触发时不阻止浏览器默认事件，若要用于拖动操作，或滑动更为细腻，可在swipe事件中使用“return false”阻止浏览器默认事件！
