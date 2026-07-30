<template>
    <div
        ref="component"
        class="c-map"
        :class="rootClasses"
        role="region"
        :aria-label="resolvedMapLabel"
        :aria-busy="isLoading ? 'true' : 'false'"
    >
        <div ref="wrapper" class="c-map__wrapper" :style="wrapperSize">
            <div v-if="loadError" class="c-map-status c-map-status--error" role="alert">
                <slot name="error" :error="loadError" :retry="retry">
                    <span>{{ mapT("loadError") }}</span>
                    <button class="c-map-status__retry" type="button" @click="retry">
                        {{ mapT("retry") }}
                    </button>
                </slot>
            </div>
            <div v-show="!loadError" class="c-map__inner" :style="innerStyle">
                <img
                    ref="img"
                    class="c-map-img"
                    :src="mapImg"
                    draggable="false"
                    :style="imgStyle"
                    :alt="resolvedMapLabel"
                    @load="handleImageLoad"
                    @error="handleImageError"
                />
                <div class="c-map-title__wrapper" v-if="effectiveOverview && !showToolbar">
                    <slot name="title" v-bind:title="mapName">
                        <div class="c-map-title">{{ mapName }}</div>
                    </slot>
                </div>
                <div
                    v-for="(i, k) in datas"
                    :key="k"
                    class="c-map-point__wrapper"
                    :style="pointStyle(i)"
                    :data-index="k"
                >
                    <slot name="point" v-bind:data="i">
                        <el-popover popper-class="c-map-point__popover" placement="top" width="200" trigger="hover">
                            <slot name="popover" v-bind:data="i">
                                <div>
                                    <div v-if="!effectiveOverview" class="c-map-title">{{ mapName }}</div>
                                    <div>{{ i.title }}</div>
                                    <div v-html="i.content"></div>
                                </div>
                            </slot>
                            <template #reference>
                                <button
                                    class="c-map-point"
                                    type="button"
                                    :aria-label="pointLabel(i)"
                                    @keydown.stop
                                ></button>
                            </template>
                        </el-popover>
                    </slot>
                </div>
            </div>
            <div v-if="showToolbar" class="c-map-toolbar" @mousedown.stop>
                <button
                    v-if="showSubSwitch"
                    class="c-map-toolbar__switch"
                    type="button"
                    :title="mapT('previousSubMap')"
                    :aria-label="mapT('previousSubMap')"
                    @click.stop="switchSubMap(-1)"
                >
                    &lt;
                </button>
                <div class="c-map-toolbar__content">
                    <div class="c-map-toolbar__title">{{ currentSubName }}</div>
                    <div v-if="hasSubMaps" class="c-map-toolbar__meta">{{ currentSubIndex + 1 }} / {{ subMapTotal }}</div>
                </div>
                <button
                    v-if="showSubSwitch"
                    class="c-map-toolbar__switch"
                    type="button"
                    :title="mapT('nextSubMap')"
                    :aria-label="mapT('nextSubMap')"
                    @click.stop="switchSubMap(1)"
                >
                    &gt;
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import jx3boxData from "@jx3box/jx3box-common/data/jx3box.json";
import { getMapScales } from "../service/data";
import { createJx3boxMapTranslator, normalizeJx3boxMapLocale } from "../i18n/messages";

function clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
}

function getTouchDistance(touches) {
    const [a, b] = touches;
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getTouchCenter(touches) {
    const [a, b] = touches;
    return {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
    };
}

export default {
    name: "Jx3boxMap",
    emits: ["resize", "error", "map-move", "point-move", "sub-switch"],
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
        mode: {
            type: String,
            default: "",
            validator: (value) => ["", "overview", "focus", "responsive"].includes(value),
        },
        locale: {
            type: String,
            default: "",
        },
        messages: {
            type: Object,
            default: () => ({}),
        },
        translator: {
            type: Function,
            default: null,
        },
        labels: {
            type: Object,
            default: () => ({}),
        },
        mapLabel: {
            type: String,
            default: "",
        },
        pointLabelKey: {
            type: String,
            default: "title",
        },
        aspectRatio: {
            type: Number,
            default: 1024 / 896,
            validator: (value) => value > 0,
        },
        focus: {
            type: Number,
            default: undefined,
        },
        trimBorder: {
            type: Boolean,
            default: false,
        },
        trimRatio: {
            type: Number,
            default: 0.05,
            validator: (value) => value >= 0 && value < 0.5,
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
        lockSubId: {
            type: Number,
            default: -1,
        },
        showToolbar: {
            type: Boolean,
            default: false,
        },
        allowSwitchSub: {
            type: Boolean,
            default: false,
        },
        autoSwitchSubByPoints: {
            type: Boolean,
            default: true,
        },
        zoomable: {
            type: Boolean,
            default: false,
        },
        wheelZoom: {
            type: Boolean,
            default: false,
        },
    },
    data: () => ({
        outerWidth: 0,
        outerHeight: 0,
        innerLeft: 0,
        innerBottom: 0,

        mapScales: {},
        selectedSubId: null,
        currentZoomScale: 1,
        minZoomScale: 0.5,
        maxZoomScale: 3,
        scaleLoading: true,
        imageLoading: true,
        loadError: null,

        resizeObserver: null,
        resizeFrame: null,
        wrapperWheelHandler: null,
        wrapperMouseDownHandler: null,
        wrapperTouchStartHandler: null,
        wrapperTouchMoveHandler: null,
        wrapperTouchEndHandler: null,
        documentMouseMoveHandler: null,
        documentMouseUpHandler: null,
        touchStore: {},
    }),
    computed: {
        effectiveOverview() {
            if (this.mode) return this.mode !== "focus";
            return this.overview;
        },
        canZoom() {
            // 历史版本中可拖动地图始终支持滚轮/双指缩放，继续保留该交互。
            return this.zoomable || this.mapDraggable;
        },
        normalizedLocale() {
            const hostLocale = this.$?.appContext?.config?.globalProperties?.$i18n?.locale;
            const value = hostLocale && typeof hostLocale === "object" ? hostLocale.value : hostLocale;
            const documentLocale = typeof document === "undefined" ? "" : document.documentElement?.lang;
            return normalizeJx3boxMapLocale(this.locale || value || documentLocale);
        },
        builtInTranslator() {
            return createJx3boxMapTranslator(this.normalizedLocale, this.messages);
        },
        isLoading() {
            return this.scaleLoading || this.imageLoading;
        },
        rootClasses() {
            return [
                `c-map--${this.mode || (this.overview ? "overview" : "focus")}`,
                {
                    "is-loading": this.isLoading,
                    "is-error": Boolean(this.loadError),
                    "is-draggable": this.mapDraggable,
                    "is-zoomable": this.canZoom,
                    "is-trimmed": this.trimBorder && this.effectiveOverview,
                },
            ];
        },
        resolvedMapLabel() {
            if (this.mapLabel) return this.mapLabel;
            if (!this.mapName) return this.mapT("unnamedMap");
            return this.mapT("mapLabel", { name: this.mapName });
        },
        trimSize() {
            return this.trimBorder && this.effectiveOverview ? this.outerWidth * this.trimRatio : 0;
        },
        overviewFullHeight() {
            return this.outerWidth ? this.outerWidth / this.aspectRatio : 0;
        },
        // 内层容器宽高
        innerWidth() {
            return this.effectiveOverview ? this.outerWidth : 1024;
        },
        innerHeight() {
            return this.effectiveOverview ? this.overviewFullHeight : 896;
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
            if (this.centerPoint) {
                return this.centerPoint;
            }
            if (this.focus != undefined) {
                return this.datas[this.focus];
            }
            return this.datas.find((d) => d.focus) ?? this.datas[0] ?? null;
        },
        // 内层容器相对外层容器偏移
        innerStyle() {
            const style = {
                width: this.innerWidth + "px",
                height: this.innerHeight + "px",
            };
            if (this.effectiveOverview) {
                if (this.trimSize) style.bottom = -this.trimSize / 2 + "px";
                return style;
            }

            // 边界条件处理
            const { left, bottom } = this.innerOffsetLimit(this.innerLeft, this.innerBottom);
            return {
                ...style,
                left: left + "px",
                bottom: bottom + "px",
            };
        },
        imgStyle() {
            return {
                transform: `scale(${this.currentZoomScale})`,
                transformOrigin: "left bottom",
            };
        },
        // 地图ID、名称、尺寸、图片等
        subMaps() {
            const scales = this.mapScales[this.mapId];
            if (!scales) return [0];
            return Object.keys(scales)
                .map((sub) => Number(sub))
                .sort((a, b) => a - b);
        },
        subMapTotal() {
            return this.subMaps.length;
        },
        hasSubMaps() {
            return this.subMapTotal > 1;
        },
        currentSubIndex() {
            const index = this.subMaps.indexOf(Number(this.subId));
            return index === -1 ? 0 : index;
        },
        currentSubName() {
            return this.mapName || "";
        },
        showSubSwitch() {
            return this.allowSwitchSub && this.hasSubMaps && this.lockSubId == -1;
        },
        subId() {
            let scales = this.mapScales[this.mapId];
            if (!scales || this.subMaps.length <= 1) return 0;
            if (this.lockSubId != -1) return this.lockSubId;
            if (this.selectedSubId != null && scales[this.selectedSubId]) return this.selectedSubId;
            if (!this.autoSwitchSubByPoints) return 0;
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
        this.loadMapScales();
        this.$nextTick(function () {
            this.bindUpdateSizeListener();
            this.bindDraggerListener();
            this.bindTouchListener();
            this.bindScaleListener();
        });
    },
    watch: {
        mapId() {
            this.selectedSubId = null;
            this.currentZoomScale = 1;
            this.$nextTick(() => {
                this.initInnerOffset(this.focusPoint);
            });
        },
        lockSubId() {
            this.currentZoomScale = 1;
            this.$nextTick(() => {
                this.initInnerOffset(this.focusPoint);
            });
        },
        centerPoint(newVal, oldVal) {
            if (this.isSamePoint(newVal, oldVal)) return;
            this.$nextTick(() => {
                this.initInnerOffset(this.focusPoint);
            });
        },
        datas() {
            if (this.effectiveOverview) return;
            this.$nextTick(() => {
                this.initInnerOffset(this.focusPoint);
            });
        },
        effectiveOverview() {
            this.currentZoomScale = 1;
            this.$nextTick(() => {
                this.initInnerOffset(this.focusPoint);
            });
            this.scheduleSizeUpdate();
        },
        aspectRatio() {
            this.scheduleSizeUpdate();
        },
        trimBorder() {
            this.scheduleSizeUpdate();
        },
        trimRatio() {
            this.scheduleSizeUpdate();
        },
        mapImg() {
            this.imageLoading = true;
            this.loadError = null;
        },
    },
    beforeUnmount() {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        if (this.resizeFrame) {
            cancelAnimationFrame(this.resizeFrame);
            this.resizeFrame = null;
        }

        const wrapper = this.$refs["wrapper"];
        if (wrapper && this.wrapperWheelHandler) {
            wrapper.removeEventListener("wheel", this.wrapperWheelHandler);
        }
        if (wrapper && this.wrapperMouseDownHandler) {
            wrapper.removeEventListener("mousedown", this.wrapperMouseDownHandler);
        }
        if (wrapper && this.wrapperTouchStartHandler) {
            wrapper.removeEventListener("touchstart", this.wrapperTouchStartHandler);
        }
        if (wrapper && this.wrapperTouchMoveHandler) {
            wrapper.removeEventListener("touchmove", this.wrapperTouchMoveHandler);
        }
        if (wrapper && this.wrapperTouchEndHandler) {
            wrapper.removeEventListener("touchend", this.wrapperTouchEndHandler);
            wrapper.removeEventListener("touchcancel", this.wrapperTouchEndHandler);
        }
        if (this.documentMouseMoveHandler) {
            document.removeEventListener("mousemove", this.documentMouseMoveHandler);
        }
        if (this.documentMouseUpHandler) {
            document.removeEventListener("mouseup", this.documentMouseUpHandler);
        }
        window.removeEventListener("resize", this.updateSize);
    },
    methods: {
        mapT(key, params = {}) {
            if (this.labels[key]) return this.labels[key];
            if (this.translator) {
                const translated = this.translator(key, params, this.normalizedLocale);
                if (translated) return translated;
            }
            return this.builtInTranslator(key, params);
        },
        pointLabel(item) {
            const title = item?.[this.pointLabelKey] || this.mapT("unnamedPoint");
            return this.mapT("pointLabel", {
                title,
                x: item?.x ?? "",
                y: item?.y ?? "",
            });
        },
        handleImageLoad() {
            this.imageLoading = false;
            this.loadError = null;
        },
        handleImageError(event) {
            this.imageLoading = false;
            this.loadError = new Error(`Failed to load map image: ${this.mapImg}`);
            this.$emit("error", { type: "image", error: this.loadError, event, src: this.mapImg });
        },
        retry() {
            this.loadError = null;
            this.scaleLoading = true;
            this.imageLoading = true;
            this.loadMapScales();
            const img = this.$refs.img;
            if (img) {
                const src = this.mapImg;
                img.src = "";
                this.$nextTick(() => {
                    img.src = src;
                });
            }
        },
        // 游戏坐标 -> 相对位置
        pointPosition(item) {
            const scale = this.mapScale;
            if (!scale) return { left: 0, bottom: 0 };
            const finalScale = this.currentZoomScale * scale.Scale;
            const Width = scale.Width / finalScale;
            const Height = scale.Height / finalScale;
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
            const finalScale = this.currentZoomScale * scale.Scale;
            const Width = scale.Width / finalScale;
            const Height = scale.Height / finalScale;
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
        isSamePoint(a, b) {
            if (a === b) return true;
            if (!a || !b) return false;
            return a.x === b.x && a.y === b.y && a.z === b.z;
        },
        isPointsInRect(rect) {
            if (!this.datas.length) return false;
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
            if (this.effectiveOverview) return { x: 0, y: 0 };
            if (!this.outerWidth || !this.outerHeight) return { x: 0, y: 0 };

            if (!centerPoint) {
                const limited = this.innerOffsetLimit(
                    (this.outerWidth - this.innerWidth * this.currentZoomScale) / 2,
                    (this.outerHeight - this.innerHeight * this.currentZoomScale) / 2
                );
                this.innerLeft = limited.left;
                this.innerBottom = limited.bottom;
                return limited;
            }

            // 外层容器的中心点
            const outerCenter = {
                x: this.outerWidth / 2,
                y: this.outerHeight / 2,
            };
            // 要展示的点相对内层容器的偏移
            const positionOffset = this.pointPosition(centerPoint);
            const limited = this.innerOffsetLimit(outerCenter.x - positionOffset.left, outerCenter.y - positionOffset.bottom);
            this.innerLeft = limited.left;
            this.innerBottom = limited.bottom;
            return limited;
        },
        // 获取地图尺寸数据
        loadMapScales() {
            this.scaleLoading = true;
            return Promise.resolve()
                .then(() => this.fetchMapScales())
                .then(() => {
                    this.scaleLoading = false;
                    this.loadError = null;
                })
                .catch((error) => {
                    this.scaleLoading = false;
                    this.imageLoading = false;
                    this.loadError = error;
                    this.$emit("error", { type: "scales", error });
                });
        },
        fetchMapScales() {
            return getMapScales().then((data) => {
                this.mapScales = data;
                this.initInnerOffset(this.focusPoint);
                return data;
            });
        },
        // 自适应组件尺寸
        updateSize() {
            const prevWidth = this.outerWidth;
            const prevHeight = this.outerHeight;
            const component = this.$refs["component"];
            const nextWidth = component?.clientWidth || 0;
            if (!nextWidth) return;
            let nextHeight;
            if (this.effectiveOverview) {
                nextHeight = Math.max(nextWidth / this.aspectRatio - nextWidth * (this.trimBorder ? this.trimRatio : 0), 0);
            } else {
                nextHeight = component?.clientHeight || 0;
            }
            if (prevWidth === nextWidth && prevHeight === nextHeight) return;
            this.outerWidth = nextWidth;
            this.outerHeight = nextHeight;
            if (prevWidth !== this.outerWidth || prevHeight !== this.outerHeight) {
                this.initInnerOffset(this.focusPoint);
            }
            this.$emit("resize", [this.outerWidth, this.outerHeight]);
        },
        scheduleSizeUpdate() {
            if (this.resizeFrame) return;
            this.resizeFrame = requestAnimationFrame(() => {
                this.resizeFrame = null;
                this.updateSize();
            });
        },
        bindUpdateSizeListener() {
            const component = this.$refs["component"];
            if (!component) return;
            this.resizeObserver?.disconnect();
            this.resizeObserver = new ResizeObserver(() => {
                this.scheduleSizeUpdate();
            });
            this.resizeObserver.observe(component);
            this.updateSize();
        },
        bindScaleListener() {
            const wrapper = this.$refs["wrapper"];
            if (!wrapper) return;
            this.wrapperWheelHandler = (e) => {
                if (!this.canZoom || (!this.wheelZoom && !this.mapDraggable)) return;
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.08 : 0.92;
                this.zoomAt(this.currentZoomScale * factor, e.clientX, e.clientY);
            };
            wrapper.addEventListener("wheel", this.wrapperWheelHandler, { passive: false });
        },
        zoomAt(scale, clientX, clientY) {
            if (!this.canZoom) return;
            const wrapper = this.$refs["wrapper"];
            if (!wrapper) return;

            const rect = wrapper.getBoundingClientRect();
            const nextScale = clamp(scale, this.minZoomScale, this.maxZoomScale);
            const anchorX = clientX - rect.left;
            const anchorBottom = rect.bottom - clientY;
            const contentX = (anchorX - this.innerLeft) / this.currentZoomScale;
            const contentBottom = (anchorBottom - this.innerBottom) / this.currentZoomScale;
            const limited = this.innerOffsetLimit(
                anchorX - contentX * nextScale,
                anchorBottom - contentBottom * nextScale,
                nextScale
            );

            this.currentZoomScale = nextScale;
            this.innerLeft = limited.left;
            this.innerBottom = limited.bottom;
        },
        bindTouchListener() {
            const wrapper = this.$refs["wrapper"];
            if (!wrapper) return;

            this.wrapperTouchStartHandler = (e) => {
                if (!this.mapDraggable && !this.pointDraggable && !this.canZoom) return;
                if (e.touches.length === 2 && this.canZoom) {
                    e.preventDefault();
                    const center = getTouchCenter(e.touches);
                    this.touchStore = {
                        type: "pinch",
                        distance: getTouchDistance(e.touches),
                        scale: this.currentZoomScale,
                        centerX: center.x,
                        centerY: center.y,
                    };
                    return;
                }

                const touch = e.touches[0];
                if (!touch || !this.mapDraggable) return;
                this.touchStore = {
                    type: "map-move",
                    x: touch.clientX,
                    y: touch.clientY,
                    px: this.innerLeft,
                    py: this.innerBottom,
                };
            };

            this.wrapperTouchMoveHandler = (e) => {
                const store = this.touchStore || {};
                if (!store.type) return;
                e.preventDefault();

                if (store.type === "pinch" && e.touches.length >= 2) {
                    const nextDistance = getTouchDistance(e.touches);
                    if (!store.distance || !nextDistance) return;
                    const center = getTouchCenter(e.touches);
                    this.zoomAt(store.scale * (nextDistance / store.distance), center.x, center.y);
                    return;
                }

                const touch = e.touches[0];
                if (store.type !== "map-move" || !touch) return;
                const dx = touch.clientX - store.x;
                const dy = store.y - touch.clientY;
                const limit = this.innerOffsetLimit(store.px + dx, store.py + dy);
                this.innerLeft = limit.left;
                this.innerBottom = limit.bottom;
            };

            this.wrapperTouchEndHandler = (e) => {
                if (e.touches.length === 1 && this.touchStore?.type === "pinch") {
                    const touch = e.touches[0];
                    this.touchStore = {
                        type: "map-move",
                        x: touch.clientX,
                        y: touch.clientY,
                        px: this.innerLeft,
                        py: this.innerBottom,
                    };
                    return;
                }
                this.touchStore = {};
            };

            wrapper.addEventListener("touchstart", this.wrapperTouchStartHandler, { passive: false });
            wrapper.addEventListener("touchmove", this.wrapperTouchMoveHandler, { passive: false });
            wrapper.addEventListener("touchend", this.wrapperTouchEndHandler);
            wrapper.addEventListener("touchcancel", this.wrapperTouchEndHandler);
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
                e.preventDefault();

                const { clientX, clientY } = e;
                store.dx = clientX - store.x;
                store.dy = store.y - clientY;
                const { left, bottom } = this.innerOffsetLimit(store.px + store.dx, store.py + store.dy);

                this.innerLeft = left;
                this.innerBottom = bottom;
            };
            const pointMoveHandler = (e) => {
                e.preventDefault();
                const { clientX, clientY } = e.type === "touchmove" ? e.touches[0] : e;
                const point = this.datas[store.pointIndex];
                const scale = this.mapScale;
                const finalScale = this.currentZoomScale * scale.Scale;
                store.dx = (clientX - store.x) / finalScale;
                store.dy = (store.y - clientY) / finalScale;
                const { x, y } = this.positionLimit(store.px + store.dx, store.py + store.dy);
                point.x = x;
                point.y = y;
            };
            this.documentMouseMoveHandler = (e) => {
                if (store.type === "map-move") {
                    mapMoveHandler(e);
                } else if (store.type === "point-move") {
                    pointMoveHandler(e);
                }
            };
            this.documentMouseUpHandler = () => {
                document.removeEventListener("mousemove", this.documentMouseMoveHandler);
                document.removeEventListener("mouseup", this.documentMouseUpHandler);

                if (!store.dx && !store.dy) return;
                this.$emit(store.type, store);

                if (this.mapFollow && store.type == "point-move") {
                    this.initInnerOffset(store.point);
                }
            };
            this.wrapperMouseDownHandler = (e) => {
                e.preventDefault();
                const { clientX, clientY } = e.type === "touchmove" ? e.touches[0] : e;

                store = {};
                store.x = clientX;
                store.y = clientY;
                if (targetIsPoint(e)) {
                    // 拖动点
                    if (!this.pointDraggable) return;
                    store.point = this.datas[store.pointIndex];
                    store.type = "point-move";
                    store.px = store.point.x;
                    store.py = store.point.y;

                    document.addEventListener("mousemove", this.documentMouseMoveHandler);
                    document.addEventListener("mouseup", this.documentMouseUpHandler);
                } else {
                    // 拖动地图
                    if (!this.mapDraggable) return;
                    store.type = "map-move";
                    store.px = this.innerLeft;
                    store.py = this.innerBottom;

                    document.addEventListener("mousemove", this.documentMouseMoveHandler);
                    document.addEventListener("mouseup", this.documentMouseUpHandler);
                }
            };
            wrapper.addEventListener("mousedown", this.wrapperMouseDownHandler);
        },
        innerOffsetLimit(left, bottom, scale = this.currentZoomScale) {
            const maxLeft = 40;
            const minLeft = this.outerWidth - this.innerWidth * scale - 40;
            const maxBottom = 40;
            const minBottom = this.outerHeight - this.innerHeight * scale - 40;
            return {
                left: Math.max(Math.min(left, maxLeft), minLeft),
                bottom: Math.max(Math.min(bottom, maxBottom), minBottom),
            };
        },
        positionLimit(x, y) {
            const finalScale = this.currentZoomScale * this.mapScale.Scale;
            const minX = this.mapScale.StartX;
            const maxX = this.mapScale.StartX + this.mapScale.Width / finalScale - 1024;
            const minY = this.mapScale.StartY;
            const maxY = this.mapScale.StartY + this.mapScale.Height / finalScale - 1024;
            return {
                x: Math.max(Math.min(x, maxX), minX),
                y: Math.max(Math.min(y, maxY), minY),
            };
        },
        switchSubMap(step) {
            if (!this.showSubSwitch) return;
            const total = this.subMapTotal;
            const nextIndex = (this.currentSubIndex + step + total) % total;
            this.selectedSubId = this.subMaps[nextIndex];
            this.$emit("sub-switch", this.selectedSubId);
            this.$nextTick(() => {
                this.initInnerOffset(this.focusPoint);
            });
        },
    },
};
</script>

<style lang="less">
@import "../assets/map.less";
</style>
