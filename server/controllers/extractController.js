const { analyzeImage } = require('../services/openaiService');

const convertImage = async (req, res) => {
    try {
        const { image, clothingType, checkedSizes } = req.body;

        if (!image) {
            return res.status(400).json({ error: '이미지가 없습니다.' });
        }

        const result = await analyzeImage(image, clothingType, checkedSizes);
        res.json({ success: true, data: result });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};

module.exports = { convertImage };