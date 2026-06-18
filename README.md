# @jx3box/jx3box-map

用于各种需要在地图上展示点位的场合  

## QuickStart

```js
import Jx3boxMap from '@jx3box/jx3box-map/src/components/Map.vue
```

```html
<jx3box-map :map-id="8" :datas="datas"></jx3box-map>
```

```js
export default {
    name: "App",
    components: {
        Jx3boxMap,
    },
    data: () => ({
        datas: [
            {
                x: 9655,
                y: 13231,
                title: "测试",
                content: "测试内容11<br />22",
            },
        ],
    }),
};
```

## props

组件props作用。

### mapId

当前所展示的地图

### datas

在地图上的点位，是一个对象数组。其中的对象的属性如表所示

| 属性名  | 描述             | 必填 | 栗子    | 备注                                           |
| ------- | ---------------- | ---- | ------- | ---------------------------------------------- |
| x       | 坐标x点          | 是   | 114514  |                                                |
| y       | 坐标y点          | 是   | 1919810 |                                                |
| title   | 悬浮框标题       | 否   |         |
| content | 悬浮框显示的内容 | 否   |         |
| focus   | 是否展示这个点   | 否   | true    | Boolean，多个数据focus都为true时只会展示第一个 |

### overview 总览模式

默认情况下，overview为true。  

**当overview为true时：**  
组件会把整个地图缩放以适应容器大小，尝试展示完整的地图与点位。  

**当overview为false时：**  
组件会以地图的原尺寸展示地图，仅展示以特定点位为`中心`的周围一部分点位。  
可以在datas内的对应对象设置focus为true指定中心点位。  
或者给组件传入focus属性，值是要展示的点位在datas内的索引。  
如果不通过任何方式指定要展示的点位会直接取第一个。  

### map-draggable

是否允许用户拖动地图，仅在overview为false时生效。  
此时用户可以通过拖动地图来改变可见区域  
即默认会以focus点为中心，但是用户可以拖动来改变展示的区域  

### point-draggable

是否允许用户移动点位。  
此时用户可以通过拖动点位来改变点位的坐标。  

### map-follow

用户拖拽点位之后是否让地图跟随被拖拽的点居中。

### trim-border

是否移除地图边框。  
西山居的中地图图片是有边框的，默认不展示边框，如果需要展示可以设为`true`

### show-toolbar

是否展示地图控制条，默认不展示。  
地图只有默认子图时，控制条展示当前地图名称；存在多个子图时，控制条展示当前子图名称和当前索引。

### allow-switch-sub

是否允许通过控制条切换子图，默认不允许。  
只有在`show-toolbar`为`true`、当前地图存在多个子图且没有通过`lock-sub-id`锁定子图时，才会展示左右切换按钮。

### auto-switch-sub-by-points

是否允许组件根据传入点位自动推断子图，默认允许。  
如果业务侧会临时隐藏、筛选或清空点位，但不希望当前子图因此改变，可以设为`false`。

## 事件

### map-move

用户拖拽地图之后触发

### point-move

用户拖拽点位之后触发

## 方法

### pointPosition(point) -> {left: ..., bottom: ...}

获得一个坐标（游戏坐标）在当前地图的中地图偏移（像素）

### gamePosition(left, bottom) -> {x: ..., y: ...}

和上面相反

### initInnerOffset(point)

移动inner，使得一个点尽可能居


## slots

允许一些部分的自定义slot。

### title

地图上方的名称部分

### point

地图上的点位元素，默认是一个带popover的小红点，如果需要替换的话需要自己给上popover

#### popover

如果使用默认的point，可以用popover这个slot来替换的默认的popover里的内容  
