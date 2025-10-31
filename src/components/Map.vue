<template>
    <div ref="component" class="c-map">
        <div ref="wrapper" class="c-map__wrapper" :style="wrapperSize">
            <div class="c-map__inner" :style="innerStyle">
                <img refs="img" class="c-map-img" :src="mapImg" draggable="false" />
                <div class="c-map-title__wrapper" v-if="overview">
                    <slot name="title" v-bind:title="mapName">
                        <div class="c-map-title">{{ mapName }}</div>
                    </slot>
                </div>
                <template v-for="(i, k) in datas">
                    <div class="c-map-point__wrapper" :style="pointStyle(i)" :key="k" :data-index="k">
                        <slot name="point" v-bind:data="i">
                            <el-popover popper-class="c-map-point__popover" placement="top" width="200" trigger="hover">
                                <slot name="popover" v-bind:data="i">
                                    <div>
                                        <div v-if="!overview" class="c-map-title">{{ mapName }}</div>
                                        <div>{{ i.title }}</div>
                                        <div v-html="i.content"></div>
                                    </div>
                                </slot>
                                <span slot="reference" class="c-map-point"> </span>
                            </el-popover>
                        </slot>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script>
import jx3boxData from "@jx3box/jx3box-common/data/jx3box.json";
import { getMapScales } from "../service/data";

export default {
    name: "Jx3boxMap",
    props: {
        // 地图ID
        mapId: {
            type: Number,
            default: 1,
        },
        // 点位数据
        datas: {
            type: Array,
            default: () => [],
        },
        overview: {
            type: Boolean,
            default: true,
        },
        focus: {
            type: Number,
            default: undefined,
        },
        trimBorder: {
            type: Boolean,
            default: false,
        },
        mapDraggable: {
            type: Boolean,
            default: false,
        },
        pointDraggable: {
            type: Boolean,
            default: false,
        },
        mapFollow: {
            type: Boolean,
            default: true,
        },
        centerPoint: {
            type: Object,
            default: null,
        },
    },
    data: () => ({
        outerWidth: 0,
        outerHeight: 0,
        innerLeft: 0,
        innerBottom: 0,

        mapScales: {},
    }),
    computed: {
        // 内层容器宽高
        innerWidth() {
            return this.overview ? this.outerWidth : 1024;
        },
        innerHeight() {
            return this.overview ? this.outerHeight : 896;
        },
        // 容器尺寸
        wrapperSize() {
            return {
                width: this.outerWidth + "px",
                height: this.outerHeight + "px",
            };
        },
        // 中心点
        focusPoint() {
            if(this.centerPoint) {
                return this.centerPoint;
            }
            if (this.focus != undefined) {
                return this.datas[this.focus];
            } else {
                return this.datas.find((d) => d.focus) ?? this.datas[0];
            }
        },
        // 内层容器相对外层容器偏移
        innerStyle() {
            const style = {
                width: this.innerWidth + "px",
                height: this.innerHeight + "px",
            };
            if (this.overview) return style;

            // 边界条件处理
            const { left, bottom } = this.offsetLimit(this.innerLeft, this.innerBottom);
            return {
                ...style,
                left: left + "px",
                bottom: bottom + "px",
            };
        },
        // 地图ID、名称、尺寸、图片等
        subId() {
            let scales = this.mapScales[this.mapId];
            if (!scales || Object.keys(scales) <= 1) return 0;
            let _sub = 0;
            let _subScale = 0;
            for (let sub in scales) {
                let rect = {
                    x: scales[sub].StartX,
                    y: scales[sub].StartY,
                    width: scales[sub].Width / scales[sub].Scale,
                    height: scales[sub].Height / scales[sub].Scale,
                };
                if (this.isPointsInRect(rect) && scales[sub].Scale > _subScale) {
                    _sub = sub;
                    _subScale = scales[sub].Scale;
                }
            }
            return _sub;
        },
        mapName() {
            return this.mapScales[this.mapId]?.[this.subId]?.Name;
        },
        mapScale() {
            return this.mapScales[this.mapId]?.[this.subId];
        },
        mapImg() {
            return `${jx3boxData.__imgPath}map/maps/map_${this.mapId}_${this.subId}.png`;
        },
    },
    mounted() {
        this.fetchMapScales();
        this.$nextTick(function () {
            this.bindUpdateSizeListener();
            this.bindDraggerListener();
        });
    },
    beforeDestroy() {
        window.removeEventListener("resize", this.updateSize);
    },
    methods: {
        // 游戏坐标 -> 相对位置
        pointPosition(item) {
            const scale = this.mapScale;
            if (!scale) return { left: 0, bottom: 0 };
            const Width = scale.Width / scale.Scale;
            const Height = scale.Height / scale.Scale;
            const left = ((item.x - scale.StartX) / Width) * this.innerWidth;
            const bottom = ((item.y - scale.StartY) / Height) * this.innerHeight;
            return {
                left,
                bottom,
            };
        },
        // 相对位置 -> 游戏坐标
        gamePosition(left, bottom) {
            const scale = this.mapScale;
            if (!scale) return { x: 0, y: 0 };
            const Width = scale.Width / scale.Scale;
            const Height = scale.Height / scale.Scale;
            const x = (left / this.innerWidth) * Width + scale.StartX;
            const y = (bottom / this.innerHeight) * Height + scale.StartY;
            return {
                x,
                y,
            };
        },
        pointStyle(item) {
            const { left, bottom } = this.pointPosition(item);
            return {
                left: left + "px",
                bottom: bottom + "px",
            };
        },
        isPointsInRect(rect) {
            let points = this.datas.map((p) => {
                return {
                    x: p.x,
                    y: p.y,
                };
            });
            return points.every((p) => {
                return p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
            });
        },
        initInnerOffset(centerPoint) {
            if (this.overview) return { x: 0, y: 0 };
            // 外层容器的中心点
            const outerCenter = {
                x: this.outerWidth / 2,
                y: this.outerHeight / 2,
            };
            // 要展示的点相对内层容器的偏移
            const positionOffset = this.pointPosition(centerPoint);
            this.innerLeft = outerCenter.x - positionOffset.left;
            this.innerBottom = outerCenter.y - positionOffset.bottom;
        },
        // 获取地图尺寸数据
        fetchMapScales() {
            getMapScales().then((data) => {
                this.mapScales = data;
                this.initInnerOffset(this.focusPoint);
            });
        },
        // 自适应组件尺寸
        updateSize() {
            this.outerWidth = this.$refs["component"]?.clientWidth;
            if (!this.outerWidth) return;
            if (this.overview) {
                this.outerHeight = this.outerWidth / (1024 / 896);
            } else {
                this.outerHeight = this.$refs["component"]?.clientHeight;
            }
            this.$emit("resize", [this.outerWidth, this.outerHeight]);
        },
        bindUpdateSizeListener() {
            const component = this.$refs["component"];
            if (!component) return;
            this.updateSize();
            component.addEventListener("resize", this.updateSize);
        },
        // 拖拽事件处理
        bindDraggerListener() {
            if (!this.mapDraggable && !this.pointDraggable) return;
            const wrapper = this.$refs["wrapper"];
            if (!wrapper) return;

            let store = {};
            const targetIsPoint = (e) => {
                let { target } = e;
                while (!target.classList.contains("c-map__wrapper")) {
                    if (target.classList.contains("c-map-point__wrapper")) {
                        store.pointIndex = Number(target.dataset["index"]);
                        return true;
                    }
                    target = target.parentNode;
                }
                return false;
            };
            const mapMoveHandler = (e) => {
                const { clientX, clientY } = e;
                store.dx = clientX - store.x;
                store.dy = store.y - clientY;
                const { left, bottom } = this.offsetLimit(store.px + store.dx, store.py + store.dy);

                this.innerLeft = left;
                this.innerBottom = bottom;
            };
            const pointMoveHandler = (e) => {
                const { clientX, clientY } = e;
                const point = this.datas[store.pointIndex];
                const scale = this.mapScale;
                store.dx = (clientX - store.x) / scale.Scale;
                store.dy = (store.y - clientY) / scale.Scale;
                const { x, y } = this.positionLimit(store.px + store.dx, store.py + store.dy);
                point.x = x;
                point.y = y;
            };
            const clickHandler = (e) => {
                store = {};
                const { clientX, clientY } = e;
                store.x = clientX;
                store.y = clientY;
                if (targetIsPoint(e)) {
                    // 拖动点
                    if (!this.pointDraggable) return;
                    store.point = this.datas[store.pointIndex];
                    store.type = "point-move";
                    store.px = store.point.x;
                    store.py = store.point.y;

                    document.addEventListener("mousemove", pointMoveHandler);
                    document.addEventListener("mouseup", removeListener);
                } else {
                    // 拖动地图
                    if (!this.mapDraggable) return;
                    store.type = "map-move";
                    store.px = this.innerLeft;
                    store.py = this.innerBottom;

                    document.addEventListener("mousemove", mapMoveHandler);
                    document.addEventListener("mouseup", removeListener);
                }
            };
            const removeListener = () => {
                document.removeEventListener("mousemove", mapMoveHandler);
                document.removeEventListener("mousemove", pointMoveHandler);
                document.removeEventListener("mouseup", removeListener);

                if (!store.dx && !store.dy) return;
                this.$emit(store.type, store);

                if (this.mapFollow && store.type == "point-move") {
                    this.initInnerOffset(store.point);
                }
            };
            wrapper.addEventListener("mousedown", clickHandler);
        },
        offsetLimit(left, bottom) {
            const maxLeft = 0;
            const minLeft = this.outerWidth - this.innerWidth;
            const maxBottom = 0;
            const minBottom = this.outerHeight - this.innerHeight;
            return {
                left: Math.max(Math.min(left, maxLeft), minLeft),
                bottom: Math.max(Math.min(bottom, maxBottom), minBottom),
            };
        },
        positionLimit(x, y) {
            const minX = this.mapScale.StartX;
            const maxX = this.mapScale.StartX + this.mapScale.Width / this.mapScale.Scale - 1024;
            const minY = this.mapScale.StartY;
            const maxY = this.mapScale.StartY + this.mapScale.Height / this.mapScale.Scale - 1024;
            return {
                x: Math.max(Math.min(x, maxX), minX),
                y: Math.max(Math.min(y, maxY), minY),
            };
        },
    },
};
</script>

<style lang="less" scoped>
@import "../assets/map.less";
</style>
