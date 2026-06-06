import JX3BOX from "@jx3box/jx3box-common/data/jx3box.json";

const { __imgPath } = JX3BOX;

export const getMapScales = async () => {
    const res = await fetch(`${__imgPath}/map/data/map_scales.json`);
    return await res.json();
};

export const getMapTree = async () => {
    const res = await fetch(`${__imgPath}/map/data/map_tree.json`);
    return await res.json();
};