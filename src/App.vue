<template>
    <div id="app">
        <jx3box-map
            :map-id="8"
            :datas="datas"
            :overview="false"
            :map-draggable="true"
            :point-draggable="true"
            @map-move="mapMoveHandle"
            @point-move="pointMoveHandle"
            @map-click="mapClickHandle"
        >
        </jx3box-map>
    </div>
</template>

<script>
import Jx3boxMap from "./components/Map.vue";

export default {
    name: "App",
    components: {
        Jx3boxMap,
    },
    methods: {
        mapMoveHandle(e) {
            console.log(e);
        },
        pointMoveHandle(e) {
            console.log(e);
        },
        mapClickHandle(e) {
            console.log(e);
        },
    },
    data: () => ({
        datas: [
            {
                x: 8000,
                y: 13231,
                title: "测试",
                content: "测试内容11<br />22",
            },
            {
                x: 1000,
                y: 13231,
                title: "测试",
                content: "测试内容11<br />22",
            },
        ],
    }),
};
</script>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

#app {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 900px;
    height: 900px;
}

.aaa11212 {
    width: 20px;
    height: 20px;
    background-color: red;
}

.bb1212 {
    width: 10px;
    height: 10px;
    background-color: blue;
}
</style>
