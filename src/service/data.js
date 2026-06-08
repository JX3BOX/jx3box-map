import JX3BOX from "@jx3box/jx3box-common/data/jx3box.json";

const { __imgPath } = JX3BOX;

export const getMapScales = () => {
    return fetch(`${__imgPath}/map/data/map_scales.json`).then((res) => res.json());
};
