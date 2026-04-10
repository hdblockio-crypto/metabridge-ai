const analyzeImage = async (imageBase64, clothingType, checkedSizes) => {
    // API 키 준비되면 여기에 GPT Vision 호출 로직 추가
    // 지금은 빈 껍데기만
    return {
        material_main: null,
        material_mix: null,
        color: null,
        origin: null,
        wash: null,
        mfg: null,
        season_tag: null,
        fit_type: null,
        fit: null,
        body_type: null,
        style: null,
        body_comp: null,
        season_feel: null,
        stretch: null,
        size: {}
    };
};

module.exports = { analyzeImage };