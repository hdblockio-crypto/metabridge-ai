const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 이미지 분석 요청을 받는 API (엔드포인트)
app.post('/api/convert', async (req, res) => {
    try {
        const { image } = req.body;

        // OpenAI 키 확인
        if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
        }

        const { OpenAI } = require('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // 여기에 GPT Vision API 호출 로직이 들어갈 자리입니다.
        console.log("이미지 데이터를 받았습니다. 분석을 준비합니다.");

        res.json({
            success: true,
            message: "서버가 이미지를 잘 받았습니다! 곧 GPT 분석 기능을 연결해 볼게요."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 정상 작동 중입니다.`);
});
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api', authRouter);
app.use(express.static('../public'));
